from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AutopaySetupRequest(BaseModel):
    """Payload submitted by customer to register an AutoPay recurring mandate."""
    bill_id: str = Field(..., description="ID of the target credit bill")
    explicit_consent: bool = Field(..., description="Customer must explicitly opt-in")
    terms_accepted: bool = Field(..., description="Confirmation of mandate terms acceptance")
    terms_version: str = Field(default="v1.0-2026", description="Audit version of legal terms accepted")
    max_amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
        description="Optional custom cap in INR; defaults to bill remaining balance if omitted"
    )
    mandate_type: str = Field(
        default="upi_autopay",
        description="Mandate protocol: 'upi_autopay', 'emandate', or 'card'"
    )


class AutopaySetupResponse(BaseModel):
    """Details returned to the frontend to initialize Razorpay mandate authorization."""
    mandate_id: str
    bill_id: str
    customer_id: str
    business_name: str
    bill_reference: str
    original_amount: float
    verified_payments_received: float
    outstanding_balance: float
    repayment_deadline: str
    max_amount: float
    max_amount_paise: int
    amount_type: str  # "variable" or "fixed"
    currency: str
    mandate_type: str
    status: str
    collection_condition: str
    cancellation_terms: str
    razorpay_key_id: str
    razorpay_customer_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    is_test_mode: bool
    provider_capability: str
    created_at: datetime


class AutopayVerifyRequest(BaseModel):
    """Server-side verification request after Razorpay Checkout authorization."""
    mandate_id: str
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class AutopayMandateOut(BaseModel):
    """Complete representation of an AutoPay mandate for customer & business dashboards."""
    id: str
    customer_id: str
    business_id: str
    bill_id: str
    business_name: Optional[str] = None
    customer_name: Optional[str] = None
    bill_reference: Optional[str] = None
    bill_outstanding: float
    repayment_deadline: Optional[str] = None
    mandate_type: str
    amount_type: str
    max_amount: float
    max_amount_paise: int
    currency: str
    frequency: str
    status: str
    effective_date: str
    expiry_date: Optional[str] = None
    consent_timestamp: datetime
    terms_version: str
    collection_condition: str
    cancellation_terms: str
    razorpay_auth_reference: Optional[str] = None
    razorpay_token_id: Optional[str] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ConsentAuditOut(BaseModel):
    """Auditable log entry for customer consent grant, revocation, or mandate status updates."""
    id: str
    mandate_id: Optional[str] = None
    customer_id: str
    bill_id: str
    action: str
    terms_version: str
    max_amount: float
    currency: str
    timestamp: datetime
    notes: Optional[str] = None


class AutopayAttemptOut(BaseModel):
    """Ledger record of an automatic collection attempt."""
    id: str
    mandate_id: str
    bill_id: str
    amount: float
    amount_paise: int
    attempt_number: int
    status: str
    razorpay_payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    intended_collection_date: Optional[str] = None
    notification_requirement: Optional[str] = None
    notification_status: Optional[str] = None
    notification_reference: Optional[str] = None
    notification_timestamp: Optional[datetime] = None
    eligibility_decision: Optional[str] = None
    deferral_reason: Optional[str] = None
    next_retry_at: Optional[datetime] = None
    failure_code: Optional[str] = None
    initiation_time: datetime
    result_time: Optional[datetime] = None
    failure_reason: Optional[str] = None
    reconciliation_status: str


class CollectionCycleTriggerRequest(BaseModel):
    target_date: Optional[date] = Field(None, description="Optional target date to simulate or evaluate (defaults to today)")
    bypass_notification_window: bool = Field(False, description="Set to True for testing to bypass the 24-hour pre-debit waiting window")
    bill_ids: Optional[List[str]] = Field(None, description="Optional filter to execute collection only for specific bill IDs")


class CollectionCycleResponse(BaseModel):
    status: str
    cycle_id: str
    executed_at: datetime
    bills_evaluated: int
    eligible_count: int
    succeeded_count: int
    failed_count: int
    deferred_count: int
    reconciled_count: int
    total_collected_paise: int
    total_collected_inr: float
    results: List[Dict[str, Any]] = []


class CollectionEngineStatusResponse(BaseModel):
    is_enabled: bool
    is_running: bool
    interval_seconds: int
    pre_debit_notification_hours: int
    max_retry_attempts: int
    last_run_time: Optional[datetime] = None
    overdue_bills_count: int
    active_mandates_count: int
    pending_attempts_count: int
    reconciliation_required_count: int


class AutopayMandateDetailOut(BaseModel):
    """Detailed view including active mandate, audit log, and previous collection attempts."""
    mandate: AutopayMandateOut
    audit_logs: List[ConsentAuditOut] = []
    attempts: List[AutopayAttemptOut] = []
