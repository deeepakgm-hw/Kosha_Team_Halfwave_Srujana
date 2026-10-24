from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.cashflow import OperatingExpenseCreate, OperatingExpenseOut
from backend.app.services.billing_service import billing_service

router = APIRouter()


@router.post(
    "/operating-expenses",
    response_model=OperatingExpenseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Recurring Operating Expense",
    description="Registers fixed recurring outflows (factory payroll, shed rent, statutory tax installments).",
)
def create_operating_expense(
    business_id: str = Query(..., description="Target business identifier"),
    data: OperatingExpenseCreate = ...,
    db: Session = Depends(get_db),
) -> OperatingExpenseOut:
    exp = billing_service.create_operating_expense(
        db=db,
        business_id=business_id,
        title=data.title,
        category=data.category,
        amount=data.amount,
        frequency=data.frequency,
        day_of_month=data.day_of_month,
    )
    return OperatingExpenseOut(
        id=exp.id,
        business_id=exp.business_id,
        title=exp.title,
        category=exp.category,
        amount=float(exp.amount),
        frequency=exp.frequency,
        day_of_month=exp.day_of_month,
        is_active=exp.is_active,
        created_at=exp.created_at,
    )


@router.get(
    "/operating-expenses",
    response_model=List[OperatingExpenseOut],
    summary="List Operating Expenses",
)
def list_operating_expenses(
    business_id: str = Query(..., description="Target business identifier"),
    db: Session = Depends(get_db),
) -> List[OperatingExpenseOut]:
    expenses = billing_service.list_operating_expenses(db=db, business_id=business_id)
    return [
        OperatingExpenseOut(
            id=e.id,
            business_id=e.business_id,
            title=e.title,
            category=e.category,
            amount=float(e.amount),
            frequency=e.frequency,
            day_of_month=e.day_of_month,
            is_active=e.is_active,
            created_at=e.created_at,
        )
        for e in expenses
    ]
