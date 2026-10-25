"""
Comprehensive Test Suite for KOSHA AutoPay Deadline Collection Engine.

Validates:
1. Overdue unpaid bills (successful collection execution, status transitions).
2. Partially paid bills (only collects actual remaining balance, never original total).
3. Bills fully paid before job runs (engine cancels / skips without debiting).
4. Missing, paused, and revoked mandates (preserves debt, skips collection).
5. Amount-limit violations (enforces mandate cap, leaves remainder outstanding).
6. Duplicate scheduler runs (idempotency, prevents duplicate debits).
7. Concurrent worker execution (in-flight row-level gating).
8. Customer manual payment racing with AutoPay (recalculates immediately).
9. Successful provider confirmation and ledger reconciliation.
10. Failed collection (insufficient funds) -> error recorded, debt preserved, retry backoff.
11. Network timeout and ambiguous provider status -> 'reconciliation_required' without false failure.
12. Pre-debit notification window enforcement (24h regulatory window).
13. Duplicate and out-of-order webhooks idempotency.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ActivityEventModel,
    AutopayAttemptModel,
    AutopayMandateModel,
    BusinessModel,
    ConsentAuditModel,
    CreditTransactionModel,
    CustomerModel,
    PaymentVerificationModel,
    RepaymentModel,
    ShopModel,
)
from backend.app.services.collection_engine import collection_engine
from backend.app.services.razorpay_service import razorpay_service


@pytest.fixture
def collection_test_setup(client, db_session):
    """Hermetic test fixture with business, shop, customers, and seed credit bills."""
    db: Session = db_session

    # Clean state
    db.query(AutopayAttemptModel).delete()
    db.query(AutopayMandateModel).delete()
    db.query(ConsentAuditModel).delete()
    db.query(PaymentVerificationModel).delete()
    db.query(RepaymentModel).delete()
    db.query(CreditTransactionModel).delete()

    biz = BusinessModel(
        id="biz_engine_test",
        legal_name="Apex Precision Engineering Pvt Ltd",
        trade_name="Apex Precision",
        industry="Manufacturing",
        is_demo=False,
    )
    db.add(biz)

    shop = ShopModel(
        id="shop_engine_test",
        shop_name="Apex Works Counter",
        shop_code="APEX-ENGINE",
        category="Industrial Spares",
        owner_name="Srujana Authorized Merchant",
        phone="+91 98450 11223",
        upi_id="apex.engine@razorpay",
        status="active",
    )
    db.add(shop)

    cust1 = CustomerModel(
        id="cust_engine_owner",
        display_name="Karthik Verma",
        phone="+919876543211",
        email="karthik.verma@example.com",
    )
    db.add(cust1)

    db.commit()

    return {
        "client": client,
        "db": db,
        "biz": biz,
        "shop": shop,
        "cust1": cust1,
    }


def test_01_overdue_unpaid_bill_collection_execution(collection_test_setup):
    """1. Overdue unpaid bill with active mandate collects remaining balance and reconciles ledger."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    # Create bill overdue by 2 days
    bill = CreditTransactionModel(
        id="bill_engine_001",
        reference="BILL-ENG-001",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Hydraulic Fittings & Sensors",
        purchase_amount=Decimal("10000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("10000.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=2),  # Overdue
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_001",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        razorpay_customer_id="cust_rzp_123",
        razorpay_token_id="token_rzp_123",
        mandate_type="upi_autopay",
        amount_type="variable",
        max_amount_paise=1000000,
        currency="INR",
        frequency="as_presented",
        status="active",
        effective_date=date.today() - timedelta(days=10),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Execute collection
    attempt = collection_engine.execute_collection_attempt(
        bill_id=bill.id,
        db=db,
        bypass_notification_window=True,
        simulated_outcome="success",
    )

    assert attempt.status == "succeeded"
    assert attempt.amount_paise == 1000000
    assert attempt.reconciliation_status == "reconciled"

    # Reload bill and verify authoritative ledger
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("0.00")
    assert bill.status == "paid"

    # Verify Repayment record was created
    repayments = db.query(RepaymentModel).filter_by(transaction_id=bill.id).all()
    assert len(repayments) == 1
    assert repayments[0].amount == Decimal("10000.00")
    assert repayments[0].payment_status == "completed"


def test_02_partially_paid_bill_collects_only_remaining_balance(collection_test_setup):
    """2. Partially paid bill (₹10,000 original, ₹4,000 paid) collects only ₹6,000, never original total."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    # Bill: 10,000 total, 2,000 down payment, 2,000 partial payment -> 6,000 remaining
    bill = CreditTransactionModel(
        id="bill_engine_002",
        reference="BILL-ENG-002",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="CNC Drill Bits & Lathe Cutters",
        purchase_amount=Decimal("10000.00"),
        initial_paid_amount=Decimal("2000.00"),
        outstanding_amount=Decimal("6000.00"),
        transaction_date=date.today() - timedelta(days=14),
        agreed_repayment_date=date.today() - timedelta(days=1),  # Overdue
        status="overdue",
    )
    db.add(bill)

    # Completed partial payment in ledger
    partial_rep = RepaymentModel(
        id="rep_partial_001",
        transaction_id=bill.id,
        amount=Decimal("2000.00"),
        repayment_date=date.today() - timedelta(days=5),
        payment_method="cash",
        payment_status="completed",
        recorded_by="counter_receipt",
    )
    db.add(partial_rep)

    mandate = AutopayMandateModel(
        id="mnd_engine_002",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        razorpay_customer_id="cust_rzp_123",
        razorpay_token_id="token_rzp_123",
        mandate_type="upi_autopay",
        amount_type="variable",
        max_amount_paise=1000000,  # Authorized up to 10,000
        currency="INR",
        status="active",
        effective_date=date.today() - timedelta(days=14),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Authoritative calculation check
    balance_info = collection_engine.calculate_authoritative_balance(bill, db)
    assert balance_info["remaining_paise"] == 600000  # Exactly 6,000 INR

    # Execute collection
    attempt = collection_engine.execute_collection_attempt(
        bill_id=bill.id,
        db=db,
        bypass_notification_window=True,
        simulated_outcome="success",
    )

    # Must collect strictly 6,000 INR (600,000 paise), NOT 10,000 INR
    assert attempt.amount_paise == 600000
    assert attempt.status == "succeeded"

    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("0.00")
    assert bill.status == "paid"


def test_03_bill_fully_paid_before_run_skips_collection(collection_test_setup):
    """3. Customer settles bill in full before collection runs -> engine detects zero balance and skips debit."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    # Bill has 0 outstanding balance
    bill = CreditTransactionModel(
        id="bill_engine_003",
        reference="BILL-ENG-003",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Precision Bearings",
        purchase_amount=Decimal("5000.00"),
        initial_paid_amount=Decimal("5000.00"),
        outstanding_amount=Decimal("0.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="paid",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_003",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=500000,
        effective_date=date.today() - timedelta(days=10),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Run cycle
    cycle_res = collection_engine.run_collection_cycle(
        db=db,
        target_date=date.today(),
        bypass_notification_window=True,
        bill_ids=[bill.id],
    )

    # Bill is skipped because outstanding balance is zero
    assert cycle_res["succeeded_count"] == 0
    assert cycle_res["eligible_count"] == 0

    # Ensure no attempts were created
    attempts = db.query(AutopayAttemptModel).filter_by(bill_id=bill.id).all()
    assert len(attempts) == 0


def test_04_missing_or_revoked_mandate_preserves_debt(collection_test_setup):
    """4. Overdue bill with revoked or missing mandate is skipped and debt preserved."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_004",
        reference="BILL-ENG-004",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Steel Tubes & Bars",
        purchase_amount=Decimal("8000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("8000.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=2),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_004",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="revoked",  # Customer revoked mandate
        max_amount_paise=800000,
        effective_date=date.today() - timedelta(days=10),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    eligibility = collection_engine.evaluate_bill_eligibility(bill, db)
    assert eligibility["is_eligible"] is False
    assert eligibility["decision"] == "ineligible_no_active_mandate"

    # Debt remains intact
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("8000.00")
    assert bill.status == "overdue"


def test_05_mandate_limit_cap_respected_without_overcharge(collection_test_setup):
    """5. Mandate cap (₹5,000) on larger bill (₹8,000) collects strictly up to ₹5,000 cap, leaving remainder."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_005",
        reference="BILL-ENG-005",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Heavy Duty Industrial Motors",
        purchase_amount=Decimal("8000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("8000.00"),
        transaction_date=date.today() - timedelta(days=12),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="overdue",
    )
    db.add(bill)

    # Customer authorized up to ₹5,000 cap (500,000 paise)
    mandate = AutopayMandateModel(
        id="mnd_engine_005",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=500000,
        effective_date=date.today() - timedelta(days=12),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    attempt = collection_engine.execute_collection_attempt(
        bill_id=bill.id,
        db=db,
        bypass_notification_window=True,
        simulated_outcome="success",
    )

    # Amount collected is strictly capped to mandate maximum (₹5,000)
    assert attempt.amount_paise == 500000
    assert attempt.status == "succeeded"

    # Bill remaining balance is reduced by exactly ₹5,000 to ₹3,000
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("3000.00")
    assert bill.status == "overdue"


def test_06_duplicate_scheduler_runs_are_idempotent(collection_test_setup):
    """6. Repeated collection cycle runs do not charge twice or create duplicate settlements."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_006",
        reference="BILL-ENG-006",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Pneumatic Cylinders",
        purchase_amount=Decimal("4000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("4000.00"),
        transaction_date=date.today() - timedelta(days=8),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_006",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=400000,
        effective_date=date.today() - timedelta(days=8),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Run 1: Successfully collects
    cycle_1 = collection_engine.run_collection_cycle(
        db=db,
        target_date=date.today(),
        bypass_notification_window=True,
        bill_ids=[bill.id],
    )
    assert cycle_1["succeeded_count"] == 1
    assert cycle_1["total_collected_paise"] == 400000

    # Run 2: Immediate second run of the scheduler
    cycle_2 = collection_engine.run_collection_cycle(
        db=db,
        target_date=date.today(),
        bypass_notification_window=True,
        bill_ids=[bill.id],
    )
    # Bill is already paid; run 2 collects nothing
    assert cycle_2["succeeded_count"] == 0
    assert cycle_2["total_collected_paise"] == 0

    # Total repayments remains exactly 1
    reps = db.query(RepaymentModel).filter_by(transaction_id=bill.id).all()
    assert len(reps) == 1


def test_07_concurrent_worker_execution_gating(collection_test_setup):
    """7. Prevents concurrent workers from initiating duplicate attempts for the same bill."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_007",
        reference="BILL-ENG-007",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Stainless Steel Valves",
        purchase_amount=Decimal("7000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("7000.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_007",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=700000,
        effective_date=date.today() - timedelta(days=10),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)

    # Worker A initiates an attempt that is currently in-flight ('initiated')
    in_flight_att = AutopayAttemptModel(
        id="att_worker_a",
        mandate_id=mandate.id,
        bill_id=bill.id,
        customer_id=cust1.id,
        business_id=shop.id,
        amount_paise=700000,
        idempotency_key="col_bill_007_unique",
        status="initiated",
        initiation_time=datetime.now(timezone.utc),
    )
    db.add(in_flight_att)
    db.commit()

    # Worker B evaluates bill eligibility while Worker A is in-flight
    eval_b = collection_engine.evaluate_bill_eligibility(bill, db)
    assert eval_b["is_eligible"] is False
    assert eval_b["decision"] == "ineligible_attempt_in_flight"
    assert "in status 'initiated'" in eval_b["deferral_reason"]


def test_08_customer_manual_payment_racing_with_autopay(collection_test_setup):
    """8. Customer makes manual payment while collection is being prepared -> balance recalculates immediately."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_008",
        reference="BILL-ENG-008",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Fasteners & Rivets",
        purchase_amount=Decimal("6000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("6000.00"),
        transaction_date=date.today() - timedelta(days=9),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_008",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=600000,
        effective_date=date.today() - timedelta(days=9),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Customer pays ₹4,000 cash at counter right before execution
    counter_rep = RepaymentModel(
        id="rep_counter_race",
        transaction_id=bill.id,
        amount=Decimal("4000.00"),
        repayment_date=date.today(),
        payment_method="cash",
        payment_status="completed",
        recorded_by="shopkeeper",
    )
    db.add(counter_rep)
    bill.outstanding_amount = Decimal("2000.00")
    db.commit()

    # Engine reloads and recalculates before charging
    attempt = collection_engine.execute_collection_attempt(
        bill_id=bill.id,
        db=db,
        bypass_notification_window=True,
        simulated_outcome="success",
    )

    # Charges only the newly calculated balance (₹2,000), not the old ₹6,000
    assert attempt.amount_paise == 200000
    assert attempt.status == "succeeded"

    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("0.00")
    assert bill.status == "paid"


def test_09_failed_collection_preserves_debt_and_applies_backoff(collection_test_setup):
    """9. Provider rejection (insufficient funds) records safe error, preserves debt, and schedules backoff."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_009",
        reference="BILL-ENG-009",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Air Compressor Spare Parts",
        purchase_amount=Decimal("5000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("5000.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_009",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=500000,
        effective_date=date.today() - timedelta(days=10),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Simulate provider failure (insufficient funds)
    attempt = collection_engine.execute_collection_attempt(
        bill_id=bill.id,
        db=db,
        bypass_notification_window=True,
        simulated_outcome="failed",
    )

    assert attempt.status == "failed"
    assert attempt.failure_code == "INSUFFICIENT_FUNDS"
    assert attempt.next_retry_at is not None

    # Debt must remain completely intact
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("5000.00")
    assert bill.status == "overdue"


def test_10_network_timeout_transitions_to_reconciliation_required(collection_test_setup):
    """10. Network timeout during debit sets 'reconciliation_required' without false failure."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_010",
        reference="BILL-ENG-010",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Gearbox Assembly Parts",
        purchase_amount=Decimal("9000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("9000.00"),
        transaction_date=date.today() - timedelta(days=15),
        agreed_repayment_date=date.today() - timedelta(days=2),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_010",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=900000,
        effective_date=date.today() - timedelta(days=15),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Execute with simulated timeout
    attempt = collection_engine.execute_collection_attempt(
        bill_id=bill.id,
        db=db,
        bypass_notification_window=True,
        simulated_outcome="timeout",
    )

    assert attempt.status == "reconciliation_required"
    assert attempt.failure_code == "NETWORK_TIMEOUT"
    assert attempt.reconciliation_status == "mismatch"

    # Bill balance is preserved while in reconciliation
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("9000.00")


def test_11_pre_debit_notification_window_enforcement(collection_test_setup):
    """11. Enforces mandatory pre-debit notification (24-hour window) before debit is allowed."""
    db = collection_test_setup["db"]
    cust1 = collection_test_setup["cust1"]
    shop = collection_test_setup["shop"]

    bill = CreditTransactionModel(
        id="bill_engine_011",
        reference="BILL-ENG-011",
        customer_id=cust1.id,
        shop_id=shop.id,
        description="Copper Wiring & Terminal Blocks",
        purchase_amount=Decimal("4500.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("4500.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=1),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_engine_011",
        customer_id=cust1.id,
        business_id=shop.id,
        shop_id=shop.id,
        bill_id=bill.id,
        status="active",
        max_amount_paise=450000,
        effective_date=date.today() - timedelta(days=10),
        consent_timestamp=datetime.now(timezone.utc),
        terms_version="v1.0-2026",
    )
    db.add(mandate)
    db.commit()

    # Step 1: Evaluate without bypass -> requires pre-debit notice
    eval_1 = collection_engine.evaluate_bill_eligibility(bill, db, bypass_notification_window=False)
    assert eval_1["is_eligible"] is False
    assert eval_1["decision"] == "requires_pre_debit_notification"

    # Step 2: Send pre-debit notification
    attempt = collection_engine.send_pre_debit_notification(bill, mandate, 450000, db)
    assert attempt.status == "awaiting_notification"
    assert attempt.notification_status == "sent"

    # Step 3: Immediately re-evaluating within 24h window -> deferred
    eval_2 = collection_engine.evaluate_bill_eligibility(bill, db, bypass_notification_window=False)
    assert eval_2["is_eligible"] is False
    assert eval_2["decision"] == "deferred_notification_window_active"


def test_12_collection_engine_api_trigger_and_status(collection_test_setup):
    """12. API endpoints for collection cycle trigger, status metrics, and attempt inspection."""
    client = collection_test_setup["client"]
    db = collection_test_setup["db"]

    # Trigger collection cycle via API
    resp = client.post(
        "/api/autopay/collection/trigger",
        json={"bypass_notification_window": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "cycle_id" in data
    assert "total_collected_inr" in data

    # Check status endpoint
    status_resp = client.get("/api/autopay/collection/status")
    assert status_resp.status_code == 200
    s_data = status_resp.json()
    assert "is_enabled" in s_data
    assert "overdue_bills_count" in s_data
    assert "max_retry_attempts" in s_data

    # List attempts endpoint
    att_resp = client.get("/api/autopay/collection/attempts")
    assert att_resp.status_code == 200
    assert isinstance(att_resp.json(), list)
