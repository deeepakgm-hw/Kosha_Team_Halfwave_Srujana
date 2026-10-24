"""
Synthetic Data Generator: Generates realistic mock cash ledger transactions and invoices.
All generated records have explicit `is_synthetic: True` markers.
"""

import random
from datetime import date, timedelta
from typing import Any, Dict, List


def generate_synthetic_transactions(
    business_id: str,
    days: int = 60,
    count_per_day: int = 3,
) -> List[Dict[str, Any]]:
    """
    Generates synthetic historical bank ledger records for demo/testing.

    TODO (Phase 2): Add seasonal variance and weekend transaction suppression.
    """
    transactions = []
    base_date = date.today() - timedelta(days=days)

    categories_inflow = ["customer_receipt", "gst_refund", "interest_credit"]
    categories_outflow = ["vendor_payment", "utility_power", "factory_supplies", "fuel"]

    for d in range(days):
        current_date = base_date + timedelta(days=d)
        for i in range(count_per_day):
            is_credit = random.random() < 0.35  # Fewer credits, larger amounts
            if is_credit:
                amt = round(random.uniform(50000, 350000), 2)
                cat = random.choice(categories_inflow)
                entry_type = "credit"
            else:
                amt = round(random.uniform(5000, 75000), 2)
                cat = random.choice(categories_outflow)
                entry_type = "debit"

            transactions.append(
                {
                    "id": f"txn_syn_{d}_{i}",
                    "business_id": business_id,
                    "date": current_date.isoformat(),
                    "type": entry_type,
                    "category": cat,
                    "amount": amt,
                    "is_synthetic": True,
                }
            )

    return transactions
