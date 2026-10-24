"""
Cash Calendar API Route.
Provides structured, categorized upcoming disbursements across a 42-day (6-week) treasury window:
Statutory compliance dues, workforce payroll, term loan repayments, supplier bills, and recurring operating expenses.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import OperatingExpenseModel, VendorBillModel
from backend.app.domain.statutory import get_upcoming_cash_calendar
from backend.app.schemas.cashflow import CalendarResponse

router = APIRouter()


@router.get(
    "",
    response_model=CalendarResponse,
    status_code=status.HTTP_200_OK,
    summary="Get 42-Day Cash Calendar Outflows",
    description=(
        "Returns scheduled outgoing cash commitments across a rolling 42-day window. "
        "Expands statutory deadlines (TDS, PF, ESI, GSTR-3B, Advance Tax) and integrates "
        "persisted vendor bills and recurring operating commitments."
    ),
)
def get_cash_calendar(
    business_id: str = Query("apex_precision_mfg", description="Business entity ID"),
    window_days: int = Query(42, ge=7, le=90, description="Rolling projection window in days (default 42)"),
    db: Session = Depends(get_db),
) -> CalendarResponse:
    """Retrieves 42-day calendar disbursements categorized by commitment type."""
    today = date.today()

    bills = (
        db.query(VendorBillModel)
        .filter(VendorBillModel.business_id == business_id, VendorBillModel.status != "paid")
        .all()
    )
    bill_dicts = [
        {
            "id": b.id,
            "bill_number": b.bill_number,
            "vendor_name": b.vendor_name,
            "amount": float(b.amount),
            "paid_amount": float(b.paid_amount),
            "due_date": b.due_date.isoformat(),
            "priority": b.priority,
            "notes": b.notes,
        }
        for b in bills
    ]

    opex = (
        db.query(OperatingExpenseModel)
        .filter(OperatingExpenseModel.business_id == business_id, OperatingExpenseModel.is_active == True)
        .all()
    )
    opex_dicts = [
        {
            "id": o.id,
            "title": o.title,
            "category": o.category,
            "amount": float(o.amount),
            "day_of_month": o.day_of_month,
        }
        for o in opex
    ]

    calendar_data = get_upcoming_cash_calendar(
        reference_date=today,
        window_days=window_days,
        vendor_bills=bill_dicts if bill_dicts else None,
        operating_expenses=opex_dicts if opex_dicts else None,
    )

    return CalendarResponse(**calendar_data)
