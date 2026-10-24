from datetime import date
from decimal import Decimal
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException, NotFoundException
from backend.app.db.database import get_db
from backend.app.db.models import BankTransactionModel, BusinessModel, ImportBatchModel
from backend.app.schemas.cashflow import BankTransactionOut, CsvImportResult
from backend.app.services.import_service import import_service

router = APIRouter()


@router.post(
    "/statements/import-csv",
    response_model=CsvImportResult,
    status_code=status.HTTP_200_OK,
    summary="Import Bank Statement CSV",
    description=(
        "Uploads and commits bank statement CSV rows atomically. "
        "Performs file encoding validation, date parsing, Decimal monetary conversion, "
        "and SHA256 cryptographic deduplication. Rejects duplicate files and rows safely."
    ),
)
async def import_csv_statement(
    business_id: str = Form(..., description="Target business identifier"),
    bank_account_id: Optional[str] = Form(None, description="Optional bank account ID"),
    amount_sign_mode: str = Form("standard", description="'standard' (positive=inflow) or 'inverted'"),
    column_mapping_json: Optional[str] = Form(None, description="Optional JSON string mapping column headers"),
    opening_balance: Optional[str] = Form(None, description="Optional verified opening ledger balance"),
    opening_balance_date: Optional[str] = Form(None, description="Optional date of opening balance (YYYY-MM-DD)"),
    file: UploadFile = File(..., description="Bank statement CSV file"),
    db: Session = Depends(get_db),
) -> CsvImportResult:
    if not file.filename.lower().endswith((".csv", ".txt")):
        raise AppException(status_code=400, message="Uploaded file must be a CSV or text file.", code="INVALID_FILE_TYPE")

    file_bytes = await file.read()
    if not file_bytes:
        raise AppException(status_code=400, message="Uploaded file is empty.", code="EMPTY_FILE")

    custom_mapping = None
    if column_mapping_json:
        try:
            custom_mapping = json.loads(column_mapping_json)
        except Exception:
            raise AppException(status_code=400, message="Invalid JSON for column_mapping_json", code="INVALID_MAPPING")

    parsed_opening_balance: Optional[Decimal] = None
    if opening_balance is not None and str(opening_balance).strip() != "":
        clean_bal = str(opening_balance).strip().replace(",", "").replace("₹", "").replace("$", "")
        try:
            parsed_opening_balance = Decimal(clean_bal)
        except Exception:
            raise AppException(
                status_code=422,
                message=f"Invalid monetary opening balance: '{opening_balance}'",
                code="INVALID_OPENING_BALANCE",
            )

    parsed_opening_date: Optional[date] = None
    if opening_balance_date is not None and str(opening_balance_date).strip() != "":
        clean_date_str = str(opening_balance_date).strip()
        try:
            from backend.app.domain.csv_importer import parse_date
            parsed_opening_date = parse_date(clean_date_str)
        except Exception:
            raise AppException(
                status_code=422,
                message=f"Invalid opening balance date format: '{opening_balance_date}'",
                code="INVALID_OPENING_DATE",
            )

    result = import_service.import_csv_statement(
        db=db,
        business_id=business_id,
        filename=file.filename,
        file_bytes=file_bytes,
        bank_account_id=bank_account_id,
        opening_balance=parsed_opening_balance,
        opening_balance_date=parsed_opening_date,
        custom_mapping=custom_mapping,
        amount_sign_mode=amount_sign_mode,
    )
    return CsvImportResult.model_validate(result)


@router.get(
    "/statements/duplicates/audit",
    summary="Audit Statement Duplicates",
    description="Inspects database records for confirmed and probable duplicate transactions.",
)
def audit_statement_duplicates(
    business_id: str = Query(..., description="Target business identifier"),
    db: Session = Depends(get_db),
):
    return import_service.audit_existing_duplicates(db=db, business_id=business_id)


@router.post(
    "/statements/duplicates/cleanup",
    summary="Cleanup Confirmed Duplicates",
    description="Safely removes redundant duplicate transactions. Supports dry-run preview.",
)
def cleanup_statement_duplicates(
    business_id: str = Query(..., description="Target business identifier"),
    dry_run: bool = Query(True, description="When true, previews changes without altering database"),
    db: Session = Depends(get_db),
):
    return import_service.cleanup_duplicates(db=db, business_id=business_id, dry_run=dry_run)


@router.get(
    "/transactions",
    response_model=List[BankTransactionOut],
    summary="List Imported Transactions",
    description="Returns settled bank transactions with optional date and type filtering.",
)
def list_transactions(
    business_id: str = Query(..., description="Target business identifier"),
    bank_account_id: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None, description="'credit' or 'debit'"),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> List[BankTransactionOut]:
    biz = db.query(BusinessModel).filter_by(id=business_id).first()
    if not biz:
        raise NotFoundException(f"Business '{business_id}' not found.")

    query = db.query(BankTransactionModel).filter_by(business_id=business_id)
    if bank_account_id:
        query = query.filter_by(bank_account_id=bank_account_id)
    if transaction_type:
        query = query.filter_by(transaction_type=transaction_type.lower())

    txns = query.order_by(BankTransactionModel.transaction_date.desc()).limit(limit).all()
    return [
        BankTransactionOut(
            id=t.id,
            business_id=t.business_id,
            bank_account_id=t.bank_account_id,
            transaction_date=t.transaction_date,
            description=t.description,
            amount=float(t.amount),
            transaction_type=t.transaction_type,
            external_reference=t.external_reference,
            is_reconciled=t.is_reconciled,
        )
        for t in txns
    ]
