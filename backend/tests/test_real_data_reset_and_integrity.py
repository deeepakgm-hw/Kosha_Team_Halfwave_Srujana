"""
Unit and integration tests verifying real-data reset, zero-demo seeding,
authoritative financial invariants, and precision balance reconciliation.
"""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ActivityEventModel,
    CreditTransactionModel,
    CustomerModel,
    PaymentRequestModel,
    PaymentVerificationModel,
    RepaymentModel,
    ShopModel,
)
from backend.app.schemas.customer import CreditTransactionCreate, ShopkeeperBillCreate, ShopkeeperRepaymentCreate
from backend.app.services.customer_service import customer_service
from backend.app.services.razorpay_service import razorpay_service


def test_zero_seed_state(db_session: Session):
    """Verifies that system initialization does not create any financial transactions."""
    customer_service.ensure_system_metadata(db_session)

    # Master entities exist
    assert db_session.query(ShopModel).count() >= 3
    assert db_session.query(CustomerModel).count() >= 3

    # Financial ledgers are completely empty
    assert db_session.query(CreditTransactionModel).count() == 0
    assert db_session.query(RepaymentModel).count() == 0
    assert db_session.query(ActivityEventModel).count() == 0
    assert db_session.query(PaymentRequestModel).count() == 0
    assert db_session.query(PaymentVerificationModel).count() == 0


def test_financial_summary_on_clean_zero_database(db_session: Session):
    """Verifies that an empty database produces genuine ₹0.00 metrics and is 100% reconciled."""
    customer_service.ensure_system_metadata(db_session)
    summary = customer_service.get_financial_summary("shop_apex_01", db_session)

    assert summary.total_billed_volume == 0.0
    assert summary.counter_cash_paid == 0.0
    assert summary.razorpay_verified_collections == 0.0
    assert summary.total_collected == 0.0
    assert summary.remaining_customer_dues == 0.0
    assert summary.active_bills_count == 0
    assert summary.settled_bills_count == 0
    assert summary.total_bills_count == 0
    assert summary.unresolved_discrepancy == 0.0
    assert summary.is_reconciled is True


def test_no_silent_reseeding_on_repeated_api_queries(client, db_session: Session):
    """Verifies that repeatedly accessing customer and shopkeeper endpoints never re-seeds demo data."""
    customer_service.ensure_system_metadata(db_session)

    # Call customer dashboard
    r1 = client.get("/api/customer/dashboard?customer_id=cust_rahul_01")
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["total_outstanding"] == 0.0
    assert len(data1["upcoming_repayments"]) == 0

    # Call shopkeeper bills
    r2 = client.get("/api/shopkeeper/bills?shop_id=shop_apex_01")
    assert r2.status_code == 200
    assert len(r2.json()) == 0

    # Call shopkeeper financial summary
    r3 = client.get("/api/shopkeeper/financial-summary?shop_id=shop_apex_01")
    assert r3.status_code == 200
    assert r3.json()["total_billed_volume"] == 0.0

    # Ensure transaction count remains strictly 0
    assert db_session.query(CreditTransactionModel).count() == 0


def test_strict_financial_invariant_lifecycle(db_session: Session):
    """
    Verifies that the financial invariant holds throughout the lifecycle:
    Total Billed Volume == Remaining Customer Dues + Counter Cash Paid + Razorpay Verified Collections
    """
    customer_service.ensure_system_metadata(db_session)

    # 1. Create a bill: Total ₹2,500.00, Downpayment ₹500.00
    txn = customer_service.create_credit_transaction(
        customer_id="cust_rahul_01",
        data=CreditTransactionCreate(
            shop_code="KOSHA-APEX",
            description="Precision CNC Milling Cutters",
            purchase_amount=Decimal("2500.00"),
            amount_paid_now=Decimal("500.00"),
            agreed_repayment_date=date.today() + timedelta(days=14),
        ),
        db=db_session,
    )
    assert txn.purchase_amount == 2500.0
    assert txn.initial_paid_amount == 500.0
    assert txn.outstanding_amount == 2000.0

    sum1 = customer_service.get_financial_summary("shop_apex_01", db_session)
    assert sum1.total_billed_volume == 2500.0
    assert sum1.counter_cash_paid == 500.0
    assert sum1.remaining_customer_dues == 2000.0
    assert sum1.razorpay_verified_collections == 0.0
    assert sum1.unresolved_discrepancy == 0.0
    assert sum1.is_reconciled is True
    assert sum1.active_bills_count == 1
    assert sum1.settled_bills_count == 0

    # 2. Counter cash repayment: ₹800.00
    customer_service.record_shopkeeper_repayment(
        transaction_id=txn.id,
        shop_id_or_code="shop_apex_01",
        data=ShopkeeperRepaymentCreate(
            amount=Decimal("800.00"),
            payment_method="shopkeeper_cash",
            notes="Counter cash installment",
        ),
        db=db_session,
    )

    sum2 = customer_service.get_financial_summary("shop_apex_01", db_session)
    assert sum2.total_billed_volume == 2500.0
    assert sum2.counter_cash_paid == 1300.0  # 500 + 800
    assert sum2.remaining_customer_dues == 1200.0  # 2000 - 800
    assert sum2.razorpay_verified_collections == 0.0
    assert sum2.unresolved_discrepancy == 0.0
    assert sum2.is_reconciled is True

    # 3. Razorpay payment verification: remaining ₹1,200.00 (120,000 paise)
    pay_req = razorpay_service.create_payment_request(
        bill_id=txn.id,
        amount_paise=120000,
        customer_id="cust_rahul_01",
        business_id="shop_apex_01",
        db=db_session,
    )

    ver = razorpay_service.verify_server_payment(
        bill_id=txn.id,
        razorpay_payment_id="pay_test_inv_001",
        customer_id="cust_rahul_01",
        db=db_session,
    )
    assert ver.amount_paise == 120000

    sum3 = customer_service.get_financial_summary("shop_apex_01", db_session)
    assert sum3.total_billed_volume == 2500.0
    assert sum3.counter_cash_paid == 1300.0
    assert sum3.razorpay_verified_collections == 1200.0
    assert sum3.total_collected == 2500.0
    assert sum3.remaining_customer_dues == 0.0
    assert sum3.unresolved_discrepancy == 0.0
    assert sum3.is_reconciled is True
    assert sum3.active_bills_count == 0
    assert sum3.settled_bills_count == 1
    assert sum3.settlement_rate_percentage == 100.0
