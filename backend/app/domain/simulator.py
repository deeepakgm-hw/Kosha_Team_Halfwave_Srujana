"""
90-Day Rolling Cash Simulator: Pure deterministic financial projection module.
Calculates rolling daily liquidity balances, detects cash shortfall and reserve breaches,
and preserves the core accounting identity:
    closing_balance = opening_balance + inflows - outflows

Zero dependencies on web frameworks (FastAPI), databases, or network I/O.
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Union
import math


def _parse_date(value: Any, default_date: date) -> date:
    """Safely parses a date string, date object, or returns default on failure."""
    if value is None:
        return default_date
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip()[:10])
        except (ValueError, TypeError):
            return default_date
    return default_date


def _clean_amount(value: Any) -> float:
    """Sanitizes amount to non-negative float. Returns 0.0 for invalid numbers."""
    if value is None:
        return 0.0
    try:
        amt = float(value)
        if math.isnan(amt) or math.isinf(amt) or amt <= 0.0:
            return 0.0
        return round(amt, 2)
    except (ValueError, TypeError):
        return 0.0


def simulate_cash_runway(
    starting_balance: float,
    start_date: Optional[Union[date, str]] = None,
    horizon_days: int = 90,
    receivables: Optional[List[Dict[str, Any]]] = None,
    outflows: Optional[List[Dict[str, Any]]] = None,
    minimum_reserve: float = 0.0,
    data_quality_warnings: Optional[List[str]] = None,
    assumptions_used: Optional[List[str]] = None,
    is_synthetic: bool = False,
) -> Dict[str, Any]:
    """
    Simulates rolling daily cash trajectory over the specified horizon.

    :param starting_balance: Settled liquid cash balance at day 0 (reconciled funds).
    :param start_date: Simulation start date (defaults to today).
    :param horizon_days: Projection window in days (clamped between 1 and 365, default 90).
    :param receivables: List of expected receivables/invoices. Unpaid portions only.
    :param outflows: List of committed vendor dues, payroll, rent, tax liabilities.
    :param minimum_reserve: Configurable cash cushion threshold.
    :param data_quality_warnings: List of known gaps or unverified records.
    :param assumptions_used: Disclosure of assumptions applied in calculation.
    :param is_synthetic: True if derived from synthetic demo personas, False if real data.
    :return: Reconciled daily projection series with shortfall and reserve metrics.
    """
    # 1. Normalize horizon and reference start date
    safe_horizon = max(1, min(365, int(horizon_days)))
    ref_date = _parse_date(start_date, default_date=date.today())

    try:
        opening_cash = float(starting_balance)
        if math.isnan(opening_cash) or math.isinf(opening_cash):
            opening_cash = 0.0
    except (ValueError, TypeError):
        opening_cash = 0.0
    opening_cash = round(opening_cash, 2)

    safe_reserve = float(minimum_reserve) if minimum_reserve is not None else 0.0

    # 2. Process receivables into daily expected inflows
    # Rule: Prevent duplicate counting.
    # Settled/paid invoices are already part of starting_balance, so only include unpaid remainder.
    # Overdue/past-due expected receipts roll to start_date (day 0).
    daily_inflows: Dict[date, float] = defaultdict(float)
    receivables_list = receivables or []

    for item in receivables_list:
        if not isinstance(item, dict):
            continue

        status = str(item.get("status", "")).strip().lower()
        if status in ("settled", "paid", "reconciled"):
            # Already cleared cash; excluded to prevent double counting
            continue

        raw_amount = _clean_amount(item.get("amount", 0.0))
        paid_amount = _clean_amount(item.get("paid_amount", 0.0))
        unpaid_amount = max(0.0, raw_amount - paid_amount)

        if unpaid_amount <= 0.0:
            continue

        # Expected payment date preference: expected_payment_date > due_date > start_date
        date_candidate = item.get("expected_payment_date") or item.get("due_date")
        target_date = _parse_date(date_candidate, default_date=ref_date)

        # Past-due receivables are overdue as of start_date; clamp to day 0
        if target_date < ref_date:
            target_date = ref_date

        daily_inflows[target_date] += unpaid_amount

    # 3. Process committed outflows
    # Rule: Committed debts due in the past roll to day 0 as immediately payable obligations.
    daily_outflows: Dict[date, float] = defaultdict(float)
    outflows_list = outflows or []

    for item in outflows_list:
        if not isinstance(item, dict):
            continue

        amount = _clean_amount(item.get("amount", 0.0))
        paid_amount = _clean_amount(item.get("paid_amount", 0.0))
        unpaid_outflow = max(0.0, amount - paid_amount)

        if unpaid_outflow <= 0.0:
            continue

        date_candidate = item.get("due_date")
        target_date = _parse_date(date_candidate, default_date=ref_date)

        # Overdue payable debt; clamp to day 0
        if target_date < ref_date:
            target_date = ref_date

        daily_outflows[target_date] += unpaid_outflow

    # 4. Run daily simulation loop
    projections = []
    current_cash = opening_cash
    min_balance = opening_cash
    first_shortfall_date: Optional[date] = None
    first_reserve_breach_date: Optional[date] = None
    negative_days_count = 0
    days_below_reserve_count = 0

    total_inflows = 0.0
    total_outflows = 0.0

    for day_idx in range(safe_horizon):
        current_date = ref_date + timedelta(days=day_idx)
        inflow = round(daily_inflows.get(current_date, 0.0), 2)
        outflow = round(daily_outflows.get(current_date, 0.0), 2)

        total_inflows += inflow
        total_outflows += outflow

        net_flow = round(inflow - outflow, 2)
        ending_cash = round(current_cash + net_flow, 2)

        is_shortfall = ending_cash < 0.0
        shortfall_amount = round(abs(ending_cash), 2) if is_shortfall else 0.0

        is_reserve_breach = ending_cash < safe_reserve
        reserve_deficit = round(safe_reserve - ending_cash, 2) if is_reserve_breach else 0.0

        if is_shortfall:
            negative_days_count += 1
            if first_shortfall_date is None:
                first_shortfall_date = current_date

        if is_reserve_breach:
            days_below_reserve_count += 1
            if first_reserve_breach_date is None:
                first_reserve_breach_date = current_date

        if ending_cash < min_balance:
            min_balance = ending_cash

        projections.append(
            {
                "date": current_date.isoformat(),
                "starting_cash": round(current_cash, 2),
                "expected_inflow": inflow,
                "committed_outflow": outflow,
                "net_cash_flow": net_flow,
                "ending_cash": ending_cash,
                "is_shortfall": is_shortfall,
                "shortfall_amount": shortfall_amount,
                "is_reserve_breach": is_reserve_breach,
                "reserve_deficit": reserve_deficit,
                "confidence_lower": None,  # Deterministic forecast; no fabricated P10/P90
                "confidence_upper": None,
                "is_synthetic": is_synthetic,
            }
        )
        current_cash = ending_cash

    # 5. Compute summary metrics & runway
    if first_shortfall_date is not None:
        runway_days = max(0, (first_shortfall_date - ref_date).days)
    else:
        runway_days = safe_horizon

    warnings = list(data_quality_warnings or [])
    assumptions = list(assumptions_used or [])
    if not assumptions:
        assumptions.append("Deterministic accounting projection: receipts arrive on contractual or expected payment dates.")
        assumptions.append("Contractual payables and operating expenses are disbursed on due dates without early payment.")
        if safe_reserve > 0:
            assumptions.append(f"Configured minimum cash reserve cushion: ₹{safe_reserve:,.2f}.")

    return {
        "start_date": ref_date.isoformat(),
        "horizon_days": safe_horizon,
        "starting_cash": opening_cash,
        "closing_cash": round(current_cash, 2),
        "total_inflows": round(total_inflows, 2),
        "total_outflows": round(total_outflows, 2),
        "net_change": round(current_cash - opening_cash, 2),
        "minimum_projected_balance": round(min_balance, 2),
        "minimum_reserve": safe_reserve,
        "first_projected_shortfall_date": (
            first_shortfall_date.isoformat() if first_shortfall_date else None
        ),
        "first_reserve_breach_date": (
            first_reserve_breach_date.isoformat() if first_reserve_breach_date else None
        ),
        "negative_cash_days_count": negative_days_count,
        "days_below_reserve_count": days_below_reserve_count,
        "runway_days": runway_days,
        "is_probabilistic": False,
        "is_synthetic": is_synthetic,
        "data_quality_warnings": warnings,
        "assumptions_used": assumptions,
        "daily_projections": projections,
    }


def simulate_scenario(
    starting_balance: float,
    start_date: Optional[Union[date, str]] = None,
    horizon_days: int = 90,
    receivables: Optional[List[Dict[str, Any]]] = None,
    outflows: Optional[List[Dict[str, Any]]] = None,
    minimum_reserve: float = 100000.0,
    buyer_delay_days: int = 0,
    sales_drop_percent: float = 0.0,
    surprise_expense: float = 0.0,
    surprise_expense_day: int = 15,
    is_synthetic: bool = False,
) -> Dict[str, Any]:
    """
    Executes a deterministic what-if scenario comparison against a baseline cashflow projection.
    Applies buyer receipt delays, top-line sales contraction, and unplanned emergency outflows.
    """
    ref_date = _parse_date(start_date, default_date=date.today())
    safe_horizon = max(1, min(365, int(horizon_days)))

    # 1. Compute unperturbed baseline
    baseline_result = simulate_cash_runway(
        starting_balance=starting_balance,
        start_date=ref_date,
        horizon_days=safe_horizon,
        receivables=receivables,
        outflows=outflows,
        minimum_reserve=minimum_reserve,
        data_quality_warnings=["BASELINE: Baseline forecast without hypothetical shocks."],
        assumptions_used=["Baseline contractual terms and scheduled recurring expenses."],
        is_synthetic=is_synthetic,
    )

    # 2. Construct shocked scenario dataset
    scenario_receivables: List[Dict[str, Any]] = []
    rec_list = receivables or []

    # Identify primary/largest receivable customer to shock with payment delay
    largest_rec_idx = -1
    largest_rec_amt = -1.0
    for idx, r in enumerate(rec_list):
        amt = float(r.get("amount", 0.0))
        if amt > largest_rec_amt:
            largest_rec_amt = amt
            largest_rec_idx = idx

    delay_days = max(0, int(buyer_delay_days))
    drop_pct = max(0.0, min(100.0, float(sales_drop_percent)))
    sales_multiplier = 1.0 - (drop_pct / 100.0)

    for idx, r in enumerate(rec_list):
        rec_copy = dict(r)
        orig_date = _parse_date(
            rec_copy.get("expected_payment_date") or rec_copy.get("due_date"),
            default_date=ref_date,
        )

        # Apply delay shock to primary buyer
        if idx == largest_rec_idx and delay_days > 0:
            rec_copy["expected_payment_date"] = (orig_date + timedelta(days=delay_days)).isoformat()
            rec_copy["notes"] = f"Delayed by {delay_days} days under what-if scenario."

        # Apply sales contraction shock to un-settled receipts
        if drop_pct > 0:
            orig_amt = float(rec_copy.get("amount", 0.0))
            rec_copy["amount"] = round(orig_amt * sales_multiplier, 2)

        scenario_receivables.append(rec_copy)

    # Shocks to outflows
    scenario_outflows: List[Dict[str, Any]] = [dict(o) for o in (outflows or [])]
    shock_amt = max(0.0, float(surprise_expense))
    if shock_amt > 0.0:
        shock_date = ref_date + timedelta(days=max(0, int(surprise_expense_day)))
        scenario_outflows.append(
            {
                "id": "SHOCK-UNEXPECTED-EXPENSE",
                "title": "Unexpected Equipment Repair / Emergency Outflow",
                "amount": round(shock_amt, 2),
                "due_date": shock_date.isoformat(),
                "category": "emergency",
                "priority": "critical",
                "is_synthetic": True,
            }
        )

    # 3. Compute shocked scenario projection
    scenario_result = simulate_cash_runway(
        starting_balance=starting_balance,
        start_date=ref_date,
        horizon_days=safe_horizon,
        receivables=scenario_receivables,
        outflows=scenario_outflows,
        minimum_reserve=minimum_reserve,
        data_quality_warnings=[
            f"SCENARIO_SHOCK: Delay={delay_days}d, SalesDrop={drop_pct}%, SurpriseExpense=₹{shock_amt:,.2f}"
        ],
        assumptions_used=[
            f"Main buyer settlement delayed by {delay_days} days.",
            f"Top-line receivables discounted by {drop_pct}% due to sales contraction.",
            f"Unplanned liquidity drain of ₹{shock_amt:,.2f} on day {surprise_expense_day}.",
        ],
        is_synthetic=is_synthetic,
    )

    # 4. Synthesize risk comparison metrics
    # Probability estimate based on proportion of days in deficit + shortfall intensity
    baseline_breach_days = baseline_result["days_below_reserve_count"]
    baseline_neg_days = baseline_result["negative_cash_days_count"]
    baseline_risk = min(
        95,
        max(
            5,
            int(
                (baseline_breach_days / max(1, safe_horizon)) * 60
                + (baseline_neg_days / max(1, safe_horizon)) * 40
            ),
        ),
    )
    if baseline_breach_days == 0 and baseline_neg_days == 0:
        baseline_risk = 12  # Low residual liquidity risk

    scenario_breach_days = scenario_result["days_below_reserve_count"]
    scenario_neg_days = scenario_result["negative_cash_days_count"]
    scenario_risk = min(
        99,
        max(
            baseline_risk,
            int(
                baseline_risk
                + (delay_days * 0.5)
                + (drop_pct * 0.7)
                + ((shock_amt / 100000.0) * 8.0)
            ),
        ),
    )

    return {
        "baseline": baseline_result,
        "scenario": scenario_result,
        "risk_comparison": {
            "baseline_risk_pct": baseline_risk,
            "scenario_risk_pct": scenario_risk,
            "risk_delta_pct": scenario_risk - baseline_risk,
            "baseline_first_breach_date": baseline_result["first_reserve_breach_date"],
            "scenario_first_breach_date": scenario_result["first_reserve_breach_date"],
            "baseline_first_shortfall_date": baseline_result["first_projected_shortfall_date"],
            "scenario_first_shortfall_date": scenario_result["first_projected_shortfall_date"],
            "baseline_min_balance": baseline_result["minimum_projected_balance"],
            "scenario_min_balance": scenario_result["minimum_projected_balance"],
            "minimum_balance_change": round(
                scenario_result["minimum_projected_balance"]
                - baseline_result["minimum_projected_balance"],
                2,
            ),
            "baseline_runway_days": baseline_result["runway_days"],
            "scenario_runway_days": scenario_result["runway_days"],
        },
        "shocks_applied": {
            "buyer_delay_days": delay_days,
            "sales_drop_percent": drop_pct,
            "surprise_expense": shock_amt,
            "surprise_expense_day": surprise_expense_day,
        },
    }

