"""
Customer Dispute and Record Correction Service for KOSHA.
Enforces:
1. Customers can flag incorrect bill amounts, missing payments, or disputed AutoPay debits.
2. Opening a dispute freezes automatic collection on that obligation (status = 'disputed').
3. Multi-tenant merchant dispute resolution with auditable notes.
4. Automatic TrustScore recalculation on dispute creation and resolution.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from backend.app.core.errors import AppException, NotFoundException
from backend.app.db.models import (
    ActivityEventModel,
    CreditTransactionModel,
    CustomerModel,
    NotificationModel,
    RepaymentDisputeModel,
    ShopModel,
)
from backend.app.services.trustscore_service import trustscore_service

logger = logging.getLogger("kosha.disputes")


class DisputeService:
    """Manages billing dispute lifecycles and ledger corrections."""

    def raise_dispute(
        self,
        customer_id: str,
        bill_id: str,
        dispute_type: str,
        description: str,
        db: Session,
    ) -> RepaymentDisputeModel:
        """
        Customer flags an inaccurate bill or missing payment.
        Freezes automatic collection by setting bill.status = 'disputed'.
        """
        bill = db.query(CreditTransactionModel).filter_by(id=bill_id).first()
        if not bill:
            raise NotFoundException(f"Bill '{bill_id}' not found.")

        if bill.customer_id != customer_id:
            raise AppException(status_code=403, message="Unauthorized to dispute obligations of another customer.")

        # Check if active dispute already exists
        existing = (
            db.query(RepaymentDisputeModel)
            .filter(
                RepaymentDisputeModel.bill_id == bill_id,
                RepaymentDisputeModel.status.in_(["opened", "under_review"]),
            )
            .first()
        )
        if existing:
            raise AppException(status_code=400, message="An active dispute is already open for this obligation.")

        prior_status = bill.status
        bill.status = "disputed"
        db.add(bill)

        dispute_id = f"disp_{uuid.uuid4().hex[:16]}"
        dispute = RepaymentDisputeModel(
            id=dispute_id,
            bill_id=bill.id,
            customer_id=customer_id,
            shop_id=bill.shop_id,
            business_id=bill.shop_id,
            dispute_type=dispute_type,
            description=description,
            status="opened",
            prior_bill_status=prior_status,
            created_at=datetime.now(timezone.utc),
        )
        db.add(dispute)

        # Notify merchant
        shop = bill.shop
        shop_name = shop.shop_name if shop else "Merchant"
        notif = NotificationModel(
            notification_key=f"disp_notif:{dispute_id}",
            recipient_type="merchant",
            recipient_id=bill.shop_id or "default_merchant",
            channel="in_app",
            title=f"Dispute Opened: Bill {bill.reference}",
            message=f"Customer opened a dispute ({dispute_type.replace('_', ' ').title()}) for Bill {bill.reference}: {description[:80]}",
            urgency="upcoming",
        )
        db.add(notif)

        # Customer activity event
        event = ActivityEventModel(
            customer_id=customer_id,
            transaction_id=bill.id,
            event_type="dispute_opened",
            title=f"Dispute Opened: {bill.reference}",
            description=f"You flagged a dispute for {bill.reference} at {shop_name}. Automatic collections are paused.",
            amount=bill.outstanding_amount,
        )
        db.add(event)

        db.commit()
        db.refresh(dispute)

        # Recalculate TrustScore (excluding disputed bill from overdue penalties)
        try:
            trustscore_service.calculate_and_save_snapshot(
                customer_id=customer_id,
                db=db,
                trigger_reason=f"dispute_opened_{bill.reference}",
            )
        except Exception as e:
            logger.warning(f"Could not recalculate TrustScore after dispute: {e}")

        logger.info(f"Dispute {dispute.id} created for bill {bill.id} by customer {customer_id}")
        return dispute

    def list_customer_disputes(self, customer_id: str, db: Session) -> List[Dict[str, Any]]:
        """Returns all disputes opened by a customer."""
        disputes = (
            db.query(RepaymentDisputeModel)
            .filter_by(customer_id=customer_id)
            .order_by(RepaymentDisputeModel.created_at.desc())
            .all()
        )
        return [
            {
                "id": d.id,
                "bill_id": d.bill_id,
                "bill_reference": d.bill.reference if d.bill else "N/A",
                "shop_name": d.shop.shop_name if d.shop else "Merchant Shop",
                "dispute_type": d.dispute_type,
                "description": d.description,
                "status": d.status,
                "resolution_action": d.resolution_action,
                "resolution_notes": d.resolution_notes,
                "created_at": d.created_at.isoformat(),
                "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            }
            for d in disputes
        ]

    def list_shop_disputes(
        self,
        shop_id_or_code: str,
        db: Session,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Lists disputes for a specific shopkeeper."""
        shop = (
            db.query(ShopModel)
            .filter(
                (ShopModel.id == shop_id_or_code) | (ShopModel.shop_code == shop_id_or_code)
            )
            .first()
        )
        shop_id = shop.id if shop else shop_id_or_code

        q = db.query(RepaymentDisputeModel).filter_by(shop_id=shop_id)
        if status:
            q = q.filter_by(status=status)

        disputes = q.order_by(RepaymentDisputeModel.created_at.desc()).all()

        return [
            {
                "id": d.id,
                "bill_id": d.bill_id,
                "bill_reference": d.bill.reference if d.bill else "N/A",
                "customer_name": d.customer.display_name if d.customer else "Customer",
                "customer_phone": d.customer.phone if d.customer else None,
                "purchase_amount": float(d.bill.purchase_amount) if d.bill else 0.0,
                "outstanding_amount": float(d.bill.outstanding_amount) if d.bill else 0.0,
                "dispute_type": d.dispute_type,
                "description": d.description,
                "status": d.status,
                "resolution_action": d.resolution_action,
                "resolution_notes": d.resolution_notes,
                "created_at": d.created_at.isoformat(),
                "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            }
            for d in disputes
        ]

    def resolve_dispute(
        self,
        dispute_id: str,
        actor_id: str,
        resolution_action: str,  # balance_adjusted, payment_credited, deadline_extended, dispute_dismissed
        resolution_notes: str,
        adjusted_amount: Optional[Decimal] = None,
        extended_date: Optional[date] = None,
        db: Session = None,
    ) -> RepaymentDisputeModel:
        """
        Merchant resolves or rejects a dispute with documented explanation.
        Restores canonical bill status and updates ledger balance.
        """
        dispute = db.query(RepaymentDisputeModel).filter_by(id=dispute_id).first()
        if not dispute:
            raise NotFoundException(f"Dispute '{dispute_id}' not found.")

        if dispute.status in ("resolved", "rejected"):
            raise AppException(status_code=400, message="Dispute is already resolved.")

        bill = dispute.bill
        now_utc = datetime.now(timezone.utc)
        today = date.today()

        # Apply specific resolution action
        if resolution_action == "balance_adjusted" and adjusted_amount is not None:
            bill.outstanding_amount = max(Decimal("0.00"), adjusted_amount)
            dispute.status = "resolved"
        elif resolution_action == "deadline_extended" and extended_date is not None:
            bill.agreed_repayment_date = extended_date
            dispute.status = "resolved"
        elif resolution_action == "payment_credited":
            # If customer proved payment, mark bill as settled
            if adjusted_amount:
                bill.outstanding_amount = max(Decimal("0.00"), bill.outstanding_amount - adjusted_amount)
            else:
                bill.outstanding_amount = Decimal("0.00")
            dispute.status = "resolved"
        elif resolution_action == "dispute_dismissed":
            dispute.status = "rejected"
        else:
            dispute.status = "resolved"

        # Restore appropriate bill status based on remaining balance and dates
        if bill.outstanding_amount <= Decimal("0.00"):
            bill.status = "paid"
        else:
            if bill.agreed_repayment_date < today:
                bill.status = "overdue"
            elif bill.agreed_repayment_date == today:
                bill.status = "due_today"
            else:
                bill.status = "upcoming"

        db.add(bill)

        dispute.resolution_action = resolution_action
        dispute.resolution_notes = resolution_notes
        dispute.resolved_by = actor_id
        dispute.resolved_at = now_utc
        db.add(dispute)

        # Notify customer
        notif = NotificationModel(
            notification_key=f"disp_res:{dispute.id}:{int(now_utc.timestamp())}",
            recipient_type="customer",
            recipient_id=dispute.customer_id,
            channel="in_app",
            title=f"Dispute {dispute.status.title()}: Bill {bill.reference}",
            message=f"Merchant {dispute.status}: '{resolution_notes[:100]}'. Bill status updated to {bill.status}.",
            urgency="info" if dispute.status == "resolved" else "upcoming",
        )
        db.add(notif)

        db.commit()
        db.refresh(dispute)

        # Recalculate TrustScore
        try:
            trustscore_service.calculate_and_save_snapshot(
                customer_id=dispute.customer_id,
                db=db,
                trigger_reason=f"dispute_{dispute.status}_{bill.reference}",
            )
        except Exception as e:
            logger.warning(f"Could not recalculate TrustScore after dispute resolution: {e}")

        logger.info(f"Dispute {dispute.id} resolved with action {resolution_action} by {actor_id}")
        return dispute


dispute_service = DisputeService()
