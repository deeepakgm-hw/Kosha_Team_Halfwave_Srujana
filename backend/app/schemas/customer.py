from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class CustomerProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    phone: str
    email: Optional[str] = None
    created_at: datetime


class ShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    shop_name: str
    shop_code: str
    category: str
    owner_name: str
    phone: Optional[str] = None
    upi_id: Optional[str] = None
    qr_payload: Optional[str] = None
    is_verified: bool
    status: str = "active"
    created_at: datetime


class ShopQrOut(BaseModel):
    shop_code: str
    shop_name: str
    qr_payload: str
    qr_svg: str
    instructions: str


class RepaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Repayment amount must be positive")
    payment_method: str = Field("demo_upi", max_length=50)
    notes: Optional[str] = Field(None, max_length=255)
    idempotency_key: Optional[str] = Field(None, max_length=100)


class RepaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    amount: float
    repayment_date: date
    payment_method: str
    payment_status: str
    recorded_by: str = "customer"
    provider_reference: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime


class CreditTransactionCreate(BaseModel):
    shop_code: str = Field(..., min_length=2, max_length=50, description="Unique shop identifier code")
    description: str = Field(..., min_length=2, max_length=255, description="Item or goods description")
    purchase_amount: Decimal = Field(..., gt=0, description="Total purchase value")
    amount_paid_now: Decimal = Field(Decimal("0.00"), ge=0, description="Initial payment made at checkout")
    agreed_repayment_date: date = Field(..., description="Agreed date to clear remaining balance (YYYY-MM-DD)")
    idempotency_key: Optional[str] = Field(None, max_length=100)


class CreditTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference: str
    customer_id: str
    shop_id: str
    shop_name: str
    shop_code: str
    description: str
    purchase_amount: float
    initial_paid_amount: float
    outstanding_amount: float
    transaction_date: date
    agreed_repayment_date: date
    status: str  # upcoming, due_today, overdue, paid
    idempotency_key: Optional[str] = None
    created_at: datetime
    repayments: List[RepaymentOut] = []


class ActivityEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    transaction_id: Optional[str] = None
    event_type: str
    title: str
    description: str
    amount: Optional[float] = None
    created_at: datetime


class ReminderItemOut(BaseModel):
    transaction_id: str
    reference: Optional[str] = None
    shop_name: str
    shop_code: Optional[str] = None
    amount: float
    due_date: date
    days_diff: int = 0  # < 0: overdue by N days, 0: due today, > 0: due in N days
    urgency: str  # overdue, due_today, upcoming, approaching, completed
    message: str


class CustomerDashboardSummary(BaseModel):
    customer: CustomerProfileOut
    total_outstanding: float
    due_within_7_days: float
    overdue_amount: float
    shops_count: int
    status_message: str
    upcoming_repayments: List[CreditTransactionOut]
    recent_activity: List[ActivityEventOut]
    reminders: List[ReminderItemOut]
    total_purchase_amount: Optional[float] = 0.0
    total_initial_paid: Optional[float] = 0.0
    total_verified_online_paid: Optional[float] = 0.0
    total_paid_amount: Optional[float] = 0.0
    active_bills_count: Optional[int] = 0
    settled_bills_count: Optional[int] = 0


class CustomerDuesResponse(BaseModel):
    total_outstanding: float
    overdue_amount: float
    due_today_amount: float
    upcoming_amount: float
    paid_amount: float
    transactions: List[CreditTransactionOut]
    total_purchase_amount: Optional[float] = 0.0
    total_initial_paid: Optional[float] = 0.0
    total_verified_online_paid: Optional[float] = 0.0


# =========================================================================
# Shopkeeper Schemas
# =========================================================================

class ShopkeeperSummaryOut(BaseModel):
    shop: ShopOut
    total_customer_receivables: float
    collected_today: float
    due_in_7_days: float
    overdue_receivables: float
    customers_with_balance_count: int
    total_transactions_count: int
    total_billed_amount: Optional[float] = 0.0
    total_cash_collected: Optional[float] = 0.0
    total_online_verified: Optional[float] = 0.0
    settled_transactions_count: Optional[int] = 0
    active_transactions_count: Optional[int] = 0


class ShopkeeperTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reference: str
    customer_id: str
    customer_name: str
    customer_phone: str
    shop_id: str
    shop_name: str
    shop_code: str
    description: str
    purchase_amount: float
    initial_paid_amount: float
    outstanding_amount: float
    transaction_date: date
    agreed_repayment_date: date
    status: str
    created_at: datetime
    repayments: List[RepaymentOut] = []


class ShopkeeperRepaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Repayment amount must be positive")
    payment_method: str = Field("shopkeeper_cash", description="cash, upi, bank_transfer")
    notes: Optional[str] = Field(None, max_length=255)
    idempotency_key: Optional[str] = Field(None, max_length=100)


# =========================================================================
# Payment Gateway Boundary Schemas
# =========================================================================

class PaymentGatewayStatusOut(BaseModel):
    is_configured: bool
    provider_name: str
    supported_methods: List[str]
    is_sandbox: bool
    instructions: str


class PaymentInitiateRequest(BaseModel):
    transaction_id: str
    amount: Decimal = Field(..., gt=0)
    payment_method: str = "demo_upi"
    idempotency_key: Optional[str] = Field(None, max_length=100)


class PaymentOrderOut(BaseModel):
    order_id: str
    transaction_id: str
    amount: float
    currency: str = "INR"
    gateway_status: str
    is_sandbox: bool
    message: str


class PaymentVerifyRequest(BaseModel):
    transaction_id: str
    order_id: str
    payment_id: str
    signature: Optional[str] = None


# =========================================================================
# Razorpay UPI Integration Schemas
# =========================================================================

class RazorpayPaymentRequestCreate(BaseModel):
    bill_id: str = Field(..., description="Target bill/credit transaction ID")
    amount_paise: Optional[int] = Field(None, gt=0, description="Amount in paise (e.g. 50000 = ₹500.00)")
    partial_amount: Optional[Decimal] = Field(None, gt=0, description="Amount in INR (e.g. 500.00)")
    idempotency_key: Optional[str] = Field(None, max_length=100)


class RazorpayPaymentRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bill_id: str
    customer_id: str
    business_id: str
    shop_id: Optional[str] = None
    amount_paise: int
    amount_inr: float
    currency: str = "INR"
    razorpay_order_id: Optional[str] = None
    razorpay_payment_link_id: Optional[str] = None
    razorpay_qr_id: Optional[str] = None
    upi_qr_payload: Optional[str] = None
    qr_image_url: Optional[str] = None
    short_url: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    idempotency_key: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    is_test_mode: bool = True
    key_id: Optional[str] = None

    @field_serializer("expires_at", "created_at")
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class RazorpayPaymentVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payment_request_id: Optional[str] = None
    bill_id: str
    razorpay_payment_id: str
    razorpay_order_id: Optional[str] = None
    amount_paise: int
    amount_inr: float
    currency: str = "INR"
    payment_method: str = "upi"
    vpa: Optional[str] = None
    status: str = "captured"
    verification_source: str = "webhook"
    verified_at: datetime

    @field_serializer("verified_at")
    def serialize_verified_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class BillLineItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Item or service name")
    quantity: int = Field(1, ge=1, description="Item quantity")
    unit_price: Decimal = Field(..., ge=0, description="Unit price in INR")
    line_total: Optional[Decimal] = Field(None, ge=0, description="Calculated line total")


class CustomerRegisterCreate(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=200, description="Customer full name")
    phone: str = Field(..., min_length=10, max_length=20, description="Customer phone number")
    email: Optional[str] = Field(None, max_length=100, description="Optional customer email")


class BillRepaymentDateUpdate(BaseModel):
    agreed_repayment_date: date = Field(..., description="Updated agreed repayment date")
    notes: Optional[str] = Field(None, max_length=255, description="Reason for date extension")


class BillCashReceiptCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Cash amount received in INR")
    notes: Optional[str] = Field(None, max_length=255, description="Optional receipt notes")
    idempotency_key: Optional[str] = Field(None, max_length=100)


class BillPaymentHistoryOut(BaseModel):
    bill_id: str
    bill_reference: str
    customer_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    shop_id: str
    shop_name: str
    shop_code: Optional[str] = None
    description: str
    notes: Optional[str] = None
    line_items: Optional[List[BillLineItem]] = None
    total_amount: float
    initial_manual_paid: float
    verified_razorpay_paid: float
    outstanding_amount: float
    created_at: Optional[datetime] = None
    agreed_repayment_date: date
    status: str
    active_payment_request: Optional[RazorpayPaymentRequestOut] = None
    verified_payments: List[RazorpayPaymentVerificationOut] = []
    all_repayments: List[RepaymentOut] = []

    @field_serializer("created_at")
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class ShopkeeperBillCreate(BaseModel):
    customer_id: Optional[str] = Field(None, description="Target customer ID from directory")
    new_customer: Optional[CustomerRegisterCreate] = Field(None, description="Register new customer on the fly")
    description: str = Field(..., min_length=2, max_length=255, description="Goods or service description")
    total_amount: Decimal = Field(..., gt=0, description="Total bill amount in INR")
    initial_payment_amount: Decimal = Field(Decimal("0.00"), ge=0, description="Amount customer is paying now")
    initial_manual_paid: Decimal = Field(Decimal("0.00"), ge=0, description="Backwards compatibility alias for initial payment")
    initial_payment_method: str = Field("none", description="'cash', 'razorpay_upi', 'none'")
    line_items: Optional[List[BillLineItem]] = Field(None, description="Optional bill line items")
    notes: Optional[str] = Field(None, max_length=500, description="Optional notes on the bill")
    agreed_repayment_date: date = Field(..., description="Agreed date to clear balance")
    generate_payment_request: bool = Field(True, description="Automatically generate Razorpay payment request")
    idempotency_key: Optional[str] = Field(None, max_length=100)


class RazorpayConfigOut(BaseModel):
    key_id: str
    mode: str = "test"
    is_test_mode: bool = True
    is_configured: bool = False
    has_live_credentials: bool = False
    upi_flow: str = "payment_link"
    merchant_name: str = "KOSHA MSME Treasury"
    upi_vpa: str = "kosha.msme@razorpay"


class ShopkeeperFinancialSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shop_id: str
    shop_name: str
    total_billed_volume: float
    counter_cash_paid: float
    razorpay_verified_collections: float
    total_collected: float
    remaining_customer_dues: float
    active_bills_count: int
    settled_bills_count: int
    total_bills_count: int
    settlement_rate_percentage: float
    collections_settlement_percentage: float
    unresolved_discrepancy: float
    is_reconciled: bool
