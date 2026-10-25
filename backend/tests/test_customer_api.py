from datetime import date, timedelta
from decimal import Decimal
import pytest
from backend.app.core.errors import AppException, NotFoundException
from backend.app.schemas.customer import CreditTransactionCreate, RepaymentCreate
from backend.app.services.customer_service import customer_service


def test_customer_dashboard_seeded_and_derived_totals(db_session):
    """Verify customer dashboard initializes demo data and derives correct aggregates."""
    customer_service.ensure_demo_seeds(db_session)
    dash = customer_service.get_dashboard("cust_rahul_01", db_session)
    assert dash.customer.id == "cust_rahul_01"
    assert dash.customer.display_name == "Rahul Sharma"
    assert dash.total_outstanding > 0
    assert dash.shops_count >= 2
    # Verify calculated status message is friendly and nonjudgmental
    assert "₹" in dash.status_message or "caught up" in dash.status_message
    assert len(dash.upcoming_repayments) >= 1
    assert len(dash.recent_activity) >= 1


def test_create_credit_transaction_valid(db_session):
    """Verify recording a valid credit purchase with down-payment."""
    today = date.today()
    due_date = today + timedelta(days=10)

    data = CreditTransactionCreate(
        shop_code="KOSHA-LAKSHMI",
        description="Fresh Dairy & Groceries",
        purchase_amount=Decimal("1500.00"),
        amount_paid_now=Decimal("500.00"),
        agreed_repayment_date=due_date,
    )

    txn = customer_service.create_credit_transaction("cust_rahul_01", data, db_session)
    assert txn.purchase_amount == 1500.00
    assert txn.initial_paid_amount == 500.00
    assert txn.outstanding_amount == 1000.00  # 1500 - 500
    assert txn.status == "upcoming"
    assert txn.shop_code == "KOSHA-LAKSHMI"
    assert txn.reference.startswith("TXN-")


def test_create_credit_transaction_zero_remaining_is_paid(db_session):
    """Verify that a purchase paid in full at checkout is marked 'paid' without generating dues."""
    today = date.today()
    data = CreditTransactionCreate(
        shop_code="KOSHA-CITY",
        description="Electrical Wire Roll",
        purchase_amount=Decimal("800.00"),
        amount_paid_now=Decimal("800.00"),
        agreed_repayment_date=today + timedelta(days=7),
    )

    txn = customer_service.create_credit_transaction("cust_rahul_01", data, db_session)
    assert txn.purchase_amount == 800.00
    assert txn.outstanding_amount == 0.00
    assert txn.status == "paid"


def test_create_credit_transaction_invalid_shop_code(db_session):
    """Verify rejection when shop code does not resolve to a known participating shop."""
    today = date.today()
    data = CreditTransactionCreate(
        shop_code="NON_EXISTENT_SHOP_999",
        description="Test Item",
        purchase_amount=Decimal("500.00"),
        amount_paid_now=Decimal("0.00"),
        agreed_repayment_date=today + timedelta(days=5),
    )

    with pytest.raises(AppException) as exc:
        customer_service.create_credit_transaction("cust_rahul_01", data, db_session)
    assert exc.value.status_code == 404
    assert exc.value.code == "SHOP_NOT_FOUND"


def test_create_credit_transaction_paid_exceeds_purchase(db_session):
    """Verify validation error when initial paid amount exceeds total purchase value."""
    today = date.today()
    data = CreditTransactionCreate(
        shop_code="KOSHA-APEX",
        description="Industrial Bolts",
        purchase_amount=Decimal("500.00"),
        amount_paid_now=Decimal("600.00"),  # > 500
        agreed_repayment_date=today + timedelta(days=5),
    )

    with pytest.raises(AppException) as exc:
        customer_service.create_credit_transaction("cust_rahul_01", data, db_session)
    assert exc.value.status_code == 422
    assert exc.value.code == "PAID_EXCEEDS_PURCHASE"


def test_repayment_partial_and_full_lifecycle(db_session):
    """Verify partial repayment decreases outstanding balance and full repayment marks transaction paid."""
    today = date.today()
    data = CreditTransactionCreate(
        shop_code="KOSHA-APEX",
        description="Machined Flange Component",
        purchase_amount=Decimal("2000.00"),
        amount_paid_now=Decimal("0.00"),
        agreed_repayment_date=today + timedelta(days=8),
    )
    txn = customer_service.create_credit_transaction("cust_rahul_01", data, db_session)
    assert txn.outstanding_amount == 2000.00
    assert txn.status == "upcoming"

    # 1. Partial Repayment of 750
    rep_data1 = RepaymentCreate(amount=Decimal("750.00"), payment_method="demo_upi")
    updated1 = customer_service.record_repayment(txn.id, "cust_rahul_01", rep_data1, db_session)
    assert updated1.outstanding_amount == 1250.00  # 2000 - 750
    assert updated1.status == "upcoming"
    assert len(updated1.repayments) == 1

    # 2. Complete Remaining Repayment of 1250
    rep_data2 = RepaymentCreate(amount=Decimal("1250.00"), payment_method="demo_upi")
    updated2 = customer_service.record_repayment(txn.id, "cust_rahul_01", rep_data2, db_session)
    assert updated2.outstanding_amount == 0.00
    assert updated2.status == "paid"
    assert len(updated2.repayments) == 2

    # 3. Further repayment on paid transaction must be rejected
    rep_data3 = RepaymentCreate(amount=Decimal("100.00"), payment_method="demo_upi")
    with pytest.raises(AppException) as exc:
        customer_service.record_repayment(txn.id, "cust_rahul_01", rep_data3, db_session)
    assert exc.value.status_code == 400
    assert exc.value.code == "TRANSACTION_ALREADY_PAID"


def test_repayment_overpayment_rejected(db_session):
    """Verify that an overpayment beyond the outstanding balance is rejected."""
    today = date.today()
    data = CreditTransactionCreate(
        shop_code="KOSHA-CITY",
        description="Drill Bits",
        purchase_amount=Decimal("600.00"),
        amount_paid_now=Decimal("100.00"),
        agreed_repayment_date=today + timedelta(days=5),
    )
    txn = customer_service.create_credit_transaction("cust_rahul_01", data, db_session)
    assert txn.outstanding_amount == 500.00

    # Attempt to repay 550 when remaining is 500
    rep_data = RepaymentCreate(amount=Decimal("550.00"), payment_method="demo_upi")
    with pytest.raises(AppException) as exc:
        customer_service.record_repayment(txn.id, "cust_rahul_01", rep_data, db_session)
    assert exc.value.status_code == 422
    assert exc.value.code == "OVERPAYMENT_NOT_ALLOWED"


def test_customer_isolation_and_privacy(db_session):
    """Verify that a customer cannot view or repay another customer's transactions."""
    today = date.today()
    data = CreditTransactionCreate(
        shop_code="KOSHA-CITY",
        description="Private Tools",
        purchase_amount=Decimal("400.00"),
        amount_paid_now=Decimal("0.00"),
        agreed_repayment_date=today + timedelta(days=5),
    )
    txn = customer_service.create_credit_transaction("cust_rahul_01", data, db_session)

    # Different customer ID should get 404
    with pytest.raises(NotFoundException):
        customer_service.get_transaction(txn.id, "cust_other_user", db_session)

    with pytest.raises(NotFoundException):
        rep_data = RepaymentCreate(amount=Decimal("200.00"))
        customer_service.record_repayment(txn.id, "cust_other_user", rep_data, db_session)


def test_list_and_resolve_shops(db_session):
    """Verify shop listing and shop-code resolution."""
    shops = customer_service.list_shops(db_session)
    assert len(shops) >= 3

    shop = customer_service.get_shop_by_code("KOSHA-APEX", db_session)
    assert shop.shop_name == "Apex Precision Works"
    assert shop.is_verified is True

    with pytest.raises(NotFoundException):
        customer_service.get_shop_by_code("INVALID-CODE-XYZ", db_session)
