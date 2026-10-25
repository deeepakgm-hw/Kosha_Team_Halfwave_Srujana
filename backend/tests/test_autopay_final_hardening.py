"""
Authoritative Final Hardening Test Suite for KOSHA AutoPay, Smart Dues & Financial Ledgers.

Validates:
1. Webhook HMAC-SHA256 signature verification and constant-time tampering rejection (HTTP 400).
2. Webhook idempotency and deduplication (duplicate deliveries ignored without duplicate credit).
3. Webhook payment.captured reconciles in-flight AutoPay attempts and atomically credits the bill ledger.
4. Webhook payment.failed logs failure reason and preserves 100% of the customer's debt.
5. Webhook refund.processed records negative adjustment and reopens paid bills.
6. Automated reconciliation cycle (run_reconciliation_cycle) resolves network timeout attempts.
7. Automated reconciliation cycle detects and transactionally repairs drifted ledger balances.
8. Bill transaction timeline endpoint returns structured chronological events with strict category separation.
9. Business Owner AutoPay Dashboard returns accurate shop-level aggregates, protected overdue balances, and itemization.
10. Reconciliation history API endpoint queries and filters auditable reconciliation log records.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import hmac
import json
import uuid
import pytest
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.models import (
    ActivityEventModel,
    AutopayAttemptModel,
    AutopayMandateModel,
    AutopayReconciliationModel,
    BusinessModel,
    ConsentAuditModel,
    CreditTransactionModel,
    CustomerModel,
    PaymentRequestModel,
    PaymentVerificationModel,
    RepaymentModel,
    ShopModel,
    WebhookEventModel,
)
from backend.app.services.collection_engine import collection_engine
from backend.app.services.razorpay_service import razorpay_service
from backend.app.services.reconciliation_service import reconciliation_service


def generate_webhook_signature(body: bytes, secret: str) -> str:
    """Generates valid HMAC-SHA256 signature for test webhook payloads."""
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


@pytest.fixture
def hardening_fixture(client, db_session):
    """Sets up clean business, shop, customer, and sample credit bills."""
    db: Session = db_session

    # Clean test tables
    db.query(AutopayReconciliationModel).delete()
    db.query(AutopayAttemptModel).delete()
    db.query(AutopayMandateModel).delete()
    db.query(ConsentAuditModel).delete()
    db.query(PaymentVerificationModel).delete()
    db.query(RepaymentModel).delete()
    db.query(PaymentRequestModel).delete()
    db.query(WebhookEventModel).delete()
    db.query(CreditTransactionModel).delete()

    biz = BusinessModel(
        id="biz_harden_test",
        legal_name="Apex Aerospace Components Pvt Ltd",
        trade_name="Apex Aero",
        industry="Precision Engineering",
        is_demo=False,
    )
    db.add(biz)

    shop = ShopModel(
        id="shop_harden_test",
        shop_name="Apex Machining Hub",
        shop_code="APEX-AERO",
        category="Industrial Hardware",
        owner_name="Srujana Founder",
        phone="+91 98450 99887",
        upi_id="apex.machining@razorpay",
        status="active",
    )
    db.add(shop)

    cust = CustomerModel(
        id="cust_harden_user",
        display_name="Vikram Sethi",
        phone="+919876543299",
        email="vikram.sethi@example.com",
    )
    db.add(cust)
    db.commit()

    return {
        "client": client,
        "db": db,
        "biz": biz,
        "shop": shop,
        "cust": cust,
    }


# =============================================================================
# 1. Webhook Signature Verification and Tampering Rejection
# =============================================================================

def test_01_webhook_signature_verification_and_rejection(hardening_fixture):
    """1. Webhook accepts valid HMAC signature and rejects invalid/missing signatures with HTTP 400."""
    client = hardening_fixture["client"]
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "kosha_rzp_webhook_secret_2026"

    payload = {
        "event": "payment.captured",
        "id": f"evt_sig_test_{uuid.uuid4().hex[:8]}",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_sig_{uuid.uuid4().hex[:8]}",
                    "amount": 50000,
                    "currency": "INR",
                    "status": "captured",
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")

    # A. Valid Signature
    valid_sig = generate_webhook_signature(raw_body, secret)
    resp_valid = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": valid_sig},
    )
    assert resp_valid.status_code == 200

    # B. Tampered / Invalid Signature
    resp_invalid = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": "tampered_fake_signature_hash"},
    )
    assert resp_invalid.status_code == 400
    assert "Invalid Razorpay webhook signature" in resp_invalid.text

    # C. Missing Signature Header
    resp_missing = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
    )
    assert resp_missing.status_code == 400


# =============================================================================
# 2. Webhook Idempotency & Deduplication
# =============================================================================

def test_02_webhook_idempotency_duplicate_delivery(hardening_fixture):
    """2. Repeated delivery of same webhook event returns 'ignored' without double crediting."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "kosha_rzp_webhook_secret_2026"

    # Create test bill
    bill = CreditTransactionModel(
        id="bill_idemp_01",
        reference="BILL-IDEMP-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Hydraulic Seals",
        purchase_amount=Decimal("2000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("2000.00"),
        transaction_date=date.today(),
        agreed_repayment_date=date.today() + timedelta(days=15),
        status="upcoming",
    )
    db.add(bill)
    db.commit()

    event_id = f"evt_idemp_{uuid.uuid4().hex[:10]}"
    pay_id = f"pay_idemp_{uuid.uuid4().hex[:10]}"
    payload = {
        "event": "payment.captured",
        "id": event_id,
        "payload": {
            "payment": {
                "entity": {
                    "id": pay_id,
                    "amount": 100000,  # ₹1,000.00
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"bill_id": bill.id},
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = generate_webhook_signature(raw_body, secret)

    # First delivery: Should process and apply payment
    resp1 = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": sig},
    )
    assert resp1.status_code == 200
    assert resp1.json().get("status") == "processed"

    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("1000.00")

    # Second delivery with exact same event ID: Must be ignored idempotently
    resp2 = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": sig},
    )
    assert resp2.status_code == 200
    res2_data = resp2.json()
    assert res2_data.get("status") == "ignored"
    assert "Duplicate webhook delivery" in res2_data.get("reason")

    # Authoritative ledger invariant: Balance must still be ₹1,000.00 (NOT ₹0.00)
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("1000.00")

    repayments = db.query(RepaymentModel).filter_by(transaction_id=bill.id).all()
    assert len(repayments) == 1


# =============================================================================
# 3. Webhook payment.captured Reconciles AutoPay Attempt & Ledger
# =============================================================================

def test_03_webhook_payment_captured_reconciles_ledger_and_attempt(hardening_fixture):
    """3. payment.captured updates bill ledger and completes in-flight AutoPay attempt."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    biz = hardening_fixture["biz"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "kosha_rzp_webhook_secret_2026"

    bill = CreditTransactionModel(
        id="bill_capture_01",
        reference="BILL-CAP-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="CNC Tooling Inserts",
        purchase_amount=Decimal("1500.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("1500.00"),
        transaction_date=date.today() - timedelta(days=20),
        agreed_repayment_date=date.today() - timedelta(days=5),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_cap_01",
        customer_id=cust.id,
        business_id=biz.id,
        shop_id=shop.id,
        bill_id=bill.id,
        razorpay_customer_id="cust_rzp_cap",
        mandate_type="upi_autopay",
        max_amount_paise=150000,
        status="active",
        effective_date=date.today() - timedelta(days=10),
    )
    db.add(mandate)

    # In-flight attempt that was waiting for confirmation
    attempt = AutopayAttemptModel(
        id="att_cap_01",
        mandate_id=mandate.id,
        bill_id=bill.id,
        customer_id=cust.id,
        business_id=biz.id,
        amount_paise=150000,
        idempotency_key="idemp_cap_att_01",
        status="reconciliation_required",
        initiation_time=datetime.now(timezone.utc) - timedelta(minutes=10),
    )
    db.add(attempt)
    db.commit()

    captured_pay_id = f"pay_cap_{uuid.uuid4().hex[:10]}"
    payload = {
        "event": "payment.captured",
        "id": f"evt_cap_{uuid.uuid4().hex[:10]}",
        "payload": {
            "payment": {
                "entity": {
                    "id": captured_pay_id,
                    "amount": 150000,  # ₹1,500.00
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {
                        "bill_id": bill.id,
                        "kosha_attempt_id": attempt.id,
                    },
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = generate_webhook_signature(raw_body, secret)

    resp = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": sig},
    )
    assert resp.status_code == 200

    # Ledger must show bill fully paid
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("0.00")
    assert bill.status == "paid"

    # Attempt must be transitioned to succeeded and reconciled
    db.refresh(attempt)
    assert attempt.status == "succeeded"
    assert attempt.reconciliation_status == "reconciled"
    assert attempt.razorpay_payment_id == captured_pay_id


# =============================================================================
# 4. Webhook payment.failed Preserves Debt & Logs Failure
# =============================================================================

def test_04_webhook_payment_failed_preserves_debt(hardening_fixture):
    """4. payment.failed updates attempt status to failed but preserves 100% of bill debt."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    biz = hardening_fixture["biz"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "kosha_rzp_webhook_secret_2026"

    bill = CreditTransactionModel(
        id="bill_fail_01",
        reference="BILL-FAIL-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Precision Bearings",
        purchase_amount=Decimal("3000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("3000.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() - timedelta(days=2),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_fail_01",
        customer_id=cust.id,
        business_id=biz.id,
        shop_id=shop.id,
        bill_id=bill.id,
        razorpay_customer_id="cust_rzp_fail",
        mandate_type="upi_autopay",
        max_amount_paise=300000,
        status="active",
        effective_date=date.today() - timedelta(days=5),
    )
    db.add(mandate)

    attempt = AutopayAttemptModel(
        id="att_fail_01",
        mandate_id=mandate.id,
        bill_id=bill.id,
        customer_id=cust.id,
        business_id=biz.id,
        amount_paise=300000,
        idempotency_key="idemp_fail_att_01",
        status="initiated",
        initiation_time=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.commit()

    payload = {
        "event": "payment.failed",
        "id": f"evt_fail_{uuid.uuid4().hex[:10]}",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_fail_{uuid.uuid4().hex[:10]}",
                    "amount": 300000,
                    "currency": "INR",
                    "status": "failed",
                    "error_code": "BAD_REQUEST_INSUFFICIENT_FUNDS",
                    "error_description": "Payer account has insufficient balance",
                    "notes": {
                        "bill_id": bill.id,
                        "kosha_attempt_id": attempt.id,
                    },
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = generate_webhook_signature(raw_body, secret)

    resp = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": sig},
    )
    assert resp.status_code == 200

    # Invariant: Debt must be 100% intact
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("3000.00")
    assert bill.status == "overdue"

    # Attempt marked failed
    db.refresh(attempt)
    assert attempt.status == "failed"
    assert attempt.failure_code == "BAD_REQUEST_INSUFFICIENT_FUNDS"
    assert "insufficient balance" in attempt.failure_reason.lower()


# =============================================================================
# 5. Webhook refund.processed Adjusts Ledger & Reopens Bill
# =============================================================================

def test_05_webhook_refund_reversal_adjusts_ledger(hardening_fixture):
    """5. refund.processed creates negative repayment and reopens previously paid bill."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]
    secret = settings.RAZORPAY_WEBHOOK_SECRET or "kosha_rzp_webhook_secret_2026"

    # Fully paid bill
    bill = CreditTransactionModel(
        id="bill_refund_01",
        reference="BILL-RFD-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Carbide Cutters",
        purchase_amount=Decimal("1000.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("0.00"),
        transaction_date=date.today() - timedelta(days=20),
        agreed_repayment_date=date.today() - timedelta(days=5),
        status="paid",
    )
    db.add(bill)

    orig_pay_id = "pay_orig_refund_01"
    initial_repayment = RepaymentModel(
        transaction_id=bill.id,
        amount=Decimal("1000.00"),
        repayment_date=date.today() - timedelta(days=6),
        payment_method="razorpay_upi",
        payment_status="completed",
        provider_reference=orig_pay_id,
        recorded_by="razorpay_verified",
    )
    db.add(initial_repayment)
    db.commit()

    # Razorpay notifies refund of ₹400.00 (40000 paise)
    payload = {
        "event": "refund.processed",
        "id": f"evt_rfd_{uuid.uuid4().hex[:10]}",
        "payload": {
            "refund": {
                "entity": {
                    "id": f"rfd_{uuid.uuid4().hex[:10]}",
                    "payment_id": orig_pay_id,
                    "amount": 40000,  # ₹400.00
                    "currency": "INR",
                    "status": "processed",
                    "notes": {"bill_id": bill.id},
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = generate_webhook_signature(raw_body, secret)

    resp = client.post(
        "/api/payment-gateway/webhook",
        content=raw_body,
        headers={"X-Razorpay-Signature": sig},
    )
    assert resp.status_code == 200

    # Bill must reopen with ₹400.00 outstanding and overdue status
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("400.00")
    assert bill.status == "overdue"

    # Reversal record should be present
    reversals = db.query(RepaymentModel).filter_by(
        transaction_id=bill.id,
        payment_method="refund_reversal",
    ).all()
    assert len(reversals) == 1
    assert reversals[0].amount == Decimal("-400.00")


# =============================================================================
# 6. Automated Reconciliation Cycle: Timeout Attempt Resolution
# =============================================================================

def test_06_automated_reconciliation_resolves_timeout_attempt(hardening_fixture):
    """6. run_reconciliation_cycle audits ambiguous attempt and credits ledger."""
    db = hardening_fixture["db"]
    biz = hardening_fixture["biz"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]

    bill = CreditTransactionModel(
        id="bill_rec_timeout_01",
        reference="BILL-REC-TO-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Rotary Valves",
        purchase_amount=Decimal("2500.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("2500.00"),
        transaction_date=date.today() - timedelta(days=12),
        agreed_repayment_date=date.today() - timedelta(days=2),
        status="overdue",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_rec_01",
        customer_id=cust.id,
        business_id=biz.id,
        shop_id=shop.id,
        bill_id=bill.id,
        razorpay_customer_id="cust_rec_01",
        mandate_type="upi_autopay",
        max_amount_paise=250000,
        status="active",
        effective_date=date.today() - timedelta(days=5),
    )
    db.add(mandate)

    # Attempt left in 'reconciliation_required' due to network timeout
    attempt = AutopayAttemptModel(
        id="att_rec_timeout_01",
        mandate_id=mandate.id,
        bill_id=bill.id,
        customer_id=cust.id,
        business_id=biz.id,
        amount_paise=250000,
        idempotency_key="idemp_rec_to_01",
        status="reconciliation_required",
        razorpay_payment_id="pay_rec_fixture_01",
        initiation_time=datetime.now(timezone.utc) - timedelta(minutes=20),
    )
    db.add(attempt)
    db.commit()

    # Run reconciliation cycle
    cycle_res = reconciliation_service.run_reconciliation_cycle(
        db=db,
        business_id=shop.id,
        bill_id=bill.id,
    )

    assert cycle_res["success"] is True
    assert cycle_res["resolved_count"] >= 1

    # Ledger must now be credited
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("0.00")
    assert bill.status == "paid"

    # Attempt must be marked succeeded
    db.refresh(attempt)
    assert attempt.status == "succeeded"
    assert attempt.reconciliation_status == "reconciled"

    # Reconciliation log entry exists
    rec_records = db.query(AutopayReconciliationModel).filter_by(bill_id=bill.id).all()
    assert len(rec_records) >= 1
    assert rec_records[0].discrepancy_type == "timeout_resolved"
    assert rec_records[0].resolution_status == "resolved"


# =============================================================================
# 7. Automated Reconciliation Cycle: Ledger Balance Drift Repair
# =============================================================================

def test_07_automated_reconciliation_repairs_ledger_drift(hardening_fixture):
    """7. run_reconciliation_cycle audits canonical ledger formula and repairs desynced outstanding_amount."""
    db = hardening_fixture["db"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]

    # Bill: purchase 5000, initial 1000, repayment 1500 -> Canonical remaining is 2500
    bill = CreditTransactionModel(
        id="bill_drift_01",
        reference="BILL-DRIFT-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Industrial Sensors",
        purchase_amount=Decimal("5000.00"),
        initial_paid_amount=Decimal("1000.00"),
        outstanding_amount=Decimal("1200.00"),  # Corrupted / drifted cached value!
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() + timedelta(days=5),
        status="upcoming",
    )
    db.add(bill)

    rep = RepaymentModel(
        transaction_id=bill.id,
        amount=Decimal("1500.00"),
        repayment_date=date.today() - timedelta(days=2),
        payment_method="razorpay_upi",
        payment_status="completed",
        provider_reference="pay_drift_rep_01",
        recorded_by="razorpay_verified",
    )
    db.add(rep)
    db.commit()

    # Trigger reconciliation cycle for this bill
    res = reconciliation_service.run_reconciliation_cycle(
        db=db,
        bill_id=bill.id,
    )
    assert res["success"] is True

    # Authoritative balance must be repaired to 2500.00 (5000 - 1000 - 1500)
    db.refresh(bill)
    assert bill.outstanding_amount == Decimal("2500.00")

    # Audit entry must be persisted
    drift_entry = db.query(AutopayReconciliationModel).filter_by(
        bill_id=bill.id,
        discrepancy_type="ledger_balance_repaired",
    ).first()
    assert drift_entry is not None
    assert drift_entry.resolution_action == "balance_repaired"
    assert drift_entry.amount_paise == 130000  # Difference: |2500 - 1200| = 1300 INR (130000 paise)


# =============================================================================
# 8. Bill Transaction Timeline Endpoint
# =============================================================================

def test_08_bill_transaction_timeline_structure(hardening_fixture):
    """8. GET /api/autopay/bills/{id}/timeline returns chronological events with strict category separation."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    biz = hardening_fixture["biz"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]

    bill = CreditTransactionModel(
        id="bill_timeline_01",
        reference="BILL-TL-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Precision Gears",
        purchase_amount=Decimal("4000.00"),
        initial_paid_amount=Decimal("1000.00"),
        outstanding_amount=Decimal("3000.00"),
        transaction_date=date.today() - timedelta(days=5),
        agreed_repayment_date=date.today() + timedelta(days=10),
        status="upcoming",
    )
    db.add(bill)

    mandate = AutopayMandateModel(
        id="mnd_tl_01",
        customer_id=cust.id,
        business_id=biz.id,
        shop_id=shop.id,
        bill_id=bill.id,
        razorpay_customer_id="cust_rzp_tl",
        mandate_type="upi_autopay",
        max_amount_paise=300000,
        status="active",
        effective_date=date.today() - timedelta(days=2),
    )
    db.add(mandate)

    # In-flight attempt (non-final state)
    att = AutopayAttemptModel(
        id="att_tl_01",
        mandate_id=mandate.id,
        bill_id=bill.id,
        customer_id=cust.id,
        business_id=biz.id,
        amount_paise=300000,
        idempotency_key="idemp_tl_att_01",
        status="initiated",
        initiation_time=datetime.now(timezone.utc),
    )
    db.add(att)
    db.commit()

    resp = client.get(f"/api/autopay/bills/{bill.id}/timeline")
    assert resp.status_code == 200
    data = resp.json()

    assert data["bill_id"] == bill.id
    assert data["bill_reference"] == "BILL-TL-01"
    assert data["purchase_amount"] == 4000.0
    assert data["outstanding_amount"] == 3000.0

    events = data["events"]
    assert len(events) >= 3

    categories = {e["category"] for e in events}
    # Initial payment must be confirmed_financial
    # In-flight attempt must be non_final_state
    assert "confirmed_financial" in categories
    assert "non_final_state" in categories

    for e in events:
        if e["event_type"] == "initial_payment":
            assert e["category"] == "confirmed_financial"
        elif e["event_type"] in ("collection_initiated", "collection_pending"):
            assert e["category"] == "non_final_state"


# =============================================================================
# 9. Business Owner AutoPay Overview Dashboard
# =============================================================================

def test_09_business_autopay_dashboard_summary(hardening_fixture):
    """9. GET /api/autopay/business/dashboard returns accurate aggregates and itemized bills."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    biz = hardening_fixture["biz"]
    shop = hardening_fixture["shop"]
    cust = hardening_fixture["cust"]

    # 1 Overdue bill with active mandate
    b1 = CreditTransactionModel(
        id="bill_dash_01",
        reference="BILL-DASH-01",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Air Filters",
        purchase_amount=Decimal("1200.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("1200.00"),
        transaction_date=date.today() - timedelta(days=20),
        agreed_repayment_date=date.today() - timedelta(days=5),
        status="overdue",
    )
    db.add(b1)

    mandate = AutopayMandateModel(
        id="mnd_dash_01",
        customer_id=cust.id,
        business_id=biz.id,
        shop_id=shop.id,
        bill_id=b1.id,
        razorpay_customer_id="cust_rzp_dash",
        mandate_type="upi_autopay",
        max_amount_paise=120000,
        status="active",
        effective_date=date.today() - timedelta(days=10),
    )
    db.add(mandate)

    # 1 Overdue bill without mandate
    b2 = CreditTransactionModel(
        id="bill_dash_02",
        reference="BILL-DASH-02",
        customer_id=cust.id,
        shop_id=shop.id,
        description="Oil Pumps",
        purchase_amount=Decimal("800.00"),
        initial_paid_amount=Decimal("0.00"),
        outstanding_amount=Decimal("800.00"),
        transaction_date=date.today() - timedelta(days=20),
        agreed_repayment_date=date.today() - timedelta(days=3),
        status="overdue",
    )
    db.add(b2)
    db.commit()

    resp = client.get(
        "/api/autopay/business/dashboard",
        params={"business_id": shop.id},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["shop_id"] == shop.id
    assert data["total_bills"] >= 2
    assert data["eligible_bills_count"] == 1
    assert data["active_mandates_count"] >= 1

    # Protected overdue should reflect bill 1 (₹1,200.00)
    assert data["total_protected_outstanding_inr"] == 1200.0
    # Unprotected overdue should reflect bill 2 (₹800.00)
    assert data["total_unprotected_outstanding_inr"] == 800.0

    items = data["bills"]
    item_map = {item["bill_id"]: item for item in items}
    assert item_map["bill_dash_01"]["autopay_status"] == "active"
    assert item_map["bill_dash_02"]["autopay_status"] == "none"


# =============================================================================
# 10. Reconciliation History API Query
# =============================================================================

def test_10_reconciliation_history_api(hardening_fixture):
    """10. GET /api/autopay/reconciliation/history returns recorded audit events."""
    client = hardening_fixture["client"]
    db = hardening_fixture["db"]
    shop = hardening_fixture["shop"]

    rec_log = AutopayReconciliationModel(
        reconciliation_run_id="rec_test_run_123",
        bill_id="bill_audit_01",
        business_id=shop.id,
        discrepancy_type="timeout_resolved",
        observed_discrepancy="Provider confirmed payment while internal state was pending.",
        provider_status="captured",
        internal_status="pending",
        resolution_action="ledger_credited",
        resolution_status="resolved",
        manual_review_required=False,
        amount_paise=100000,
        notes="Automated reconciliation resolved successfully.",
    )
    db.add(rec_log)
    db.commit()

    resp = client.get(
        "/api/autopay/reconciliation/history",
        params={"business_id": shop.id},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert len(data) >= 1
    record = data[0]
    assert record["reconciliation_run_id"] == "rec_test_run_123"
    assert record["discrepancy_type"] == "timeout_resolved"
    assert record["resolution_status"] == "resolved"
    assert record["amount_paise"] == 100000
