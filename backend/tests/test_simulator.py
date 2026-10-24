from datetime import date, timedelta
from backend.app.domain.simulator import simulate_cash_runway


def test_simulation_normal_flow():
    """
    Test standard financial movements across a 90-day horizon.
    Verifies daily and overall ledger reconciliation.
    """
    start_date = date(2026, 11, 1)
    starting_balance = 100000.0

    receivables = [
        {"amount": 50000.0, "expected_payment_date": (start_date + timedelta(days=10)).isoformat()},
        {"amount": 30000.0, "expected_payment_date": (start_date + timedelta(days=25)).isoformat()},
    ]
    outflows = [
        {"amount": 40000.0, "due_date": (start_date + timedelta(days=15)).isoformat()},
        {"amount": 20000.0, "due_date": (start_date + timedelta(days=30)).isoformat()},
    ]

    res = simulate_cash_runway(
        starting_balance=starting_balance,
        start_date=start_date,
        horizon_days=90,
        receivables=receivables,
        outflows=outflows,
    )

    assert res["horizon_days"] == 90
    assert res["starting_cash"] == 100000.0
    assert res["total_inflows"] == 80000.0
    assert res["total_outflows"] == 60000.0
    # Reconciled: 100000 + 80000 - 60000 = 120000
    assert res["closing_cash"] == 120000.0
    assert res["net_change"] == 20000.0
    assert res["first_projected_shortfall_date"] is None
    assert res["negative_cash_days_count"] == 0
    assert res["runway_days"] == 90

    # Verify daily conservation on every single day
    for pt in res["daily_projections"]:
        expected_close = round(pt["starting_cash"] + pt["expected_inflow"] - pt["committed_outflow"], 2)
        assert pt["ending_cash"] == expected_close


def test_simulation_no_transactions():
    """
    Test with zero inflows and zero outflows.
    Opening cash must remain strictly constant for all 90 days.
    """
    start_date = date(2026, 11, 1)
    starting_balance = 75000.0

    res = simulate_cash_runway(
        starting_balance=starting_balance,
        start_date=start_date,
        horizon_days=90,
        receivables=[],
        outflows=[],
    )

    assert res["starting_cash"] == 75000.0
    assert res["closing_cash"] == 75000.0
    assert res["total_inflows"] == 0.0
    assert res["total_outflows"] == 0.0
    assert res["minimum_projected_balance"] == 75000.0
    assert res["first_projected_shortfall_date"] is None
    assert res["negative_cash_days_count"] == 0
    assert len(res["daily_projections"]) == 90

    for pt in res["daily_projections"]:
        assert pt["starting_cash"] == 75000.0
        assert pt["ending_cash"] == 75000.0
        assert pt["expected_inflow"] == 0.0
        assert pt["committed_outflow"] == 0.0


def test_simulation_same_day_inflow_outflow():
    """
    Test both an inflow and outflow occurring on the exact same date.
    Verifies proper net flow and closing balance calculation.
    """
    start_date = date(2026, 11, 1)
    target_date = (start_date + timedelta(days=5)).isoformat()

    receivables = [{"amount": 25000.0, "expected_payment_date": target_date}]
    outflows = [{"amount": 15000.0, "due_date": target_date}]

    res = simulate_cash_runway(
        starting_balance=10000.0,
        start_date=start_date,
        horizon_days=30,
        receivables=receivables,
        outflows=outflows,
    )

    day_5_pt = res["daily_projections"][5]
    assert day_5_pt["date"] == target_date
    assert day_5_pt["starting_cash"] == 10000.0
    assert day_5_pt["expected_inflow"] == 25000.0
    assert day_5_pt["committed_outflow"] == 15000.0
    assert day_5_pt["net_cash_flow"] == 10000.0
    assert day_5_pt["ending_cash"] == 20000.0


def test_simulation_delayed_receivable():
    """
    Test delayed receivable. Verifies cash reflects delay and doesn't arrive early.
    """
    start_date = date(2026, 11, 1)
    original_due_date = (start_date + timedelta(days=5)).isoformat()
    delayed_expected_date = (start_date + timedelta(days=20)).isoformat()

    # Invoice had due date on day 5, but counterparty behavior models expected date on day 20
    receivables = [
        {
            "amount": 50000.0,
            "due_date": original_due_date,
            "expected_payment_date": delayed_expected_date,
        }
    ]
    # An outflow occurs on day 10
    outflows = [{"amount": 30000.0, "due_date": (start_date + timedelta(days=10)).isoformat()}]

    res = simulate_cash_runway(
        starting_balance=20000.0,
        start_date=start_date,
        horizon_days=30,
        receivables=receivables,
        outflows=outflows,
    )

    # On day 5, no inflow should be recognized because expected_payment_date is day 20
    assert res["daily_projections"][5]["expected_inflow"] == 0.0

    # On day 10, outflow occurs -> 20k - 30k = -10k shortfall!
    assert res["daily_projections"][10]["committed_outflow"] == 30000.0
    assert res["daily_projections"][10]["ending_cash"] == -10000.0
    assert res["daily_projections"][10]["is_shortfall"] is True

    # On day 20, the delayed inflow arrives -> -10k + 50k = +40k recovery
    assert res["daily_projections"][20]["expected_inflow"] == 50000.0
    assert res["daily_projections"][20]["ending_cash"] == 40000.0


def test_simulation_cash_shortfall():
    """
    Test cash deficit where outflow exceeds liquidity.
    Verifies first_projected_shortfall_date, minimum_projected_balance, and negative days count.
    """
    start_date = date(2026, 11, 1)
    shortfall_date = start_date + timedelta(days=4)

    outflows = [{"amount": 100000.0, "due_date": shortfall_date.isoformat()}]

    res = simulate_cash_runway(
        starting_balance=30000.0,
        start_date=start_date,
        horizon_days=10,
        receivables=[],
        outflows=outflows,
    )

    assert res["first_projected_shortfall_date"] == shortfall_date.isoformat()
    assert res["runway_days"] == 4
    # Day 0,1,2,3 positive; Day 4,5,6,7,8,9 negative (6 days)
    assert res["negative_cash_days_count"] == 6
    assert res["minimum_projected_balance"] == -70000.0
    assert res["closing_cash"] == -70000.0


def test_simulation_duplicate_counting_prevention():
    """
    Verify settled/paid invoices are excluded from expected inflows (already in starting cash),
    and partially paid invoices only include the unpaid remainder.
    """
    start_date = date(2026, 11, 1)
    target_date = (start_date + timedelta(days=3)).isoformat()

    receivables = [
        {"amount": 50000.0, "status": "settled", "expected_payment_date": target_date},
        {"amount": 40000.0, "status": "paid", "expected_payment_date": target_date},
        {"amount": 30000.0, "status": "pending", "paid_amount": 10000.0, "expected_payment_date": target_date},
    ]

    res = simulate_cash_runway(
        starting_balance=10000.0,
        start_date=start_date,
        horizon_days=10,
        receivables=receivables,
        outflows=[],
    )

    # Only 20000 (30000 - 10000) should be included!
    assert res["total_inflows"] == 20000.0
    assert res["closing_cash"] == 30000.0


def test_simulation_edge_cases_safety():
    """
    Verify safety when given:
    - Negative starting cash
    - Past-due invoices (due before start_date)
    - Missing dates
    - Invalid or negative amounts
    """
    start_date = date(2026, 11, 1)

    receivables = [
        # Past-due invoice: should roll to day 0
        {"amount": 15000.0, "due_date": (start_date - timedelta(days=10)).isoformat()},
        # Missing date: should default to start_date
        {"amount": 5000.0, "due_date": None},
        # Invalid / negative amounts: should be ignored safely
        {"amount": -20000.0, "due_date": start_date.isoformat()},
        {"amount": "invalid_number", "due_date": start_date.isoformat()},
    ]

    outflows = [
        # Past-due debt: should roll to day 0
        {"amount": 8000.0, "due_date": (start_date - timedelta(days=5)).isoformat()},
        # Negative outflow amount: should be ignored
        {"amount": -5000.0, "due_date": start_date.isoformat()},
    ]

    # Negative starting cash
    res = simulate_cash_runway(
        starting_balance=-5000.0,
        start_date=start_date,
        horizon_days=5,
        receivables=receivables,
        outflows=outflows,
    )

    # Inflows on day 0: 15000 (past due) + 5000 (missing date) = 20000
    # Outflow on day 0: 8000 (past due)
    day_0 = res["daily_projections"][0]
    assert day_0["starting_cash"] == -5000.0
    assert day_0["expected_inflow"] == 20000.0
    assert day_0["committed_outflow"] == 8000.0
    # Day 0 ending cash: -5000 + 20000 - 8000 = +7000
    assert day_0["ending_cash"] == 7000.0
