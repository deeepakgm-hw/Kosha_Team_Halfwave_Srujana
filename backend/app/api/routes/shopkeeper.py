from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import (
    BillPaymentHistoryOut,
    CustomerProfileOut,
    ShopOut,
    ShopkeeperBillCreate,
    ShopkeeperRepaymentCreate,
    ShopkeeperSummaryOut,
    ShopkeeperTransactionOut,
)
from backend.app.services.customer_service import customer_service
from backend.app.services.razorpay_service import razorpay_service

router = APIRouter()

DEFAULT_SHOP_ID = "shop_apex_01"


@router.get(
    "/customers",
    response_model=List[CustomerProfileOut],
    summary="List Registered Customers",
    description="Lists all customer profiles available for credit billing and payment requests.",
)
def list_shopkeeper_customers(db: Session = Depends(get_db)) -> List[CustomerProfileOut]:
    customer_service.ensure_demo_seeds(db)
    from backend.app.db.models import CustomerModel
    customers = db.query(CustomerModel).order_by(CustomerModel.display_name.asc()).all()
    return [CustomerProfileOut.model_validate(c) for c in customers]


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
    customer_service.ensure_demo_seeds(db)

    # 1. Check customer exists
    from backend.app.db.models import CustomerModel
    cust = db.query(CustomerModel).filter_by(id=data.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail=f"Customer '{data.customer_id}' not found.")

    # 2. Financial validation
    if data.initial_manual_paid > data.total_amount:
        raise HTTPException(status_code=422, detail="Initial payment cannot exceed total bill amount.")

    # 3. Create credit transaction / bill
    from backend.app.schemas.customer import CreditTransactionCreate
    txn_out = customer_service.create_credit_transaction(
        customer_id=cust.id,
        data=CreditTransactionCreate(
            shop_code=shop.shop_code,
            description=data.description,
            purchase_amount=data.total_amount,
            amount_paid_now=data.initial_manual_paid,
            agreed_repayment_date=data.agreed_repayment_date,
            idempotency_key=data.idempotency_key,
        ),
        db=db,
    )

    # 4. If requested and balance remains, generate Razorpay request
    if data.generate_payment_request and txn_out.outstanding_amount > 0:
        remaining_paise = razorpay_service.inr_to_paise(txn_out.outstanding_amount)
        razorpay_service.create_payment_request(
            bill_id=txn_out.id,
            amount_paise=remaining_paise,
            customer_id=cust.id,
            business_id=shop.id,
            db=db,
        )

    # 5. Return complete history output
    return razorpay_service.get_bill_payment_history(
        bill_id=txn_out.id,
        business_id=shop.id,
        db=db,
    )


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
