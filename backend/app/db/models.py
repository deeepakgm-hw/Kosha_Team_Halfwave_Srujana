"""
SQLAlchemy ORM models for persistent, decimal-safe financial records.
Implements Business, Bank Account, Import Batch, Transaction, Invoice, Bill, and Recurring Operating Expenses.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class BusinessModel(Base):
    """Business entity profile and currency setup."""

    __tablename__ = "businesses"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    legal_name = Column(String(200), nullable=False)
    trade_name = Column(String(200), nullable=False)
    industry = Column(String(100), nullable=False)
    msme_category = Column(String(50), default="Small")
    currency = Column(String(10), default="INR")
    registration_number = Column(String(100), nullable=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    bank_accounts = relationship("BankAccountModel", back_populates="business", cascade="all, delete-orphan")
    transactions = relationship("BankTransactionModel", back_populates="business", cascade="all, delete-orphan")
    invoices = relationship("CustomerInvoiceModel", back_populates="business", cascade="all, delete-orphan")
    bills = relationship("VendorBillModel", back_populates="business", cascade="all, delete-orphan")
    operating_expenses = relationship("OperatingExpenseModel", back_populates="business", cascade="all, delete-orphan")
    import_batches = relationship("ImportBatchModel", back_populates="business", cascade="all, delete-orphan")


class BankAccountModel(Base):
    """Bank account with opening balance and verification state."""

    __tablename__ = "bank_accounts"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    bank_name = Column(String(100), nullable=False)
    account_number_mask = Column(String(30), nullable=False)
    currency = Column(String(10), default="INR")
    opening_balance = Column(Numeric(15, 2, asdecimal=True), nullable=False, default=0.00)
    opening_balance_date = Column(Date, nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    business = relationship("BusinessModel", back_populates="bank_accounts")
    transactions = relationship("BankTransactionModel", back_populates="bank_account")
    import_batches = relationship("ImportBatchModel", back_populates="bank_account")


class ImportBatchModel(Base):
    """Log of transaction CSV imports for auditability, reconciliation, and idempotency."""

    __tablename__ = "import_batches"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    bank_account_id = Column(String(50), ForeignKey("bank_accounts.id"), nullable=True)
    source_filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)  # SHA256 of file contents
    imported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    total_rows = Column(Integer, default=0)
    accepted_rows = Column(Integer, default=0)
    rejected_rows = Column(Integer, default=0)
    duplicate_rows = Column(Integer, default=0)
    statement_start_date = Column(Date, nullable=True)
    statement_end_date = Column(Date, nullable=True)
    total_credit_amount = Column(Numeric(15, 2, asdecimal=True), default=0.00)
    total_debit_amount = Column(Numeric(15, 2, asdecimal=True), default=0.00)
    net_movement = Column(Numeric(15, 2, asdecimal=True), default=0.00)
    reconciliation_status = Column(String(30), default="unverified")  # unverified, reconciled, discrepancy

    business = relationship("BusinessModel", back_populates="import_batches")
    bank_account = relationship("BankAccountModel", back_populates="import_batches")
    transactions = relationship("BankTransactionModel", back_populates="import_batch")


class BankTransactionModel(Base):
    """Imported, reconciled settled bank transaction."""

    __tablename__ = "bank_transactions"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    bank_account_id = Column(String(50), ForeignKey("bank_accounts.id"), nullable=True, index=True)
    import_batch_id = Column(String(50), ForeignKey("import_batches.id"), nullable=True, index=True)
    transaction_date = Column(Date, nullable=False, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)  # Signed: positive = credit, negative = debit
    transaction_type = Column(String(10), nullable=False)  # credit or debit
    external_reference = Column(String(100), nullable=True, index=True)
    fingerprint = Column(String(64), nullable=False, index=True)  # SHA256 fingerprint for deduplication
    is_reconciled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    business = relationship("BusinessModel", back_populates="transactions")
    bank_account = relationship("BankAccountModel", back_populates="transactions")
    import_batch = relationship("ImportBatchModel", back_populates="transactions")

    __table_args__ = (
        Index("idx_txn_biz_date", "business_id", "transaction_date"),
        Index("idx_txn_biz_fingerprint", "business_id", "fingerprint"),
    )


class CustomerInvoiceModel(Base):
    """Customer accounts receivable invoice."""

    __tablename__ = "customer_invoices"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    invoice_number = Column(String(100), nullable=False)
    customer_name = Column(String(200), nullable=False)
    customer_id = Column(String(100), nullable=True)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    expected_payment_date = Column(Date, nullable=True, index=True)
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    paid_amount = Column(Numeric(15, 2, asdecimal=True), nullable=False, default=0.00)
    status = Column(String(20), nullable=False, default="unpaid")  # unpaid, partially_paid, paid, cancelled
    msmed_eligible = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    business = relationship("BusinessModel", back_populates="invoices")
    payments = relationship("InvoicePaymentModel", back_populates="invoice", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_inv_biz_num", "business_id", "invoice_number", unique=True),
        Index("idx_inv_biz_status", "business_id", "status"),
    )


class InvoicePaymentModel(Base):
    """Recorded payment towards a customer invoice."""

    __tablename__ = "invoice_payments"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(50), ForeignKey("customer_invoices.id"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    bank_transaction_id = Column(String(50), ForeignKey("bank_transactions.id"), nullable=True)
    reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    invoice = relationship("CustomerInvoiceModel", back_populates="payments")
    bank_transaction = relationship("BankTransactionModel")


class VendorBillModel(Base):
    """Vendor accounts payable bill or committed outgoing debt."""

    __tablename__ = "vendor_bills"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    bill_number = Column(String(100), nullable=False)
    vendor_name = Column(String(200), nullable=False)
    vendor_id = Column(String(100), nullable=True)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    category = Column(String(50), default="vendor")  # vendor, rent, payroll, tax, emi, utility
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    paid_amount = Column(Numeric(15, 2, asdecimal=True), nullable=False, default=0.00)
    status = Column(String(20), nullable=False, default="unpaid")  # unpaid, partially_paid, paid, cancelled
    priority = Column(String(20), default="normal")  # critical, normal, flexible
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    business = relationship("BusinessModel", back_populates="bills")
    payments = relationship("BillPaymentModel", back_populates="bill", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_bill_biz_num", "business_id", "bill_number", unique=True),
        Index("idx_bill_biz_status", "business_id", "status"),
    )


class BillPaymentModel(Base):
    """Recorded payment towards a vendor bill."""

    __tablename__ = "bill_payments"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    bill_id = Column(String(50), ForeignKey("vendor_bills.id"), nullable=False, index=True)
    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    bank_transaction_id = Column(String(50), ForeignKey("bank_transactions.id"), nullable=True)
    reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    bill = relationship("VendorBillModel", back_populates="payments")
    bank_transaction = relationship("BankTransactionModel")


class OperatingExpenseModel(Base):
    """Recurring operational commitment (payroll, monthly shed rent, advance tax)."""

    __tablename__ = "operating_expenses"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # payroll, rent, statutory, emi, utility
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    frequency = Column(String(20), default="monthly")  # monthly, quarterly
    day_of_month = Column(Integer, default=1)  # Day 1-31 when obligation falls due
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    business = relationship("BusinessModel", back_populates="operating_expenses")
