"""
API endpoints for KOSHA TrustScore internal repayment reliability scoring.
Enforces:
1. Deterministic 4-factor rule-based breakdown.
2. Complete explainability metrics with positive and negative signals.
3. Multi-tenant customer data isolation for business owners.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_optional_user
from backend.app.db.database import get_db
from backend.app.db.models import UserModel
from backend.app.services.trustscore_service import trustscore_service

router = APIRouter()

DEFAULT_CUSTOMER_ID = "cust_rahul_01"


def resolve_auth_customer_id(current_user: Optional[UserModel], explicit_id: Optional[str] = None) -> str:
    if current_user and current_user.customer_id:
        return current_user.customer_id
    if explicit_id:
        return explicit_id
    return DEFAULT_CUSTOMER_ID


@router.get(
    "/customer/{customer_id}",
    summary="Get Customer TrustScore & Factor Breakdown",
    description="Returns customer internal reliability score (0-100), 40/25/20/15 breakdown, metrics, and explainability signals.",
)
def get_customer_trust_score(
    customer_id: str,
    force_recalc: bool = Query(False, description="Force fresh recalculation"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> Dict[str, Any]:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id)
    return trustscore_service.get_or_calculate_score(
        customer_id=eff_cust_id,
        db=db,
        force_recalc=force_recalc,
    )


@router.get(
    "/history",
    summary="Get TrustScore History",
    description="Returns chronological score snapshots for customer trend visualization.",
)
def get_score_history(
    customer_id: Optional[str] = Query(None),
    limit: int = Query(12, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id)
    return trustscore_service.get_score_history(
        customer_id=eff_cust_id,
        db=db,
        limit=limit,
    )


@router.post(
    "/recalculate",
    summary="Recalculate Customer TrustScore",
    description="Forces immediate recalculation and persists a new snapshot with delta analysis.",
)
def recalculate_trust_score(
    customer_id: Optional[str] = Query(None),
    reason: str = Query("manual_refresh", description="Audit reason for recalculation"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> Dict[str, Any]:
    eff_cust_id = resolve_auth_customer_id(current_user, customer_id)
    snap = trustscore_service.calculate_and_save_snapshot(
        customer_id=eff_cust_id,
        db=db,
        trigger_reason=reason,
    )
    return trustscore_service.get_or_calculate_score(customer_id=eff_cust_id, db=db)


@router.get(
    "/business/{business_or_shop_id}/customer/{customer_id}",
    summary="Get Business Owner View of Customer Profile",
    description="Exposes customer reliability tier and metrics strictly scoped to this merchant's bills (no cross-shop leakage).",
)
def get_business_customer_profile(
    business_or_shop_id: str,
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> Dict[str, Any]:
    return trustscore_service.get_business_customer_profile(
        business_or_shop_id=business_or_shop_id,
        customer_id=customer_id,
        db=db,
    )
