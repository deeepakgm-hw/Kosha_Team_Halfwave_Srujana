from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field


class BusinessProfileSchema(BaseModel):
    id: str
    legal_name: str
    trade_name: str
    industry: str
    msme_category: str
    registration_number: Optional[str] = None
    currency: str = "INR"
    current_cash: float
    reconciled_date: date
    is_synthetic: bool = True


class TransactionSchema(BaseModel):
    id: str
    business_id: str
    date: date
    type: str  # credit or debit
    category: str
    counterparty: str
    amount: float
    reference: Optional[str] = None
    is_synthetic: bool = True


class InvoiceSchema(BaseModel):
    id: str
    business_id: str
    invoice_number: str
    customer_id: str
    customer_name: str
    issue_date: date
    due_date: date
    amount: float
    paid_amount: float = 0.0
    status: str  # pending, overdue, settled
    days_overdue: int = 0
    msmed_eligible: bool = True
    expected_pay_date: Optional[date] = None
    payment_confidence: float = 1.0
    is_synthetic: bool = True


class PayableSchema(BaseModel):
    id: str
    business_id: str
    vendor_name: str
    category: str  # payroll, vendor, rent, statutory, emi
    due_date: date
    amount: float
    priority: str  # critical, normal, flexible
    negotiable: bool = False
    is_synthetic: bool = True


class ForecastDailyPoint(BaseModel):
    date: date
    starting_cash: float
    expected_inflow: float
    committed_outflow: float
    ending_cash: float
    shortfall_amount: float = 0.0
    confidence_lower: float
    confidence_upper: float
    is_synthetic: bool = True


class ForecastRequest(BaseModel):
    horizon_days: int = Field(default=90, ge=1, le=180)
    confidence_interval: float = Field(default=0.90, ge=0.5, le=0.99)
    include_stochastic_receivables: bool = True


class ForecastResponse(BaseModel):
    business_id: str
    forecast_generated_at: str
    horizon_days: int
    current_cash: float
    burn_rate_monthly: float
    runway_days: Optional[int] = None
    earliest_shortfall_date: Optional[date] = None
    daily_projections: List[ForecastDailyPoint]
    is_synthetic: bool = True
