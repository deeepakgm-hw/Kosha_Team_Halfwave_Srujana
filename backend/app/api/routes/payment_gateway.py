from typing import Any, Dict
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import (
    PaymentGatewayStatusOut,
    PaymentInitiateRequest,
    PaymentOrderOut,
    PaymentVerifyRequest,
)
from backend.app.services.payment_gateway import payment_gateway_service

router = APIRouter()


@router.get(
    "/status",
    response_model=PaymentGatewayStatusOut,
    summary="Get Payment Gateway Integration Status",
    description="Inspects whether production payment provider credentials are configured or sandbox simulation is active.",
)
def get_gateway_status() -> PaymentGatewayStatusOut:
    return payment_gateway_service.get_status()


@router.post(
    "/initiate",
    response_model=PaymentOrderOut,
    summary="Initiate Digital Payment Order",
    description="Initiates an order through the payment gateway boundary. In sandbox mode, returns an authoritative demonstration order.",
)
def initiate_payment(
    req: PaymentInitiateRequest, db: Session = Depends(get_db)
) -> PaymentOrderOut:
    return payment_gateway_service.create_order(req, db=db)


@router.post(
    "/verify",
    summary="Verify Payment Authenticity",
    description="Verifies the payment authenticity server-side. In sandbox mode, validates order format.",
)
def verify_payment(
    req: PaymentVerifyRequest, db: Session = Depends(get_db)
) -> Dict[str, Any]:
    result = payment_gateway_service.verify_payment(req, db=db)
    if not result.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("reason", "Payment verification failed."),
        )
    return result


@router.post(
    "/webhook",
    summary="Process Payment Provider Webhook",
    description="Idempotent endpoint to process asynchronous payment updates from external gateways.",
)
def process_webhook(
    payload: Dict[str, Any],
    x_webhook_id: str = Header(..., description="Unique provider event ID for idempotency"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return payment_gateway_service.process_webhook(
        event_id=x_webhook_id, payload=payload, db=db
    )
