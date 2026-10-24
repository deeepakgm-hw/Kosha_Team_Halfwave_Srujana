"""
Statutory Calendar Domain: Encapsulates Indian compliance deadlines and penalty rules.
Non-negotiable tax outflows:
- GSTR-3B: 20th of succeeding month
- TDS Deposit: 7th of succeeding month
- Advance Tax: June 15 (15%), Sept 15 (45%), Dec 15 (75%), March 15 (100%)
- PF / ESI: 15th of succeeding month
"""

from datetime import date
from typing import Dict, List


def get_upcoming_statutory_deadlines(
    reference_date: date,
    window_days: int = 90,
) -> List[Dict[str, str]]:
    """
    Returns statutory compliance obligations falling within the horizon window.

    TODO (Phase 2): Implement dynamic calculation based on enterprise turnover category.
    """
    # Placeholder statutory schedule
    return [
        {
            "category": "TDS",
            "title": "TDS Monthly Deposit",
            "due_date_rule": "7th of every month",
            "penalty_description": "1.5% interest per month for delayed payment under Section 201(1A).",
        },
        {
            "category": "GST",
            "title": "GSTR-3B Monthly Return & Tax",
            "due_date_rule": "20th of every month",
            "penalty_description": "18% p.a. interest plus daily late fees under CGST Act Section 50.",
        },
        {
            "category": "PF_ESI",
            "title": "Provident Fund & ESI Remittance",
            "due_date_rule": "15th of every month",
            "penalty_description": "Loss of tax deduction and penal damages under EPF Act.",
        },
    ]
