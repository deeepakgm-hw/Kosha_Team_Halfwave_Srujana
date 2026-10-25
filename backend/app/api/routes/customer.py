from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import UserModel
from backend.app.api.deps import get_optional_user
from backend.app.schemas.customer import (
    ActivityEventOut,
    BillPaymentHistoryOut,
    CreditTransactionCreate,
    CreditTransactionOut,
    CustomerDashboardSummary,
    CustomerDuesResponse,
    RazorpayPaymentRequestOut,
    ReminderItemOut,
    RepaymentCreate,
)
from backend.app.services.customer_service import customer_service
from backend.app.services.razorpay_service import razorpay_service

router = APIRouter()

DEFAULT_CUSTOMER_ID = "cust_rahul_01"


def resolve_customer_id(explicit_id: Optional[str], current_user: Optional[UserModel]) -> str:
    """Prioritizes authenticated customer identity; falls back to explicit query param or default."""
    if current_user and current_user.customer_id:
        return current_user.customer_id
    if explicit_id:
        return explicit_id
    return DEFAULT_CUSTOMER_ID


@router.get(
    "/bills",
    response_model=List[BillPaymentHistoryOut],
    summary="List Customer Bills with Razorpay Payment Requests",
    description="Returns all bills belonging to this customer with payment requests, verified payments, and outstanding balances.",
)
def list_customer_bills(
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    status: Optional[str] = Query(None, description="'all', 'upcoming', 'due_today', 'overdue', 'paid'"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[BillPaymentHistoryOut]:
    eff_id = resolve_customer_id(customer_id, current_user)
    dues = customer_service.get_dues(customer_id=eff_id, filter_status=status, db=db)
    return [
        razorpay_service.get_bill_payment_history(bill_id=t.id, customer_id=eff_id, db=db)
        for t in dues.transactions
    ]


@router.get(
    "/bills/{bill_id}",
    response_model=BillPaymentHistoryOut,
    summary="Get Specific Customer Bill Payment Details",
    description="Returns detailed bill breakdown and verified payments, enforcing customer ownership.",
)
def get_customer_bill_detail(
    bill_id: str,
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> BillPaymentHistoryOut:
    eff_id = resolve_customer_id(customer_id, current_user)
    return razorpay_service.get_bill_payment_history(
        bill_id=bill_id, customer_id=eff_id, db=db
    )


@router.post(
    "/bills/{bill_id}/payment-request",
    response_model=RazorpayPaymentRequestOut,
    summary="Initiate UPI Payment for Customer Bill",
    description="Creates or retrieves an active Razorpay payment request for full or partial bill payment.",
)
def create_customer_bill_payment_request(
    bill_id: str,
    partial_amount: Optional[Decimal] = Query(None, gt=0, description="Optional custom partial payment in INR"),
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> RazorpayPaymentRequestOut:
    eff_id = resolve_customer_id(customer_id, current_user)
    amount_paise = None
    if partial_amount is not None:
        amount_paise = razorpay_service.inr_to_paise(partial_amount)

    req = razorpay_service.create_payment_request(
        bill_id=bill_id,
        amount_paise=amount_paise,
        customer_id=eff_id,
        force_new=bool(partial_amount is not None),
        db=db,
    )

    return RazorpayPaymentRequestOut(
        id=req.id,
        bill_id=req.bill_id,
        customer_id=req.customer_id,
        business_id=req.business_id,
        shop_id=req.shop_id,
        amount_paise=req.amount_paise,
        amount_inr=float(razorpay_service.paise_to_inr(req.amount_paise)),
        currency=req.currency,
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_link_id=req.razorpay_payment_link_id,
        razorpay_qr_id=req.razorpay_qr_id,
        upi_qr_payload=req.upi_qr_payload,
        qr_image_url=req.qr_image_url,
        short_url=req.short_url,
        status=req.status,
        failure_reason=req.failure_reason,
        idempotency_key=req.idempotency_key,
        expires_at=req.expires_at,
        created_at=req.created_at,
        is_test_mode=not razorpay_service.is_live_configured(),
        key_id=razorpay_service.get_public_config().key_id,
    )


@router.get(
    "/dashboard",
    response_model=CustomerDashboardSummary,
    summary="Get Customer Dashboard Overview",
    description="Returns aggregate outstanding dues, upcoming repayments, and recent activity for the customer.",
)
def get_customer_dashboard(
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CustomerDashboardSummary:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.get_dashboard(customer_id=eff_id, db=db)


@router.get(
    "/dues",
    response_model=CustomerDuesResponse,
    summary="List Customer Dues & Credit Purchases",
    description="Returns customer credit purchases with status breakdown and optional filtering.",
)
def get_customer_dues(
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    status: Optional[str] = Query(None, description="'all', 'upcoming', 'due_today', 'overdue', 'paid'"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CustomerDuesResponse:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.get_dues(customer_id=eff_id, filter_status=status, db=db)


@router.get(
    "/transactions",
    response_model=List[CreditTransactionOut],
    summary="List All Transactions for Customer",
    description="Returns all credit transactions recorded for this customer.",
)
def list_customer_transactions(
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[CreditTransactionOut]:
    eff_id = resolve_customer_id(customer_id, current_user)
    dues = customer_service.get_dues(customer_id=eff_id, filter_status=None, db=db)
    return dues.transactions


@router.get(
    "/transactions/{transaction_id}",
    response_model=CreditTransactionOut,
    summary="Get Credit Transaction Details",
    description="Returns full audit detail and payment history for a specific credit transaction.",
)
def get_transaction_detail(
    transaction_id: str,
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CreditTransactionOut:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.get_transaction(transaction_id=transaction_id, customer_id=eff_id, db=db)


@router.post(
    "/transactions",
    response_model=CreditTransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record New Shop-Credit Purchase",
    description="Validates shop code, records purchase amount and initial down-payment, and sets agreed repayment date.",
)
def create_credit_transaction(
    data: CreditTransactionCreate,
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CreditTransactionOut:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.create_credit_transaction(customer_id=eff_id, data=data, db=db)


@router.post(
    "/transactions/{transaction_id}/repayments",
    response_model=CreditTransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Repayment",
    description="Records a demo repayment towards an outstanding credit balance and recalculates remaining balance.",
)
def record_repayment(
    transaction_id: str,
    data: RepaymentCreate,
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CreditTransactionOut:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.record_repayment(
        transaction_id=transaction_id, customer_id=eff_id, data=data, db=db
    )


@router.get(
    "/activity",
    response_model=List[ActivityEventOut],
    summary="List Customer Activity Audit Log",
    description="Returns timeline of credit purchases, partial payments, and cleared balances.",
)
def get_customer_activity(
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[ActivityEventOut]:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.get_activity(customer_id=eff_id, limit=limit, db=db)


@router.get(
    "/reminders",
    response_model=List[ReminderItemOut],
    summary="List Customer Repayment Reminders",
    description="Returns chronological, urgency-sorted repayment reminders based on upcoming, due today, and overdue commitments.",
)
def get_customer_reminders(
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[ReminderItemOut]:
    eff_id = resolve_customer_id(customer_id, current_user)
    return customer_service.get_reminders(customer_id=eff_id, db=db)
