"""
MSMED Act 2006 Domain Logic: Models statutory rights for Micro and Small Enterprises.
Under Sections 15 & 16 of the MSMED Act:
- Buyer must settle payments within agreed term, or maximum 45 days from day of acceptance.
- Beyond 45 days, buyer is liable to compound interest with monthly rests at 3 times RBI Bank Rate.

NOTE: This module provides algorithmic estimations for financial forecasting.
It does not constitute formal legal counsel.
"""

from typing import Dict


def calculate_msmed_penal_interest(
    principal_amount: float,
    days_overdue: int,
    rbi_bank_rate: float = 0.065,  # e.g., 6.50%
) -> Dict[str, float]:
    """
    Estimates compound penal interest under Section 16 of MSMED Act.
    Penal rate = 3 * RBI Bank Rate (compounded with monthly rests).

    TODO (Phase 2): Implement exact daily day-count fraction with monthly compounding rests.
    """
    if days_overdue <= 45:
        return {
            "is_violation": 0.0,
            "penal_rate_annual": 0.0,
            "estimated_interest": 0.0,
            "total_claimable": principal_amount,
        }

    penal_rate = 3 * rbi_bank_rate
    overdue_days_beyond_limit = days_overdue - 45
    # Approximate linear compounding for preliminary estimation
    interest_est = principal_amount * (penal_rate * (overdue_days_beyond_limit / 365.0))

    return {
        "is_violation": 1.0,
        "penal_rate_annual": round(penal_rate * 100, 2),
        "estimated_interest": round(interest_est, 2),
        "total_claimable": round(principal_amount + interest_est, 2),
    }
