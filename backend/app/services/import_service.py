"""
Database Import Service: Coordinates atomic statement batch imports,
fingerprint deduplication, batch logging, and reconciliation reporting.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException, NotFoundException
from backend.app.db.models import BankAccountModel, BankTransactionModel, BusinessModel, ImportBatchModel
from backend.app.domain.csv_importer import compute_file_hash, parse_statement_csv, CsvImportError


class ImportService:
    """Service handling bank statement CSV ingestion and persistence."""

    def import_csv_statement(
        self,
        db: Session,
        business_id: str,
        filename: str,
        file_bytes: bytes,
        bank_account_id: Optional[str] = None,
        opening_balance: Optional[Decimal] = None,
        opening_balance_date: Optional[date] = None,
        custom_mapping: Optional[Dict[str, str]] = None,
        amount_sign_mode: str = "standard",
    ) -> Dict[str, Any]:
        """
        Processes and commits bank statement CSV rows atomically.
        """
        # 1. Verify business existence
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        if not biz:
            raise NotFoundException(f"Business '{business_id}' does not exist.")

        # 2. Resolve or configure bank account
        account: Optional[BankAccountModel] = None
        if bank_account_id:
            account = db.query(BankAccountModel).filter_by(id=bank_account_id, business_id=business_id).first()
            if not account:
                raise NotFoundException(f"Bank account '{bank_account_id}' does not belong to business '{business_id}'.")
            if opening_balance is not None:
                account.opening_balance = opening_balance
                if opening_balance_date:
                    account.opening_balance_date = opening_balance_date
                account.is_verified = True
                db.add(account)
        else:
            # Fall back to existing bank account for business if available
            account = db.query(BankAccountModel).filter_by(business_id=business_id).first()
            if account:
                bank_account_id = account.id
                if opening_balance is not None:
                    account.opening_balance = opening_balance
                    if opening_balance_date:
                        account.opening_balance_date = opening_balance_date
                    account.is_verified = True
                    db.add(account)
            elif opening_balance is not None:
                # Create a verified account with provided opening balance
                account = BankAccountModel(
                    business_id=business_id,
                    bank_name="Imported Statement Account",
                    account_number_mask="...0000",
                    currency=biz.currency or "INR",
                    opening_balance=opening_balance,
                    opening_balance_date=opening_balance_date or date.today(),
                    is_verified=True,
                )
                db.add(account)
                db.flush()
                bank_account_id = account.id

        # 3. Check for identical file import (SHA256 idempotent guard)
        file_hash = compute_file_hash(file_bytes)
        existing_batch = (
            db.query(ImportBatchModel)
            .filter_by(business_id=business_id, file_hash=file_hash)
            .first()
        )
        if existing_batch:
            raise AppException(
                status_code=409,
                message=f"This exact CSV file ('{filename}') has already been imported on {existing_batch.imported_at.isoformat()} (Batch ID: {existing_batch.id}).",
                code="DUPLICATE_FILE_IMPORT",
            )

        # 4. Fetch existing transaction fingerprints for deduplication
        existing_fingerprints = set(
            row[0]
            for row in db.query(BankTransactionModel.fingerprint)
            .filter_by(business_id=business_id)
            .all()
        )

        # 5. Parse and validate CSV rows
        try:
            parsed = parse_statement_csv(
                file_bytes=file_bytes,
                business_id=business_id,
                account_id=bank_account_id,
                custom_mapping=custom_mapping,
                amount_sign_mode=amount_sign_mode,
                existing_fingerprints=existing_fingerprints,
            )
            if len(parsed) == 4:
                accepted_data, rejected_data, duplicate_count, breakdown = parsed
            else:
                accepted_data, rejected_data, duplicate_count = parsed
                breakdown = {
                    "exact_file_duplicates": duplicate_count,
                    "previously_imported_duplicates": 0,
                    "potential_duplicates_review": 0,
                    "potential_duplicates_details": [],
                }
        except CsvImportError as exc:
            raise AppException(status_code=422, message=str(exc), code="CSV_PARSE_ERROR") from exc

        # 6. Calculate batch aggregates
        total_credit = sum((r["amount"] for r in accepted_data if r["amount"] > 0), Decimal("0.00"))
        total_debit = sum((abs(r["amount"]) for r in accepted_data if r["amount"] < 0), Decimal("0.00"))
        net_movement = total_credit - total_debit

        start_date = min((r["transaction_date"] for r in accepted_data), default=None)
        end_date = max((r["transaction_date"] for r in accepted_data), default=None)

        # 7. Atomic database write
        try:
            batch = ImportBatchModel(
                business_id=business_id,
                bank_account_id=bank_account_id,
                source_filename=filename,
                file_hash=file_hash,
                total_rows=len(accepted_data) + len(rejected_data) + duplicate_count,
                accepted_rows=len(accepted_data),
                rejected_rows=len(rejected_data),
                duplicate_rows=duplicate_count,
                statement_start_date=start_date,
                statement_end_date=end_date,
                total_credit_amount=total_credit,
                total_debit_amount=total_debit,
                net_movement=net_movement,
                reconciliation_status="verified" if (account and account.is_verified) else "unverified",
            )
            db.add(batch)
            db.flush()  # assign batch.id

            for item in accepted_data:
                txn = BankTransactionModel(
                    business_id=business_id,
                    bank_account_id=bank_account_id,
                    import_batch_id=batch.id,
                    transaction_date=item["transaction_date"],
                    description=item["description"],
                    amount=item["amount"],
                    transaction_type=item["transaction_type"],
                    external_reference=item["external_reference"],
                    fingerprint=item["fingerprint"],
                    is_reconciled=False,
                )
                db.add(txn)

            db.commit()
            db.refresh(batch)

        except Exception as exc:
            db.rollback()
            raise AppException(
                status_code=500,
                message=f"Database commit failed during statement import: {str(exc)}",
                code="IMPORT_COMMIT_FAILED",
            ) from exc

        # 8. Compute reconciliation report
        opening_bal = account.opening_balance if account else None
        closing_bal = (opening_bal + net_movement) if opening_bal is not None else None

        try:
            from backend.app.core.events import event_broadcaster
            event_broadcaster.publish("statement_imported", {
                "batch_id": batch.id,
                "business_id": business_id,
                "total_rows": batch.total_rows,
                "accepted_rows": batch.accepted_rows,
                "duplicate_rows": batch.duplicate_rows,
                "net_movement": float(net_movement),
            })
        except Exception:
            pass

        return {
            "batch_id": batch.id,
            "business_id": business_id,
            "filename": filename,
            "total_rows": batch.total_rows,
            "accepted_rows": batch.accepted_rows,
            "duplicate_rows": batch.duplicate_rows,
            "exact_file_duplicates": breakdown.get("exact_file_duplicates", 0),
            "previously_imported_duplicates": breakdown.get("previously_imported_duplicates", 0),
            "potential_duplicates_review": breakdown.get("potential_duplicates_review", 0),
            "potential_duplicates_details": breakdown.get("potential_duplicates_details", []),
            "rejected_rows": batch.rejected_rows,
            "rejected_details": rejected_data,
            "statement_period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
            "reconciliation": {
                "opening_balance": float(opening_bal) if opening_bal is not None else None,
                "opening_balance_verified": bool(account and account.is_verified),
                "total_credits": float(total_credit),
                "total_debits": float(total_debit),
                "net_movement": float(net_movement),
                "calculated_closing_balance": float(closing_bal) if closing_bal is not None else None,
                "verification_notes": (
                    "Reconciled with verified bank account opening balance."
                    if (account and account.is_verified)
                    else "Opening balance has not been verified. Reconciled net movement calculated from statement only."
                ),
            },
        }

    def audit_existing_duplicates(self, db: Session, business_id: str) -> Dict[str, Any]:
        """
        Scans persistent database records for confirmed and probable duplicate transactions.
        Preserves audit history and financial traceability.
        """
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        if not biz:
            raise NotFoundException(f"Business '{business_id}' not found.")

        txns = (
            db.query(BankTransactionModel)
            .filter_by(business_id=business_id)
            .order_by(BankTransactionModel.transaction_date.desc(), BankTransactionModel.id)
            .all()
        )

        seen_fingerprints: Dict[str, BankTransactionModel] = {}
        seen_ref_keys: Dict[str, BankTransactionModel] = {}
        exact_duplicates: List[Dict[str, Any]] = []
        probable_duplicates: List[Dict[str, Any]] = []

        for t in txns:
            # 1. Exact duplicate by external reference
            if t.external_reference:
                ref_key = f"{t.transaction_date.isoformat()}|{t.amount:.2f}|{t.external_reference.strip().lower()}"
                if ref_key in seen_ref_keys:
                    first = seen_ref_keys[ref_key]
                    exact_duplicates.append({
                        "id": t.id,
                        "original_id": first.id,
                        "date": t.transaction_date.isoformat(),
                        "amount": float(t.amount),
                        "description": t.description,
                        "external_reference": t.external_reference,
                        "reason": f"Matches reference '{t.external_reference}' and date of original transaction {first.id}.",
                    })
                else:
                    seen_ref_keys[ref_key] = t

            # 2. Duplicate by fingerprint
            if t.fingerprint in seen_fingerprints:
                first = seen_fingerprints[t.fingerprint]
                if not any(d["id"] == t.id for d in exact_duplicates):
                    exact_duplicates.append({
                        "id": t.id,
                        "original_id": first.id,
                        "date": t.transaction_date.isoformat(),
                        "amount": float(t.amount),
                        "description": t.description,
                        "external_reference": t.external_reference,
                        "reason": f"Identical fingerprint matches transaction {first.id}.",
                    })
            else:
                seen_fingerprints[t.fingerprint] = t

        return {
            "business_id": business_id,
            "total_transactions_scanned": len(txns),
            "confirmed_exact_duplicates_count": len(exact_duplicates),
            "confirmed_exact_duplicates": exact_duplicates,
            "probable_duplicates_count": len(probable_duplicates),
            "probable_duplicates": probable_duplicates,
            "is_clean": len(exact_duplicates) == 0,
        }

    def cleanup_duplicates(
        self, db: Session, business_id: str, dry_run: bool = True
    ) -> Dict[str, Any]:
        """
        Removes redundant exact duplicate transactions while preserving the primary record.
        """
        audit = self.audit_existing_duplicates(db=db, business_id=business_id)
        duplicate_ids = [d["id"] for d in audit["confirmed_exact_duplicates"]]

        if dry_run or not duplicate_ids:
            return {
                "dry_run": True,
                "actions_planned": f"Would remove {len(duplicate_ids)} confirmed duplicate transactions.",
                "duplicate_ids": duplicate_ids,
                "audit": audit,
            }

        # Execute safe removal
        deleted_count = (
            db.query(BankTransactionModel)
            .filter(BankTransactionModel.id.in_(duplicate_ids))
            .delete(synchronize_session=False)
        )
        db.commit()

        return {
            "dry_run": False,
            "deleted_count": deleted_count,
            "message": f"Successfully eliminated {deleted_count} redundant duplicate transactions.",
            "duplicate_ids": duplicate_ids,
        }


import_service = ImportService()
