"""
Production-Grade Database Cleanup, Deduplication, and Financial Reconciliation Service for KOSHA.
Features:
1. Dry-run mode for reporting planned deduplications before any destructive changes.
2. Transactional execution with automatic rollback on error.
3. Foreign key preservation and dependent reference migration.
4. Exact integer paise / Decimal balance recalculation enforcing financial invariants.
5. Repeatable and idempotent cleanup.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
import shutil
import sqlite3
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.app.core.errors import AppException
from backend.app.db.models import (
    ActivityEventModel,
    BankAccountModel,
    BankTransactionModel,
    BusinessModel,
    CreditTransactionModel,
    CustomerInvoiceModel,
    CustomerModel,
    ImportBatchModel,
    InvoicePaymentModel,
    OperatingExpenseModel,
    PaymentAttemptModel,
    PaymentRequestModel,
    PaymentVerificationModel,
    RepaymentModel,
    ShopModel,
    VendorBillModel,
    WebhookEventModel,
)


class DeduplicationReport:
    """Structured report tracking all inspected entities and actions taken."""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.businesses_merged: List[Dict[str, Any]] = []
        self.bank_transactions_deduped: List[Dict[str, Any]] = []
        self.bills_deduped: List[Dict[str, Any]] = []
        self.repayments_deduped: List[Dict[str, Any]] = []
        self.payment_requests_cleaned: List[Dict[str, Any]] = []
        self.balances_reconciled: List[Dict[str, Any]] = []
        self.flagged_for_review: List[Dict[str, Any]] = []
        self.before_counts: Dict[str, int] = {}
        self.after_counts: Dict[str, int] = {}
        self.before_totals: Dict[str, Decimal] = {}
        self.after_totals: Dict[str, Decimal] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dry_run": self.dry_run,
            "timestamp": self.timestamp,
            "businesses_merged_count": len(self.businesses_merged),
            "businesses_merged": self.businesses_merged,
            "bank_transactions_deduped_count": len(self.bank_transactions_deduped),
            "bank_transactions_deduped": self.bank_transactions_deduped,
            "bills_deduped_count": len(self.bills_deduped),
            "bills_deduped": self.bills_deduped,
            "repayments_deduped_count": len(self.repayments_deduped),
            "repayments_deduped": self.repayments_deduped,
            "payment_requests_cleaned_count": len(self.payment_requests_cleaned),
            "balances_reconciled_count": len(self.balances_reconciled),
            "balances_reconciled": self.balances_reconciled,
            "flagged_for_review_count": len(self.flagged_for_review),
            "flagged_for_review": self.flagged_for_review,
            "before_counts": self.before_counts,
            "after_counts": self.after_counts,
            "before_totals": {k: float(v) for k, v in self.before_totals.items()},
            "after_totals": {k: float(v) for k, v in self.after_totals.items()},
        }


class DeduplicationService:
    """Core deduplication and reconciliation engine."""

    @staticmethod
    def inr_to_paise(amount: Decimal | float | int) -> int:
        if isinstance(amount, (float, int)):
            amount = Decimal(str(amount))
        return int(round(amount * Decimal(100)))

    @staticmethod
    def paise_to_inr(paise: int) -> Decimal:
        return (Decimal(paise) / Decimal(100)).quantize(Decimal("0.01"))

    def capture_table_counts(self, db: Session) -> Dict[str, int]:
        """Captures exact row counts for all database tables."""
        return {
            "businesses": db.query(BusinessModel).count(),
            "bank_accounts": db.query(BankAccountModel).count(),
            "bank_transactions": db.query(BankTransactionModel).count(),
            "import_batches": db.query(ImportBatchModel).count(),
            "customer_invoices": db.query(CustomerInvoiceModel).count(),
            "vendor_bills": db.query(VendorBillModel).count(),
            "operating_expenses": db.query(OperatingExpenseModel).count(),
            "shops": db.query(ShopModel).count(),
            "customers": db.query(CustomerModel).count(),
            "customer_credit_transactions": db.query(CreditTransactionModel).count(),
            "customer_repayments": db.query(RepaymentModel).count(),
            "customer_activities": db.query(ActivityEventModel).count(),
            "payment_requests": db.query(PaymentRequestModel).count(),
            "payment_verifications": db.query(PaymentVerificationModel).count(),
            "payment_attempts": db.query(PaymentAttemptModel).count(),
            "webhook_events": db.query(WebhookEventModel).count(),
        }

    def capture_financial_totals(self, db: Session) -> Dict[str, Decimal]:
        """Captures baseline financial totals using precise Decimal arithmetic."""
        total_purchases = db.query(func.coalesce(func.sum(CreditTransactionModel.purchase_amount), 0)).scalar()
        total_initial_paid = db.query(func.coalesce(func.sum(CreditTransactionModel.initial_paid_amount), 0)).scalar()
        total_outstanding = db.query(func.coalesce(func.sum(CreditTransactionModel.outstanding_amount), 0)).scalar()

        total_repayments = (
            db.query(func.coalesce(func.sum(RepaymentModel.amount), 0))
            .filter(RepaymentModel.payment_status == "completed")
            .scalar()
        )

        total_invoices = db.query(func.coalesce(func.sum(CustomerInvoiceModel.amount), 0)).scalar()
        total_bills = db.query(func.coalesce(func.sum(VendorBillModel.amount), 0)).scalar()

        return {
            "total_credit_purchases": Decimal(str(total_purchases)),
            "total_credit_initial_paid": Decimal(str(total_initial_paid)),
            "total_credit_outstanding": Decimal(str(total_outstanding)),
            "total_completed_repayments": Decimal(str(total_repayments)),
            "total_invoices_ar": Decimal(str(total_invoices)),
            "total_bills_ap": Decimal(str(total_bills)),
        }

    # -------------------------------------------------------------------------
    # Core Step 1: Deduplicate Businesses
    # -------------------------------------------------------------------------

    def deduplicate_businesses(self, db: Session, report: DeduplicationReport):
        """
        Merges redundant business profiles sharing legal names (e.g., apex-precision into apex_precision_mfg).
        Migrates all child references before removing duplicate records.
        """
        # Canonical apex business is apex_precision_mfg
        canonical_id = "apex_precision_mfg"
        duplicate_id = "apex-precision"

        canonical_biz = db.query(BusinessModel).filter_by(id=canonical_id).first()
        duplicate_biz = db.query(BusinessModel).filter_by(id=duplicate_id).first()

        if canonical_biz and duplicate_biz:
            # Check dependent references
            acc_count = db.query(BankAccountModel).filter_by(business_id=duplicate_id).count()
            tx_count = db.query(BankTransactionModel).filter_by(business_id=duplicate_id).count()
            inv_count = db.query(CustomerInvoiceModel).filter_by(business_id=duplicate_id).count()
            bill_count = db.query(VendorBillModel).filter_by(business_id=duplicate_id).count()

            report.businesses_merged.append({
                "duplicate_id": duplicate_id,
                "canonical_id": canonical_id,
                "legal_name": canonical_biz.legal_name,
                "dependent_accounts_migrated": acc_count,
                "dependent_transactions_migrated": tx_count,
                "action": "repointed_and_deleted" if not report.dry_run else "planned_merge",
            })

            if not report.dry_run:
                # Re-point any child rows if any exist
                db.query(BankAccountModel).filter_by(business_id=duplicate_id).update({"business_id": canonical_id})
                db.query(BankTransactionModel).filter_by(business_id=duplicate_id).update({"business_id": canonical_id})
                db.query(CustomerInvoiceModel).filter_by(business_id=duplicate_id).update({"business_id": canonical_id})
                db.query(VendorBillModel).filter_by(business_id=duplicate_id).update({"business_id": canonical_id})
                db.query(OperatingExpenseModel).filter_by(business_id=duplicate_id).update({"business_id": canonical_id})
                db.query(ImportBatchModel).filter_by(business_id=duplicate_id).update({"business_id": canonical_id})
                db.delete(duplicate_biz)
                db.flush()

    # -------------------------------------------------------------------------
    # Core Step 2: Deduplicate Credit Transactions (Bills)
    # -------------------------------------------------------------------------

    def deduplicate_credit_bills(self, db: Session, report: DeduplicationReport):
        """
        Deduplicates unintentional duplicate bill creations sharing the same customer, shop,
        description, purchase amount, initial paid amount, and creation time window.
        Preserves canonical bill and migrates dependent repayments/requests.
        """
        # Find groups of bills with identical attributes
        bills = db.query(CreditTransactionModel).order_by(CreditTransactionModel.created_at.asc()).all()
        seen_keys: Dict[Tuple, CreditTransactionModel] = {}

        for b in bills:
            # Key based on customer + shop + purchase amount + initial paid + description
            norm_desc = b.description.strip().lower()
            key = (b.customer_id, b.shop_id, b.purchase_amount, b.initial_paid_amount, norm_desc)

            if key not in seen_keys:
                seen_keys[key] = b
            else:
                canonical = seen_keys[key]
                # Check if this duplicate was created in close succession (within 2 hours)
                time_diff = abs((b.created_at - canonical.created_at).total_seconds())
                if time_diff < 7200:  # 2 hours
                    report.bills_deduped.append({
                        "duplicate_id": b.id,
                        "duplicate_reference": b.reference,
                        "canonical_id": canonical.id,
                        "canonical_reference": canonical.reference,
                        "customer_id": b.customer_id,
                        "amount": float(b.purchase_amount),
                        "description": b.description,
                        "action": "migrated_and_deleted" if not report.dry_run else "planned_dedup",
                    })

                    if not report.dry_run:
                        # Migrate repayments on duplicate to canonical
                        db.query(RepaymentModel).filter_by(transaction_id=b.id).update({"transaction_id": canonical.id})
                        db.query(PaymentRequestModel).filter_by(bill_id=b.id).update({"bill_id": canonical.id})
                        db.query(PaymentVerificationModel).filter_by(bill_id=b.id).update({"bill_id": canonical.id})
                        db.query(ActivityEventModel).filter_by(transaction_id=b.id).update({"transaction_id": canonical.id})
                        db.delete(b)
                        db.flush()
                else:
                    report.flagged_for_review.append({
                        "entity": "credit_bill",
                        "bill_id": b.id,
                        "reference": b.reference,
                        "reason": "Matching description and amount, but created at separate times. Kept as distinct purchase.",
                    })

    # -------------------------------------------------------------------------
    # Core Step 3: Deduplicate Repayments
    # -------------------------------------------------------------------------

    def deduplicate_repayments(self, db: Session, report: DeduplicationReport):
        """
        Deduplicates exact duplicate repayments sharing the same transaction, amount,
        payment method, date, and provider reference / idempotency key.
        """
        repayments = db.query(RepaymentModel).order_by(RepaymentModel.created_at.asc()).all()
        seen_keys: Dict[Tuple, RepaymentModel] = {}

        for rep in repayments:
            # Distinguish legitimate separate counter payments from true duplicates
            # True duplicates have same transaction + amount + provider_reference or same idempotency_key
            if rep.provider_reference:
                key = (rep.transaction_id, rep.amount, rep.provider_reference)
            elif rep.idempotency_key:
                key = (rep.transaction_id, rep.idempotency_key)
            else:
                key = (rep.transaction_id, rep.amount, rep.repayment_date, rep.payment_method, rep.notes)

            if key not in seen_keys:
                seen_keys[key] = rep
            else:
                canonical = seen_keys[key]
                report.repayments_deduped.append({
                    "duplicate_id": rep.id,
                    "canonical_id": canonical.id,
                    "transaction_id": rep.transaction_id,
                    "amount": float(rep.amount),
                    "action": "deleted" if not report.dry_run else "planned_dedup",
                })
                if not report.dry_run:
                    db.delete(rep)
                    db.flush()

    # -------------------------------------------------------------------------
    # Core Step 4: Reconcile Financial Balances
    # -------------------------------------------------------------------------

    def reconcile_financial_balances(self, db: Session, report: DeduplicationReport):
        """
        Recalculates every bill's outstanding balance from authoritative ledger entries:
        Outstanding = max(0, purchase_amount - initial_paid_amount - sum(repayments WHERE status='completed' AND method!='initial_downpayment')).
        Enforces integer paise precision and syncs lifecycle status.
        """
        today = date.today()
        bills = db.query(CreditTransactionModel).all()

        for bill in bills:
            purchase_paise = self.inr_to_paise(bill.purchase_amount)
            initial_paise = self.inr_to_paise(bill.initial_paid_amount)

            # Sum valid completed repayments excluding initial_downpayment to prevent double counting
            valid_repayments = (
                db.query(RepaymentModel)
                .filter(
                    RepaymentModel.transaction_id == bill.id,
                    RepaymentModel.payment_status == "completed",
                    RepaymentModel.payment_method != "initial_downpayment",
                )
                .all()
            )
            repaid_paise = sum(self.inr_to_paise(r.amount) for r in valid_repayments)

            # Invariant: outstanding = max(0, purchase - initial - sum(repayments))
            derived_outstanding_paise = max(0, purchase_paise - initial_paise - repaid_paise)
            derived_outstanding = self.paise_to_inr(derived_outstanding_paise)

            recorded_outstanding = bill.outstanding_amount
            old_status = bill.status

            # Determine lifecycle status
            if derived_outstanding <= Decimal("0.00"):
                new_status = "paid"
            elif bill.agreed_repayment_date < today:
                new_status = "overdue"
            elif bill.agreed_repayment_date == today:
                new_status = "due_today"
            else:
                new_status = "upcoming"

            has_balance_change = abs(recorded_outstanding - derived_outstanding) > Decimal("0.001")
            has_status_change = old_status != new_status

            if has_balance_change or has_status_change:
                report.balances_reconciled.append({
                    "bill_id": bill.id,
                    "reference": bill.reference,
                    "customer_id": bill.customer_id,
                    "purchase_amount": float(bill.purchase_amount),
                    "initial_paid_amount": float(bill.initial_paid_amount),
                    "repayments_sum": float(self.paise_to_inr(repaid_paise)),
                    "old_outstanding": float(recorded_outstanding),
                    "new_outstanding": float(derived_outstanding),
                    "old_status": old_status,
                    "new_status": new_status,
                })

                if not report.dry_run:
                    bill.outstanding_amount = derived_outstanding
                    bill.status = new_status
                    db.add(bill)

        if not report.dry_run:
            db.flush()

    # -------------------------------------------------------------------------
    # Core Step 5: Clean Obsolete Payment Requests
    # -------------------------------------------------------------------------

    def cleanup_payment_requests(self, db: Session, report: DeduplicationReport):
        """
        Ensures bills only have one active payment request for the current outstanding balance.
        Marks older or obsolete requests as expired.
        """
        bills = db.query(CreditTransactionModel).all()
        now = datetime.now(timezone.utc)

        for bill in bills:
            active_requests = (
                db.query(PaymentRequestModel)
                .filter_by(bill_id=bill.id, status="active")
                .order_by(PaymentRequestModel.created_at.desc())
                .all()
            )

            if len(active_requests) > 1:
                # Keep latest request, expire older ones
                canonical_req = active_requests[0]
                for old_req in active_requests[1:]:
                    report.payment_requests_cleaned.append({
                        "request_id": old_req.id,
                        "bill_id": bill.id,
                        "amount_paise": old_req.amount_paise,
                        "action": "expired_duplicate" if not report.dry_run else "planned_expire",
                    })
                    if not report.dry_run:
                        old_req.status = "expired"
                        db.add(old_req)

            # If bill is fully paid, expire any active payment request
            if bill.status == "paid" and active_requests:
                for req in active_requests:
                    report.payment_requests_cleaned.append({
                        "request_id": req.id,
                        "bill_id": bill.id,
                        "reason": "Bill fully paid. Marking active payment request as expired.",
                        "action": "expired_paid_bill" if not report.dry_run else "planned_expire",
                    })
                    if not report.dry_run:
                        req.status = "expired"
                        db.add(req)

        if not report.dry_run:
            db.flush()

    # -------------------------------------------------------------------------
    # Master Execution Method
    # -------------------------------------------------------------------------

    def execute_cleanup(self, db: Session, dry_run: bool = True) -> DeduplicationReport:
        """
        Executes full deduplication and reconciliation pipeline.
        In dry_run mode (default), calculates everything without committing.
        In apply mode (dry_run=False), runs in a single transaction.
        """
        report = DeduplicationReport(dry_run=dry_run)
        report.before_counts = self.capture_table_counts(db)
        report.before_totals = self.capture_financial_totals(db)

        try:
            # 1. Deduplicate businesses
            self.deduplicate_businesses(db, report)

            # 2. Deduplicate credit bills
            self.deduplicate_credit_bills(db, report)

            # 3. Deduplicate repayments
            self.deduplicate_repayments(db, report)

            # 4. Reconcile balances
            self.reconcile_financial_balances(db, report)

            # 5. Clean payment requests
            self.cleanup_payment_requests(db, report)

            if not dry_run:
                db.commit()

            report.after_counts = self.capture_table_counts(db)
            report.after_totals = self.capture_financial_totals(db)

        except Exception as e:
            if not dry_run:
                db.rollback()
            raise AppException(status_code=500, message=f"Deduplication failed: {str(e)}", code="CLEANUP_FAILED")

        return report


deduplication_service = DeduplicationService()
