def test_forecast_endpoint_default_sample(client):
    """
    Test calling POST /api/forecast with default payload.
    Should load synthetic sample persona data and return 90-day trajectory.
    """
    response = client.post("/api/forecast", json={})
    assert response.status_code == 200

    data = response.json()
    assert data["business_id"] == "apex_precision_mfg"
    assert data["horizon_days"] == 90
    assert data["starting_cash"] == 450000.0
    assert data["is_probabilistic"] is False
    assert data["is_synthetic"] is True
    assert len(data["daily_projections"]) == 90
    assert "minimum_projected_balance" in data
    assert "negative_cash_days_count" in data
    assert "runway_days" in data

    # Verify reconciliation for daily points
    for pt in data["daily_projections"]:
        expected_close = round(pt["starting_cash"] + pt["expected_inflow"] - pt["committed_outflow"], 2)
        assert pt["ending_cash"] == expected_close


def test_forecast_endpoint_custom_payload(client):
    """
    Test calling POST /api/forecast with custom receivables and outflows.
    """
    payload = {
        "business_id": "custom_biz",
        "start_date": "2026-11-01",
        "starting_cash": 50000.0,
        "horizon_days": 30,
        "receivables": [
            {"amount": 20000.0, "expected_payment_date": "2026-11-10"}
        ],
        "outflows": [
            {"amount": 80000.0, "due_date": "2026-11-15"}
        ],
    }
    response = client.post("/api/forecast", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["business_id"] == "custom_biz"
    assert data["horizon_days"] == 30
    assert data["starting_cash"] == 50000.0
    # Day 0 to 9: 50,000
    # Day 10 (Nov 10): +20,000 -> 70,000
    # Day 15 (Nov 15): -80,000 -> -10,000 (shortfall!)
    assert data["first_projected_shortfall_date"] == "2026-11-15"
    assert data["minimum_projected_balance"] == -10000.0
    assert data["runway_days"] == 14
    assert data["negative_cash_days_count"] == 16
    assert data["closing_cash"] == -10000.0


def test_simulate_scenario_endpoint(client):
    """
    Test calling POST /api/simulate with scenario shocks.
    Verifies comparative recalculation of baseline vs shocked forecast.
    """
    payload = {
        "persona_id": "manufacturer",
        "use_sample_data": True,
        "horizon_days": 90,
        "minimum_reserve": 100000.0,
        "buyer_delay_days": 20,
        "sales_drop_percent": 15.0,
        "surprise_expense": 150000.0,
        "surprise_expense_day": 15,
    }
    response = client.post("/api/simulate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "baseline" in data
    assert "scenario" in data
    assert "risk_comparison" in data
    assert "shocks_applied" in data

    risk = data["risk_comparison"]
    assert risk["scenario_risk_pct"] >= risk["baseline_risk_pct"]
    assert risk["scenario_min_balance"] < risk["baseline_min_balance"]
    assert data["shocks_applied"]["buyer_delay_days"] == 20
    assert len(data["scenario"]["daily_projections"]) == 90


def test_multi_persona_datasets(client):
    """
    Test generating forecasts for the 3 distinct personas:
    1. Manufacturer
    2. Seasonal Trader
    3. Service Firm
    """
    from backend.app.data.personas import get_sample_forecast_dataset
    from datetime import date

    today = date.today()
    mfg_cash, mfg_rec, mfg_out = get_sample_forecast_dataset(today, "manufacturer")
    trader_cash, trader_rec, trader_out = get_sample_forecast_dataset(today, "trader")
    srv_cash, srv_rec, srv_out = get_sample_forecast_dataset(today, "service")

    assert mfg_cash == 450000.0
    assert trader_cash == 620000.0
    assert srv_cash == 280000.0

    assert len(mfg_rec) > 0
    assert len(trader_rec) > 0
    assert len(srv_rec) > 0

