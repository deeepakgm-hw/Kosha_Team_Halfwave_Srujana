from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


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


class CustomerDuesResponse(BaseModel):
    total_outstanding: float
    overdue_amount: float
    due_today_amount: float
    upcoming_amount: float
    paid_amount: float
    transactions: List[CreditTransactionOut]


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
