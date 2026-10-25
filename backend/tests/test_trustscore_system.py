"""
Automated Test Suite for KOSHA TrustScore Repayment Reliability System.
Tests:
1. Pure domain 4-factor scoring model (40/25/20/15).
2. Minimum history safeguard (<2 obligations classified as 'insufficient_history').
3. Multi-tenant data privacy (merchant views score but zero cross-merchant transaction leakage).
4. Snapshot persistence and score delta tracking.
5. Exclusion of disputed obligations from reliability penalties.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from backend.app.domain.trustscore import (
    ObligationRecord,
    calculate_trust_score,
)
from backend.app.services.customer_service import customer_service
from backend.app.services.trustscore_service import trustscore_service


# =============================================================================
# 1. Pure Domain Logic Tests
# =============================================================================

def test_01_minimum_history_safeguard():
    """Customers with < 2 obligations receive 'insufficient_history' (None score), avoiding unfair penalties."""
    # 0 obligations
    res0 = calculate_trust_score([], evaluation_date=date(2026, 10, 26))
    assert res0.has_sufficient_history is False
    assert res0.total_score is None
    assert res0.category == "insufficient_history"

    # 1 obligation
    rec1 = ObligationRecord(
        id="bill_1",
        purchase_amount=Decimal("1500.00"),
        initial_paid=Decimal("500.00"),
        outstanding_amount=Decimal("1000.00"),
        transaction_date=date(2026, 10, 1),
        agreed_repayment_date=date(2026, 10, 15),
        status="overdue",
    )
    res1 = calculate_trust_score([rec1], evaluation_date=date(2026, 10, 26))
    assert res1.has_sufficient_history is False
    assert res1.total_score is None
    assert res1.category == "insufficient_history"


def test_02_perfect_repayment_history_scores_excellent():
    """Customers with 100% on-time settlement and zero overdue balance score in the Excellent tier (>=80)."""
    today = date(2026, 10, 26)
    bills = [
        ObligationRecord(
            id="bill_1",
            purchase_amount=Decimal("2000.00"),
            initial_paid=Decimal("500.00"),
            outstanding_amount=Decimal("0.00"),
            transaction_date=today - timedelta(days=40),
            agreed_repayment_date=today - timedelta(days=20),
            status="paid",
            repayments=[
                {"amount": 1500.0, "repayment_date": today - timedelta(days=22), "payment_status": "completed"}
            ],
        ),
        ObligationRecord(
            id="bill_2",
            purchase_amount=Decimal("3500.00"),
            initial_paid=Decimal("1000.00"),
            outstanding_amount=Decimal("0.00"),
            transaction_date=today - timedelta(days=25),
            agreed_repayment_date=today - timedelta(days=10),
            status="paid",
            repayments=[
                {"amount": 2500.0, "repayment_date": today - timedelta(days=12), "payment_status": "completed"}
            ],
        ),
    ]

    res = calculate_trust_score(bills, evaluation_date=today)
    assert res.has_sufficient_history is True
    assert res.total_score is not None
    assert res.total_score >= 85
    assert res.category == "excellent"
    assert res.on_time_score == 40.0
    assert res.current_overdue_ratio_score == 20.0
    assert res.active_overdue_obligations == 0


def test_03_overdue_penalties_proportional():
    """Prolonged overdue bills reduce scores into Fair or Needs Attention tiers."""
    today = date(2026, 10, 26)
    bills = [
        ObligationRecord(
            id="bill_1",
            purchase_amount=Decimal("1000.00"),
            initial_paid=Decimal("0.00"),
            outstanding_amount=Decimal("0.00"),
            transaction_date=today - timedelta(days=60),
            agreed_repayment_date=today - timedelta(days=40),
            status="paid",
            repayments=[
                {"amount": 1000.0, "repayment_date": today - timedelta(days=41), "payment_status": "completed"}
            ],
        ),
        ObligationRecord(
            id="bill_2",
            purchase_amount=Decimal("5000.00"),
            initial_paid=Decimal("0.00"),
            outstanding_amount=Decimal("5000.00"),
            transaction_date=today - timedelta(days=45),
            agreed_repayment_date=today - timedelta(days=35),  # 35 days overdue!
            status="overdue",
        ),
    ]

    res = calculate_trust_score(bills, evaluation_date=today)
    assert res.has_sufficient_history is True
    assert res.total_score is not None
    assert res.total_score < 65
    assert res.category in ("fair", "needs_attention")
    assert res.active_overdue_obligations == 1
    assert len(res.risk_factors) >= 1


def test_04_disputed_bills_excluded_from_reliability_penalties():
    """Bills flagged as disputed are excluded from overdue penalties pending resolution."""
    today = date(2026, 10, 26)
    bills = [
        ObligationRecord(
            id="bill_1",
            purchase_amount=Decimal("1500.00"),
            initial_paid=Decimal("0.00"),
            outstanding_amount=Decimal("0.00"),
            transaction_date=today - timedelta(days=30),
            agreed_repayment_date=today - timedelta(days=15),
            status="paid",
            repayments=[
                {"amount": 1500.0, "repayment_date": today - timedelta(days=16), "payment_status": "completed"}
            ],
        ),
        ObligationRecord(
            id="bill_2",
            purchase_amount=Decimal("3000.00"),
            initial_paid=Decimal("0.00"),
            outstanding_amount=Decimal("3000.00"),
            transaction_date=today - timedelta(days=25),
            agreed_repayment_date=today - timedelta(days=10),
            status="disputed",
            is_disputed=True,
        ),
    ]

    res = calculate_trust_score(bills, evaluation_date=today)
    # The disputed bill is not counted as an active overdue penalty
    assert res.active_overdue_obligations == 0
    assert res.current_overdue_paise == 0
    assert any("disputed" in f.lower() for f in res.positive_factors)


# =============================================================================
# 2. Service & API Endpoint Tests
# =============================================================================

def test_05_customer_score_api(client, db_session: Session):
    """Verifies that the customer TrustScore endpoint returns full 4-factor breakdown."""
    customer_service.ensure_demo_seeds(db_session)

    res = client.get("/api/trustscore/customer/cust_rahul_01")
    assert res.status_code == 200
    data = res.json()
    assert data["customer_id"] == "cust_rahul_01"
    assert "score" in data
    assert "score_category" in data
    assert "breakdown" in data
    assert data["breakdown"]["on_time_performance"]["max_score"] == 40.0
    assert data["breakdown"]["overdue_frequency_duration"]["max_score"] == 25.0
    assert data["breakdown"]["current_overdue_ratio"]["max_score"] == 20.0
    assert data["breakdown"]["recency_consistency"]["max_score"] == 15.0
    assert "signals" in data
    assert "methodology_notes" in data


def test_06_trustscore_history_tracking(client, db_session: Session):
    """Verifies that multiple snapshots are recorded over time and queryable via history."""
    customer_service.ensure_demo_seeds(db_session)

    # Trigger calculation
    recalc_res = client.post("/api/trustscore/recalculate?customer_id=cust_rahul_01&reason=audit_test")
    assert recalc_res.status_code == 200

    hist_res = client.get("/api/trustscore/history?customer_id=cust_rahul_01")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert isinstance(history, list)
    assert len(history) >= 1
    assert "score" in history[0]
    assert "timestamp" in history[0]


def test_07_business_owner_customer_profile_privacy_isolation(client, db_session: Session):
    """
    CRITICAL SECURITY CHECK:
    A shopkeeper inspecting a customer profile sees the customer's TrustScore tier,
    but financial amounts and transaction lists are STRICTLY ISOLATED to that shopkeeper's store!
    Never leaks transaction records or balances belonging to another merchant.
    """
    customer_service.ensure_demo_seeds(db_session)

    # Rahul Sharma has transactions at both shop_lakshmi_02 and shop_apex_01
    res = client.get("/api/trustscore/business/shop_apex_01/customer/cust_rahul_01")
    assert res.status_code == 200
    data = res.json()

    assert data["customer_id"] == "cust_rahul_01"
    assert "trust_score" in data
    assert "score_category" in data
    assert "merchant_specific" in data

    merchant_data = data["merchant_specific"]
    assert merchant_data["shop_id"] == "shop_apex_01"

    # All returned bills MUST belong strictly to shop_apex_01!
    for b in merchant_data["bills"]:
        # Verify bill belongs to shop_apex_01
        from backend.app.db.models import CreditTransactionModel
        db_bill = db_session.query(CreditTransactionModel).filter_by(id=b["id"]).first()
        assert db_bill.shop_id == "shop_apex_01"
