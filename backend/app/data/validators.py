"""
Data Validation Helpers: Validates data integrity of incoming or generated financial records.
"""

from typing import Any, Dict, List, Tuple


def validate_synthetic_record(record: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Ensures that records have required financial fields and mandatory synthetic tags.
    """
    errors = []
    if not record.get("is_synthetic"):
        errors.append("Record must be explicitly tagged with 'is_synthetic: true'.")

    amount = record.get("amount")
    if amount is not None and amount < 0:
        errors.append("Transaction amount cannot be negative; use 'debit' type instead.")

    return len(errors) == 0, errors
