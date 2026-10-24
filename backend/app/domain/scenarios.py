"""
Scenario Engine: Evaluates what-if financial stress tests against the baseline cash trajectory.
Allows SME owners to model:
1. Major debtor payment delay (+30 or +60 days)
2. Revenue drop shock (-15% to -40%)
3. Unplanned capital expenditure or emergency equipment repair
4. Vendor credit contraction (reduced payment credit terms)
"""

from typing import Any, Dict, List


def apply_delayed_debtor_scenario(
    inflow_schedule: Dict[str, float],
    debtor_invoice_id: str,
    invoice_amount: float,
    original_expected_date: str,
    delay_days: int,
) -> Dict[str, Any]:
    """
    Applies a debtor delay shock to the inflow schedule.

    TODO (Phase 2): Support probabilistic spillover across month-end statutory thresholds.
    """
    # Placeholder implementation
    return {
        "scenario_type": "delayed_debtor",
        "affected_invoice": debtor_invoice_id,
        "amount_shifted": invoice_amount,
        "delay_days": delay_days,
        "status": "applied",
    }


def apply_revenue_shock_scenario(
    baseline_inflows: List[float],
    reduction_percentage: float,
) -> List[float]:
    """
    Simulates a percentage drop across uncommitted future revenues.

    TODO (Phase 2): Distinguish contracted retainers vs variable project revenues.
    """
    factor = max(0.0, 1.0 - (reduction_percentage / 100.0))
    return [round(inflow * factor, 2) for inflow in baseline_inflows]
