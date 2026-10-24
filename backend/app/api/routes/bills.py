from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.cashflow import BillCreate, BillOut, BillPaymentCreate, BillPaymentOut
from backend.app.services.billing_service import billing_service

router = APIRouter()


@router.post(
    "/bills",
    response_model=BillOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Vendor Bill",
    description="Registers an accounts payable obligation with due date and priority category.",
)
def create_bill(
    business_id: str = Query(..., description="Target business identifier"),
    data: BillCreate = ...,
    db: Session = Depends(get_db),
) -> BillOut:
    bill = billing_service.create_bill(
        db=db,
        business_id=business_id,
        bill_number=data.bill_number,
        vendor_name=data.vendor_name,
        vendor_id=data.vendor_id,
        issue_date=data.issue_date,
        due_date=data.due_date,
        category=data.category,
        amount=data.amount,
        priority=data.priority,
        notes=data.notes,
    )
    return BillOut.from_orm_model(bill)


@router.get(
    "/bills",
    response_model=List[BillOut],
    summary="List Vendor Bills",
    description="Returns vendor bills for a business with optional status filter.",
)
def list_bills(
    business_id: str = Query(..., description="Target business identifier"),
    status: Optional[str] = Query(None, description="'unpaid', 'partially_paid', or 'paid'"),
    db: Session = Depends(get_db),
) -> List[BillOut]:
    bills = billing_service.list_bills(db=db, business_id=business_id, status_filter=status)
    return [BillOut.from_orm_model(b) for b in bills]


@router.get(
    "/bills/{bill_id}",
    response_model=BillOut,
    summary="Get Bill Details",
)
def get_bill(bill_id: str, db: Session = Depends(get_db)) -> BillOut:
    bill = billing_service.get_bill(db=db, bill_id=bill_id)
    return BillOut.from_orm_model(bill)


@router.post(
    "/bills/{bill_id}/payments",
    response_model=BillPaymentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Bill Payment",
    description="Records an outgoing payment against a vendor bill. Rejects overpayments.",
)
def record_bill_payment(
    bill_id: str,
    data: BillPaymentCreate,
    db: Session = Depends(get_db),
) -> BillPaymentOut:
    payment = billing_service.record_bill_payment(
        db=db,
        bill_id=bill_id,
        amount=data.amount,
        payment_date=data.payment_date,
        reference=data.reference,
        bank_transaction_id=data.bank_transaction_id,
    )
    return BillPaymentOut(
        id=payment.id,
        bill_id=payment.bill_id,
        payment_date=payment.payment_date,
        amount=float(payment.amount),
        reference=payment.reference,
        bank_transaction_id=payment.bank_transaction_id,
        created_at=payment.created_at,
    )
