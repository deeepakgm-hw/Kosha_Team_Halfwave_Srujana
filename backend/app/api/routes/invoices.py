from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.cashflow import InvoiceCreate, InvoiceOut, InvoicePaymentCreate, InvoicePaymentOut
from backend.app.services.billing_service import billing_service

router = APIRouter()


@router.post(
    "/invoices",
    response_model=InvoiceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Customer Invoice",
    description="Registers an accounts receivable invoice without automatically increasing bank cash.",
)
def create_invoice(
    business_id: str = Query(..., description="Target business identifier"),
    data: InvoiceCreate = ...,
    db: Session = Depends(get_db),
) -> InvoiceOut:
    inv = billing_service.create_invoice(
        db=db,
        business_id=business_id,
        invoice_number=data.invoice_number,
        customer_name=data.customer_name,
        customer_id=data.customer_id,
        issue_date=data.issue_date,
        due_date=data.due_date,
        amount=data.amount,
        expected_payment_date=data.expected_payment_date,
        msmed_eligible=data.msmed_eligible,
        notes=data.notes,
    )
    return InvoiceOut.from_orm_model(inv)


@router.get(
    "/invoices",
    response_model=List[InvoiceOut],
    summary="List Customer Invoices",
    description="Returns invoices for a business with optional status filter (unpaid, partially_paid, paid).",
)
def list_invoices(
    business_id: str = Query(..., description="Target business identifier"),
    status: Optional[str] = Query(None, description="'unpaid', 'partially_paid', or 'paid'"),
    db: Session = Depends(get_db),
) -> List[InvoiceOut]:
    invoices = billing_service.list_invoices(db=db, business_id=business_id, status_filter=status)
    return [InvoiceOut.from_orm_model(inv) for inv in invoices]


@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceOut,
    summary="Get Invoice Details",
)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)) -> InvoiceOut:
    inv = billing_service.get_invoice(db=db, invoice_id=invoice_id)
    return InvoiceOut.from_orm_model(inv)


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=InvoicePaymentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Invoice Payment",
    description="Records a customer payment against an invoice. Rejects overpayments.",
)
def record_invoice_payment(
    invoice_id: str,
    data: InvoicePaymentCreate,
    db: Session = Depends(get_db),
) -> InvoicePaymentOut:
    payment = billing_service.record_invoice_payment(
        db=db,
        invoice_id=invoice_id,
        amount=data.amount,
        payment_date=data.payment_date,
        reference=data.reference,
        bank_transaction_id=data.bank_transaction_id,
        idempotency_key=data.idempotency_key,
    )
    return InvoicePaymentOut(
        id=payment.id,
        invoice_id=payment.invoice_id,
        payment_date=payment.payment_date,
        amount=float(payment.amount),
        reference=payment.reference,
        bank_transaction_id=payment.bank_transaction_id,
        idempotency_key=payment.idempotency_key,
        created_at=payment.created_at,
    )
