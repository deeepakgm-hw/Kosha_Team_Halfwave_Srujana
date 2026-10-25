from typing import List, Optional
from decimal import Decimal
import json
import uuid
from datetime import date as dt_date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import (
    BillCashReceiptCreate,
    BillPaymentHistoryOut,
    BillRepaymentDateUpdate,
    CustomerProfileOut,
    CustomerRegisterCreate,
    ShopOut,
    ShopkeeperBillCreate,
    ShopkeeperFinancialSummaryOut,
    ShopkeeperRepaymentCreate,
    ShopkeeperSummaryOut,
    ShopkeeperTransactionOut,
)
from backend.app.services.customer_service import customer_service, generate_reference
from backend.app.services.razorpay_service import razorpay_service

router = APIRouter()

DEFAULT_SHOP_ID = "shop_apex_01"


@router.get(
    "/customers",
    response_model=List[CustomerProfileOut],
    summary="List Registered Customers",
    description="Lists all customer profiles available for credit billing and payment requests.",
)
def list_shopkeeper_customers(
    search: Optional[str] = Query(None, description="Search by customer name, phone, or ID"),
    db: Session = Depends(get_db),
) -> List[CustomerProfileOut]:
    customer_service.ensure_system_metadata(db)
    from backend.app.db.models import CustomerModel
    query = db.query(CustomerModel)
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            (CustomerModel.display_name.ilike(s)) |
            (CustomerModel.phone.ilike(s)) |
            (CustomerModel.id.ilike(s))
        )
    customers = query.order_by(CustomerModel.display_name.asc()).all()
    return [CustomerProfileOut.model_validate(c) for c in customers]


@router.post(
    "/customers",
    response_model=CustomerProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Customer Profile",
    description="Registers a new customer profile for issuing bills, reusing existing profile if phone number matches.",
)
def register_shopkeeper_customer(
    data: CustomerRegisterCreate,
    db: Session = Depends(get_db),
) -> CustomerProfileOut:
    customer_service.ensure_system_metadata(db)
    from backend.app.db.models import CustomerModel
    clean_phone = data.phone.strip()
    raw_phone = clean_phone.replace("+91", "").replace(" ", "").replace("-", "")

    existing = db.query(CustomerModel).filter(
        (CustomerModel.phone == clean_phone) |
        (CustomerModel.phone.like(f"%{raw_phone}%"))
    ).first()
    if existing:
        existing.display_name = data.display_name.strip()
        if data.email:
            existing.email = data.email.strip()
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return CustomerProfileOut.model_validate(existing)

    new_cust = CustomerModel(
        id=f"cust_{uuid.uuid4().hex[:8]}",
        display_name=data.display_name.strip(),
        phone=clean_phone,
        email=data.email.strip() if data.email else None,
    )
    db.add(new_cust)
    db.commit()
    db.refresh(new_cust)
    return CustomerProfileOut.model_validate(new_cust)


@router.post(
    "/bills",
    response_model=BillPaymentHistoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Customer Bill & Generate Razorpay Request",
    description="Business owner creates a bill with total amount and agreed repayment date, records initial payment if applicable, and generates Razorpay payment request.",
)
def create_shopkeeper_bill(
    data: ShopkeeperBillCreate,
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> BillPaymentHistoryOut:
    shop = customer_service._resolve_shop(shop_id or DEFAULT_SHOP_ID, db)
    customer_service.ensure_system_metadata(db)

    # 1. Resolve or register customer
    from backend.app.db.models import CustomerModel, CreditTransactionModel, RepaymentModel, ActivityEventModel
    cust = None
    if data.new_customer:
        clean_phone = data.new_customer.phone.strip()
        raw_phone = clean_phone.replace("+91", "").replace(" ", "").replace("-", "")
        cust = db.query(CustomerModel).filter(
            (CustomerModel.phone == clean_phone) |
            (CustomerModel.phone.like(f"%{raw_phone}%"))
        ).first()
        if not cust:
            cust = CustomerModel(
                id=f"cust_{uuid.uuid4().hex[:8]}",
                display_name=data.new_customer.display_name.strip(),
                phone=clean_phone,
                email=data.new_customer.email.strip() if data.new_customer.email else None,
            )
            db.add(cust)
            db.flush()
    elif data.customer_id:
        cust = db.query(CustomerModel).filter_by(id=data.customer_id).first()
        if not cust:
            # Also try matching by phone
            cust = db.query(CustomerModel).filter_by(phone=data.customer_id.strip()).first()

    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found or invalid customer details.")

    # 2. Determine initial payment amount & payment method
    paying_now = data.initial_payment_amount if data.initial_payment_amount > 0 else (data.initial_manual_paid or Decimal("0.00"))
    if paying_now > data.total_amount:
        raise HTTPException(status_code=422, detail="Initial payment amount cannot exceed total bill amount.")
    if paying_now < Decimal("0.00"):
        raise HTTPException(status_code=422, detail="Initial payment amount cannot be negative.")

    method = (data.initial_payment_method or "none").lower().strip()

    # 3. Create canonical bill in customer_credit_transactions
    today = dt_date.today()
    ref = generate_reference()

    # Line items serialization
    line_items_json_str = None
    if data.line_items:
        line_items_json_str = json.dumps([item.model_dump(mode="json") for item in data.line_items])

    if method in ("razorpay_upi", "upi") and paying_now > 0:
        # Razorpay UPI: NOT marked paid until server-side verification!
        initial_paid = Decimal("0.00")
        outstanding = data.total_amount
        bill_status = "due_today" if data.agreed_repayment_date == today else "upcoming"
    elif paying_now > 0:
        # Cash / manual downpayment received at counter: marked as verified manual cash receipt
        initial_paid = paying_now
        outstanding = data.total_amount - paying_now
        bill_status = "paid" if outstanding == Decimal("0.00") else ("due_today" if data.agreed_repayment_date == today else "upcoming")
    else:
        initial_paid = Decimal("0.00")
        outstanding = data.total_amount
        bill_status = "due_today" if data.agreed_repayment_date == today else "upcoming"

    bill = CreditTransactionModel(
        id=str(uuid.uuid4()),
        reference=ref,
        customer_id=cust.id,
        shop_id=shop.id,
        description=data.description.strip(),
        purchase_amount=data.total_amount,
        initial_paid_amount=initial_paid,
        outstanding_amount=outstanding,
        transaction_date=today,
        agreed_repayment_date=data.agreed_repayment_date,
        status=bill_status,
        notes=data.notes.strip() if data.notes else None,
        line_items_json=line_items_json_str,
        idempotency_key=data.idempotency_key,
    )
    db.add(bill)
    db.flush()

    # If cash was received immediately, record manual receipt
    if method == "cash" and paying_now > 0:
        rep = RepaymentModel(
            id=str(uuid.uuid4()),
            transaction_id=bill.id,
            amount=paying_now,
            repayment_date=today,
            payment_method="cash",
            payment_status="completed",
            recorded_by="shopkeeper",
            provider_reference=f"CASH-{uuid.uuid4().hex[:6].upper()}",
            notes=data.notes or "Initial cash received at counter",
        )
        db.add(rep)

    # Record activity log
    act_desc = f"Bill {ref} generated for ₹{data.total_amount:,.2f} at {shop.shop_name}."
    if method == "cash" and paying_now > 0:
        act_desc += f" Received ₹{paying_now:,.2f} cash. Balance: ₹{outstanding:,.2f}."
    act = ActivityEventModel(
        customer_id=cust.id,
        transaction_id=bill.id,
        event_type="purchase_recorded",
        title="Customer Bill Generated",
        description=act_desc,
        amount=data.total_amount,
    )
    db.add(act)
    db.commit()
    db.refresh(bill)

    # Broadcast SSE
    try:
        from backend.app.core.events import event_broadcaster
        event_broadcaster.publish("bill_created", {
            "bill_id": bill.id,
            "customer_id": bill.customer_id,
            "shop_id": bill.shop_id,
            "reference": bill.reference,
            "total_amount": float(bill.purchase_amount),
            "outstanding_amount": float(bill.outstanding_amount),
        })
    except Exception:
        pass

    # 4. Generate Razorpay Payment Request if applicable
    if method in ("razorpay_upi", "upi") and paying_now > 0:
        # Request the exact initial amount paying now via UPI
        req_paise = razorpay_service.inr_to_paise(paying_now)
        razorpay_service.create_payment_request(
            bill_id=bill.id,
            amount_paise=req_paise,
            customer_id=cust.id,
            business_id=shop.id,
            db=db,
        )
    elif data.generate_payment_request and bill.outstanding_amount > 0:
        # Request remaining balance
        rem_paise = razorpay_service.inr_to_paise(bill.outstanding_amount)
        razorpay_service.create_payment_request(
            bill_id=bill.id,
            amount_paise=rem_paise,
            customer_id=cust.id,
            business_id=shop.id,
            db=db,
        )

    return razorpay_service.get_bill_payment_history(
        bill_id=bill.id,
        business_id=shop.id,
        db=db,
    )


@router.get(
    "/bills/{bill_id}",
    response_model=BillPaymentHistoryOut,
    summary="Get Specific Customer Bill Details for Business Owner",
    description="Returns detailed digital bill breakdown, line items, and verified payment history.",
)
def get_shopkeeper_bill_detail(
    bill_id: str,
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> BillPaymentHistoryOut:
    shop = customer_service._resolve_shop(shop_id or DEFAULT_SHOP_ID, db)
    return razorpay_service.get_bill_payment_history(bill_id=bill_id, business_id=shop.id, db=db)


@router.patch(
    "/bills/{bill_id}/repayment-date",
    response_model=BillPaymentHistoryOut,
    summary="Update Agreed Repayment Date for a Bill",
    description="Updates the agreed repayment deadline with audit logging and recalibration of overdue status.",
)
def update_bill_repayment_date(
    bill_id: str,
    data: BillRepaymentDateUpdate,
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> BillPaymentHistoryOut:
    from backend.app.db.models import CreditTransactionModel, ActivityEventModel
    shop = customer_service._resolve_shop(shop_id or DEFAULT_SHOP_ID, db)
    bill = db.query(CreditTransactionModel).filter_by(id=bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"Bill '{bill_id}' not found.")

    old_date = bill.agreed_repayment_date
    bill.agreed_repayment_date = data.agreed_repayment_date
    today = dt_date.today()

    if bill.outstanding_amount == Decimal("0.00"):
        bill.status = "paid"
    elif bill.agreed_repayment_date < today:
        bill.status = "overdue"
    elif bill.agreed_repayment_date == today:
        bill.status = "due_today"
    else:
        bill.status = "upcoming"

    db.add(bill)

    # Record audit event
    act = ActivityEventModel(
        customer_id=bill.customer_id,
        transaction_id=bill.id,
        event_type="date_extended",
        title="Repayment Date Updated",
        description=f"Repayment deadline for bill {bill.reference} changed from {old_date} to {data.agreed_repayment_date}. {data.notes or ''}".strip(),
        amount=bill.outstanding_amount,
    )
    db.add(act)
    db.commit()
    db.refresh(bill)

    try:
        from backend.app.core.events import event_broadcaster
        event_broadcaster.publish("repayment_date_updated", {
            "bill_id": bill.id,
            "new_date": str(bill.agreed_repayment_date),
            "status": bill.status,
        })
    except Exception:
        pass

    return razorpay_service.get_bill_payment_history(bill_id=bill.id, business_id=shop.id, db=db)


@router.post(
    "/bills/{bill_id}/cash-receipt",
    response_model=BillPaymentHistoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Authorized Cash Receipt for a Bill",
    description="Records an in-person cash payment at the counter, immediately reducing outstanding balance with an audit trail.",
)
def record_bill_cash_receipt(
    bill_id: str,
    data: BillCashReceiptCreate,
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> BillPaymentHistoryOut:
    from backend.app.db.models import CreditTransactionModel, RepaymentModel, ActivityEventModel
    shop = customer_service._resolve_shop(shop_id or DEFAULT_SHOP_ID, db)
    bill = db.query(CreditTransactionModel).filter_by(id=bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"Bill '{bill_id}' not found.")

    if data.amount <= Decimal("0.00"):
        raise HTTPException(status_code=422, detail="Cash amount must be greater than zero.")

    if data.amount > bill.outstanding_amount:
        raise HTTPException(
            status_code=422,
            detail=f"Cash receipt amount (₹{data.amount}) cannot exceed remaining due of ₹{bill.outstanding_amount}."
        )

    # Check idempotency
    if data.idempotency_key:
        existing = db.query(RepaymentModel).filter_by(idempotency_key=data.idempotency_key).first()
        if existing:
            return razorpay_service.get_bill_payment_history(bill_id=bill.id, business_id=shop.id, db=db)

    today = dt_date.today()
    rep = RepaymentModel(
        id=str(uuid.uuid4()),
        transaction_id=bill.id,
        amount=data.amount,
        repayment_date=today,
        payment_method="cash",
        payment_status="completed",
        recorded_by="shopkeeper",
        provider_reference=f"CASH-{uuid.uuid4().hex[:6].upper()}",
        notes=data.notes or "Manual cash collection recorded at store counter",
        idempotency_key=data.idempotency_key,
    )
    db.add(rep)

    # Deduct from outstanding balance
    new_outstanding = (bill.outstanding_amount - data.amount).quantize(Decimal("0.01"))
    bill.outstanding_amount = new_outstanding

    if new_outstanding == Decimal("0.00"):
        bill.status = "paid"
    else:
        if bill.agreed_repayment_date < today:
            bill.status = "overdue"
        elif bill.agreed_repayment_date == today:
            bill.status = "due_today"
        else:
            bill.status = "upcoming"

    db.add(bill)

    # Activity audit
    act = ActivityEventModel(
        customer_id=bill.customer_id,
        transaction_id=bill.id,
        event_type="cash_payment",
        title="Cash Payment Received",
        description=f"Recorded ₹{data.amount:,.2f} cash receipt for bill {bill.reference}. Remaining balance: ₹{new_outstanding:,.2f}.",
        amount=data.amount,
    )
    db.add(act)
    db.commit()
    db.refresh(bill)

    try:
        from backend.app.core.events import event_broadcaster
        event_broadcaster.publish("payment_verified", {
            "bill_id": bill.id,
            "amount": float(data.amount),
            "new_outstanding": float(new_outstanding),
            "status": bill.status,
            "payment_method": "cash",
        })
    except Exception:
        pass

    return razorpay_service.get_bill_payment_history(bill_id=bill.id, business_id=shop.id, db=db)


@router.get(
    "/bills",
    response_model=List[BillPaymentHistoryOut],
    summary="List Customer Bills for Business Owner",
    description="Lists all customer bills with payment requests, verified Razorpay collections, and remaining balances.",
)
def list_shopkeeper_bills(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    status: Optional[str] = Query(None, description="'all', 'outstanding', 'due_today', 'upcoming', 'overdue', 'paid'"),
    search: Optional[str] = Query(None, description="Search by bill reference, customer name, or description"),
    db: Session = Depends(get_db),
) -> List[BillPaymentHistoryOut]:
    shop = customer_service._resolve_shop(shop_id or DEFAULT_SHOP_ID, db)
    txns = customer_service.get_shopkeeper_transactions(
        shop_id_or_code=shop.id,
        filter_status=status,
        search=search,
        db=db,
    )
    return [
        razorpay_service.get_bill_payment_history(bill_id=t.id, business_id=shop.id, db=db)
        for t in txns
    ]


@router.get(
    "/shop",
    response_model=ShopOut,
    summary="Get Active Shopkeeper Shop Profile",
    description="Returns metadata and verified status for the active shopkeeper merchant profile.",
)
def get_shopkeeper_shop(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopOut:
    return customer_service.get_shopkeeper_shop(shop_id_or_code=shop_id, db=db)


@router.get(
    "/shop/summary",
    response_model=ShopkeeperSummaryOut,
    summary="Get Shopkeeper Receivables Summary",
    description="Calculates live KPI metrics: Total customer receivables, collections today, due in 7 days, overdue balances, and debtor customer counts.",
)
def get_shopkeeper_summary(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopkeeperSummaryOut:
    return customer_service.get_shopkeeper_summary(shop_id_or_code=shop_id or DEFAULT_SHOP_ID, db=db)


@router.get(
    "/financial-summary",
    response_model=ShopkeeperFinancialSummaryOut,
    summary="Get Authoritative Real-Time Financial Summary",
    description="Authoritative backend calculation of all financial metrics: Remaining Customer Dues, Razorpay Verified Collections, Counter Cash Paid, Total Billed Volume, Active Bills, and Settled Bills.",
)
def get_financial_summary(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopkeeperFinancialSummaryOut:
    return customer_service.get_financial_summary(shop_id_or_code=shop_id or DEFAULT_SHOP_ID, db=db)


@router.get(
    "/shop/transactions",
    response_model=List[ShopkeeperTransactionOut],
    summary="List Customer Credit Transactions for Shopkeeper",
    description="Returns filtered transactions scoped strictly to this merchant, including customer contact, payment history, and status.",
)
def get_shopkeeper_transactions(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    status: Optional[str] = Query(None, description="'all', 'outstanding', 'due_today', 'upcoming', 'overdue', 'paid'"),
    search: Optional[str] = Query(None, description="Search by transaction reference or customer name"),
    db: Session = Depends(get_db),
) -> List[ShopkeeperTransactionOut]:
    return customer_service.get_shopkeeper_transactions(
        shop_id_or_code=shop_id or DEFAULT_SHOP_ID,
        filter_status=status,
        search=search,
        db=db,
    )


@router.post(
    "/transactions/{transaction_id}/repayments",
    response_model=ShopkeeperTransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Payment Received Directly at Counter",
    description="Allows shopkeeper to record a customer payment received in cash or external transfer, updating the shared transaction record.",
)
def record_shopkeeper_repayment(
    transaction_id: str,
    data: ShopkeeperRepaymentCreate,
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopkeeperTransactionOut:
    return customer_service.record_shopkeeper_repayment(
        transaction_id=transaction_id,
        shop_id_or_code=shop_id or DEFAULT_SHOP_ID,
        data=data,
        db=db,
    )
