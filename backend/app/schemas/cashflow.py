from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ==========================================
# Business & Accounts Schemas
# ==========================================

class BusinessCreate(BaseModel):
    id: Optional[str] = Field(None, description="Optional custom unique slug or leave empty for auto-generated UUID")
    legal_name: str = Field(..., min_length=2, max_length=200)
    trade_name: str = Field(..., min_length=2, max_length=200)
    industry: str = Field(..., min_length=2, max_length=100)
    msme_category: str = Field("Small", description="Micro, Small, or Medium")
    currency: str = Field("INR", max_length=10)
    registration_number: Optional[str] = Field(None, description="Udyam / GSTIN registration number")
    is_demo: bool = Field(False, description="Whether this is an isolated synthetic demo entity")


class BusinessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    legal_name: str
    trade_name: str
    industry: str
    msme_category: str
    currency: str
    registration_number: Optional[str] = None
    is_demo: bool
    created_at: datetime


class BankAccountCreate(BaseModel):
    bank_name: str = Field("Imported Statement Account", min_length=2, max_length=100)
    account_number_mask: str = Field("...0000", min_length=4, max_length=30, description="e.g. '...4920'")
    currency: str = Field("INR", max_length=10)
    opening_balance: Decimal = Field(Decimal("0.00"), description="Starting verified ledger balance")
    opening_balance_date: Optional[date] = Field(default_factory=date.today, description="Date of opening balance (YYYY-MM-DD)")
    is_verified: bool = Field(True, description="Whether opening balance was verified against an official statement")


class BankAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    bank_name: str
    account_number_mask: str
    currency: str
    opening_balance: float
    opening_balance_date: date
    is_verified: bool
    created_at: datetime


# ==========================================
# CSV Import & Transaction Schemas
# ==========================================

class RejectedRowDetail(BaseModel):
    row_number: int
    raw_content: str
    error: str


class ReconciliationSummary(BaseModel):
    opening_balance: Optional[float] = None
    opening_balance_verified: bool
    total_credits: float
    total_debits: float
    net_movement: float
    calculated_closing_balance: Optional[float] = None
    verification_notes: str


class StatementPeriod(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class CsvImportResult(BaseModel):
    batch_id: str
    business_id: str
    filename: str
    total_rows: int
    accepted_rows: int
    duplicate_rows: int
    exact_file_duplicates: int = 0
    previously_imported_duplicates: int = 0
    potential_duplicates_review: int = 0
    potential_duplicates_details: List[Dict[str, Any]] = []
    rejected_rows: int
    rejected_details: List[RejectedRowDetail]
    statement_period: StatementPeriod
    reconciliation: ReconciliationSummary


class BankTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    bank_account_id: Optional[str] = None
    transaction_date: date
    description: str
    amount: float
    transaction_type: str
    external_reference: Optional[str] = None
    is_reconciled: bool


# ==========================================
# Invoices & Bills Schemas
# ==========================================

class InvoiceCreate(BaseModel):
    invoice_number: str = Field(..., min_length=1, max_length=100)
    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_id: Optional[str] = None
    issue_date: date
    due_date: date
    expected_payment_date: Optional[date] = None
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    msmed_eligible: bool = True
    notes: Optional[str] = None


class InvoicePaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    payment_date: date
    reference: Optional[str] = None
    bank_transaction_id: Optional[str] = None
    idempotency_key: Optional[str] = None


class InvoicePaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_id: str
    payment_date: date
    amount: float
    reference: Optional[str] = None
    bank_transaction_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime


class InvoiceOut(BaseModel):
    id: str
    business_id: str
    invoice_number: str
    customer_name: str
    customer_id: Optional[str] = None
    issue_date: date
    due_date: date
    expected_payment_date: Optional[date] = None
    amount: float
    paid_amount: float
    outstanding_amount: float
    status: str
    msmed_eligible: bool
    notes: Optional[str] = None
    payments: List[InvoicePaymentOut] = []
    created_at: datetime

    @classmethod
    def from_orm_model(cls, m: Any) -> "InvoiceOut":
        out = float(m.amount - m.paid_amount)
        return cls(
            id=m.id,
            business_id=m.business_id,
            invoice_number=m.invoice_number,
            customer_name=m.customer_name,
            customer_id=m.customer_id,
            issue_date=m.issue_date,
            due_date=m.due_date,
            expected_payment_date=m.expected_payment_date,
            amount=float(m.amount),
            paid_amount=float(m.paid_amount),
            outstanding_amount=max(0.0, out),
            status=m.status,
            msmed_eligible=m.msmed_eligible,
            notes=m.notes,
            payments=[InvoicePaymentOut.model_validate(p) for p in m.payments],
            created_at=m.created_at,
        )


class BillCreate(BaseModel):
    bill_number: str = Field(..., min_length=1, max_length=100)
    vendor_name: str = Field(..., min_length=1, max_length=200)
    vendor_id: Optional[str] = None
    issue_date: date
    due_date: date
    category: str = Field("vendor", description="vendor, rent, payroll, tax, utility, emi")
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    priority: str = Field("normal", description="critical, normal, flexible")
    notes: Optional[str] = None


class BillPaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    payment_date: date
    reference: Optional[str] = None
    bank_transaction_id: Optional[str] = None
    idempotency_key: Optional[str] = None


class BillPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bill_id: str
    payment_date: date
    amount: float
    reference: Optional[str] = None
    bank_transaction_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime


class BillOut(BaseModel):
    id: str
    business_id: str
    bill_number: str
    vendor_name: str
    vendor_id: Optional[str] = None
    issue_date: date
    due_date: date
    category: str
    amount: float
    paid_amount: float
    outstanding_amount: float
    status: str
    priority: str
    notes: Optional[str] = None
    payments: List[BillPaymentOut] = []
    created_at: datetime

    @classmethod
    def from_orm_model(cls, m: Any) -> "BillOut":
        out = float(m.amount - m.paid_amount)
        return cls(
            id=m.id,
            business_id=m.business_id,
            bill_number=m.bill_number,
            vendor_name=m.vendor_name,
            vendor_id=m.vendor_id,
            issue_date=m.issue_date,
            due_date=m.due_date,
            category=m.category,
            amount=float(m.amount),
            paid_amount=float(m.paid_amount),
            outstanding_amount=max(0.0, out),
            status=m.status,
            priority=m.priority,
            notes=m.notes,
            payments=[BillPaymentOut.model_validate(p) for p in m.payments],
            created_at=m.created_at,
        )


class OperatingExpenseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    category: str = Field("payroll", description="payroll, rent, statutory, emi, utility")
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    frequency: str = Field("monthly", description="monthly or quarterly")
    day_of_month: int = Field(1, ge=1, le=31)


class OperatingExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    title: str
    category: str
    amount: float
    frequency: str
    day_of_month: int
    is_active: bool
    created_at: datetime


# ==========================================
# Forecast Request & Response Schemas
# ==========================================

class ReceivableInput(BaseModel):
    id: Optional[str] = None
    customer_name: Optional[str] = "Customer"
    amount: float = Field(..., description="Invoice total amount in INR")
    due_date: Optional[str] = None
    expected_payment_date: Optional[str] = None
    status: Optional[str] = "expected"
    paid_amount: float = Field(0.0, ge=0.0)
    confidence: Optional[float] = 1.0


class OutflowInput(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = "Committed Outflow"
    amount: float = Field(..., description="Committed debt amount in INR")
    due_date: Optional[str] = None
    category: Optional[str] = "general"
    priority: Optional[str] = "normal"


class ForecastDailyPoint(BaseModel):
    date: str
    starting_cash: float
    expected_inflow: float
    committed_outflow: float
    net_cash_flow: float
    ending_cash: float
    is_shortfall: bool
    shortfall_amount: float = 0.0
    is_reserve_breach: bool = False
    reserve_deficit: float = 0.0
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    is_synthetic: bool = False


class ForecastRequest(BaseModel):
    business_id: Optional[str] = Field("apex_precision_mfg", description="Target business identifier")
    start_date: Optional[str] = Field(None, description="Forecast start date (YYYY-MM-DD), defaults to today")
    starting_cash: Optional[float] = Field(
        None, description="Override opening liquid cash. If omitted, uses reconciled bank account balance"
    )
    horizon_days: int = Field(default=90, ge=1, le=180, description="Forecast window (1 to 180 days)")
    minimum_reserve: float = Field(
        default=0.0, ge=0.0, description="Configurable cash reserve cushion to monitor for breaches"
    )
    receivables: Optional[List[ReceivableInput]] = Field(
        None, description="Optional custom expected invoices list overriding database records"
    )
    outflows: Optional[List[OutflowInput]] = Field(
        None, description="Optional custom committed payments list overriding database records"
    )
    use_sample_data: bool = Field(
        False, description="Explicitly force loading isolated synthetic demo persona data"
    )


class ForecastResponse(BaseModel):
    business_id: str
    forecast_generated_at: str
    start_date: str
    horizon_days: int
    starting_cash: float
    closing_cash: float
    total_inflows: float
    total_outflows: float
    net_change: float
    minimum_projected_balance: float
    minimum_reserve: float = 0.0
    first_projected_shortfall_date: Optional[str] = None
    first_reserve_breach_date: Optional[str] = None
    negative_cash_days_count: int
    days_below_reserve_count: int = 0
    runway_days: Optional[int] = None
    is_probabilistic: bool = False
    is_synthetic: bool = False
    data_quality_warnings: List[str] = []
    assumptions_used: List[str] = []
    daily_projections: List[ForecastDailyPoint]


# ==========================================
# Operational State Summary Schema
# ==========================================

class BusinessStateSummary(BaseModel):
    business_id: str
    legal_name: str
    currency: str
    is_demo: bool
    current_cash: float
    verified_opening_balance: Optional[float] = None
    total_settled_inflows: float
    total_settled_outflows: float
    total_unpaid_receivables: float
    total_unpaid_payables: float
    active_invoices_count: int
    active_bills_count: int
    imported_transactions_count: int
    reconciliation_status: str  # verified, unverified, no_accounts
    data_quality_warnings: List[str] = []


# ==========================================
# Scenario Simulation Schemas
# ==========================================

class ScenarioSimulationRequest(BaseModel):
    business_id: Optional[str] = Field("apex_precision_mfg", description="Target business entity ID")
    persona_id: Optional[str] = Field("manufacturer", description="Sample persona ID: manufacturer, trader, or service")
    use_sample_data: bool = Field(True, description="Whether to simulate using synthetic business datasets")
    horizon_days: int = Field(90, ge=1, le=365)
    minimum_reserve: float = Field(100000.0, ge=0.0, description="Minimum reserve threshold (INR)")
    buyer_delay_days: int = Field(0, ge=0, le=120, description="Additional days key buyer delays invoice payment")
    sales_drop_percent: float = Field(0.0, ge=0.0, le=100.0, description="Top-line sales/inflows contraction percentage")
    surprise_expense: float = Field(0.0, ge=0.0, description="Emergency outflow amount in INR")
    surprise_expense_day: int = Field(15, ge=0, le=90, description="Day index when emergency outflow strikes")


class RiskComparisonMetrics(BaseModel):
    baseline_risk_pct: int
    scenario_risk_pct: int
    risk_delta_pct: int
    baseline_first_breach_date: Optional[str] = None
    scenario_first_breach_date: Optional[str] = None
    baseline_first_shortfall_date: Optional[str] = None
    scenario_first_shortfall_date: Optional[str] = None
    baseline_min_balance: float
    scenario_min_balance: float
    minimum_balance_change: float
    baseline_runway_days: int
    scenario_runway_days: int


class ScenarioShocksApplied(BaseModel):
    buyer_delay_days: int
    sales_drop_percent: float
    surprise_expense: float
    surprise_expense_day: int


class ScenarioSimulationResponse(BaseModel):
    baseline: ForecastResponse
    scenario: ForecastResponse
    risk_comparison: RiskComparisonMetrics
    shocks_applied: ScenarioShocksApplied


# ==========================================
# Action Ranking Schemas
# ==========================================

class ActionItemOut(BaseModel):
    id: str
    badge: str
    category: str
    category_label: str
    title: str
    why_recommended: str
    cash_flow_impact: str
    risk_shift: str
    cost: str
    cost_inr: float
    yield_inr: float
    days_to_cash: int
    relationship_cost: str
    relationship_notes: str
    assumptions: str
    practical_steps: List[str]
    mcda_score: float


class ActionRankingRequest(BaseModel):
    business_id: Optional[str] = "apex_precision_mfg"
    shortfall_amount: float = 65000.0
    days_until_shortfall: int = 18
    baseline_risk_pct: int = 71


class ActionRankingResponse(BaseModel):
    business_id: str
    shortfall_amount: float
    days_until_shortfall: int
    actions: List[ActionItemOut]


# ==========================================
# Receivables & MSMED Schemas
# ==========================================

class ReceivablesLawInvoice(BaseModel):
    id: str
    invoice_number: str
    customer_name: str
    amount: float
    due_date: str
    overdue_days: int
    is_violation: bool
    penal_rate_annual: str
    accrued_penal_interest: float
    total_claimable: float
    section_43b_status: str
    section_43b_notes: str
    statutory_reminder_draft: str


class ReceivablesLawResponse(BaseModel):
    business_id: str
    rbi_bank_rate_pct: float
    msmed_penal_rate_pct: float
    compounding_frequency: str
    total_overdue_principal: float
    total_accrued_penal_interest: float
    invoices: List[ReceivablesLawInvoice]
    disclaimer: str


# ==========================================
# Cash Calendar Schemas
# ==========================================

class CalendarOutflowItem(BaseModel):
    id: str
    date: str
    formatted_date: str
    title: str
    category: str
    amount: str
    amount_num: float
    priority: str
    is_confirmed: bool
    notes: str


class CalendarResponse(BaseModel):
    reference_date: str
    horizon_days: int
    end_date: str
    total_committed_amount: float
    category_totals: Dict[str, float]
    payments_count: int
    scheduled_payments: List[CalendarOutflowItem]


# ==========================================
# Backtest & Trust Schemas
# ==========================================

class CalibrationPoint(BaseModel):
    predicted: int
    actual: int


class BacktestResponse(BaseModel):
    business_id: str
    dataset_name: str
    is_synthetic: bool
    evaluation_periods: int
    band_coverage_pct: int
    band_coverage_target_pct: int
    warning_lead_time_days: int
    false_alarms_ratio: str
    missed_shortfalls_count: int
    mean_absolute_error_inr: float
    mean_absolute_error_formatted: str
    trust_score: float
    calibration_curve: List[CalibrationPoint]
    methodology_notes: List[str]



