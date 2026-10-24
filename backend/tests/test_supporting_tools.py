"""
Tests for supporting capabilities and newly integrated domain routers:
1. Corrective Action Prioritization (MCDA scoring and POST /api/actions/rank)
2. Receivables & MSMED Act 2006 Penalties (Section 16 compounding and GET /api/receivables/law)
3. Statutory Cash Calendar (42-day disbursements and GET /api/calendar)
4. Forecast Reliability & Backtesting (Calibration coordinates and GET /api/backtest)
"""

from datetime import date
from fastapi.testclient import TestClient
import pytest
from backend.app.main import app
from backend.app.domain.actions import rank_corrective_actions
from backend.app.domain.msmed_law import calculate_msmed_penal_interest, generate_statutory_reminder_text
from backend.app.domain.statutory import get_upcoming_cash_calendar
from backend.app.domain.backtest import run_historical_backtest

client = TestClient(app)


# ==========================================
# 1. Action Ranking Tests
# ==========================================

def test_rank_corrective_actions_order_and_structure():
    """Verify that rank_corrective_actions returns 4 ranked actions with required fields."""
    actions = rank_corrective_actions(
        shortfall_amount=75000.0,
        days_until_shortfall=15,
        baseline_risk_pct=65,
    )
    assert len(actions) == 4
    assert actions[0]["badge"] == "#1 Recommended"
    for act in actions:
        assert "title" in act
        assert "why_recommended" in act
        assert "cash_flow_impact" in act
        assert "risk_shift" in act
        assert "cost" in act
        assert "relationship_cost" in act
        assert len(act["practical_steps"]) >= 2


def test_api_actions_rank_endpoint():
    """Verify POST /api/actions/rank returns HTTP 200 and ranked actions payload."""
    payload = {
        "business_id": "apex_precision_mfg",
        "shortfall_amount": 100000.0,
        "days_until_shortfall": 20,
        "baseline_risk_pct": 70,
    }
    response = client.post("/api/actions/rank", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["business_id"] == "apex_precision_mfg"
    assert len(data["actions"]) == 4
    assert data["actions"][0]["badge"] == "#1 Recommended"


# ==========================================
# 2. MSMED 2006 Statutory Penal Interest Tests
# ==========================================

def test_msmed_zero_overdue_not_violation():
    """Verify that non-overdue invoices incur zero penal interest and are marked COMPLIANT."""
    res = calculate_msmed_penal_interest(
        principal_amount=50000.0,
        days_overdue=0,
        rbi_bank_rate=0.065,
    )
    assert res["is_violation"] is False
    assert res["accrued_penal_interest"] == 0.0
    assert res["total_claimable_amount"] == 50000.0
    assert res["section_43b_status"] == "COMPLIANT"


def test_msmed_compound_monthly_rests():
    """Verify that overdue invoices incur compound interest with monthly rests at 3x RBI rate."""
    principal = 140000.0
    days_overdue = 38
    rbi_rate = 0.065  # 3 * 6.50% = 19.50% p.a.

    res = calculate_msmed_penal_interest(
        principal_amount=principal,
        days_overdue=days_overdue,
        rbi_bank_rate=rbi_rate,
    )
    assert res["is_violation"] is True
    assert res["penal_rate_annual_pct"] == 19.5
    # For 38 days on ₹1,40,000 at 19.5% compounded monthly, interest is > ₹2,000
    assert 2200.0 <= res["accrued_penal_interest"] <= 2900.0
    assert res["total_claimable_amount"] == round(principal + res["accrued_penal_interest"], 2)


def test_msmed_section_43b_disallowance():
    """Invoices overdue beyond 45 days must trigger Section 43B(h) tax disallowance status."""
    res = calculate_msmed_penal_interest(
        principal_amount=40000.0,
        days_overdue=65,
        rbi_bank_rate=0.065,
    )
    assert res["is_violation"] is True
    assert res["section_43b_status"] == "DISALLOWED"
    assert "Section 43B(h)" in res["section_43b_notes"]


def test_api_receivables_law_endpoint():
    """Verify GET /api/receivables/law returns overdue list, totals, and reminder drafts."""
    response = client.get("/api/receivables/law?business_id=apex_precision_mfg")
    assert response.status_code == 200
    data = response.json()
    assert data["business_id"] == "apex_precision_mfg"
    assert data["rbi_bank_rate_pct"] == 6.5
    assert data["msmed_penal_rate_pct"] == 19.5
    assert len(data["invoices"]) >= 3
    assert data["total_overdue_principal"] > 0
    assert data["total_accrued_penal_interest"] > 0
    # Reminder text is populated
    assert "STATUTORY REGULATORY NOTICE" in data["invoices"][0]["statutory_reminder_draft"]


# ==========================================
# 3. Statutory Cash Calendar Tests
# ==========================================

def test_statutory_calendar_date_expansion():
    """Verify that 42-day window schedules TDS (7th), PF (15th), GST (20th), and payroll."""
    ref_date = date(2026, 11, 1)
    cal = get_upcoming_cash_calendar(reference_date=ref_date, window_days=42)

    assert cal["horizon_days"] == 42
    assert cal["payments_count"] > 0
    categories = {p["category"] for p in cal["scheduled_payments"]}
    assert "Statutory" in categories
    assert "Payroll" in categories
    assert "Loan repayments" in categories
    assert "Supplier payments" in categories


def test_api_calendar_endpoint():
    """Verify GET /api/calendar returns categorized outflows and category totals."""
    response = client.get("/api/calendar?business_id=apex_precision_mfg&window_days=42")
    assert response.status_code == 200
    data = response.json()
    assert data["horizon_days"] == 42
    assert "category_totals" in data
    assert data["category_totals"]["Statutory"] > 0
    assert len(data["scheduled_payments"]) > 0


# ==========================================
# 4. Forecast Reliability & Backtesting Tests
# ==========================================

def test_historical_backtest_metrics():
    """Verify run_historical_backtest produces 12 periods, ~78% band coverage, and calibration points."""
    bt = run_historical_backtest(business_id="apex_precision_mfg", evaluation_periods=12)
    assert bt["evaluation_periods"] == 12
    assert bt["band_coverage_pct"] >= 70
    assert bt["warning_lead_time_days"] >= 14
    assert bt["missed_shortfalls_count"] == 0
    assert len(bt["calibration_curve"]) == 5
    assert bt["trust_score"] > 80.0


def test_api_backtest_endpoint():
    """Verify GET /api/backtest returns trust score and calibration points."""
    response = client.get("/api/backtest?business_id=apex_precision_mfg")
    assert response.status_code == 200
    data = response.json()
    assert data["evaluation_periods"] == 12
    assert "calibration_curve" in data
    assert data["calibration_curve"][0]["predicted"] == 10
    assert data["calibration_curve"][0]["actual"] == 12
