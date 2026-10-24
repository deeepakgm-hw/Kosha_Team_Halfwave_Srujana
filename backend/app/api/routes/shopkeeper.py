from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import (
    ShopOut,
    ShopkeeperRepaymentCreate,
    ShopkeeperSummaryOut,
    ShopkeeperTransactionOut,
)
from backend.app.services.customer_service import customer_service

router = APIRouter()

DEFAULT_SHOP_ID = "shop_apex_01"


@router.get(
    "/shop",
    response_model=ShopOut,
    summary="Get Active Shopkeeper Shop Profile",
    description="Returns metadata and verified status for the active shopkeeper merchant profile.",
)
def get_shopkeeper_shop(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopOut:
    return customer_service.get_shopkeeper_shop(shop_id_or_code=shop_id, db=db)


@router.get(
    "/shop/summary",
    response_model=ShopkeeperSummaryOut,
    summary="Get Shopkeeper Receivables Summary",
    description="Calculates live KPI metrics: Total customer receivables, collections today, due in 7 days, overdue balances, and debtor customer counts.",
)
def get_shopkeeper_summary(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopkeeperSummaryOut:
    return customer_service.get_shopkeeper_summary(shop_id_or_code=shop_id or DEFAULT_SHOP_ID, db=db)


@router.get(
    "/shop/transactions",
    response_model=List[ShopkeeperTransactionOut],
    summary="List Customer Credit Transactions for Shopkeeper",
    description="Returns filtered transactions scoped strictly to this merchant, including customer contact, payment history, and status.",
)
def get_shopkeeper_transactions(
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    status: Optional[str] = Query(None, description="'all', 'outstanding', 'due_today', 'upcoming', 'overdue', 'paid'"),
    search: Optional[str] = Query(None, description="Search by transaction reference or customer name"),
    db: Session = Depends(get_db),
) -> List[ShopkeeperTransactionOut]:
    return customer_service.get_shopkeeper_transactions(
        shop_id_or_code=shop_id or DEFAULT_SHOP_ID,
        filter_status=status,
        search=search,
        db=db,
    )


@router.post(
    "/transactions/{transaction_id}/repayments",
    response_model=ShopkeeperTransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record Payment Received Directly at Counter",
    description="Allows shopkeeper to record a customer payment received in cash or external transfer, updating the shared transaction record.",
)
def record_shopkeeper_repayment(
    transaction_id: str,
    data: ShopkeeperRepaymentCreate,
    shop_id: Optional[str] = Query(DEFAULT_SHOP_ID, description="Target shop ID or code"),
    db: Session = Depends(get_db),
) -> ShopkeeperTransactionOut:
    return customer_service.record_shopkeeper_repayment(
        transaction_id=transaction_id,
        shop_id_or_code=shop_id or DEFAULT_SHOP_ID,
        data=data,
        db=db,
    )
