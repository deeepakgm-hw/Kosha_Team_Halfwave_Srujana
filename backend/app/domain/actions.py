"""
Action Ranking Engine: Generates and prioritizes corrective actions to resolve cash shortfalls.
Evaluates actions across three dimensions:
- Liquidity Impact (INR yield)
- Execution Velocity (Days to cash in hand)
- Friction / Cost (Discount, interest, vendor relationship impact)
"""

from typing import Any, Dict, List


class CorrectiveActionOption:
    EARLY_PAYMENT_DISCOUNT = "early_payment_discount"
    DEFER_CAPEX = "defer_capex"
    MSMED_FORMAL_DEMAND = "msmed_formal_demand"
    INVOICE_DISCOUNTING = "invoice_discounting"
    VENDOR_TERM_EXTENSION = "vendor_term_extension"


def rank_corrective_actions(
    shortfall_amount: float,
    days_until_shortfall: int,
    available_receivables: List[Dict[str, Any]],
    available_payables: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Ranks potential interventions to resolve a cash shortfall.

    TODO (Phase 2): Implement multi-criteria decision analysis (TOPSIS/AHP) weighting.
    """
    # Placeholder recommendation list
    return [
        {
            "action_id": "act_001",
            "type": CorrectiveActionOption.EARLY_PAYMENT_DISCOUNT,
            "title": "Offer 2% Quick-Pay Discount on Overdue Invoices",
            "description": "Incentivize Tier-1 customers to clear bills within 48 hours.",
            "estimated_yield": round(shortfall_amount * 0.6, 2),
            "estimated_days_to_cash": 3,
            "cost_inr": round(shortfall_amount * 0.02, 2),
            "priority": "HIGH",
        },
        {
            "action_id": "act_002",
            "type": CorrectiveActionOption.DEFER_CAPEX,
            "title": "Postpone Non-Critical Equipment Purchase",
            "description": "Shift discretionary asset purchase beyond the 90-day window.",
            "estimated_yield": round(shortfall_amount * 0.4, 2),
            "estimated_days_to_cash": 1,
            "cost_inr": 0.0,
            "priority": "MEDIUM",
        },
    ]
