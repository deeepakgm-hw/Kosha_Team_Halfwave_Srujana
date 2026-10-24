from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import (
    ActivityEventOut,
    CreditTransactionCreate,
    CreditTransactionOut,
    CustomerDashboardSummary,
    CustomerDuesResponse,
    ReminderItemOut,
    RepaymentCreate,
)
from backend.app.services.customer_service import customer_service

router = APIRouter()

DEFAULT_CUSTOMER_ID = "cust_rahul_01"


@router.get(
    "/dashboard",
    response_model=CustomerDashboardSummary,
    summary="Get Customer Dashboard Overview",
    description="Returns aggregate outstanding dues, upcoming repayments, and recent activity for the customer.",
)
def get_customer_dashboard(
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    db: Session = Depends(get_db),
) -> CustomerDashboardSummary:
    return customer_service.get_dashboard(customer_id=customer_id, db=db)


@router.get(
    "/dues",
    response_model=CustomerDuesResponse,
    summary="List Customer Dues & Credit Purchases",
    description="Returns customer credit purchases with status breakdown and optional filtering.",
)
def get_customer_dues(
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    status: Optional[str] = Query(None, description="'all', 'upcoming', 'due_today', 'overdue', 'paid'"),
    db: Session = Depends(get_db),
) -> CustomerDuesResponse:
    return customer_service.get_dues(customer_id=customer_id, filter_status=status, db=db)


@router.get(
    "/transactions",
    response_model=List[CreditTransactionOut],
    summary="List All Transactions for Customer",
    description="Returns all credit transactions recorded for this customer.",
)
def list_customer_transactions(
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    db: Session = Depends(get_db),
) -> List[CreditTransactionOut]:
    dues = customer_service.get_dues(customer_id=customer_id, filter_status=None, db=db)
    return dues.transactions


@router.get(
    "/transactions/{transaction_id}",
    response_model=CreditTransactionOut,
    summary="Get Credit Transaction Details",
    description="Returns full audit detail and payment history for a specific credit transaction.",
)
def get_transaction_detail(
    transaction_id: str,
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    db: Session = Depends(get_db),
) -> CreditTransactionOut:
    return customer_service.get_transaction(transaction_id=transaction_id, customer_id=customer_id, db=db)


@router.post(
    "/transactions",
    response_model=CreditTransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record New Shop-Credit Purchase",
    description="Validates shop code, records purchase amount and initial down-payment, and sets agreed repayment date.",
)
def create_credit_transaction(
    data: CreditTransactionCreate,
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    db: Session = Depends(get_db),
) -> CreditTransactionOut:
    return customer_service.create_credit_transaction(customer_id=customer_id, data=data, db=db)


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
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    db: Session = Depends(get_db),
) -> CreditTransactionOut:
    return customer_service.record_repayment(
        transaction_id=transaction_id, customer_id=customer_id, data=data, db=db
    )


@router.get(
    "/activity",
    response_model=List[ActivityEventOut],
    summary="List Customer Activity Audit Log",
    description="Returns timeline of credit purchases, partial payments, and cleared balances.",
)
def get_customer_activity(
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[ActivityEventOut]:
    return customer_service.get_activity(customer_id=customer_id, limit=limit, db=db)


@router.get(
    "/reminders",
    response_model=List[ReminderItemOut],
    summary="List Customer Repayment Reminders",
    description="Returns chronological, urgency-sorted repayment reminders based on upcoming, due today, and overdue commitments.",
)
def get_customer_reminders(
    customer_id: str = Query(DEFAULT_CUSTOMER_ID, description="Target customer identifier"),
    db: Session = Depends(get_db),
) -> List[ReminderItemOut]:
    return customer_service.get_reminders(customer_id=customer_id, db=db)
