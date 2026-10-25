"""
Razorpay Payment Gateway API Routes.
Provides:
1. Public client configuration (safe key_id, mode, merchant info).
2. Payment request creation (fixed or partial amounts in integer paise).
3. Server-side payment verification (browser callback validation & capture confirmation).
4. Official Razorpay webhook ingestion with constant-time HMAC signature verification.
5. Bill payment history and outstanding balance queries.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import (
    BillPaymentHistoryOut,
    PaymentGatewayStatusOut,
    PaymentInitiateRequest,
    PaymentOrderOut,
    PaymentVerifyRequest,
    RazorpayConfigOut,
    RazorpayPaymentRequestCreate,
    RazorpayPaymentRequestOut,
    RazorpayPaymentVerificationOut,
)
from backend.app.services.payment_gateway import payment_gateway_service
from backend.app.services.razorpay_service import razorpay_service

router = APIRouter()


@router.get(
    "/config",
    response_model=RazorpayConfigOut,
    summary="Get Public Razorpay Configuration",
    description="Returns public Key ID and Test/Live mode flags. Never returns API secrets.",
)
def get_razorpay_config() -> RazorpayConfigOut:
    return razorpay_service.get_public_config()


@router.get(
    "/status",
    response_model=PaymentGatewayStatusOut,
    summary="Get Payment Gateway Integration Status",
    description="Inspects whether production payment provider credentials are configured or test mode is active.",
)
def get_gateway_status() -> PaymentGatewayStatusOut:
    return payment_gateway_service.get_status()


@router.post(
    "/requests",
    response_model=RazorpayPaymentRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Razorpay UPI Payment Request",
    description="Creates an authorized Razorpay UPI payment request for a specific bill, with integer paise precision and dynamic QR generation.",
)
def create_payment_request(
    data: RazorpayPaymentRequestCreate,
    customer_id: Optional[str] = Query(None, description="Optional customer ID for authorization"),
    business_id: Optional[str] = Query(None, description="Optional business/shop ID for authorization"),
    db: Session = Depends(get_db),
) -> RazorpayPaymentRequestOut:
    # If partial_amount is given in INR, convert to paise
    amount_paise = data.amount_paise
    if amount_paise is None and data.partial_amount is not None:
        amount_paise = razorpay_service.inr_to_paise(data.partial_amount)

    req = razorpay_service.create_payment_request(
        bill_id=data.bill_id,
        amount_paise=amount_paise,
        customer_id=customer_id,
        business_id=business_id,
        idempotency_key=data.idempotency_key,
        db=db,
    )

    return RazorpayPaymentRequestOut(
        id=req.id,
        bill_id=req.bill_id,
        customer_id=req.customer_id,
        business_id=req.business_id,
        shop_id=req.shop_id,
        amount_paise=req.amount_paise,
        amount_inr=float(razorpay_service.paise_to_inr(req.amount_paise)),
        currency=req.currency,
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_link_id=req.razorpay_payment_link_id,
        razorpay_qr_id=req.razorpay_qr_id,
        upi_qr_payload=req.upi_qr_payload,
        qr_image_url=req.qr_image_url,
        short_url=req.short_url,
        status=req.status,
        failure_reason=req.failure_reason,
        idempotency_key=req.idempotency_key,
        expires_at=req.expires_at,
        created_at=req.created_at,
        is_test_mode=not razorpay_service.is_live_configured(),
        key_id=razorpay_service.get_public_config().key_id,
    )


@router.get(
    "/requests/{request_id}",
    response_model=RazorpayPaymentRequestOut,
    summary="Get Payment Request Status & QR",
)
def get_payment_request(
    request_id: str, db: Session = Depends(get_db)
) -> RazorpayPaymentRequestOut:
    from backend.app.db.models import PaymentRequestModel
    req = db.query(PaymentRequestModel).filter_by(id=request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail=f"Payment request '{request_id}' not found.")

    # Auto-sync with Razorpay if still active
    if req.status in ("active", "pending_verification"):
        try:
            razorpay_service.sync_payment_request_status(request_id, db)
            db.refresh(req)
        except Exception:
            pass

    return RazorpayPaymentRequestOut(
        id=req.id,
        bill_id=req.bill_id,
        customer_id=req.customer_id,
        business_id=req.business_id,
        shop_id=req.shop_id,
        amount_paise=req.amount_paise,
        amount_inr=float(razorpay_service.paise_to_inr(req.amount_paise)),
        currency=req.currency,
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_link_id=req.razorpay_payment_link_id,
        razorpay_qr_id=req.razorpay_qr_id,
        upi_qr_payload=req.upi_qr_payload,
        qr_image_url=req.qr_image_url,
        short_url=req.short_url,
        status=req.status,
        failure_reason=req.failure_reason,
        idempotency_key=req.idempotency_key,
        expires_at=req.expires_at,
        created_at=req.created_at,
        is_test_mode=not razorpay_service.is_live_configured(),
        key_id=razorpay_service.get_public_config().key_id,
    )


@router.post(
    "/requests/{request_id}/sync",
    summary="Real-Time Synchronization with Razorpay",
    description="Actively checks Razorpay API for live payment status, records verified payments or failures, and broadcasts SSE updates.",
)
def sync_payment_request(
    request_id: str, db: Session = Depends(get_db)
) -> Dict[str, Any]:
    return razorpay_service.sync_payment_request_status(request_id, db)


@router.post(
    "/requests/{request_id}/simulate-recognition",
    summary="Simulate Real-Time Payment Recognition",
    description="Simulates immediate payment success or failure for quick UI testing.",
)
async def simulate_payment_recognition(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    outcome = body.get("outcome", "success")
    reason = body.get("reason")
    return razorpay_service.simulate_recognition(request_id, outcome, reason, db)


@router.post(
    "/requests/{request_id}/regenerate",
    response_model=RazorpayPaymentRequestOut,
    summary="Regenerate Expired Payment Request",
    description="Regenerates an expired payment request for the remaining balance without creating duplicate bills.",
)
def regenerate_payment_request(
    request_id: str,
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> RazorpayPaymentRequestOut:
    req = razorpay_service.regenerate_payment_request(
        request_id=request_id, db=db, customer_id=customer_id
    )
    return RazorpayPaymentRequestOut(
        id=req.id,
        bill_id=req.bill_id,
        customer_id=req.customer_id,
        business_id=req.business_id,
        shop_id=req.shop_id,
        amount_paise=req.amount_paise,
        amount_inr=float(razorpay_service.paise_to_inr(req.amount_paise)),
        currency=req.currency,
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_link_id=req.razorpay_payment_link_id,
        razorpay_qr_id=req.razorpay_qr_id,
        upi_qr_payload=req.upi_qr_payload,
        qr_image_url=req.qr_image_url,
        short_url=req.short_url,
        status=req.status,
        failure_reason=req.failure_reason,
        idempotency_key=req.idempotency_key,
        expires_at=req.expires_at,
        created_at=req.created_at,
        is_test_mode=not razorpay_service.is_live_configured(),
        key_id=razorpay_service.get_public_config().key_id,
    )


@router.get(
    "/bills/{bill_id}/history",
    response_model=BillPaymentHistoryOut,
    summary="Get Bill Payment History & Outstanding Balance",
    description="Retrieves auditable payment history, showing identical verified balances in business and customer views.",
)
def get_bill_payment_history(
    bill_id: str,
    customer_id: Optional[str] = Query(None),
    business_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> BillPaymentHistoryOut:
    return razorpay_service.get_bill_payment_history(
        bill_id=bill_id,
        customer_id=customer_id,
        business_id=business_id,
        db=db,
    )


@router.post(
    "/verify",
    summary="Verify Payment Authenticity",
    description="Authoritatively verifies a Razorpay payment callback on the server side before updating the bill balance.",
)
def verify_payment(
    req: PaymentVerifyRequest,
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # Check if this is a Razorpay verification request
    if req.payment_id.startswith("pay_") or req.order_id.startswith("order_"):
        verif = razorpay_service.verify_server_payment(
            bill_id=req.transaction_id,
            razorpay_payment_id=req.payment_id,
            razorpay_order_id=req.order_id,
            razorpay_signature=req.signature,
            customer_id=customer_id,
            db=db,
        )
        return {
            "verified": True,
            "order_id": req.order_id,
            "payment_id": verif.razorpay_payment_id,
            "amount_inr": float(razorpay_service.paise_to_inr(verif.amount_paise)),
            "status": verif.status,
            "is_test_mode": not razorpay_service.is_live_configured(),
        }

    # Otherwise fallback to sandbox service for backwards compatibility
    result = payment_gateway_service.verify_payment(req, db=db)
    if not result.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("reason", "Payment verification failed."),
        )
    return result


@router.post(
    "/webhook",
    summary="Process Razorpay & Payment Provider Webhook",
    description="Official webhook endpoint. Verifies raw request body HMAC signature using constant-time comparison.",
)
async def process_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    x_webhook_id: Optional[str] = Header(None, alias="X-Webhook-Id"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    raw_body = await request.body()

    # 1. Razorpay Official Webhook Flow
    if x_razorpay_signature:
        return razorpay_service.handle_webhook(
            raw_body=raw_body,
            signature_header=x_razorpay_signature,
            db=db,
        )

    # 2. Legacy / Test Mock Webhook Flow with X-Webhook-Id
    if x_webhook_id:
        try:
            import json
            payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except Exception:
            payload = {}
        return payment_gateway_service.process_webhook(
            event_id=x_webhook_id, payload=payload, db=db
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Missing required webhook signature header (X-Razorpay-Signature).",
    )


# Backwards compatibility for legacy demo initiate
@router.post(
    "/initiate",
    response_model=PaymentOrderOut,
    summary="Initiate Digital Payment Order (Legacy)",
)
def initiate_payment(
    req: PaymentInitiateRequest, db: Session = Depends(get_db)
) -> PaymentOrderOut:
    return payment_gateway_service.create_order(req, db=db)
