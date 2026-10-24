"""
Persistent Repayment Reminder & Notification Service:
Deduplicates repayment reminders using deterministic unique notification keys.
Interprets due dates strictly in 'Asia/Kolkata' timezone.
Supports in-app delivery and non-blocking scheduled execution.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import json
from typing import Any, Dict, List, Optional
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from backend.app.core.errors import NotFoundException
from backend.app.db.models import (
    CreditTransactionModel,
    CustomerModel,
    NotificationModel,
    RepaymentModel,
    ShopModel,
)

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")


def get_kolkata_today() -> date:
    """Returns the current date in Asia/Kolkata."""
    return datetime.now(KOLKATA_TZ).date()


class ReminderService:
    """Manages persistent reminders and deduplicated notifications."""

    def evaluate_and_generate_reminders(self, db: Session) -> Dict[str, Any]:
        """
        Scans all active credit transactions and creates deduplicated reminders.
        Guarantees that repeated executions on the same day never duplicate notifications.
        """
        today = get_kolkata_today()
        seven_days_later = today + timedelta(days=7)

        active_txns = (
            db.query(CreditTransactionModel)
            .filter(CreditTransactionModel.outstanding_amount > Decimal("0.00"))
            .all()
        )

        generated_notifications = []
        skipped_duplicates = 0

        for txn in active_txns:
            shop = txn.shop
            shop_name = shop.shop_name if shop else "Shop"
            due_date = txn.agreed_repayment_date
            diff_days = (due_date - today).days

            urgency: Optional[str] = None
            title: Optional[str] = None
            msg: Optional[str] = None

            if diff_days < 0:
                urgency = "overdue"
                days_overdue = abs(diff_days)
                title = "Payment Overdue Alert"
                msg = f"Your payment of ₹{txn.outstanding_amount:,.2f} for {txn.description} at {shop_name} is overdue by {days_overdue} day(s)."
            elif diff_days == 0:
                urgency = "due_today"
                title = "Payment Due Today"
                msg = f"Your payment of ₹{txn.outstanding_amount:,.2f} for {txn.description} at {shop_name} is due today."
            elif 0 < diff_days <= 3:
                urgency = "approaching"
                title = "Upcoming Due Reminder"
                msg = f"Reminder: ₹{txn.outstanding_amount:,.2f} at {shop_name} is due in {diff_days} day(s) ({due_date.strftime('%d %b %Y')})."
            elif 3 < diff_days <= 7:
                urgency = "upcoming"
                title = "Repayment Schedule Notice"
                msg = f"Notice: ₹{txn.outstanding_amount:,.2f} at {shop_name} scheduled for {due_date.strftime('%d %b %Y')}."

            if urgency and title and msg:
                # Deterministic deduplication key: customer + transaction + date + urgency
                customer_key = f"remind:cust:{txn.customer_id}:{txn.id}:{today.isoformat()}:{urgency}"
                existing = (
                    db.query(NotificationModel)
                    .filter_by(notification_key=customer_key)
                    .first()
                )

                if not existing:
                    notif = NotificationModel(
                        notification_key=customer_key,
                        recipient_type="customer",
                        recipient_id=txn.customer_id,
                        channel="in_app",
                        title=title,
                        message=msg,
                        urgency=urgency,
                        is_read=False,
                    )
                    db.add(notif)
                    generated_notifications.append(customer_key)
                else:
                    skipped_duplicates += 1

                # If overdue, also generate merchant receivable alert
                if urgency == "overdue" and txn.shop_id:
                    merchant_key = f"remind:shop:{txn.shop_id}:{txn.id}:{today.isoformat()}:overdue"
                    existing_m = (
                        db.query(NotificationModel)
                        .filter_by(notification_key=merchant_key)
                        .first()
                    )
                    if not existing_m:
                        cust_name = txn.customer.display_name if txn.customer else "Customer"
                        m_notif = NotificationModel(
                            notification_key=merchant_key,
                            recipient_type="merchant",
                            recipient_id=txn.shop_id,
                            channel="in_app",
                            title="Customer Credit Overdue",
                            message=f"{cust_name}'s due of ₹{txn.outstanding_amount:,.2f} ({txn.description}) is overdue by {abs(diff_days)} day(s).",
                            urgency="overdue",
                            is_read=False,
                        )
                        db.add(m_notif)
                        generated_notifications.append(merchant_key)
                    else:
                        skipped_duplicates += 1

        db.commit()

        return {
            "evaluation_date": today.isoformat(),
            "timezone": "Asia/Kolkata",
            "active_transactions_evaluated": len(active_txns),
            "generated_notifications_count": len(generated_notifications),
            "skipped_duplicates_count": skipped_duplicates,
        }

    def list_notifications(
        self, db: Session, recipient_type: str, recipient_id: str, unread_only: bool = False
    ) -> List[NotificationModel]:
        """Lists persistent notifications for a customer or merchant."""
        q = db.query(NotificationModel).filter_by(
            recipient_type=recipient_type, recipient_id=recipient_id
        )
        if unread_only:
            q = q.filter_by(is_read=False)
        return q.order_by(NotificationModel.created_at.desc()).limit(50).all()

    def mark_notification_read(self, db: Session, notification_id: str) -> NotificationModel:
        """Marks a notification as read."""
        notif = db.query(NotificationModel).filter_by(id=notification_id).first()
        if not notif:
            raise NotFoundException(f"Notification '{notification_id}' not found.")
        notif.is_read = True
        db.commit()
        db.refresh(notif)
        return notif

    def notify_payment_confirmed(
        self, db: Session, txn: CreditTransactionModel, repayment: RepaymentModel
    ) -> None:
        """
        Emits idempotent payment confirmation notifications to customer and merchant.
        """
        today = get_kolkata_today()
        shop_name = txn.shop.shop_name if txn.shop else "Shop"
        cust_name = txn.customer.display_name if txn.customer else "Customer"

        # 1. Customer Notification
        cust_key = f"pay_confirm:cust:{txn.customer_id}:{repayment.id}"
        if not db.query(NotificationModel).filter_by(notification_key=cust_key).first():
            db.add(
                NotificationModel(
                    notification_key=cust_key,
                    recipient_type="customer",
                    recipient_id=txn.customer_id,
                    channel="in_app",
                    title="Payment Confirmed",
                    message=f"Payment of ₹{repayment.amount:,.2f} recorded at {shop_name}. Remaining due: ₹{txn.outstanding_amount:,.2f}.",
                    urgency="payment_confirmed",
                    is_read=False,
                )
            )

        # 2. Merchant Notification
        if txn.shop_id:
            shop_key = f"pay_confirm:shop:{txn.shop_id}:{repayment.id}"
            if not db.query(NotificationModel).filter_by(notification_key=shop_key).first():
                db.add(
                    NotificationModel(
                        notification_key=shop_key,
                        recipient_type="merchant",
                        recipient_id=txn.shop_id,
                        channel="in_app",
                        title="Payment Collected",
                        message=f"Received ₹{repayment.amount:,.2f} from {cust_name} for {txn.description}. Balance: ₹{txn.outstanding_amount:,.2f}.",
                        urgency="payment_confirmed",
                        is_read=False,
                    )
                )

        db.commit()


reminder_service = ReminderService()
