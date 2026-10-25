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
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
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
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
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


class ShopModel(Base):
    """Participating merchant shop for credit purchases."""

    __tablename__ = "shops"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    shop_name = Column(String(200), nullable=False)
    shop_code = Column(String(50), nullable=False, unique=True, index=True)
    category = Column(String(100), default="General Store")
    owner_name = Column(String(100), default="Authorized Merchant")
    phone = Column(String(20), nullable=True)
    upi_id = Column(String(100), nullable=True)
    qr_payload = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=True)
    status = Column(String(20), default="active")  # active, inactive
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    transactions = relationship("CreditTransactionModel", back_populates="shop", cascade="all, delete-orphan")


class CustomerModel(Base):
    """Customer profile for tracking shop credits and repayment obligations."""

    __tablename__ = "customers"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    display_name = Column(String(200), nullable=False, default="Rahul Sharma")
    phone = Column(String(20), nullable=False, default="+91 98765 43210")
    email = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    transactions = relationship("CreditTransactionModel", back_populates="customer", cascade="all, delete-orphan")
    activities = relationship("ActivityEventModel", back_populates="customer", cascade="all, delete-orphan")


class CreditTransactionModel(Base):
    """Customer credit transaction at a participating shop with repayment tracking."""

    __tablename__ = "customer_credit_transactions"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    reference = Column(String(50), nullable=False, unique=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    shop_id = Column(String(50), ForeignKey("shops.id"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    purchase_amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    initial_paid_amount = Column(Numeric(15, 2, asdecimal=True), nullable=False, default=0.00)
    outstanding_amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    transaction_date = Column(Date, nullable=False, index=True)
    agreed_repayment_date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="upcoming", index=True)  # upcoming, due_today, overdue, paid
    notes = Column(Text, nullable=True)
    line_items_json = Column(Text, nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer = relationship("CustomerModel", back_populates="transactions")
    shop = relationship("ShopModel", back_populates="transactions")
    repayments = relationship("RepaymentModel", back_populates="transaction", cascade="all, delete-orphan")
    payment_requests = relationship("PaymentRequestModel", back_populates="bill", cascade="all, delete-orphan")
    payment_verifications = relationship("PaymentVerificationModel", back_populates="bill", cascade="all, delete-orphan")
    autopay_mandates = relationship("AutopayMandateModel", back_populates="bill", cascade="all, delete-orphan")
    autopay_attempts = relationship("AutopayAttemptModel", back_populates="bill", cascade="all, delete-orphan")


class RepaymentModel(Base):
    """Recorded repayment towards a credit transaction."""

    __tablename__ = "customer_repayments"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    transaction_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=False, index=True)
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    repayment_date = Column(Date, nullable=False)
    payment_method = Column(String(50), default="demo_upi")  # demo_upi, demo_cash, demo_netbanking
    payment_status = Column(String(20), default="completed")  # completed, failed, pending
    recorded_by = Column(String(50), default="customer")  # customer, shopkeeper
    provider_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    transaction = relationship("CreditTransactionModel", back_populates="repayments")


class ActivityEventModel(Base):
    """Audit activity event for customer actions and repayment reminders."""

    __tablename__ = "customer_activities"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    transaction_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=True)
    event_type = Column(String(50), nullable=False)  # purchase_recorded, partial_payment, repayment_completed, reminder
    title = Column(String(200), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    customer = relationship("CustomerModel", back_populates="activities")


class PaymentAttemptModel(Base):
    """Tracked digital payment initiation for idempotency and gateway reconciliation."""

    __tablename__ = "payment_attempts"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    order_id = Column(String(100), unique=True, nullable=False, index=True)
    customer_id = Column(String(50), nullable=True, index=True)
    business_id = Column(String(50), nullable=True, index=True)
    shop_id = Column(String(50), nullable=True, index=True)
    target_id = Column(String(50), nullable=False, index=True)  # credit transaction or invoice ID
    target_type = Column(String(50), nullable=False, default="credit_transaction")  # credit_transaction, customer_invoice
    amount = Column(Numeric(15, 2, asdecimal=True), nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(30), default="created", index=True)  # created, pending, succeeded, failed, cancelled
    gateway_provider = Column(String(50), default="KOSHA_SANDBOX")
    provider_payment_id = Column(String(100), nullable=True)
    signature = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class WebhookEventModel(Base):
    """Idempotency log of external payment gateway webhooks."""

    __tablename__ = "webhook_events"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    event_id = Column(String(100), unique=True, nullable=False, index=True)
    provider = Column(String(50), default="KOSHA_SANDBOX")
    event_type = Column(String(100), nullable=False)
    payload_json = Column(Text, nullable=True)
    status = Column(String(30), default="processed")  # processed, ignored, failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NotificationModel(Base):
    """Persistent, deduplicated notifications and repayment reminders."""

    __tablename__ = "notifications"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    notification_key = Column(String(150), unique=True, nullable=False, index=True)  # e.g. remind:ctx_01:2026-10-24:due_today
    recipient_type = Column(String(30), nullable=False, index=True)  # customer, merchant, business
    recipient_id = Column(String(50), nullable=False, index=True)
    channel = Column(String(30), default="in_app")  # in_app, sms, email
    title = Column(String(200), nullable=False)
    message = Column(String(255), nullable=False)
    urgency = Column(String(30), default="info", index=True)  # info, upcoming, due_today, overdue, payment_confirmed
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PaymentRequestModel(Base):
    """
    Razorpay digital payment request for an authorized bill.
    Supports UPI QR codes, Razorpay Standard Checkout Orders, and Payment Links.
    """
    __tablename__ = "payment_requests"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    bill_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=False, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    business_id = Column(String(50), nullable=False, index=True)
    shop_id = Column(String(50), ForeignKey("shops.id"), nullable=True, index=True)

    # Financial amount in precise integer paise
    amount_paise = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)

    # Razorpay Gateway Identifiers
    razorpay_order_id = Column(String(100), nullable=True, index=True)
    razorpay_payment_link_id = Column(String(100), nullable=True, index=True)
    razorpay_qr_id = Column(String(100), nullable=True, index=True)

    # UPI & Checkout Payloads
    upi_qr_payload = Column(Text, nullable=True)  # e.g. upi://pay?pa=...
    qr_image_url = Column(Text, nullable=True)
    short_url = Column(Text, nullable=True)  # Razorpay checkout / payment link URL

    # Lifecycle State
    status = Column(String(30), default="active", index=True)  # active, pending_verification, partially_paid, paid, failed, expired, cancelled
    failure_reason = Column(Text, nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    bill = relationship("CreditTransactionModel", back_populates="payment_requests")
    customer = relationship("CustomerModel")
    shop = relationship("ShopModel")
    verifications = relationship("PaymentVerificationModel", back_populates="payment_request", cascade="all, delete-orphan")


class PaymentVerificationModel(Base):
    """
    Authoritative record of verified Razorpay payment collections.
    Guarantees idempotency via razorpay_payment_id uniqueness.
    """
    __tablename__ = "payment_verifications"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    payment_request_id = Column(String(50), ForeignKey("payment_requests.id"), nullable=True, index=True)
    bill_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=False, index=True)
    customer_id = Column(String(50), nullable=False, index=True)
    business_id = Column(String(50), nullable=False, index=True)

    razorpay_payment_id = Column(String(100), unique=True, nullable=False, index=True)
    razorpay_order_id = Column(String(100), nullable=True, index=True)

    amount_paise = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)

    payment_method = Column(String(50), default="upi")
    vpa = Column(String(100), nullable=True)
    status = Column(String(30), default="captured", index=True)  # captured, failed
    verification_source = Column(String(30), default="webhook")  # webhook or server_verify

    signature = Column(String(255), nullable=True)
    excess_credit_paise = Column(Integer, default=0)
    raw_response_json = Column(Text, nullable=True)

    verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    payment_request = relationship("PaymentRequestModel", back_populates="verifications")
    bill = relationship("CreditTransactionModel", back_populates="payment_verifications")


# =============================================================================
# Authentication & Identity Models
# =============================================================================

class UserModel(Base):
    """
    Authenticated application user for Customer and Business Owner roles.
    Authenticates via secure bcrypt-hashed password or verified Google Identity.
    """
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for Google OAuth users
    full_name = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False, default="customer")  # "customer" or "business_owner"
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    google_sub = Column(String(255), unique=True, nullable=True, index=True)

    # Scoped entity references for authoritative data isolation
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=True, index=True)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=True, index=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer = relationship("CustomerModel", foreign_keys=[customer_id])
    business = relationship("BusinessModel", foreign_keys=[business_id])
    sessions = relationship("AuthSessionModel", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetTokenModel", back_populates="user", cascade="all, delete-orphan")


class AuthSessionModel(Base):
    """Active authenticated session tracking for server-side revocation and validation."""
    __tablename__ = "auth_sessions"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("UserModel", back_populates="sessions")


class PasswordResetTokenModel(Base):
    """Cryptographic single-use, time-limited password reset tokens."""
    __tablename__ = "password_reset_tokens"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("UserModel", back_populates="password_reset_tokens")


# =============================================================================
# Production AutoPay & Mandate Models
# =============================================================================

class AutopayMandateModel(Base):
    """
    Authoritative record of a customer-authorized recurring payment mandate (e.g. UPI AutoPay).
    Lifecycle states:
    - pending_authorization: Registered in system, awaiting customer authorization at provider.
    - active: Provider confirmation verified; eligible for future overdue debit.
    - paused: Temporarily paused by customer or merchant.
    - revoked: Explicitly revoked by customer (permanent).
    - cancelled: Cancelled due to full manual bill settlement or shop void.
    - expired: Passed validity period.
    - failed: Authorization rejected or failed at provider.
    """
    __tablename__ = "autopay_mandates"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    shop_id = Column(String(50), ForeignKey("shops.id"), nullable=True, index=True)
    bill_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=False, index=True)

    razorpay_customer_id = Column(String(100), nullable=True, index=True)
    razorpay_order_id = Column(String(100), nullable=True, index=True)
    razorpay_token_id = Column(String(100), nullable=True, index=True)
    razorpay_mandate_id = Column(String(100), nullable=True, index=True)

    mandate_type = Column(String(50), default="upi_autopay", nullable=False)  # upi_autopay, emandate, card
    amount_type = Column(String(20), default="variable", nullable=False)      # variable, fixed
    max_amount_paise = Column(Integer, nullable=False)                        # Maximum authorized limit in paise
    currency = Column(String(10), default="INR", nullable=False)
    frequency = Column(String(50), default="as_presented", nullable=False)

    status = Column(String(30), default="pending_authorization", nullable=False, index=True)

    effective_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)

    consent_timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    terms_version = Column(String(50), default="v1.0-2026", nullable=False)
    collection_condition = Column(
        String(255),
        default="Authorized collection attempted only after agreed repayment deadline if balance remains unpaid",
        nullable=False,
    )

    razorpay_auth_reference = Column(String(100), nullable=True)
    failure_code = Column(String(100), nullable=True)
    failure_reason = Column(Text, nullable=True)
    revocation_timestamp = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    bill = relationship("CreditTransactionModel", back_populates="autopay_mandates")
    customer = relationship("CustomerModel")
    business = relationship("BusinessModel")
    attempts = relationship("AutopayAttemptModel", back_populates="mandate", cascade="all, delete-orphan")
    audit_logs = relationship("ConsentAuditModel", back_populates="mandate", cascade="all, delete-orphan")


class AutopayAttemptModel(Base):
    """
    Immutable ledger entry for each collection attempt executed against an active mandate.
    """
    __tablename__ = "autopay_attempts"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    mandate_id = Column(String(50), ForeignKey("autopay_mandates.id"), nullable=False, index=True)
    bill_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=False, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    business_id = Column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)

    amount_paise = Column(Integer, nullable=False)
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    attempt_number = Column(Integer, default=1, nullable=False)

    status = Column(String(30), default="scheduled", nullable=False, index=True)
    # scheduled, eligible, awaiting_notification, initiated, pending, succeeded, failed, cancelled, reconciliation_required

    razorpay_payment_id = Column(String(100), nullable=True, index=True)
    razorpay_order_id = Column(String(100), nullable=True, index=True)

    intended_collection_date = Column(Date, nullable=True)
    notification_requirement = Column(String(30), default="required", nullable=True)  # required, not_required
    notification_status = Column(String(30), default="pending", nullable=True)        # pending, sent, delivered, failed, bypassed
    notification_reference = Column(String(100), nullable=True)
    notification_timestamp = Column(DateTime, nullable=True)
    eligibility_decision = Column(String(50), nullable=True)                         # eligible, deferred_awaiting_notification, ineligible_zero_balance, etc.
    deferral_reason = Column(Text, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)

    initiation_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    result_time = Column(DateTime, nullable=True)

    failure_code = Column(String(100), nullable=True)
    failure_reason = Column(Text, nullable=True)
    reconciliation_status = Column(String(30), default="unreconciled", nullable=False)  # unreconciled, reconciled, mismatch

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    mandate = relationship("AutopayMandateModel", back_populates="attempts")
    bill = relationship("CreditTransactionModel", back_populates="autopay_attempts")


class ConsentAuditModel(Base):
    """
    Auditable consent trail recording explicit customer approvals, limits, terms version, and revocations.
    """
    __tablename__ = "consent_audits"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    mandate_id = Column(String(50), ForeignKey("autopay_mandates.id"), nullable=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False, index=True)
    bill_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=False, index=True)
    business_id = Column(String(50), nullable=False, index=True)

    action = Column(String(50), nullable=False)  # consent_granted, consent_rejected, mandate_authorized, mandate_paused, mandate_resumed, mandate_revoked, mandate_cancelled
    terms_version = Column(String(50), nullable=False)
    max_amount_paise = Column(Integer, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)

    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(255), nullable=True)
    auth_flow_reference = Column(String(100), nullable=True)

    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    mandate = relationship("AutopayMandateModel", back_populates="audit_logs")


class AutopayReconciliationModel(Base):
    """
    Authoritative audit record of automated and manual reconciliation cycles.
    Tracks discrepancies between local ledger, collection attempts, and Razorpay provider records.
    """
    __tablename__ = "autopay_reconciliations"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    reconciliation_run_id = Column(String(100), nullable=False, index=True)
    bill_id = Column(String(50), ForeignKey("customer_credit_transactions.id"), nullable=True, index=True)
    attempt_id = Column(String(50), ForeignKey("autopay_attempts.id"), nullable=True, index=True)
    mandate_id = Column(String(50), ForeignKey("autopay_mandates.id"), nullable=True, index=True)
    business_id = Column(String(50), nullable=True, index=True)

    provider_payment_id = Column(String(100), nullable=True, index=True)
    discrepancy_type = Column(String(50), nullable=False, index=True)
    # timeout_resolved, unrecorded_payment, status_mismatch, pending_resolved, ledger_balance_repaired, mandate_desync

    observed_discrepancy = Column(Text, nullable=False)
    provider_status = Column(String(50), nullable=True)
    internal_status = Column(String(50), nullable=True)

    resolution_action = Column(String(50), nullable=False)
    # ledger_credited, status_reconciled, balance_repaired, manual_review_flagged, marked_failed

    resolution_status = Column(String(30), default="resolved", nullable=False, index=True)
    # resolved, manual_review_required, unresolved

    manual_review_required = Column(Boolean, default=False, nullable=False)
    amount_paise = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
