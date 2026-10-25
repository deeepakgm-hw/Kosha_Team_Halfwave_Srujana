"""
API endpoints for Customer Disputes and Inaccuracy Corrections.
Enforces:
1. Customer can raise a dispute, which freezes automatic collection on that obligation.
2. Merchant reviews evidence and resolves or rejects dispute with auditable notes.
3. Automatic TrustScore recalculation.
"""

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.api.deps import get_optional_user
from backend.app.db.database import get_db
from backend.app.db.models import UserModel
from backend.app.services.dispute_service import dispute_service

router = APIRouter()

DEFAULT_CUSTOMER_ID = "cust_rahul_01"


class DisputeCreateRequest(BaseModel):
    bill_id: str = Field(..., description="Target obligation identifier")
    dispute_type: str = Field(
        ...,
        description="Type: incorrect_amount, payment_missing, failed_payment_charged, incorrect_deadline, unauthorized_collection, other",
    )
    description: str = Field(..., min_length=5, max_length=1000, description="Detailed explanation of the billing inaccuracy")


class DisputeResolveRequest(BaseModel):
    resolution_action: str = Field(
        ...,
        description="Action: balance_adjusted, payment_credited, deadline_extended, dispute_dismissed",
    )
    resolution_notes: str = Field(..., min_length=5, max_length=1000, description="Documented rationale for the resolution")
    adjusted_amount: Optional[float] = Field(None, ge=0.0, description="Updated outstanding balance if adjusted")
    extended_date: Optional[date] = Field(None, description="New repayment deadline if extended")


@router.post(
    "/raise",
    status_code=status.HTTP_201_CREATED,
    summary="Raise Customer Dispute on Obligation",
    description="Registers a dispute and immediately pauses AutoPay collections on this bill pending merchant review.",
)
def raise_dispute(
    payload: DisputeCreateRequest,
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> Dict[str, Any]:
    eff_cust_id = current_user.customer_id if (current_user and current_user.customer_id) else (customer_id or DEFAULT_CUSTOMER_ID)
    dispute = dispute_service.raise_dispute(
        customer_id=eff_cust_id,
        bill_id=payload.bill_id,
        dispute_type=payload.dispute_type,
        description=payload.description,
        db=db,
    )
    return {
        "dispute_id": dispute.id,
        "bill_id": dispute.bill_id,
        "status": dispute.status,
        "message": "Dispute registered successfully. Automatic collection is paused on this obligation.",
    }


@router.get(
    "/customer",
    summary="List Customer Disputes",
    description="Returns all disputes opened by this customer with status and resolution notes.",
)
def list_customer_disputes(
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    eff_cust_id = current_user.customer_id if (current_user and current_user.customer_id) else (customer_id or DEFAULT_CUSTOMER_ID)
    return dispute_service.list_customer_disputes(customer_id=eff_cust_id, db=db)


@router.get(
    "/shop/{shop_id_or_code}",
    summary="List Shop Disputes",
    description="Returns all customer disputes on bills issued by this merchant.",
)
def list_shop_disputes(
    shop_id_or_code: str,
    status: Optional[str] = Query(None, description="Filter by status: opened, under_review, resolved, rejected"),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    return dispute_service.list_shop_disputes(
        shop_id_or_code=shop_id_or_code,
        db=db,
        status=status,
    )


@router.post(
    "/{dispute_id}/resolve",
    summary="Resolve or Reject Customer Dispute",
    description="Merchant resolves dispute with documented action, adjusting ledger balance and restoring bill status.",
)
def resolve_dispute(
    dispute_id: str,
    payload: DisputeResolveRequest,
    shop_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_optional_user),
) -> Dict[str, Any]:
    actor = current_user.email if current_user else (shop_id or "merchant")
    adj_amt = Decimal(str(payload.adjusted_amount)) if payload.adjusted_amount is not None else None

    dispute = dispute_service.resolve_dispute(
        dispute_id=dispute_id,
        actor_id=actor,
        resolution_action=payload.resolution_action,
        resolution_notes=payload.resolution_notes,
        adjusted_amount=adj_amt,
        extended_date=payload.extended_date,
        db=db,
    )
    return {
        "dispute_id": dispute.id,
        "bill_id": dispute.bill_id,
        "status": dispute.status,
        "resolution_action": dispute.resolution_action,
        "message": f"Dispute marked as {dispute.status}.",
    }
