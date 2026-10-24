"""
Payment Behavior Model: Estimates expected customer payment timing and probability.
Evaluates historical counterparty payment latencies to calculate payment confidence.
"""

from datetime import date, timedelta
from typing import Dict, List, Optional


def estimate_payment_date(
    due_date: date,
    historical_delays_days: List[int],
    default_buffer_days: int = 5,
) -> date:
    """
    Estimates the most probable payment date based on customer historical delay distribution.

    TODO (Phase 2): Implement kernel density estimation or median latency with variance bounds.
    """
    if not historical_delays_days:
        return due_date + timedelta(days=default_buffer_days)

    avg_delay = sum(historical_delays_days) / len(historical_delays_days)
    return due_date + timedelta(days=int(round(avg_delay)))


def calculate_payment_probability(
    days_overdue: int,
    credit_score_band: str = "medium",
) -> float:
    """
    Calculates the probability that an invoice will be recovered within the next 30 days.

    TODO (Phase 2): Incorporate survival analysis curve for overdue aging buckets.
    """
    if days_overdue <= 0:
        return 0.95
    if days_overdue <= 30:
        return 0.80
    if days_overdue <= 60:
        return 0.60
    if days_overdue <= 90:
        return 0.40
    return 0.20
