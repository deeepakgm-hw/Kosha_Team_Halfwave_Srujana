from backend.app.domain.ledger import calculate_balance, summarize_ledger_entries


def test_calculate_balance_basic():
    """Verify standard credit and debit calculations."""
    starting_balance = 100000.0
    credits = [50000.0, 25000.0]
    debits = [30000.0, 15000.0]

    # Expected: 100000 + 75000 - 45000 = 130000
    balance = calculate_balance(starting_balance, credits, debits)
    assert balance == 130000.0


def test_calculate_balance_zero_movements():
    """Verify starting balance remains unchanged when no entries exist."""
    balance = calculate_balance(50000.0, [], [])
    assert balance == 50000.0


def test_summarize_ledger_entries():
    """Verify entry summary aggregation."""
    entries = [
        {"id": "1", "type": "credit", "amount": 20000.0, "category": "sales"},
        {"id": "2", "type": "debit", "amount": 5000.0, "category": "rent"},
        {"id": "3", "type": "debit", "amount": 3000.0, "category": "electricity"},
    ]

    summary = summarize_ledger_entries(10000.0, entries)
    assert summary["starting_balance"] == 10000.0
    assert summary["total_inflows"] == 20000.0
    assert summary["total_outflows"] == 8000.0
    assert summary["closing_balance"] == 22000.0
