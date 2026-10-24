from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException, NotFoundException
from backend.app.db.database import get_db
from backend.app.db.models import BankAccountModel, BusinessModel
from backend.app.schemas.cashflow import (
    BankAccountCreate,
    BankAccountOut,
    BusinessCreate,
    BusinessOut,
    BusinessStateSummary,
)
from backend.app.services.cashflow_service import cashflow_service

router = APIRouter()


@router.post(
    "/businesses",
    response_model=BusinessOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Business Profile",
    description="Registers a new enterprise profile with currency and MSME classification.",
)
def create_business(data: BusinessCreate, db: Session = Depends(get_db)) -> BusinessOut:
    if data.id:
        existing = db.query(BusinessModel).filter_by(id=data.id.strip()).first()
        if existing:
            raise AppException(status_code=409, message=f"Business ID '{data.id}' already exists.", code="BUSINESS_EXISTS")

    biz = BusinessModel(
        id=data.id.strip() if data.id else None,
        legal_name=data.legal_name.strip(),
        trade_name=data.trade_name.strip(),
        industry=data.industry.strip(),
        msme_category=data.msme_category.strip(),
        currency=data.currency.strip().upper(),
        registration_number=data.registration_number.strip() if data.registration_number else None,
        is_demo=data.is_demo,
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)
    return BusinessOut.model_validate(biz)


@router.get(
    "/businesses",
    response_model=List[BusinessOut],
    summary="List Registered Businesses",
)
def list_businesses(
    include_demo: bool = Query(True, description="Whether to include synthetic demo personas"),
    db: Session = Depends(get_db),
) -> List[BusinessOut]:
    query = db.query(BusinessModel)
    if not include_demo:
        query = query.filter_by(is_demo=False)
    businesses = query.order_by(BusinessModel.created_at.desc()).all()
    return [BusinessOut.model_validate(b) for b in businesses]


@router.get(
    "/businesses/{business_id}",
    response_model=BusinessOut,
    summary="Get Business Profile",
)
def get_business(business_id: str, db: Session = Depends(get_db)) -> BusinessOut:
    biz = db.query(BusinessModel).filter_by(id=business_id).first()
    if not biz:
        raise NotFoundException(f"Business '{business_id}' not found.")
    return BusinessOut.model_validate(biz)


@router.get(
    "/businesses/{business_id}/state",
    response_model=BusinessStateSummary,
    summary="Get Operational Cash State Summary",
    description="Returns settled bank funds, unpaid receivables/payables, and reconciliation state.",
)
def get_business_state(business_id: str, db: Session = Depends(get_db)) -> BusinessStateSummary:
    return cashflow_service.get_state_summary(business_id=business_id, db=db)


@router.post(
    "/businesses/{business_id}/accounts",
    response_model=BankAccountOut,
    status_code=status.HTTP_201_CREATED,
    summary="Configure Bank Account",
    description="Registers a bank account with verified or unverified opening balance.",
)
def create_bank_account(
    business_id: str,
    data: BankAccountCreate,
    db: Session = Depends(get_db),
) -> BankAccountOut:
    biz = db.query(BusinessModel).filter_by(id=business_id).first()
    if not biz:
        raise NotFoundException(f"Business '{business_id}' not found.")

    acc = BankAccountModel(
        business_id=biz.id,
        bank_name=(data.bank_name or "Imported Statement Account").strip(),
        account_number_mask=(data.account_number_mask or "...0000").strip(),
        currency=(data.currency or "INR").strip().upper(),
        opening_balance=data.opening_balance,
        opening_balance_date=data.opening_balance_date or date.today(),
        is_verified=data.is_verified,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return BankAccountOut(
        id=acc.id,
        business_id=acc.business_id,
        bank_name=acc.bank_name,
        account_number_mask=acc.account_number_mask,
        currency=acc.currency,
        opening_balance=float(acc.opening_balance),
        opening_balance_date=acc.opening_balance_date,
        is_verified=acc.is_verified,
        created_at=acc.created_at,
    )


@router.get(
    "/businesses/{business_id}/accounts",
    response_model=List[BankAccountOut],
    summary="List Bank Accounts",
)
def list_bank_accounts(business_id: str, db: Session = Depends(get_db)) -> List[BankAccountOut]:
    biz = db.query(BusinessModel).filter_by(id=business_id).first()
    if not biz:
        raise NotFoundException(f"Business '{business_id}' not found.")

    accounts = db.query(BankAccountModel).filter_by(business_id=biz.id).all()
    return [
        BankAccountOut(
            id=a.id,
            business_id=a.business_id,
            bank_name=a.bank_name,
            account_number_mask=a.account_number_mask,
            currency=a.currency,
            opening_balance=float(a.opening_balance),
            opening_balance_date=a.opening_balance_date,
            is_verified=a.is_verified,
            created_at=a.created_at,
        )
        for a in accounts
    ]
