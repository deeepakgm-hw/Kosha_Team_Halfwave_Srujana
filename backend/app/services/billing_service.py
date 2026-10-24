"""
Billing & Payables Service: Handles customer invoice lifecycle, vendor bill tracking,
overpayment prevention, payment logging, and operating expenses.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException, NotFoundException, ValidationError
from backend.app.db.models import (
    BankAccountModel,
    BankTransactionModel,
    BillPaymentModel,
    BusinessModel,
    CustomerInvoiceModel,
    InvoicePaymentModel,
    OperatingExpenseModel,
    VendorBillModel,
)


class BillingService:
    """Service managing accounts receivable, accounts payable, and payment recording."""

    # ==========================
    # Customer Invoices
    # ==========================

    def create_invoice(
        self,
        db: Session,
        business_id: str,
        invoice_number: str,
        customer_name: str,
        issue_date: date,
        due_date: date,
        amount: Decimal,
        customer_id: Optional[str] = None,
        expected_payment_date: Optional[date] = None,
        msmed_eligible: bool = True,
        notes: Optional[str] = None,
    ) -> CustomerInvoiceModel:
        """Creates a new customer invoice without altering cash balances."""
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        if not biz:
            raise NotFoundException(f"Business '{business_id}' does not exist.")

        if amount <= Decimal("0.00"):
            raise ValidationError("Invoice amount must be greater than zero.")

        if due_date < issue_date:
            raise ValidationError("Due date cannot precede invoice issue date.")

        existing = (
            db.query(CustomerInvoiceModel)
            .filter_by(business_id=business_id, invoice_number=invoice_number.strip())
            .first()
        )
        if existing:
            raise AppException(
                status_code=409,
                message=f"Invoice number '{invoice_number}' already exists for this business.",
                code="DUPLICATE_INVOICE_NUMBER",
            )

        invoice = CustomerInvoiceModel(
            business_id=business_id,
            invoice_number=invoice_number.strip(),
            customer_name=customer_name.strip(),
            customer_id=customer_id,
            issue_date=issue_date,
            due_date=due_date,
            expected_payment_date=expected_payment_date or due_date,
            amount=amount,
            paid_amount=Decimal("0.00"),
            status="unpaid",
            msmed_eligible=msmed_eligible,
            notes=notes,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice

    def list_invoices(
        self,
        db: Session,
        business_id: str,
        status_filter: Optional[str] = None,
    ) -> List[CustomerInvoiceModel]:
        """Lists customer invoices for a business."""
        query = db.query(CustomerInvoiceModel).filter_by(business_id=business_id)
        if status_filter:
            query = query.filter_by(status=status_filter.lower())
        return query.order_by(CustomerInvoiceModel.due_date.asc()).all()

    def get_invoice(self, db: Session, invoice_id: str) -> CustomerInvoiceModel:
        inv = db.query(CustomerInvoiceModel).filter_by(id=invoice_id).first()
        if not inv:
            raise NotFoundException(f"Invoice '{invoice_id}' not found.")
        return inv

    def record_invoice_payment(
        self,
        db: Session,
        invoice_id: str,
        amount: Decimal,
        payment_date: date,
        reference: Optional[str] = None,
        bank_transaction_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> InvoicePaymentModel:
        """
        Records a customer payment against an invoice.
        Rejects overpayments to maintain strict accounting integrity.
        Enforces idempotency by checking idempotency_key.
        """
        if idempotency_key:
            existing = (
                db.query(InvoicePaymentModel)
                .filter_by(idempotency_key=idempotency_key)
                .first()
            )
            if existing:
                return existing

        invoice = self.get_invoice(db, invoice_id)

        if invoice.status == "paid":
            raise ValidationError(f"Invoice '{invoice.invoice_number}' is already fully paid.")

        if amount <= Decimal("0.00"):
            raise ValidationError("Payment amount must be greater than zero.")

        outstanding = invoice.amount - invoice.paid_amount
        if amount > outstanding:
            raise ValidationError(
                f"Overpayment rejected. Maximum claimable outstanding balance is ₹{outstanding:,.2f}, received ₹{amount:,.2f}."
            )

        # Check bank transaction match if provided
        if bank_transaction_id:
            txn = (
                db.query(BankTransactionModel)
                .filter_by(id=bank_transaction_id, business_id=invoice.business_id)
                .first()
            )
            if not txn:
                raise NotFoundException(f"Bank transaction '{bank_transaction_id}' not found.")
            txn.is_reconciled = True

        payment = InvoicePaymentModel(
            invoice_id=invoice.id,
            payment_date=payment_date,
            amount=amount,
            bank_transaction_id=bank_transaction_id,
            reference=reference,
            idempotency_key=idempotency_key,
        )
        db.add(payment)

        # Update invoice paid balance & status
        invoice.paid_amount += amount
        if invoice.paid_amount >= invoice.amount:
            invoice.status = "paid"
        else:
            invoice.status = "partially_paid"

        db.commit()
        db.refresh(invoice)
        db.refresh(payment)
        return payment

    # ==========================
    # Vendor Bills
    # ==========================

    def create_bill(
        self,
        db: Session,
        business_id: str,
        bill_number: str,
        vendor_name: str,
        issue_date: date,
        due_date: date,
        amount: Decimal,
        category: str = "vendor",
        priority: str = "normal",
        vendor_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> VendorBillModel:
        """Creates a committed vendor payable."""
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        if not biz:
            raise NotFoundException(f"Business '{business_id}' does not exist.")

        if amount <= Decimal("0.00"):
            raise ValidationError("Bill amount must be greater than zero.")

        if due_date < issue_date:
            raise ValidationError("Due date cannot precede bill issue date.")

        existing = (
            db.query(VendorBillModel)
            .filter_by(business_id=business_id, bill_number=bill_number.strip())
            .first()
        )
        if existing:
            raise AppException(
                status_code=409,
                message=f"Bill number '{bill_number}' already exists for this business.",
                code="DUPLICATE_BILL_NUMBER",
            )

        bill = VendorBillModel(
            business_id=business_id,
            bill_number=bill_number.strip(),
            vendor_name=vendor_name.strip(),
            vendor_id=vendor_id,
            issue_date=issue_date,
            due_date=due_date,
            category=category.lower(),
            amount=amount,
            paid_amount=Decimal("0.00"),
            status="unpaid",
            priority=priority.lower(),
            notes=notes,
        )
        db.add(bill)
        db.commit()
        db.refresh(bill)
        return bill

    def list_bills(
        self,
        db: Session,
        business_id: str,
        status_filter: Optional[str] = None,
    ) -> List[VendorBillModel]:
        query = db.query(VendorBillModel).filter_by(business_id=business_id)
        if status_filter:
            query = query.filter_by(status=status_filter.lower())
        return query.order_by(VendorBillModel.due_date.asc()).all()

    def get_bill(self, db: Session, bill_id: str) -> VendorBillModel:
        bill = db.query(VendorBillModel).filter_by(id=bill_id).first()
        if not bill:
            raise NotFoundException(f"Bill '{bill_id}' not found.")
        return bill

    def record_bill_payment(
        self,
        db: Session,
        bill_id: str,
        amount: Decimal,
        payment_date: date,
        reference: Optional[str] = None,
        bank_transaction_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> BillPaymentModel:
        """Records a payment towards a vendor bill, preventing overpayments and enforcing idempotency."""
        if idempotency_key:
            existing = (
                db.query(BillPaymentModel)
                .filter_by(idempotency_key=idempotency_key)
                .first()
            )
            if existing:
                return existing

        bill = self.get_bill(db, bill_id)

        if bill.status == "paid":
            raise ValidationError(f"Bill '{bill.bill_number}' is already fully paid.")

        if amount <= Decimal("0.00"):
            raise ValidationError("Payment amount must be greater than zero.")

        outstanding = bill.amount - bill.paid_amount
        if amount > outstanding:
            raise ValidationError(
                f"Overpayment rejected. Maximum outstanding payable is ₹{outstanding:,.2f}, attempted ₹{amount:,.2f}."
            )

        if bank_transaction_id:
            txn = (
                db.query(BankTransactionModel)
                .filter_by(id=bank_transaction_id, business_id=bill.business_id)
                .first()
            )
            if not txn:
                raise NotFoundException(f"Bank transaction '{bank_transaction_id}' not found.")
            txn.is_reconciled = True

        payment = BillPaymentModel(
            bill_id=bill.id,
            payment_date=payment_date,
            amount=amount,
            bank_transaction_id=bank_transaction_id,
            reference=reference,
            idempotency_key=idempotency_key,
        )
        db.add(payment)

        bill.paid_amount += amount
        if bill.paid_amount >= bill.amount:
            bill.status = "paid"
        else:
            bill.status = "partially_paid"

        db.commit()
        db.refresh(bill)
        db.refresh(payment)
        return payment

    # ==========================
    # Recurring Operating Expenses
    # ==========================

    def create_operating_expense(
        self,
        db: Session,
        business_id: str,
        title: str,
        category: str,
        amount: Decimal,
        frequency: str = "monthly",
        day_of_month: int = 1,
    ) -> OperatingExpenseModel:
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        if not biz:
            raise NotFoundException(f"Business '{business_id}' does not exist.")

        if amount <= Decimal("0.00"):
            raise ValidationError("Expense amount must be greater than zero.")

        if not (1 <= day_of_month <= 31):
            raise ValidationError("day_of_month must be between 1 and 31.")

        exp = OperatingExpenseModel(
            business_id=business_id,
            title=title.strip(),
            category=category.lower(),
            amount=amount,
            frequency=frequency.lower(),
            day_of_month=day_of_month,
            is_active=True,
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    def list_operating_expenses(self, db: Session, business_id: str) -> List[OperatingExpenseModel]:
        return (
            db.query(OperatingExpenseModel)
            .filter_by(business_id=business_id, is_active=True)
            .order_by(OperatingExpenseModel.day_of_month.asc())
            .all()
        )


billing_service = BillingService()
