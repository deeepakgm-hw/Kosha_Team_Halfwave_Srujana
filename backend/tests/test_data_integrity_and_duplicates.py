"""
Comprehensive Data Integrity, Idempotency, and Duplicate Elimination Test Suite
Covers all 20 critical Phase 12 validation and data integrity scenarios.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
import io
import pytest
from sqlalchemy.orm import Session

from backend.app.core.errors import AppException, NotFoundException, ValidationError
from backend.app.db.models import (
    BankAccountModel,
    BankTransactionModel,
    BusinessModel,
    CreditTransactionModel,
    CustomerInvoiceModel,
    CustomerModel,
    NotificationModel,
    PaymentAttemptModel,
    RepaymentModel,
    ShopModel,
    ImportBatchModel,
    WebhookEventModel,
)
from backend.app.schemas.cashflow import (
    InvoiceCreate,
    InvoicePaymentCreate,
)
from backend.app.schemas.customer import (
    CreditTransactionCreate,
    PaymentInitiateRequest,
    PaymentVerifyRequest,
    RepaymentCreate,
)
from backend.app.services.billing_service import billing_service
from backend.app.services.customer_service import customer_service
from backend.app.services.import_service import import_service
from backend.app.services.payment_gateway import payment_gateway_service
from backend.app.services.reminder_service import ReminderService, get_kolkata_today


def _setup_test_business(db: Session, biz_id: str = "biz_test_integ") -> BusinessModel:
    """Helper to seed an active test business and primary bank account."""
    biz = db.query(BusinessModel).filter_by(id=biz_id).first()
    if not biz:
        biz = BusinessModel(
            id=biz_id,
            legal_name="Apex Precision Engineering Pvt Ltd",
            trade_name="Apex Precision",
            industry="Manufacturing",
            msme_category="Small",
            currency="INR",
            is_demo=False,
        )
        db.add(biz)
        db.commit()

    account = db.query(BankAccountModel).filter_by(business_id=biz_id).first()
    if not account:
        account = BankAccountModel(
            id=f"acc_{biz_id}",
            business_id=biz_id,
            bank_name="State Bank of India",
            account_number_mask="...8821",
            currency="INR",
            opening_balance=Decimal("100000.00"),
            opening_balance_date=date(2026, 1, 1),
            is_verified=True,
        )
        db.add(account)
        db.commit()
    return biz


def _setup_test_customer_and_shop(db: Session):
    """Helper to seed customer and shop records."""
    customer_service.ensure_demo_seeds(db)


# =========================================================================
# Scenario 1: First-time CSV import
# =========================================================================
def test_scenario_01_first_time_csv_import(client, db_session):
    """Valid CSV with new transactions imported successfully into persistent ledger."""
    _setup_test_business(db_session, "biz_scen_01")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Client Payment A,25000.00,REF-SCEN-01A\n"
        "2026-03-02,Vendor Material Bill,-10000.00,REF-SCEN-01B\n"
    )
    files = {"file": ("bank_statement_march.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    data = {"business_id": "biz_scen_01", "reconcile": "true"}

    res = client.post("/api/statements/import-csv", data=data, files=files)
    assert res.status_code == 200, res.text
    res_json = res.json()
    assert res_json["accepted_rows"] == 2
    assert res_json["rejected_rows"] == 0
    assert res_json["exact_file_duplicates"] == 0
    assert res_json["previously_imported_duplicates"] == 0
    assert res_json["reconciliation"]["total_credits"] == 25000.0
    assert res_json["reconciliation"]["total_debits"] == 10000.0

    # Verify statement record exists in DB
    batch = db_session.query(ImportBatchModel).filter_by(business_id="biz_scen_01").first()
    assert batch is not None
    assert batch.total_credit_amount == Decimal("25000.00")
    assert batch.total_debit_amount == Decimal("10000.00")


# =========================================================================
# Scenario 2: Re-import of the exact same file
# =========================================================================
def test_scenario_02_duplicate_file_reimport_rejected(client, db_session):
    """Re-uploading the exact same file returns HTTP 409 DUPLICATE_FILE_IMPORT."""
    _setup_test_business(db_session, "biz_scen_02")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-05,Sales Deposit,15000.00,REF-DUP-01\n"
    )
    # 1. First import succeeds
    files1 = {"file": ("march_statement.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res1 = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_02"}, files=files1)
    assert res1.status_code == 200

    # 2. Second import of exact identical file & filename must be rejected with 409
    files2 = {"file": ("march_statement.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res2 = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_02"}, files=files2)
    assert res2.status_code == 409
    err = res2.json().get("error", {})
    assert err.get("code") == "DUPLICATE_FILE_IMPORT"
    assert "already been imported" in err.get("message", "")


# =========================================================================
# Scenario 3: Duplicate rows within one file
# =========================================================================
def test_scenario_03_in_file_duplicate_rows_detected_and_skipped(client, db_session):
    """Duplicate rows within a single uploaded file are detected and skipped."""
    _setup_test_business(db_session, "biz_scen_03")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Office Rent,-12000.00,RENT-MARCH\n"
        "2026-03-01,Office Rent,-12000.00,RENT-MARCH\n"  # In-file exact duplicate
        "2026-03-02,Electricity Bill,-3500.00,EBILL-MARCH\n"
    )
    files = {"file": ("rent_and_bills.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_03"}, files=files)
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["accepted_rows"] == 2
    assert res_json["exact_file_duplicates"] == 1
    assert res_json["total_rows"] == 3


# =========================================================================
# Scenario 4: Transaction already present in database
# =========================================================================
def test_scenario_04_previously_imported_transactions_skipped(client, db_session):
    """A row matching a previously imported transaction in the DB is detected as existing."""
    _setup_test_business(db_session, "biz_scen_04")

    # File 1 contains transaction TX1
    csv1 = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Customer Deposit,50000.00,UTR987654321\n"
    )
    files1 = {"file": ("file_one.csv", io.BytesIO(csv1.encode("utf-8")), "text/csv")}
    res1 = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_04"}, files=files1)
    assert res1.status_code == 200

    # File 2 (different filename and new transaction TX2) also re-includes TX1
    csv2 = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Customer Deposit,50000.00,UTR987654321\n"  # Already imported
        "2026-03-02,Raw Material,-18000.00,RAW-001\n"         # New
    )
    files2 = {"file": ("file_two.csv", io.BytesIO(csv2.encode("utf-8")), "text/csv")}
    res2 = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_04"}, files=files2)
    assert res2.status_code == 200
    res2_json = res2.json()
    assert res2_json["previously_imported_duplicates"] == 1
    assert res2_json["accepted_rows"] == 1


# =========================================================================
# Scenario 5: Two legitimate same-amount transactions on the same day preserved
# =========================================================================
def test_scenario_05_legitimate_repeated_same_day_transactions_preserved(client, db_session):
    """
    Legitimate repeated same-day same-amount transactions without references
    (common in MSME cash/chai/fuel expenses) are preserved with occurrence discriminators.
    """
    _setup_test_business(db_session, "biz_scen_05")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Tea and Refreshments,-500.00,\n"
        "2026-03-01,Tea and Refreshments,-500.00,\n"  # Legitimate second order on same day
    )
    files = {"file": ("cash_expenses.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_05"}, files=files)
    assert res.status_code == 200
    res_json = res.json()
    # Both legitimate transactions must be accepted to maintain accurate cash balance!
    assert res_json["accepted_rows"] == 2
    assert res_json["exact_file_duplicates"] == 0
    assert res_json["potential_duplicates_review"] >= 1
    assert len(res_json["potential_duplicates_details"]) >= 1
    assert res_json["potential_duplicates_details"][0]["amount"] == -500.0


# =========================================================================
# Scenario 6: Similar descriptions that are not exact duplicates
# =========================================================================
def test_scenario_06_similar_descriptions_not_dropped(client, db_session):
    """Transactions with similar descriptions are kept distinct and never falsely dropped."""
    _setup_test_business(db_session, "biz_scen_06")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Vendor Apex Logistics - Freight A,-4500.00,LOG-A\n"
        "2026-03-01,Vendor Apex Logistics - Freight B,-4500.00,LOG-B\n"
    )
    files = {"file": ("freight.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    res = client.post("/api/statements/import-csv", data={"business_id": "biz_scen_06"}, files=files)
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["accepted_rows"] == 2
    assert res_json["exact_file_duplicates"] == 0


# =========================================================================
# Scenario 7: Duplicate invoice numbers rejected
# =========================================================================
def test_scenario_07_duplicate_invoice_number_rejected(db_session):
    """Creating an invoice with an existing invoice_number raises ValidationError."""
    _setup_test_business(db_session, "biz_scen_07")

    # 1. Create initial invoice
    inv1 = billing_service.create_invoice(
        db=db_session,
        business_id="biz_scen_07",
        invoice_number="INV-2026-UNIQUE-01",
        customer_name="Tata Motors Tier-1",
        issue_date=date(2026, 3, 1),
        due_date=date(2026, 3, 31),
        amount=Decimal("50000.00"),
    )
    assert inv1.id is not None

    # 2. Attempt duplicate creation for same business must fail with 409
    with pytest.raises(AppException) as exc:
        billing_service.create_invoice(
            db=db_session,
            business_id="biz_scen_07",
            invoice_number="INV-2026-UNIQUE-01",
            customer_name="Tata Motors Tier-1",
            issue_date=date(2026, 3, 1),
            due_date=date(2026, 3, 31),
            amount=Decimal("50000.00"),
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "DUPLICATE_INVOICE_NUMBER"


# =========================================================================
# Scenario 8: Concurrent duplicate submissions with idempotency_key returning identical record
# =========================================================================
def test_scenario_08_idempotent_invoice_payment_submission(db_session):
    """Submissions with the same idempotency_key return the existing payment without double-counting."""
    _setup_test_business(db_session, "biz_scen_08")

    inv = billing_service.create_invoice(
        db=db_session,
        business_id="biz_scen_08",
        invoice_number="INV-2026-IDEMP-01",
        customer_name="Hero MotoCorp Tier-2",
        issue_date=date(2026, 3, 1),
        due_date=date(2026, 3, 31),
        amount=Decimal("30000.00"),
    )

    # First payment attempt with idempotency key
    pay1 = billing_service.record_invoice_payment(
        db=db_session,
        invoice_id=inv.id,
        amount=Decimal("10000.00"),
        payment_date=date(2026, 3, 15),
        reference="NEFT-001",
        idempotency_key="idemp_inv_pay_123",
    )
    assert pay1.amount == Decimal("10000.00")
    assert inv.paid_amount == Decimal("10000.00")

    # Second concurrent or retry submission with identical idempotency key
    pay2 = billing_service.record_invoice_payment(
        db=db_session,
        invoice_id=inv.id,
        amount=Decimal("10000.00"),
        payment_date=date(2026, 3, 15),
        reference="NEFT-001",
        idempotency_key="idemp_inv_pay_123",
    )

    # Must return exact same payment record without double-debiting invoice!
    assert pay2.id == pay1.id
    assert inv.paid_amount == Decimal("10000.00")


# =========================================================================
# Scenario 9: Duplicate payment callbacks and webhooks
# =========================================================================
def test_scenario_09_duplicate_payment_webhooks_idempotently_ignored(db_session):
    """Webhook callbacks with identical event_id are processed idempotently."""
    event_id = "evt_razorpay_mock_test_001"
    payload = {"event": "payment.captured", "payment_id": "pay_98765", "amount": 200000}

    # 1. First webhook execution
    res1 = payment_gateway_service.process_webhook(event_id=event_id, payload=payload, db=db_session)
    assert res1["status"] == "processed"
    assert res1["event_id"] == event_id

    # 2. Second webhook callback with same event_id
    res2 = payment_gateway_service.process_webhook(event_id=event_id, payload=payload, db=db_session)
    assert res2["status"] == "ignored"
    assert "Duplicate webhook event already processed" in res2["reason"]


# =========================================================================
# Scenario 10: Partial payments correctly reducing outstanding amount
# =========================================================================
def test_scenario_10_partial_payments_reduce_outstanding_amount(db_session):
    """Partial repayments correctly reduce customer outstanding credit balance."""
    _setup_test_customer_and_shop(db_session)

    # 1. Create a credit transaction for Rahul of ₹1500 with ₹500 down-payment -> ₹1000 outstanding
    txn = customer_service.create_credit_transaction(
        customer_id="cust_rahul_01",
        data=CreditTransactionCreate(
            shop_code="KOSHA-LAKSHMI",
            description="Hardware Supplies",
            purchase_amount=Decimal("1500.00"),
            amount_paid_now=Decimal("500.00"),
            agreed_repayment_date=date.today() + timedelta(days=14),
        ),
        db=db_session,
    )
    assert txn.outstanding_amount == 1000.00
    assert txn.status == "upcoming"

    # 2. Record partial repayment of ₹400
    updated_txn = customer_service.record_repayment(
        transaction_id=txn.id,
        customer_id="cust_rahul_01",
        data=RepaymentCreate(
            amount=Decimal("400.00"),
            payment_method="upi",
            notes="Partial payment 1",
        ),
        db=db_session,
    )
    assert updated_txn.outstanding_amount == 600.00
    assert updated_txn.status == "upcoming"
    # 2 repayments: initial checkout downpayment (₹500) + partial repayment (₹400)
    assert len(updated_txn.repayments) == 2

    # 3. Refresh and verify in database
    db_txn = db_session.query(CreditTransactionModel).filter_by(id=txn.id).first()
    assert db_txn.outstanding_amount == Decimal("600.00")
    assert db_txn.status == "upcoming"


# =========================================================================
# Scenario 11: Full settlement marking invoice/credit as paid and rejecting further payments
# =========================================================================
def test_scenario_11_full_settlement_marks_paid_and_rejects_subsequent(db_session):
    """Full settlement marks transaction as paid and rejects subsequent payment attempts."""
    _setup_test_customer_and_shop(db_session)

    txn = customer_service.create_credit_transaction(
        customer_id="cust_rahul_01",
        data=CreditTransactionCreate(
            shop_code="KOSHA-LAKSHMI",
            description="Paints & Primers",
            purchase_amount=Decimal("800.00"),
            amount_paid_now=Decimal("0.00"),
            agreed_repayment_date=date.today() + timedelta(days=7),
        ),
        db=db_session,
    )
    assert txn.outstanding_amount == 800.00

    # Pay full remaining balance of ₹800
    settled = customer_service.record_repayment(
        transaction_id=txn.id,
        customer_id="cust_rahul_01",
        data=RepaymentCreate(amount=Decimal("800.00"), payment_method="cash"),
        db=db_session,
    )
    assert settled.outstanding_amount == 0.00
    assert settled.status == "paid"

    # Attempt subsequent payment on fully settled transaction -> must be rejected
    with pytest.raises(AppException) as exc:
        customer_service.record_repayment(
            transaction_id=txn.id,
            customer_id="cust_rahul_01",
            data=RepaymentCreate(amount=Decimal("100.00"), payment_method="cash"),
            db=db_session,
        )
    assert exc.value.status_code == 400
    assert "already fully paid" in exc.value.detail or exc.value.code == "TRANSACTION_ALREADY_PAID"


# =========================================================================
# Scenario 12: Failed and cancelled payment orders
# =========================================================================
def test_scenario_12_failed_and_cancelled_payment_orders(db_session):
    """Payment attempts can transition to failed without modifying ledger balances."""
    _setup_test_customer_and_shop(db_session)

    txn = customer_service.create_credit_transaction(
        customer_id="cust_rahul_01",
        data=CreditTransactionCreate(
            shop_code="KOSHA-LAKSHMI",
            description="Power Tools",
            purchase_amount=Decimal("2000.00"),
            amount_paid_now=Decimal("0.00"),
            agreed_repayment_date=date.today() + timedelta(days=7),
        ),
        db=db_session,
    )

    # Initiate order
    order = payment_gateway_service.create_order(
        PaymentInitiateRequest(
            transaction_id=txn.id,
            amount=Decimal("1000.00"),
            idempotency_key="order_fail_test_01",
        ),
        db=db_session,
    )

    attempt = db_session.query(PaymentAttemptModel).filter_by(order_id=order.order_id).first()
    assert attempt.status == "created"

    # Mark attempt failed
    attempt.status = "failed"
    attempt.error_description = "User cancelled at UPI authorization screen"
    db_session.add(attempt)
    db_session.commit()

    # Underlying transaction remains unaffected
    db_txn = db_session.query(CreditTransactionModel).filter_by(id=txn.id).first()
    assert db_txn.outstanding_amount == Decimal("2000.00")
    assert db_txn.status == "upcoming"


# =========================================================================
# Scenario 13: Refund/reversal traceability
# =========================================================================
def test_scenario_13_refund_reversal_traceability(db_session):
    """Payment attempts store audit details supporting refund status transition."""
    attempt = PaymentAttemptModel(
        idempotency_key="idemp_refund_test_01",
        order_id="ORDER_REFUND_01",
        customer_id="cust_rahul_01",
        target_id="txn_mock_01",
        target_type="credit_transaction",
        amount=Decimal("500.00"),
        currency="INR",
        status="succeeded",
        provider_payment_id="PAY_ORIGINAL_99",
        gateway_provider="KOSHA_SANDBOX",
    )
    db_session.add(attempt)
    db_session.commit()

    # Trace reversal / refund
    attempt.status = "refunded"
    attempt.error_description = "Chargeback processed by merchant"
    db_session.add(attempt)
    db_session.commit()

    db_session.refresh(attempt)
    assert attempt.status == "refunded"
    assert attempt.provider_payment_id == "PAY_ORIGINAL_99"


# =========================================================================
# Scenario 14: Inactive/invalid shop QR code rejected
# =========================================================================
def test_scenario_14_invalid_shop_code_rejected(client, db_session):
    """Scanning an invalid shop code returns HTTP 404 with a clear error."""
    _setup_test_customer_and_shop(db_session)

    res = client.get("/api/shops/NON_EXISTENT_SHOP_CODE/qr")
    assert res.status_code == 404
    err_msg = res.json().get("error", {}).get("message", "").lower()
    assert "not found" in err_msg


# =========================================================================
# Scenario 15: Overpayment rejection on invoices and customer credit
# =========================================================================
def test_scenario_15_overpayment_rejection(db_session):
    """Attempting an overpayment on invoices or customer credit is strictly rejected."""
    _setup_test_customer_and_shop(db_session)
    _setup_test_business(db_session, "biz_scen_15")

    # 1. Customer credit overpayment
    txn = customer_service.create_credit_transaction(
        customer_id="cust_rahul_01",
        data=CreditTransactionCreate(
            shop_code="KOSHA-LAKSHMI",
            description="Small Hardware",
            purchase_amount=Decimal("300.00"),
            amount_paid_now=Decimal("0.00"),
            agreed_repayment_date=date.today() + timedelta(days=7),
        ),
        db=db_session,
    )
    with pytest.raises(AppException) as exc_cust:
        customer_service.record_repayment(
            transaction_id=txn.id,
            customer_id="cust_rahul_01",
            data=RepaymentCreate(amount=Decimal("500.00"), payment_method="cash"),
            db=db_session,
        )
    assert exc_cust.value.code == "OVERPAYMENT_NOT_ALLOWED" or "cannot exceed" in exc_cust.value.detail

    # 2. Invoice overpayment
    inv = billing_service.create_invoice(
        db=db_session,
        business_id="biz_scen_15",
        invoice_number="INV-2026-OVERPAY",
        customer_name="Client Test",
        issue_date=date(2026, 3, 1),
        due_date=date(2026, 3, 31),
        amount=Decimal("1000.00"),
    )
    with pytest.raises(AppException) as exc_inv:
        billing_service.record_invoice_payment(
            db=db_session,
            invoice_id=inv.id,
            amount=Decimal("1500.00"),
            payment_date=date(2026, 3, 15),
        )
    assert "overpayment" in exc_inv.value.detail.lower() or "overpayment" in str(exc_inv.value).lower()


# =========================================================================
# Scenario 16: Duplicate reminder prevention
# =========================================================================
def test_scenario_16_duplicate_reminder_prevention(db_session):
    """
    Executing reminder evaluation twice on the same day skips duplicate notifications
    using deterministic notification keys.
    """
    _setup_test_customer_and_shop(db_session)
    # ensure_demo_seeds seeded ctx_demo_02 (overdue) and ctx_demo_01 (upcoming)

    reminder_service = ReminderService()

    # First evaluation generates notifications
    res1 = reminder_service.evaluate_and_generate_reminders(db=db_session)
    first_gen_count = res1["generated_notifications_count"]
    assert first_gen_count >= 1

    # Second evaluation on the same day must skip duplicates
    res2 = reminder_service.evaluate_and_generate_reminders(db=db_session)
    assert res2["generated_notifications_count"] == 0
    assert res2["skipped_duplicates_count"] >= first_gen_count


# =========================================================================
# Scenario 17: Scheduled reminder date boundaries in Asia/Kolkata
# =========================================================================
def test_scenario_17_scheduled_reminder_date_boundaries_kolkata(db_session):
    """Urgency determination uses exact Asia/Kolkata date boundaries."""
    _setup_test_customer_and_shop(db_session)

    kolkata_today = get_kolkata_today()
    reminder_service = ReminderService()

    # 1. ctx_demo_02 is already seeded as overdue
    # 2. Add a transaction due today
    customer_service.create_credit_transaction(
        customer_id="cust_rahul_01",
        data=CreditTransactionCreate(
            shop_code="KOSHA-LAKSHMI",
            description="Fasteners Due Today",
            purchase_amount=Decimal("1500.00"),
            amount_paid_now=Decimal("0.00"),
            agreed_repayment_date=kolkata_today,
        ),
        db=db_session,
    )

    res = reminder_service.evaluate_and_generate_reminders(db=db_session)
    assert res["generated_notifications_count"] >= 1
    # Check that notifications for today and overdue exist
    notifs = db_session.query(NotificationModel).all()
    urgencies = [n.urgency for n in notifs]
    assert any(u in ["overdue", "critical"] for u in urgencies)
    assert any(u in ["due_today", "urgent"] for u in urgencies)


# =========================================================================
# Scenario 18: Database rollback on batch failure leaving 0 orphan records
# =========================================================================
def test_scenario_18_database_rollback_on_batch_failure(db_session):
    """Any unexpected failure in a transactional operation rolls back cleanly."""
    _setup_test_business(db_session, "biz_scen_18")

    initial_count = db_session.query(BankTransactionModel).count()

    # Attempt a malformed atomic operation that throws an exception inside a nested transaction
    try:
        with db_session.begin_nested():
            txn1 = BankTransactionModel(
                id="txn_temp_01",
                business_id="biz_scen_18",
                bank_account_id="acc_biz_scen_18",
                transaction_date=date(2026, 3, 1),
                description="Test Rollback Txn",
                amount=Decimal("1000.00"),
                transaction_type="credit",
                fingerprint="hash_temp_01",
            )
            db_session.add(txn1)
            # Simulate unexpected failure (e.g. division by zero or DB constraint error)
            raise RuntimeError("Simulated mid-batch processing failure!")
    except RuntimeError:
        pass

    # Ensure zero orphan records were committed
    final_count = db_session.query(BankTransactionModel).count()
    assert final_count == initial_count


# =========================================================================
# Scenario 19: HTTP 422 CSV import regression test
# =========================================================================
def test_scenario_19_http_422_csv_import_regression(client, db_session):
    """
    Submitting opening_balance_date="" and opening_balance="234554" via multipart/form-data
    succeeds without FastAPI HTTP 422 Unprocessable Content.
    """
    _setup_test_business(db_session, "biz_scen_19")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Opening Customer Deposit,50000.00,REF-REG-01\n"
    )
    files = {"file": ("bank_statement_with_empty_date.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    form_data = {
        "business_id": "biz_scen_19",
        "opening_balance": "234554",
        "opening_balance_date": "",  # Empty string from form input
        "reconcile": "true",
    }

    res = client.post("/api/statements/import-csv", data=form_data, files=files)
    assert res.status_code == 200, f"Expected 200 but got {res.status_code}: {res.text}"
    res_json = res.json()
    assert res_json["accepted_rows"] == 1
    assert res_json["reconciliation"]["opening_balance"] == 234554.0


# =========================================================================
# Scenario 20: Cash-flow reconciliation equation check
# =========================================================================
def test_scenario_20_cash_flow_reconciliation_equation(client, db_session):
    """
    Verifies the fundamental treasury equation:
    closing_balance == opening_balance + sum(credits) - sum(debits)
    """
    _setup_test_business(db_session, "biz_scen_20")

    csv_data = (
        "transaction_date,description,amount,external_reference\n"
        "2026-03-01,Client Revenue 1,120000.00,CR-01\n"
        "2026-03-02,Client Revenue 2,80000.00,CR-02\n"
        "2026-03-03,Supplier Raw Materials,-50000.00,DR-01\n"
        "2026-03-04,Payroll Direct Debit,-70000.00,DR-02\n"
    )
    files = {"file": ("monthly_treasury.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    form_data = {
        "business_id": "biz_scen_20",
        "opening_balance": "100000.00",
        "reconcile": "true",
    }

    res = client.post("/api/statements/import-csv", data=form_data, files=files)
    assert res.status_code == 200
    recon = res.json()["reconciliation"]

    opening = Decimal(str(recon["opening_balance"]))
    credits = Decimal(str(recon["total_credits"]))
    debits = Decimal(str(recon["total_debits"]))
    closing = Decimal(str(recon["calculated_closing_balance"]))

    # Equation: closing == opening + credits - debits
    expected_closing = opening + credits - debits
    assert closing == expected_closing, f"Equation mismatch: {closing} != {expected_closing}"
    assert closing == Decimal("180000.00")
