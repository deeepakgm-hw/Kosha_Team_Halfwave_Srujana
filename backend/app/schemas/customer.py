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
    created_at: datetime


class RepaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Repayment amount must be positive")
    payment_method: str = Field("demo_upi", max_length=50)
    notes: Optional[str] = Field(None, max_length=255)


class RepaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    amount: float
    repayment_date: date
    payment_method: str
    payment_status: str
    provider_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class CreditTransactionCreate(BaseModel):
    shop_code: str = Field(..., min_length=2, max_length=50, description="Unique shop identifier code")
    description: str = Field(..., min_length=2, max_length=255, description="Item or goods description")
    purchase_amount: Decimal = Field(..., gt=0, description="Total purchase value")
    amount_paid_now: Decimal = Field(Decimal("0.00"), ge=0, description="Initial payment made at checkout")
    agreed_repayment_date: date = Field(..., description="Agreed date to clear remaining balance (YYYY-MM-DD)")


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
    shop_name: str
    amount: float
    due_date: date
    urgency: str  # overdue, due_today, upcoming
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
