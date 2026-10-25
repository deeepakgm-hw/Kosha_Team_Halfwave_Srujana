"""
Tests for DeduplicationService, Database Cleanup, and Real-Time SSE Broadcaster.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from sqlalchemy.orm import Session

from backend.app.core.events import event_broadcaster
from backend.app.db.models import (
    ActivityEventModel,
    BankAccountModel,
    BankTransactionModel,
    BusinessModel,
    CreditTransactionModel,
    CustomerModel,
    PaymentRequestModel,
    RepaymentModel,
    ShopModel,
)
from backend.app.services.customer_service import customer_service
from backend.app.services.deduplication_service import deduplication_service


def test_dry_run_leaves_database_unmodified(db_session: Session):
    """Verifies that dry-run mode identifies duplicates but leaves the database unchanged."""
    customer_service.ensure_demo_seeds(db_session)

    # Insert canonical and duplicate businesses
    canonical_biz = BusinessModel(
        id="apex_precision_mfg",
        legal_name="Apex Precision Components Pvt Ltd",
        trade_name="Apex Precision Components",
        industry="Manufacturing",
        is_demo=True,
    )
    dup_biz = BusinessModel(
        id="apex-precision",
        legal_name="Apex Precision Components Pvt Ltd",
        trade_name="Apex Precision Components",
        industry="Manufacturing",
        is_demo=True,
    )
    db_session.add(canonical_biz)
    db_session.add(dup_biz)
    db_session.commit()

    count_before = db_session.query(BusinessModel).count()
    report = deduplication_service.execute_cleanup(db_session, dry_run=True)

    assert report.dry_run is True
    assert len(report.businesses_merged) >= 1
    # Check that database row was NOT deleted in dry-run mode
    count_after = db_session.query(BusinessModel).count()
    assert count_after == count_before


def test_apply_deduplicates_duplicate_business_and_repoints_fk(db_session: Session):
    """Verifies that apply mode merges duplicate businesses and re-points dependent rows."""
    customer_service.ensure_demo_seeds(db_session)

    canonical_id = "apex_precision_mfg"
    dup_id = "apex-precision"

    # Ensure canonical exists
    canonical = db_session.query(BusinessModel).filter_by(id=canonical_id).first()
    if not canonical:
        canonical = BusinessModel(
            id=canonical_id,
            legal_name="Apex Precision Components Pvt Ltd",
            trade_name="Apex Precision Components",
            industry="Manufacturing",
            is_demo=True,
        )
        db_session.add(canonical)
        db_session.commit()

    # Ensure duplicate exists with a dependent bank account
    dup = db_session.query(BusinessModel).filter_by(id=dup_id).first()
    if not dup:
        dup = BusinessModel(
            id=dup_id,
            legal_name="Apex Precision Components Pvt Ltd",
            trade_name="Apex Precision Components",
            industry="Manufacturing",
            is_demo=True,
        )
        db_session.add(dup)
        db_session.commit()

    dup_acc = BankAccountModel(
        id=f"acc_dup_{uuid.uuid4().hex[:6]}",
        business_id=dup_id,
        bank_name="Test Bank",
        account_number_mask="...1234",
        opening_balance=Decimal("1000.00"),
        opening_balance_date=date(2026, 1, 1),
    )
    db_session.add(dup_acc)
    db_session.commit()

    report = deduplication_service.execute_cleanup(db_session, dry_run=False)

    assert report.dry_run is False
    # Check duplicate business is deleted
    assert db_session.query(BusinessModel).filter_by(id=dup_id).first() is None
    # Check dependent bank account was re-pointed to canonical business
    db_session.refresh(dup_acc)
    assert dup_acc.business_id == canonical_id


def test_apply_deduplicates_rapid_duplicate_bills(db_session: Session):
    """Verifies that accidental repeated bill creations within a 2-hour window are merged."""
    customer_service.ensure_demo_seeds(db_session)
    now = datetime.now(timezone.utc)
    today = now.date()

    # Create canonical bill
    canonical_bill = CreditTransactionModel(
        id=f"bill_canon_{uuid.uuid4().hex[:6]}",
        reference="TXN-CANON-01",
        customer_id="cust_rahul_01",
        shop_id="shop_apex_01",
        description="Duplicate Test Item",
        purchase_amount=Decimal("2500.00"),
        initial_paid_amount=Decimal("500.00"),
        outstanding_amount=Decimal("2000.00"),
        transaction_date=today,
        agreed_repayment_date=today + timedelta(days=14),
        status="upcoming",
        created_at=now - timedelta(minutes=5),
    )
    db_session.add(canonical_bill)

    # Create identical accidental duplicate bill 2 minutes later
    dup_bill = CreditTransactionModel(
        id=f"bill_dup_{uuid.uuid4().hex[:6]}",
        reference="TXN-DUP-01",
        customer_id="cust_rahul_01",
        shop_id="shop_apex_01",
        description="Duplicate Test Item",
        purchase_amount=Decimal("2500.00"),
        initial_paid_amount=Decimal("500.00"),
        outstanding_amount=Decimal("2000.00"),
        transaction_date=today,
        agreed_repayment_date=today + timedelta(days=14),
        status="upcoming",
        created_at=now - timedelta(minutes=3),
    )
    db_session.add(dup_bill)
    db_session.commit()

    # Add a repayment to the duplicate bill
    dup_rep = RepaymentModel(
        id=f"rep_on_dup_{uuid.uuid4().hex[:6]}",
        transaction_id=dup_bill.id,
        amount=Decimal("300.00"),
        repayment_date=today,
        payment_method="shopkeeper_cash",
        payment_status="completed",
    )
    db_session.add(dup_rep)
    db_session.commit()

    report = deduplication_service.execute_cleanup(db_session, dry_run=False)

    # Duplicate bill should be deleted
    assert db_session.query(CreditTransactionModel).filter_by(id=dup_bill.id).first() is None
    # Repayment should be migrated to canonical bill
    db_session.refresh(dup_rep)
    assert dup_rep.transaction_id == canonical_bill.id


def test_financial_balance_reconciliation_precision(db_session: Session):
    """Verifies that balance reconciliation correctly enforces integer paise invariants."""
    today = date.today()
    bill = CreditTransactionModel(
        id=f"bill_recon_{uuid.uuid4().hex[:6]}",
        reference="TXN-RECON-01",
        customer_id="cust_rahul_01",
        shop_id="shop_apex_01",
        description="Precision Testing",
        purchase_amount=Decimal("1999.99"),
        initial_paid_amount=Decimal("499.99"),
        outstanding_amount=Decimal("1500.00"),  # Correctly: 1999.99 - 499.99 = 1500.00
        transaction_date=today - timedelta(days=5),
        agreed_repayment_date=today - timedelta(days=1),  # Overdue
        status="upcoming",  # Intentionally wrong status to test sync
    )
    db_session.add(bill)
    db_session.commit()

    # Add a partial payment of ₹500.00
    rep = RepaymentModel(
        id=f"rep_recon_{uuid.uuid4().hex[:6]}",
        transaction_id=bill.id,
        amount=Decimal("500.00"),
        repayment_date=today,
        payment_method="razorpay_upi",
        payment_status="completed",
    )
    db_session.add(rep)
    db_session.commit()

    # Run balance reconciliation
    report = deduplication_service.execute_cleanup(db_session, dry_run=False)

    db_session.refresh(bill)
    # Expected: 1999.99 - 499.99 - 500.00 = 1000.00
    assert bill.outstanding_amount == Decimal("1000.00")
    # Date was in the past, so status must synchronize to 'overdue'
    assert bill.status == "overdue"


def test_real_time_sse_event_broadcast():
    """Verifies that the EventBroadcaster publishes messages to connected queues without error."""
    test_event_type = "test_broadcast_event"
    test_payload = {"bill_id": "test_123", "amount": 500.0}

    # Should publish cleanly without raising exceptions even with 0 subscribers
    event_broadcaster.publish(test_event_type, test_payload)
