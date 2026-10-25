"""
Pure domain logic for KOSHA TrustScore calculation.
Enforces:
1. Transparent, deterministic, rule-based reliability scoring (0 - 100).
2. Exact 4-factor weighting:
   - 40%: On-time repayment performance
   - 25%: Overdue frequency and duration penalty
   - 20%: Current verified overdue obligations ratio
   - 15%: Consistency and recency of verified repayments
3. Minimum history safeguard: Customers with < 2 recorded obligations are classified
   as 'insufficient_history' (New) instead of receiving a penalizing zero score.
4. Pure functions with zero database or network dependencies.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class TrustScoreFactors:
    on_time_score: float                  # Max 40.0
    overdue_frequency_duration_score: float # Max 25.0
    current_overdue_ratio_score: float    # Max 20.0
    recency_consistency_score: float      # Max 15.0

    total_score: Optional[int]            # 0 - 100 or None if insufficient history
    category: str                         # excellent, good, fair, needs_attention, insufficient_history
    has_sufficient_history: bool

    # Component metrics
    total_obligations: int
    completed_obligations: int
    on_time_obligations: int
    late_obligations: int
    active_overdue_obligations: int

    total_borrowed_paise: int
    total_repaid_paise: int
    current_outstanding_paise: int
    current_overdue_paise: int
    on_time_ratio_pct: float

    positive_factors: List[str]
    risk_factors: List[str]
    methodology_notes: str


@dataclass
class ObligationRecord:
    id: str
    purchase_amount: Decimal
    initial_paid: Decimal
    outstanding_amount: Decimal
    transaction_date: date
    agreed_repayment_date: date
    status: str                           # upcoming, due_today, overdue, paid, disputed, cancelled
    is_disputed: bool = False
    repayments: List[Dict[str, Any]] = field(default_factory=list)


def inr_to_paise(val: Decimal) -> int:
    return int((val * Decimal("100")).quantize(Decimal("1")))


def calculate_trust_score(
    obligations: List[ObligationRecord],
    evaluation_date: Optional[date] = None,
) -> TrustScoreFactors:
    """
    Computes deterministic KOSHA TrustScore from verified obligation records.
    Filters out disputed and cancelled bills from negative scoring penalties.
    """
    today = evaluation_date or date.today()

    # Filter active/valid obligations (ignore cancelled)
    valid_records = [b for b in obligations if b.status != "cancelled"]

    # Minimum history rule: At least 2 obligations required
    if len(valid_records) < 2:
        tot_borrowed = sum(inr_to_paise(b.purchase_amount) for b in valid_records)
        tot_outstanding = sum(inr_to_paise(b.outstanding_amount) for b in valid_records)
        tot_repaid = max(0, tot_borrowed - tot_outstanding)

        return TrustScoreFactors(
            on_time_score=0.0,
            overdue_frequency_duration_score=0.0,
            current_overdue_ratio_score=0.0,
            recency_consistency_score=0.0,
            total_score=None,
            category="insufficient_history",
            has_sufficient_history=False,
            total_obligations=len(valid_records),
            completed_obligations=0,
            on_time_obligations=0,
            late_obligations=0,
            active_overdue_obligations=0,
            total_borrowed_paise=tot_borrowed,
            total_repaid_paise=tot_repaid,
            current_outstanding_paise=tot_outstanding,
            current_overdue_paise=0,
            on_time_ratio_pct=0.0,
            positive_factors=["New customer account registered", "Awaiting sufficient repayment history"],
            risk_factors=[],
            methodology_notes="Customers with fewer than 2 obligations are marked 'New / Insufficient History' to avoid unfair penalties.",
        )

    # 1. Financial totals in exact integer paise
    total_borrowed_paise = sum(inr_to_paise(b.purchase_amount) for b in valid_records)
    current_outstanding_paise = sum(inr_to_paise(b.outstanding_amount) for b in valid_records)
    total_repaid_paise = max(0, total_borrowed_paise - current_outstanding_paise)

    # 2. Obligation status classification
    settled_bills = [b for b in valid_records if inr_to_paise(b.outstanding_amount) == 0 or b.status == "paid"]
    on_time_count = 0
    late_settled_count = 0

    for b in settled_bills:
        # Check last payment date relative to agreed repayment date
        completed_repayments = [
            r for r in b.repayments
            if r.get("payment_status") == "completed" or r.get("status") == "completed"
        ]
        if completed_repayments:
            last_date_str = max(r.get("repayment_date") for r in completed_repayments)
            last_date = last_date_str if isinstance(last_date_str, date) else date.fromisoformat(str(last_date_str)[:10])
            if last_date <= b.agreed_repayment_date:
                on_time_count += 1
            else:
                late_settled_count += 1
        else:
            # If paid at initial counter purchase
            if inr_to_paise(b.initial_paid) >= inr_to_paise(b.purchase_amount):
                on_time_count += 1
            else:
                on_time_count += 1

    # Active overdue obligations (exclude disputed ones from penalty)
    active_overdue_bills = [
        b for b in valid_records
        if inr_to_paise(b.outstanding_amount) > 0
        and b.agreed_repayment_date < today
        and not b.is_disputed
        and b.status != "disputed"
    ]
    current_overdue_paise = sum(inr_to_paise(b.outstanding_amount) for b in active_overdue_bills)

    # =========================================================================
    # Factor 1: On-time repayment performance (Weight: 40%)
    # =========================================================================
    if settled_bills:
        on_time_ratio = float(on_time_count) / float(len(settled_bills))
        on_time_score = round(on_time_ratio * 40.0, 2)
        on_time_ratio_pct = round(on_time_ratio * 100.0, 1)
    else:
        # If bills are active but none overdue yet, grant baseline performance
        if not active_overdue_bills:
            on_time_score = 32.0  # 80% baseline for good-standing active bills
            on_time_ratio_pct = 100.0
        else:
            on_time_score = 10.0
            on_time_ratio_pct = 0.0

    # =========================================================================
    # Factor 2: Overdue frequency and duration penalty (Weight: 25%)
    # =========================================================================
    overdue_score = 25.0
    # Overdue count penalty
    total_count = len(valid_records)
    overdue_events = len(active_overdue_bills) + late_settled_count
    if total_count > 0 and overdue_events > 0:
        freq_penalty = (float(overdue_events) / float(total_count)) * 12.0
        overdue_score -= freq_penalty

    # Duration penalty for active overdue bills
    max_days_overdue = 0
    for b in active_overdue_bills:
        days = (today - b.agreed_repayment_date).days
        if days > max_days_overdue:
            max_days_overdue = days

    if max_days_overdue > 30:
        overdue_score -= 13.0
    elif max_days_overdue > 14:
        overdue_score -= 8.0
    elif max_days_overdue > 7:
        overdue_score -= 4.0
    elif max_days_overdue > 0:
        overdue_score -= 2.0

    overdue_score = max(0.0, round(overdue_score, 2))

    # =========================================================================
    # Factor 3: Current verified overdue obligations ratio (Weight: 20%)
    # =========================================================================
    if current_overdue_paise == 0:
        current_overdue_ratio_score = 20.0
    else:
        denom = max(total_borrowed_paise, 1)
        overdue_ratio = min(1.0, float(current_overdue_paise) / float(denom))
        current_overdue_ratio_score = round(20.0 * (1.0 - overdue_ratio), 2)

    # =========================================================================
    # Factor 4: Consistency and recency of completed repayments (Weight: 15%)
    # =========================================================================
    # Find most recent completed repayment across all bills
    all_repayments = []
    for b in valid_records:
        for r in b.repayments:
            if r.get("payment_status") == "completed" or r.get("status") == "completed":
                r_date = r.get("repayment_date")
                if isinstance(r_date, str):
                    r_date = date.fromisoformat(r_date[:10])
                all_repayments.append(r_date)

    if all_repayments:
        most_recent_date = max(all_repayments)
        days_since_repayment = (today - most_recent_date).days
        if days_since_repayment <= 30:
            recency_score = 15.0
        elif days_since_repayment <= 60:
            recency_score = 12.0
        elif days_since_repayment <= 90:
            recency_score = 8.0
        else:
            recency_score = 5.0
    else:
        # No subsequent repayments, check recent downpayments
        recency_score = 8.0 if settled_bills else 5.0

    # =========================================================================
    # Total Score & Categorization
    # =========================================================================
    raw_total = on_time_score + overdue_score + current_overdue_ratio_score + recency_score
    total_score = int(round(min(100.0, max(0.0, raw_total))))

    if total_score >= 80:
        category = "excellent"
    elif total_score >= 65:
        category = "good"
    elif total_score >= 50:
        category = "fair"
    else:
        category = "needs_attention"

    # Positive & Risk signals
    positives: List[str] = []
    risks: List[str] = []

    if on_time_ratio_pct >= 90.0 and settled_bills:
        positives.append(f"{on_time_ratio_pct:.0f}% on-time repayment rate across {len(settled_bills)} settled obligations")
    elif on_time_ratio_pct >= 75.0:
        positives.append(f"Strong {on_time_ratio_pct:.0f}% on-time settlement record")

    if current_overdue_paise == 0:
        positives.append("Zero current overdue obligations across all participating shops")
    else:
        overdue_inr = float(Decimal(current_overdue_paise) / Decimal(100))
        risks.append(f"₹{overdue_inr:,.2f} currently overdue across {len(active_overdue_bills)} obligation(s)")

    if max_days_overdue > 0:
        risks.append(f"Oldest unpaid obligation is overdue by {max_days_overdue} days")

    if all_repayments:
        positives.append("Active verified repayment activity recorded recently")
    else:
        if not settled_bills:
            risks.append("Complete first full settlement to establish higher repayment consistency")

    disputed_count = sum(1 for b in valid_records if b.is_disputed or b.status == "disputed")
    if disputed_count > 0:
        positives.append(f"{disputed_count} disputed bill(s) excluded from reliability penalties pending merchant review")

    methodology = (
        "KOSHA TrustScore is an internal reliability index computed from 4 canonical dimensions: "
        "On-time settlements (40%), Overdue frequency & duration (25%), Current overdue balance ratio (20%), "
        "and Repayment recency (15%). Strictly an internal metric; not a credit bureau score."
    )

    return TrustScoreFactors(
        on_time_score=on_time_score,
        overdue_frequency_duration_score=overdue_score,
        current_overdue_ratio_score=current_overdue_ratio_score,
        recency_consistency_score=recency_score,
        total_score=total_score,
        category=category,
        has_sufficient_history=True,
        total_obligations=len(valid_records),
        completed_obligations=len(settled_bills),
        on_time_obligations=on_time_count,
        late_obligations=late_settled_count,
        active_overdue_obligations=len(active_overdue_bills),
        total_borrowed_paise=total_borrowed_paise,
        total_repaid_paise=total_repaid_paise,
        current_outstanding_paise=current_outstanding_paise,
        current_overdue_paise=current_overdue_paise,
        on_time_ratio_pct=on_time_ratio_pct,
        positive_factors=positives,
        risk_factors=risks,
        methodology_notes=methodology,
    )
