"""
Service layer for KOSHA TrustScore calculation, snapshot persistence, and audit history.
Guarantees:
1. Strict calculation reproducibility via persisted TrustScoreSnapshotModel.
2. Cross-business privacy isolation (no merchant sees another merchant's financial data).
3. Automatic recalculation triggers on payments, bill updates, and dispute resolutions.
4. Transparent explainability metrics and factor breakdown.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
import json
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundException
from backend.app.db.models import (
    CreditTransactionModel,
    CustomerModel,
    RepaymentDisputeModel,
    RepaymentModel,
    ShopModel,
    TrustScoreSnapshotModel,
)
from backend.app.domain.trustscore import (
    ObligationRecord,
    TrustScoreFactors,
    calculate_trust_score,
)

logger = logging.getLogger("kosha.trustscore")


class TrustScoreService:
    """Manages internal customer repayment reliability scoring lifecycle."""

    def _load_customer_obligations(self, customer_id: str, db: Session) -> List[ObligationRecord]:
        """Loads and converts customer bills into domain ObligationRecord entities."""
        bills = (
            db.query(CreditTransactionModel)
            .filter_by(customer_id=customer_id)
            .all()
        )

        records: List[ObligationRecord] = []
        for b in bills:
            # Check for active dispute
            has_active_dispute = (
                db.query(RepaymentDisputeModel)
                .filter(
                    RepaymentDisputeModel.bill_id == b.id,
                    RepaymentDisputeModel.status.in_(["opened", "under_review"]),
                )
                .first()
                is not None
            )

            # Extract completed repayments
            repayments_data: List[Dict[str, Any]] = [
                {
                    "id": r.id,
                    "amount": float(r.amount),
                    "repayment_date": r.repayment_date,
                    "payment_status": r.payment_status,
                    "payment_method": r.payment_method,
                }
                for r in (b.repayments or [])
            ]

            records.append(
                ObligationRecord(
                    id=b.id,
                    purchase_amount=Decimal(str(b.purchase_amount)),
                    initial_paid=Decimal(str(b.initial_paid_amount)),
                    outstanding_amount=Decimal(str(b.outstanding_amount)),
                    transaction_date=b.transaction_date,
                    agreed_repayment_date=b.agreed_repayment_date,
                    status="disputed" if has_active_dispute else b.status,
                    is_disputed=has_active_dispute,
                    repayments=repayments_data,
                )
            )

        return records

    def calculate_and_save_snapshot(
        self,
        customer_id: str,
        db: Session,
        trigger_reason: str = "periodic_recalculation",
    ) -> TrustScoreSnapshotModel:
        """
        Executes pure domain TrustScore calculation and atomically records an immutable snapshot.
        Tracks score delta and stores full factor breakdown.
        """
        customer = db.query(CustomerModel).filter_by(id=customer_id).first()
        if not customer:
            raise NotFoundException(f"Customer '{customer_id}' not found.")

        # 1. Load obligations and run calculation
        records = self._load_customer_obligations(customer_id, db)
        factors: TrustScoreFactors = calculate_trust_score(records, evaluation_date=date.today())

        # 2. Get previous snapshot to compute delta
        prev_snap = (
            db.query(TrustScoreSnapshotModel)
            .filter_by(customer_id=customer_id)
            .order_by(TrustScoreSnapshotModel.calculation_timestamp.desc())
            .first()
        )

        prev_score = prev_snap.score if (prev_snap and prev_snap.score is not None) else None
        score_change = None
        if factors.total_score is not None and prev_score is not None:
            score_change = factors.total_score - prev_score

        # 3. Create persistent snapshot
        factors_data = {
            "on_time_score": factors.on_time_score,
            "overdue_frequency_duration_score": factors.overdue_frequency_duration_score,
            "current_overdue_ratio_score": factors.current_overdue_ratio_score,
            "recency_consistency_score": factors.recency_consistency_score,
            "positive_factors": factors.positive_factors,
            "risk_factors": factors.risk_factors,
            "methodology_notes": factors.methodology_notes,
            "trigger_reason": trigger_reason,
        }

        snap = TrustScoreSnapshotModel(
            id=f"tss_{uuid.uuid4().hex[:16]}",
            customer_id=customer_id,
            score=factors.total_score,
            score_category=factors.category,
            has_sufficient_history=factors.has_sufficient_history,
            model_version="v1.0-deterministic",
            on_time_performance_score=Decimal(str(factors.on_time_score)),
            overdue_frequency_duration_score=Decimal(str(factors.overdue_frequency_duration_score)),
            current_overdue_ratio_score=Decimal(str(factors.current_overdue_ratio_score)),
            recency_consistency_score=Decimal(str(factors.recency_consistency_score)),
            total_obligations_count=factors.total_obligations,
            completed_obligations_count=factors.completed_obligations,
            on_time_obligations_count=factors.on_time_obligations,
            late_obligations_count=factors.late_obligations,
            active_overdue_count=factors.active_overdue_obligations,
            total_borrowed_paise=factors.total_borrowed_paise,
            total_repaid_paise=factors.total_repaid_paise,
            current_outstanding_paise=factors.current_outstanding_paise,
            current_overdue_paise=factors.current_overdue_paise,
            on_time_ratio_pct=Decimal(str(factors.on_time_ratio_pct)),
            previous_score=prev_score,
            score_change=score_change,
            change_reason=trigger_reason,
            factors_json=json.dumps(factors_data),
            calculation_timestamp=datetime.now(timezone.utc),
        )

        db.add(snap)
        db.commit()
        db.refresh(snap)

        logger.info(
            f"TrustScore calculated for customer {customer_id}: "
            f"Score={factors.total_score} ({factors.category}), Delta={score_change}, Reason={trigger_reason}"
        )
        return snap

    def get_or_calculate_score(
        self,
        customer_id: str,
        db: Session,
        force_recalc: bool = False,
    ) -> Dict[str, Any]:
        """
        Retrieves the latest TrustScore snapshot, recalculating if absent or explicitly requested.
        """
        snap = (
            db.query(TrustScoreSnapshotModel)
            .filter_by(customer_id=customer_id)
            .order_by(TrustScoreSnapshotModel.calculation_timestamp.desc())
            .first()
        )

        if not snap or force_recalc:
            snap = self.calculate_and_save_snapshot(
                customer_id=customer_id,
                db=db,
                trigger_reason="on_demand_lookup" if snap else "initial_calculation",
            )

        factors_data = json.loads(snap.factors_json or "{}")

        return {
            "customer_id": snap.customer_id,
            "score": snap.score,
            "score_category": snap.score_category,
            "has_sufficient_history": snap.has_sufficient_history,
            "model_version": snap.model_version,
            "calculation_timestamp": snap.calculation_timestamp.isoformat(),
            "breakdown": {
                "on_time_performance": {
                    "score": float(snap.on_time_performance_score),
                    "max_score": 40.0,
                    "percentage": snap.score and round((float(snap.on_time_performance_score) / 40.0) * 100.0, 1),
                    "weight_description": "40% weight: Evaluates on-time settlement ratio on completed bills",
                },
                "overdue_frequency_duration": {
                    "score": float(snap.overdue_frequency_duration_score),
                    "max_score": 25.0,
                    "percentage": snap.score and round((float(snap.overdue_frequency_duration_score) / 25.0) * 100.0, 1),
                    "weight_description": "25% weight: Penalizes frequent late payments and extended overdue days",
                },
                "current_overdue_ratio": {
                    "score": float(snap.current_overdue_ratio_score),
                    "max_score": 20.0,
                    "percentage": snap.score and round((float(snap.current_overdue_ratio_score) / 20.0) * 100.0, 1),
                    "weight_description": "20% weight: Proportional to active overdue balance vs total obligations",
                },
                "recency_consistency": {
                    "score": float(snap.recency_consistency_score),
                    "max_score": 15.0,
                    "percentage": snap.score and round((float(snap.recency_consistency_score) / 15.0) * 100.0, 1),
                    "weight_description": "15% weight: Rewards verified repayment activity within last 30-90 days",
                },
            },
            "metrics": {
                "total_obligations": snap.total_obligations_count,
                "completed_obligations": snap.completed_obligations_count,
                "on_time_obligations": snap.on_time_obligations_count,
                "late_obligations": snap.late_obligations_count,
                "active_overdue_count": snap.active_overdue_count,
                "on_time_ratio_pct": float(snap.on_time_ratio_pct),
                "total_borrowed_inr": float(Decimal(snap.total_borrowed_paise) / Decimal(100)),
                "total_repaid_inr": float(Decimal(snap.total_repaid_paise) / Decimal(100)),
                "current_outstanding_inr": float(Decimal(snap.current_outstanding_paise) / Decimal(100)),
                "current_overdue_inr": float(Decimal(snap.current_overdue_paise) / Decimal(100)),
            },
            "delta": {
                "previous_score": snap.previous_score,
                "score_change": snap.score_change,
                "change_reason": snap.change_reason,
            },
            "signals": {
                "positive_factors": factors_data.get("positive_factors", []),
                "risk_factors": factors_data.get("risk_factors", []),
            },
            "methodology_notes": factors_data.get(
                "methodology_notes",
                "Internal repayment reliability scoring based on verified local shop obligations.",
            ),
        }

    def get_score_history(
        self,
        customer_id: str,
        db: Session,
        limit: int = 12,
    ) -> List[Dict[str, Any]]:
        """Returns chronological TrustScore snapshot history for trend visualization."""
        snaps = (
            db.query(TrustScoreSnapshotModel)
            .filter_by(customer_id=customer_id)
            .order_by(TrustScoreSnapshotModel.calculation_timestamp.asc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": s.id,
                "score": s.score,
                "score_category": s.score_category,
                "score_change": s.score_change,
                "change_reason": s.change_reason,
                "timestamp": s.calculation_timestamp.isoformat(),
                "on_time_ratio_pct": float(s.on_time_ratio_pct),
                "outstanding_inr": float(Decimal(s.current_outstanding_paise) / Decimal(100)),
            }
            for s in snaps
        ]

    def get_business_customer_profile(
        self,
        business_or_shop_id: str,
        customer_id: str,
        db: Session,
    ) -> Dict[str, Any]:
        """
        Multi-tenant business owner view of a customer's reliability profile.
        CRITICAL PRIVACY RULE:
        Exposes customer's overall TrustScore & reliability category,
        but strictly limits financial totals (billed volume, dues, overdue)
        to transactions associated with THIS MERCHANT ONLY!
        Never leaks another shop's transactions or balances.
        """
        # Resolve target shop
        shop = (
            db.query(ShopModel)
            .filter(
                (ShopModel.id == business_or_shop_id) | (ShopModel.shop_code == business_or_shop_id)
            )
            .first()
        )
        shop_id = shop.id if shop else business_or_shop_id

        # 1. Authoritative Customer TrustScore
        score_data = self.get_or_calculate_score(customer_id=customer_id, db=db)

        # 2. Filter transactions strictly for this merchant
        merchant_bills = (
            db.query(CreditTransactionModel)
            .filter(
                CreditTransactionModel.customer_id == customer_id,
                CreditTransactionModel.shop_id == shop_id,
            )
            .order_by(CreditTransactionModel.transaction_date.desc())
            .all()
        )

        tot_billed = Decimal("0.00")
        tot_outstanding = Decimal("0.00")
        tot_overdue = Decimal("0.00")
        active_bills = 0
        settled_bills = 0
        today = date.today()

        bill_summaries = []
        for b in merchant_bills:
            tot_billed += b.purchase_amount
            tot_outstanding += b.outstanding_amount
            is_overdue = b.agreed_repayment_date < today and b.outstanding_amount > Decimal("0.00")
            if is_overdue:
                tot_overdue += b.outstanding_amount

            if b.outstanding_amount <= Decimal("0.00"):
                settled_bills += 1
            else:
                active_bills += 1

            bill_summaries.append({
                "id": b.id,
                "reference": b.reference,
                "description": b.description,
                "purchase_amount": float(b.purchase_amount),
                "outstanding_amount": float(b.outstanding_amount),
                "agreed_repayment_date": b.agreed_repayment_date.isoformat(),
                "status": b.status,
            })

        customer = db.query(CustomerModel).filter_by(id=customer_id).first()

        return {
            "customer_id": customer_id,
            "customer_name": customer.display_name if customer else "Customer",
            "phone_masked": (customer.phone[:6] + " ****") if (customer and customer.phone) else None,
            "trust_score": score_data["score"],
            "score_category": score_data["score_category"],
            "has_sufficient_history": score_data["has_sufficient_history"],
            "overall_on_time_ratio_pct": score_data["metrics"]["on_time_ratio_pct"],
            "merchant_specific": {
                "shop_id": shop_id,
                "shop_name": shop.shop_name if shop else "Your Store",
                "total_billed_inr": float(tot_billed),
                "current_outstanding_inr": float(tot_outstanding),
                "current_overdue_inr": float(tot_overdue),
                "active_bills_count": active_bills,
                "settled_bills_count": settled_bills,
                "bills": bill_summaries,
            },
            "signals": score_data["signals"],
        }


trustscore_service = TrustScoreService()
