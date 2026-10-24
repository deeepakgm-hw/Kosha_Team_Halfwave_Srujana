"""
90-Day Rolling Cash Simulator: Combines deterministic commitments and stochastic inflows
to project daily liquidity and detect earliest potential shortfall.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional


def simulate_cash_runway(
    starting_balance: float,
    start_date: date,
    horizon_days: int = 90,
    daily_committed_outflows: Optional[Dict[date, float]] = None,
    daily_expected_inflows: Optional[Dict[date, float]] = None,
) -> Dict[str, Any]:
    """
    Simulates daily cash trajectory over the specified horizon.

    TODO (Phase 2): Implement Monte Carlo simulations for stochastic receivables confidence intervals.

    :return: Dictionary containing daily balances, minimum balance, and earliest shortfall date.
    """
    daily_committed_outflows = daily_committed_outflows or {}
    daily_expected_inflows = daily_expected_inflows or {}

    projections = []
    current_cash = starting_balance
    earliest_shortfall: Optional[date] = None
    min_cash = starting_balance

    for day_idx in range(horizon_days):
        current_date = start_date + timedelta(days=day_idx)
        inflow = daily_expected_inflows.get(current_date, 0.0)
        outflow = daily_committed_outflows.get(current_date, 0.0)

        end_cash = current_cash + inflow - outflow
        if end_cash < 0 and earliest_shortfall is None:
            earliest_shortfall = current_date

        if end_cash < min_cash:
            min_cash = end_cash

        projections.append(
            {
                "date": current_date.isoformat(),
                "starting_cash": round(current_cash, 2),
                "inflow": round(inflow, 2),
                "outflow": round(outflow, 2),
                "ending_cash": round(end_cash, 2),
            }
        )
        current_cash = end_cash

    return {
        "horizon_days": horizon_days,
        "opening_balance": starting_balance,
        "closing_balance": round(current_cash, 2),
        "min_balance": round(min_cash, 2),
        "earliest_shortfall_date": earliest_shortfall.isoformat() if earliest_shortfall else None,
        "daily_projections": projections,
    }
