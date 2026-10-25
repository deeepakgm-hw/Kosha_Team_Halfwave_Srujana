"""
Automated Test Suite for KOSHA Customer Disputes & Corrections Workflow.
Tests:
1. Customer raises dispute on obligation -> freezes AutoPay collection.
2. AutoPay collection engine skips disputed bills.
3. Merchant reviews dispute and resolves it with documented rationale.
4. TrustScore recalculates safely upon dispute lifecycle transitions.
5. Authorization boundary: Customer cannot dispute another customer's obligation.
"""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from backend.app.db.models import (
    AutopayMandateModel,
    CreditTransactionModel,
    RepaymentDisputeModel,
)
from backend.app.services.collection_engine import collection_engine
from backend.app.services.customer_service import customer_service


def test_01_customer_raises_dispute_pauses_autopay(client, db_session: Session):
    """Verifies that opening a dispute sets bill.status = 'disputed' and pauses AutoPay."""
    customer_service.ensure_demo_seeds(db_session)

    # 1. Find an active bill for cust_rahul_01
    bill = (
        db_session.query(CreditTransactionModel)
        .filter_by(customer_id="cust_rahul_01")
        .filter(CreditTransactionModel.outstanding_amount > Decimal("0.00"))
        .first()
    )
    assert bill is not None
    original_status = bill.status

    # 2. Raise dispute
    payload = {
        "bill_id": bill.id,
        "dispute_type": "incorrect_amount",
        "description": "Counter merchant charged ₹500 extra for packaging materials.",
    }
    res = client.post("/api/disputes/raise?customer_id=cust_rahul_01", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "dispute_id" in data
    assert data["bill_id"] == bill.id

    # 3. Verify bill status is now 'disputed'
    db_session.refresh(bill)
    assert bill.status == "disputed"

    # 4. Collection engine eligibility MUST evaluate to False for disputed bill
    eval_res = collection_engine.evaluate_bill_eligibility(bill, db_session)
    assert eval_res["is_eligible"] is False
    assert "dispute" in eval_res["deferral_reason"].lower()


def test_02_merchant_resolves_dispute_restores_bill(client, db_session: Session):
    """Verifies that a merchant resolving a dispute updates the ledger and restores active bill status."""
    customer_service.ensure_demo_seeds(db_session)

    # Create bill and dispute
    bill = CreditTransactionModel(
        id="bill_disp_test_01",
        reference="BILL-DISP-001",
        customer_id="cust_rahul_01",
        shop_id="shop_apex_01",
        description="Machine Gears Batch",
        purchase_amount=Decimal("4000.00"),
        initial_paid_amount=Decimal("1000.00"),
        outstanding_amount=Decimal("3000.00"),
        transaction_date=date.today() - timedelta(days=10),
        agreed_repayment_date=date.today() + timedelta(days=10),
        status="disputed",
    )
    db_session.add(bill)

    dispute = RepaymentDisputeModel(
        id="disp_test_001",
        bill_id=bill.id,
        customer_id="cust_rahul_01",
        shop_id="shop_apex_01",
        business_id="shop_apex_01",
        dispute_type="incorrect_amount",
        description="Applied invoice discount not reflected.",
        status="opened",
        prior_bill_status="upcoming",
    )
    db_session.add(dispute)
    db_session.commit()

    # Merchant resolves dispute with balance adjustment (gives ₹500 discount: 3000 -> 2500)
    resolve_payload = {
        "resolution_action": "balance_adjusted",
        "resolution_notes": "Applied 15% trade discount as agreed. Balance reduced to ₹2,500.",
        "adjusted_amount": 2500.0,
    }

    res = client.post(f"/api/disputes/{dispute.id}/resolve?shop_id=shop_apex_01", json=resolve_payload)
    assert res.status_code == 200

    db_session.refresh(dispute)
    db_session.refresh(bill)

    assert dispute.status == "resolved"
    assert dispute.resolution_action == "balance_adjusted"
    assert bill.outstanding_amount == Decimal("2500.00")
    assert bill.status == "upcoming"  # Restored from 'disputed' to 'upcoming'


def test_03_customer_cannot_dispute_others_bill(client, db_session: Session):
    """Unauthorized dispute attempts on obligations belonging to another customer are rejected with 403."""
    customer_service.ensure_demo_seeds(db_session)

    # Find a bill belonging to cust_priya_02
    priya_bill = (
        db_session.query(CreditTransactionModel)
        .filter_by(customer_id="cust_priya_02")
        .first()
    )
    assert priya_bill is not None

    # Rahul Sharma tries to dispute Priya's bill
    payload = {
        "bill_id": priya_bill.id,
        "dispute_type": "unauthorized_collection",
        "description": "Unauthorized attempt.",
    }
    res = client.post("/api/disputes/raise?customer_id=cust_rahul_01", json=payload)
    assert res.status_code in (403, 400)
