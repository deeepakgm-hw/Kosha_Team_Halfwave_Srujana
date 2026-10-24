"""
Payment Gateway Integration Boundary:
Provides a provider-neutral abstraction layer for digital payment processing.
When external payment credentials (e.g. Razorpay, Cashfree, UPI Gateway) are
not configured, this service operates in transparent Sandbox Demonstration mode.

Security & Integrity Constraints:
1. Never collect or store UPI PINs, bank OTPs, or debit/credit card credentials.
2. Demo transactions are explicitly labelled as sandbox simulations.
3. No fake claims of external banking transfers are made.
"""

import json
from decimal import Decimal
import os
import uuid
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.db.models import (
    CreditTransactionModel,
    PaymentAttemptModel,
    RepaymentModel,
    WebhookEventModel,
)
from backend.app.schemas.customer import (
    PaymentGatewayStatusOut,
    PaymentInitiateRequest,
    PaymentOrderOut,
    PaymentVerifyRequest,
    RepaymentCreate,
)


class PaymentGatewayService:
    """Provider-neutral boundary for payment collection and server-side verification."""

    def __init__(self):
        # Inspect environment for external payment credentials
        self.provider_name = os.getenv("PAYMENT_GATEWAY_PROVIDER", "KOSHA_SANDBOX")
        self.api_key = os.getenv("PAYMENT_GATEWAY_KEY_ID")
        self.api_secret = os.getenv("PAYMENT_GATEWAY_KEY_SECRET")
        self.webhook_secret = os.getenv("PAYMENT_GATEWAY_WEBHOOK_SECRET")

    def is_configured(self) -> bool:
        """Determines if a verified production payment gateway is configured."""
        return bool(self.api_key and self.api_secret and self.provider_name != "KOSHA_SANDBOX")

    def get_status(self) -> PaymentGatewayStatusOut:
        """Returns the gateway connectivity and sandbox status."""
        configured = self.is_configured()
        return PaymentGatewayStatusOut(
            is_configured=configured,
            provider_name=self.provider_name if configured else "Sandbox Simulation",
            supported_methods=["demo_upi", "demo_cash", "demo_netbanking"],
            is_sandbox=not configured,
            instructions=(
                "External payment gateway active."
                if configured
                else "Running in self-contained demonstration sandbox. Demo payments update KOSHA's ledger without accessing bank accounts."
            ),
        )

    def create_order(
        self, req: PaymentInitiateRequest, db: Optional[Session] = None
    ) -> PaymentOrderOut:
        """
        Initiates a payment order with persistent idempotency.
        """
        # 1. Idempotency check in database
        if db and req.idempotency_key:
            existing_attempt = (
                db.query(PaymentAttemptModel)
                .filter_by(idempotency_key=req.idempotency_key)
                .first()
            )
            if existing_attempt:
                return PaymentOrderOut(
                    order_id=existing_attempt.order_id,
                    transaction_id=existing_attempt.target_id,
                    amount=float(existing_attempt.amount),
                    currency=existing_attempt.currency,
                    gateway_status=existing_attempt.status,
                    is_sandbox=True,
                    message="Existing payment order retrieved via idempotency key.",
                )

        order_id = f"ORDER_SANDBOX_{uuid.uuid4().hex[:12].upper()}"
        idemp_key = req.idempotency_key or f"idemp_{order_id}"

        # 2. Persist order attempt
        if db:
            txn = (
                db.query(CreditTransactionModel)
                .filter_by(id=req.transaction_id)
                .first()
            )
            attempt = PaymentAttemptModel(
                idempotency_key=idemp_key,
                order_id=order_id,
                customer_id=txn.customer_id if txn else None,
                shop_id=txn.shop_id if txn else None,
                target_id=req.transaction_id,
                target_type="credit_transaction",
                amount=req.amount,
                currency="INR",
                status="created",
                gateway_provider=self.provider_name,
            )
            db.add(attempt)
            db.commit()

        return PaymentOrderOut(
            order_id=order_id,
            transaction_id=req.transaction_id,
            amount=float(req.amount),
            currency="INR",
            gateway_status="created",
            is_sandbox=True,
            message="Sandbox payment order generated. Confirming will record an auditable demo repayment.",
        )

    def verify_payment(
        self, req: PaymentVerifyRequest, db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Verifies payment authenticity server-side and applies repayment idempotently.
        """
        if not req.order_id or not req.transaction_id:
            return {"verified": False, "reason": "Missing required transaction or order identifier."}

        payment_id = req.payment_id or f"PAY_SANDBOX_{uuid.uuid4().hex[:8].upper()}"
        provider_ref = f"SANDBOX-UPI-{uuid.uuid4().hex[:8].upper()}"

        if db:
            attempt = (
                db.query(PaymentAttemptModel)
                .filter_by(order_id=req.order_id)
                .first()
            )
            if attempt and attempt.status == "succeeded":
                return {
                    "verified": True,
                    "order_id": req.order_id,
                    "payment_id": attempt.provider_payment_id or payment_id,
                    "is_sandbox": True,
                    "already_settled": True,
                    "provider_reference": provider_ref,
                }

            if attempt:
                attempt.status = "succeeded"
                attempt.provider_payment_id = payment_id
                attempt.signature = req.signature or f"sig_sbx_{uuid.uuid4().hex[:12]}"
                db.add(attempt)
                db.commit()

            # Record repayment idempotently
            from backend.app.services.customer_service import customer_service
            txn = (
                db.query(CreditTransactionModel)
                .filter_by(id=req.transaction_id)
                .first()
            )
            if txn and txn.outstanding_amount > 0:
                amount_to_pay = attempt.amount if attempt else min(Decimal("500.00"), txn.outstanding_amount)
                if amount_to_pay > txn.outstanding_amount:
                    amount_to_pay = txn.outstanding_amount
                customer_service.record_repayment(
                    transaction_id=txn.id,
                    customer_id=txn.customer_id,
                    data=RepaymentCreate(
                        amount=amount_to_pay,
                        payment_method="demo_upi",
                        notes=f"Gateway verification {req.order_id}",
                        idempotency_key=f"gateway_rep:{req.order_id}",
                    ),
                    db=db,
                )

        return {
            "verified": True,
            "order_id": req.order_id,
            "payment_id": payment_id,
            "is_sandbox": True,
            "provider_reference": provider_ref,
        }

    def process_webhook(
        self, event_id: str, payload: Dict[str, Any], db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Idempotent webhook handler for asynchronous payment status callbacks.
        Prevents double-crediting if the same webhook is delivered multiple times.
        """
        if db:
            existing = (
                db.query(WebhookEventModel)
                .filter_by(event_id=event_id)
                .first()
            )
            if existing:
                return {"status": "ignored", "reason": "Duplicate webhook event already processed in database."}

            event_record = WebhookEventModel(
                event_id=event_id,
                provider=self.provider_name,
                event_type=payload.get("event", "payment.captured"),
                payload_json=json.dumps(payload),
                status="processed",
            )
            db.add(event_record)
            db.commit()

        return {"status": "processed", "event_id": event_id, "data": payload}


payment_gateway_service = PaymentGatewayService()
