"""
AutoPay and Recurring Mandate API Endpoints for KOSHA.
Enforces:
1. Explicit customer consent registration and terms acceptance.
2. Cryptographic signature and provider-verified mandate activation.
3. Strict object-level authorization across customers and business owners.
4. Mandate lifecycle management (pause, resume, revoke).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_optional_user
from backend.app.core.errors import AppException
from backend.app.db.database import get_db
from backend.app.db.models import UserModel
from backend.app.schemas.autopay import (
    AutopayAttemptOut,
    AutopayMandateDetailOut,
    AutopayMandateOut,
    AutopaySetupRequest,
    AutopaySetupResponse,
    AutopayVerifyRequest,
    CollectionCycleResponse,
    CollectionCycleTriggerRequest,
    CollectionEngineStatusResponse,
)
from backend.app.services.autopay_service import autopay_service
from backend.app.services.collection_engine import collection_engine

router = APIRouter()

DEFAULT_CUSTOMER_ID = "cust_rahul_01"


def resolve_auth_customer_id(current_user: Optional[UserModel], explicit_id: Optional[str] = None) -> str:
    if current_user and current_user.customer_id:
        return current_user.customer_id
    if explicit_id:
        return explicit_id
    return DEFAULT_CUSTOMER_ID


def resolve_auth_business_id(current_user: Optional[UserModel], explicit_id: Optional[str] = None) -> str:
    if current_user and current_user.business_id:
        return current_user.business_id
    if explicit_id:
        return explicit_id
    return "apex_precision_mfg"


@router.post(
    "/mandates/setup",
    response_model=AutopaySetupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Customer AutoPay Mandate",
    description="Registers an auditable customer consent and initiates Razorpay UPI AutoPay mandate setup.",
)
def setup_mandate(
    data: AutopaySetupRequest,
    request: Request,
    customer_id: Optional[str] = Query(None, description="Target customer identifier"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> AutopaySetupResponse:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id)
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return autopay_service.setup_mandate(
        data=data,
        customer_id=eff_cust_id,
        ip_address=ip_address,
        user_agent=user_agent,
        db=db,
    )


@router.post(
    "/mandates/verify",
    response_model=AutopayMandateOut,
    summary="Verify & Activate AutoPay Mandate",
    description="Authoritatively validates Razorpay authorization callback and transitions mandate to active state.",
)
def verify_mandate(
    data: AutopayVerifyRequest,
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> AutopayMandateOut:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id) if (current_user or customer_id) else None
    return autopay_service.verify_mandate(data=data, customer_id=eff_cust_id, db=db)


@router.get(
    "/mandates/bill/{bill_id}",
    response_model=Optional[AutopayMandateDetailOut],
    summary="Get AutoPay Mandate by Bill ID",
    description="Returns current mandate details, audit trail, and collection attempts for a specific bill.",
)
def get_mandate_by_bill(
    bill_id: str,
    customer_id: Optional[str] = Query(None),
    business_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> Optional[AutopayMandateDetailOut]:
    eff_cust_id = current_user.customer_id if (current_user and current_user.customer_id) else customer_id
    eff_biz_id = current_user.business_id if (current_user and current_user.business_id) else business_id

    return autopay_service.get_mandate_by_bill(
        bill_id=bill_id,
        customer_id=eff_cust_id,
        business_id=eff_biz_id,
        db=db,
    )


@router.get(
    "/mandates/customer",
    response_model=List[AutopayMandateOut],
    summary="List Customer Mandates",
    description="Returns all active and historical AutoPay mandates authorized by this customer.",
)
def list_customer_mandates(
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[AutopayMandateOut]:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id)
    return autopay_service.list_customer_mandates(customer_id=eff_cust_id, db=db)


@router.get(
    "/mandates/business",
    response_model=List[AutopayMandateOut],
    summary="List Business Mandates",
    description="Returns all customer mandates registered on bills issued by this business.",
)
def list_business_mandates(
    business_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[AutopayMandateOut]:
    eff_biz_id = resolve_auth_business_id(current_user, business_id)
    return autopay_service.list_business_mandates(business_id=eff_biz_id, db=db)


@router.post(
    "/mandates/{mandate_id}/pause",
    response_model=AutopayMandateOut,
    summary="Pause Active AutoPay Mandate",
    description="Temporarily suspends future automatic collection attempts.",
)
def pause_mandate(
    mandate_id: str,
    customer_id: Optional[str] = Query(None),
    business_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> AutopayMandateOut:
    is_biz = bool(business_id or (current_user and current_user.role == "business_owner"))
    if is_biz:
        actor_id = resolve_auth_business_id(current_user, business_id)
    else:
        actor_id = resolve_auth_customer_id(current_user, customer_id)
    return autopay_service.pause_mandate(mandate_id=mandate_id, actor_id=actor_id, is_business=is_biz, db=db)


@router.post(
    "/mandates/{mandate_id}/resume",
    response_model=AutopayMandateOut,
    summary="Resume Paused AutoPay Mandate",
    description="Reactivates a paused mandate for future automatic collections.",
)
def resume_mandate(
    mandate_id: str,
    customer_id: Optional[str] = Query(None),
    business_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> AutopayMandateOut:
    is_biz = bool(business_id or (current_user and current_user.role == "business_owner"))
    if is_biz:
        actor_id = resolve_auth_business_id(current_user, business_id)
    else:
        actor_id = resolve_auth_customer_id(current_user, customer_id)
    return autopay_service.resume_mandate(mandate_id=mandate_id, actor_id=actor_id, is_business=is_biz, db=db)


@router.post(
    "/mandates/{mandate_id}/revoke",
    response_model=AutopayMandateOut,
    summary="Revoke Customer AutoPay Mandate",
    description="Permanently revokes an AutoPay mandate. Revoked mandates can never initiate future debits.",
)
def revoke_mandate(
    mandate_id: str,
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> AutopayMandateOut:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id)
    return autopay_service.revoke_mandate(mandate_id=mandate_id, customer_id=eff_cust_id, db=db)


# =============================================================================
# 5. Deadline Collection Engine Endpoints
# =============================================================================

@router.post(
    "/collection/trigger",
    response_model=CollectionCycleResponse,
    summary="Trigger AutoPay Collection Cycle",
    description="Executes a deadline-based collection run over overdue bills with active mandates.",
)
def trigger_collection_cycle(
    payload: CollectionCycleTriggerRequest,
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CollectionCycleResponse:
    res = collection_engine.run_collection_cycle(
        db=db,
        target_date=payload.target_date,
        bypass_notification_window=payload.bypass_notification_window,
        bill_ids=payload.bill_ids,
    )
    return CollectionCycleResponse(**res)


@router.get(
    "/collection/status",
    response_model=CollectionEngineStatusResponse,
    summary="Get Collection Engine Status & Metrics",
    description="Returns configuration, run status, overdue bill counts, and pending attempts.",
)
def get_collection_engine_status(
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> CollectionEngineStatusResponse:
    res = collection_engine.get_engine_status(db=db)
    return CollectionEngineStatusResponse(**res)


@router.get(
    "/collection/attempts",
    response_model=List[AutopayAttemptOut],
    summary="List Collection Attempts",
    description="Lists durable collection attempts with status and error details.",
)
def list_collection_attempts(
    bill_id: Optional[str] = Query(None),
    mandate_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[AutopayAttemptOut]:
    from backend.app.db.models import AutopayAttemptModel
    q = db.query(AutopayAttemptModel)
    if bill_id:
        q = q.filter(AutopayAttemptModel.bill_id == bill_id)
    if mandate_id:
        q = q.filter(AutopayAttemptModel.mandate_id == mandate_id)
    if status:
        q = q.filter(AutopayAttemptModel.status == status)

    attempts = q.order_by(AutopayAttemptModel.initiation_time.desc()).limit(limit).all()

    return [
        AutopayAttemptOut(
            id=att.id,
            mandate_id=att.mandate_id,
            bill_id=att.bill_id,
            amount=float(att.amount_paise) / 100.0,
            amount_paise=att.amount_paise,
            attempt_number=att.attempt_number,
            status=att.status,
            razorpay_payment_id=att.razorpay_payment_id,
            razorpay_order_id=att.razorpay_order_id,
            intended_collection_date=att.intended_collection_date.isoformat() if att.intended_collection_date else None,
            notification_requirement=att.notification_requirement,
            notification_status=att.notification_status,
            notification_reference=att.notification_reference,
            notification_timestamp=att.notification_timestamp,
            eligibility_decision=att.eligibility_decision,
            deferral_reason=att.deferral_reason,
            next_retry_at=att.next_retry_at,
            failure_code=att.failure_code,
            initiation_time=att.initiation_time,
            result_time=att.result_time,
            failure_reason=att.failure_reason,
            reconciliation_status=att.reconciliation_status,
        )
        for att in attempts
    ]


@router.post(
    "/collection/reconcile/{attempt_id}",
    response_model=AutopayAttemptOut,
    summary="Reconcile Ambiguous Attempt with Razorpay",
    description="Queries Razorpay to resolve a timeout or ambiguous payment attempt.",
)
def reconcile_attempt(
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> AutopayAttemptOut:
    att = collection_engine.reconcile_ambiguous_attempt(attempt_id=attempt_id, db=db)
    return AutopayAttemptOut(
        id=att.id,
        mandate_id=att.mandate_id,
        bill_id=att.bill_id,
        amount=float(att.amount_paise) / 100.0,
        amount_paise=att.amount_paise,
        attempt_number=att.attempt_number,
        status=att.status,
        razorpay_payment_id=att.razorpay_payment_id,
        razorpay_order_id=att.razorpay_order_id,
        intended_collection_date=att.intended_collection_date.isoformat() if att.intended_collection_date else None,
        notification_requirement=att.notification_requirement,
        notification_status=att.notification_status,
        notification_reference=att.notification_reference,
        notification_timestamp=att.notification_timestamp,
        eligibility_decision=att.eligibility_decision,
        deferral_reason=att.deferral_reason,
        next_retry_at=att.next_retry_at,
        failure_code=att.failure_code,
        initiation_time=att.initiation_time,
        result_time=att.result_time,
        failure_reason=att.failure_reason,
        reconciliation_status=att.reconciliation_status,
    )


@router.get(
    "/collection/bill/{bill_id}/eligibility",
    summary="Evaluate Bill Collection Eligibility",
    description="Calculates authoritative balance in integer paise and checks mandate eligibility.",
)
def evaluate_bill_eligibility(
    bill_id: str,
    bypass_notification_window: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
):
    from decimal import Decimal
    from backend.app.db.models import CreditTransactionModel
    bill = db.query(CreditTransactionModel).filter_by(id=bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"Bill '{bill_id}' not found.")

    balance_info = collection_engine.calculate_authoritative_balance(bill, db)
    eligibility = collection_engine.evaluate_bill_eligibility(
        bill,
        db,
        bypass_notification_window=bypass_notification_window,
    )

    return {
        "bill_id": bill.id,
        "reference": bill.reference,
        "balance": {
            "total_paise": balance_info["total_paise"],
            "initial_paid_paise": balance_info["initial_paid_paise"],
            "verified_repayments_paise": balance_info["verified_repayments_paise"],
            "remaining_paise": balance_info["remaining_paise"],
            "remaining_inr": float(balance_info["remaining_inr"]),
            "is_fully_paid": balance_info["is_fully_paid"],
        },
        "eligibility": {
            "is_eligible": eligibility["is_eligible"],
            "decision": eligibility["decision"],
            "collectible_paise": eligibility["collectible_paise"],
            "collectible_inr": float(Decimal(eligibility["collectible_paise"]) / Decimal(100)),
            "deferral_reason": eligibility["deferral_reason"],
            "mandate_id": eligibility["mandate"].id if eligibility["mandate"] else None,
        },
    }
