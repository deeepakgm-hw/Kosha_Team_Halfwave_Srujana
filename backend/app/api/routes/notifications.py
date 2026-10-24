from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from datetime import datetime

from backend.app.db.database import get_db
from backend.app.services.reminder_service import reminder_service

router = APIRouter()


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    notification_key: str
    recipient_type: str
    recipient_id: str
    channel: str
    title: str
    message: str
    urgency: str
    is_read: bool
    created_at: datetime


@router.post(
    "/evaluate",
    summary="Evaluate Repayment Reminders",
    description="Triggers scheduled reminder evaluation in Asia/Kolkata timezone. Deduplicates notifications automatically.",
)
def evaluate_reminders(db: Session = Depends(get_db)) -> Dict[str, Any]:
    return reminder_service.evaluate_and_generate_reminders(db=db)


@router.get(
    "",
    response_model=List[NotificationOut],
    summary="List Notifications",
    description="Returns persistent in-app notifications for a customer or merchant profile.",
)
def list_notifications(
    recipient_type: str = Query(..., description="'customer' or 'merchant'"),
    recipient_id: str = Query(..., description="Customer ID or Shop ID"),
    unread_only: bool = Query(False, description="Filter only unread notices"),
    db: Session = Depends(get_db),
) -> List[NotificationOut]:
    notifs = reminder_service.list_notifications(
        db=db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        unread_only=unread_only,
    )
    return [NotificationOut.model_validate(n) for n in notifs]


@router.post(
    "/{notification_id}/read",
    response_model=NotificationOut,
    summary="Mark Notification Read",
)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
) -> NotificationOut:
    notif = reminder_service.mark_notification_read(db=db, notification_id=notification_id)
    return NotificationOut.model_validate(notif)
