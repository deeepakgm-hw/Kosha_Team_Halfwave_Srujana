"""
Ledger Domain Module: Reconciles settled transactions and calculates point-in-time cash balances.
All functions here are pure and deterministic without I/O or database dependencies.
"""

from typing import Dict, List, Literal, TypedDict


class TransactionEntry(TypedDict):
    id: str
    type: Literal["credit", "debit"]
    amount: float
    category: str


def calculate_balance(
    starting_balance: float,
    credits: List[float],
    debits: List[float],
) -> float:
    """
    Calculate the reconciled cash balance given starting balance, list of credits, and list of debits.

    :param starting_balance: Opening cash balance in account currency.
    :param credits: List of incoming settled cash amounts.
    :param debits: List of outgoing settled cash amounts.
    :return: Net reconciled cash balance.
    """
    total_inflow = sum(credits)
    total_outflow = sum(debits)
    return round(starting_balance + total_inflow - total_outflow, 2)


def summarize_ledger_entries(
    starting_balance: float,
    entries: List[TransactionEntry],
) -> Dict[str, float]:
    """
    Summarizes ledger entries into opening cash, total inflows, total outflows, and closing cash.

    TODO (Phase 2): Add multi-account reconciliation and currency support.
    """
    inflow = sum(entry["amount"] for entry in entries if entry["type"] == "credit")
    outflow = sum(entry["amount"] for entry in entries if entry["type"] == "debit")
    closing = starting_balance + inflow - outflow

    return {
        "starting_balance": round(starting_balance, 2),
        "total_inflows": round(inflow, 2),
        "total_outflows": round(outflow, 2),
        "closing_balance": round(closing, 2),
    }
