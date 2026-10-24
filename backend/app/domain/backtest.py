"""
Backtest & Trust Validation Domain: Evaluates historical forecast fidelity against reconciled actuals.
Computes metrics to generate an intuitive Trust Score (0-100) for the business owner.
"""

from typing import Dict, List


def calculate_forecast_accuracy(
    projected_balances: List[float],
    actual_balances: List[float],
) -> Dict[str, float]:
    """
    Computes Mean Absolute Percentage Error (MAPE) and a normalized Trust Score.

    TODO (Phase 2): Implement asymmetric loss penalty (shortfall underestimation penalized more).
    """
    if not projected_balances or not actual_balances or len(projected_balances) != len(actual_balances):
        return {
            "mape": 0.0,
            "trust_score": 50.0,
            "evaluated_periods": 0.0,
        }

    errors = []
    for proj, act in zip(projected_balances, actual_balances):
        if act != 0:
            errors.append(abs(proj - act) / abs(act))

    mape = (sum(errors) / len(errors)) * 100 if errors else 0.0
    # Convert MAPE to 0-100 Trust Score: 0% error -> 100 score, >= 50% error -> lower score
    trust_score = max(0.0, min(100.0, 100.0 - mape))

    return {
        "mape": round(mape, 2),
        "trust_score": round(trust_score, 1),
        "evaluated_periods": float(len(projected_balances)),
    }
