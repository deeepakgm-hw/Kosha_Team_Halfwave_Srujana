from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.schemas.customer import ShopOut, ShopQrOut
from backend.app.services.customer_service import customer_service

router = APIRouter()


@router.get(
    "",
    response_model=List[ShopOut],
    summary="List Participating Shops",
    description="Returns all verified participating merchant shops available for shop credit.",
)
def list_shops(db: Session = Depends(get_db)) -> List[ShopOut]:
    return customer_service.list_shops(db=db)


@router.get(
    "/{shop_code}",
    response_model=ShopOut,
    summary="Resolve Shop by Code",
    description="Resolves a shop code or QR code payload to verify shop identity and metadata before payment.",
)
def get_shop_by_code(shop_code: str, db: Session = Depends(get_db)) -> ShopOut:
    return customer_service.get_shop_by_code(shop_code=shop_code, db=db)


@router.get(
    "/{shop_code}/qr",
    response_model=ShopQrOut,
    summary="Generate Shop QR Code",
    description="Generates authoritative QR code SVG payload and customer instructions for a merchant shop.",
)
def get_shop_qr(shop_code: str, db: Session = Depends(get_db)) -> ShopQrOut:
    return customer_service.get_shop_qr(shop_code=shop_code, db=db)
