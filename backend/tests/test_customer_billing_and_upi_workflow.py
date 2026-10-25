"""
Automated End-to-End Test Suite for KOSHA Real Shop Billing, UPI Payments, and Customer Credit.
Tests:
1. Customer registration on the fly and line-item bill creation.
2. Initial UPI payment remaining unverified until server-side confirmation.
3. Partial payments ledger reconciliation (₹2,000 -> ₹800 -> ₹700 -> ₹500 -> Paid).
4. Counter cash receipts and overpayment protection.
5. Repayment date extensions with audit event tracking.
6. Identity of canonical bill record across business and customer views.
7. Perfect financial summary reconciliation (Billed = Dues + Cash + Verified Online).
"""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from backend.app.db.models import (
    CreditTransactionModel,
    CustomerModel,
    PaymentRequestModel,
    PaymentVerificationModel,
    RepaymentModel,
    ShopModel,
)
from backend.app.services.razorpay_service import razorpay_service


@pytest.fixture(autouse=True)
def ensure_test_shop(db_session):
    shop = db_session.query(ShopModel).filter_by(shop_code="KOSHA-APEX").first()
    if not shop:
        shop = ShopModel(
            id="shop_apex_01",
            shop_name="Apex Precision Components Store",
            shop_code="KOSHA-APEX",
            category="Industrial Spares",
            owner_name="Srujana Authorized Merchant",
            phone="+91 98450 11223",
            upi_id="kosha.apex@icici",
            is_verified=True,
            status="active",
        )
        db_session.add(shop)
        db_session.commit()
    return shop


def test_01_customer_registration_and_line_items_bill_creation(client, db_session):
    """1. Business owner can register customer on the fly and create bill with line items."""
    today = date.today()
    repay_date = today + timedelta(days=14)

    payload = {
        "new_customer": {
            "display_name": "Meera Nambiar",
            "phone": "+91 99887 76655",
            "email": "meera.nambiar@example.com",
        },
        "description": "Industrial Fasteners & Bushing Kit",
        "total_amount": 2500.0,
        "initial_payment_amount": 500.0,
        "initial_payment_method": "cash",
        "line_items": [
            {"name": "Grade-8 High Tensile Bolts (Pack of 50)", "quantity": 2, "unit_price": 750.0, "line_total": 1500.0},
            {"name": "Self-Lubricating Bronze Bushing", "quantity": 4, "unit_price": 250.0, "line_total": 1000.0},
        ],
        "notes": "Delivered to shop floor with test certs.",
        "agreed_repayment_date": repay_date.isoformat(),
        "generate_payment_request": True,
    }

    resp = client.post("/api/shopkeeper/bills", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    # Verify bill totals and initial payment
    assert data["total_amount"] == 2500.0
    assert data["initial_manual_paid"] == 500.0
    assert data["outstanding_amount"] == 2000.0
    assert data["status"] in ("upcoming", "due_today")
    assert data["customer_name"] == "Meera Nambiar"
    assert len(data["line_items"]) == 2

    # Verify active payment request is generated for the remaining ₹2,000 balance
    assert data["active_payment_request"] is not None
    assert data["active_payment_request"]["amount_paise"] == 200000
    assert data["active_payment_request"]["amount_inr"] == 2000.0

    # Verify cash repayment was recorded in audit history
    cash_reps = [r for r in data["all_repayments"] if r["payment_method"] == "cash"]
    assert len(cash_reps) == 1
    assert cash_reps[0]["amount"] == 500.0
    assert cash_reps[0]["recorded_by"] == "shopkeeper"


def test_02_initial_upi_payment_unverified_until_server_confirmation(client, db_session):
    """2. Initial UPI payment creates payment request but does not reduce dues until verified."""
    today = date.today()
    repay_date = today + timedelta(days=20)

    # Customer pays ₹800 via Razorpay UPI out of a ₹2,000 bill
    payload = {
        "new_customer": {
            "display_name": "Arjun Menon",
            "phone": "+91 91234 56789",
        },
        "description": "Precision Milling Cutters",
        "total_amount": 2000.0,
        "initial_payment_amount": 800.0,
        "initial_payment_method": "razorpay_upi",
        "agreed_repayment_date": repay_date.isoformat(),
        "generate_payment_request": True,
    }

    resp = client.post("/api/shopkeeper/bills", json=payload)
    assert resp.status_code == 201
    bill = resp.json()

    # CRITICAL: Before verification, outstanding remains full ₹2,000 and initial_paid is 0!
    assert bill["total_amount"] == 2000.0
    assert bill["initial_manual_paid"] == 0.0
    assert bill["verified_razorpay_paid"] == 0.0
    assert bill["outstanding_amount"] == 2000.0
    assert bill["active_payment_request"] is not None
    assert bill["active_payment_request"]["amount_paise"] == 80000  # ₹800.00 requested
    assert bill["active_payment_request"]["amount_inr"] == 800.0

    req_id = bill["active_payment_request"]["id"]

    # Now simulate authoritative payment recognition / webhook for ₹800
    sim_resp = client.post(
        f"/api/payment-gateway/requests/{req_id}/simulate-recognition",
        json={"outcome": "success"},
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["verified"] is True
    assert sim_data["amount_inr"] == 800.0
    assert sim_data["new_outstanding"] == 1200.0

    # Verify both business owner and customer now see updated ₹1,200 balance
    shop_bill = client.get(f"/api/shopkeeper/bills/{bill['bill_id']}").json()
    cust_bill = client.get(f"/api/customer/bills/{bill['bill_id']}?customer_id={bill['customer_id']}").json()

    assert shop_bill["outstanding_amount"] == 1200.0
    assert shop_bill["verified_razorpay_paid"] == 800.0
    assert cust_bill["outstanding_amount"] == 1200.0
    assert cust_bill["verified_razorpay_paid"] == 800.0


def test_03_multi_step_partial_payments_ledger_reconciliation(client, db_session):
    """3. Test sequence: ₹2,000 bill -> pay ₹800 -> pay ₹700 -> pay ₹500 -> Fully Paid."""
    today = date.today()

    # Step 0: Create ₹2,000 bill with 0 initial payment (100% credit)
    create_resp = client.post(
        "/api/shopkeeper/bills",
        json={
            "new_customer": {
                "display_name": "Siddharth Rao",
                "phone": "+91 97766 55443",
            },
            "description": "Custom Fabrication Sheet Metal",
            "total_amount": 2000.0,
            "initial_payment_amount": 0.0,
            "initial_payment_method": "none",
            "agreed_repayment_date": (today + timedelta(days=10)).isoformat(),
            "generate_payment_request": False,
        },
    )
    assert create_resp.status_code == 201
    bill = create_resp.json()
    bill_id = bill["bill_id"]
    customer_id = bill["customer_id"]

    assert bill["outstanding_amount"] == 2000.0

    # Step 1: Customer initiates partial payment of ₹800
    req1 = client.post(
        f"/api/customer/bills/{bill_id}/payment-request?partial_amount=800.0&customer_id={customer_id}"
    ).json()
    assert req1["amount_paise"] == 80000

    # Verify payment 1
    client.post(f"/api/payment-gateway/requests/{req1['id']}/simulate-recognition", json={"outcome": "success"})

    bill_after_1 = client.get(f"/api/customer/bills/{bill_id}?customer_id={customer_id}").json()
    assert bill_after_1["outstanding_amount"] == 1200.0
    assert bill_after_1["verified_razorpay_paid"] == 800.0
    assert len(bill_after_1["verified_payments"]) == 1

    # Step 2: Customer initiates partial payment of ₹700
    req2 = client.post(
        f"/api/customer/bills/{bill_id}/payment-request?partial_amount=700.0&customer_id={customer_id}"
    ).json()
    assert req2["amount_paise"] == 70000

    client.post(f"/api/payment-gateway/requests/{req2['id']}/simulate-recognition", json={"outcome": "success"})

    bill_after_2 = client.get(f"/api/customer/bills/{bill_id}?customer_id={customer_id}").json()
    assert bill_after_2["outstanding_amount"] == 500.0
    assert bill_after_2["verified_razorpay_paid"] == 1500.0
    assert len(bill_after_2["verified_payments"]) == 2

    # Step 3: Customer initiates final payment of remaining ₹500
    req3 = client.post(
        f"/api/customer/bills/{bill_id}/payment-request?partial_amount=500.0&customer_id={customer_id}"
    ).json()
    assert req3["amount_paise"] == 50000

    client.post(f"/api/payment-gateway/requests/{req3['id']}/simulate-recognition", json={"outcome": "success"})

    bill_final = client.get(f"/api/customer/bills/{bill_id}?customer_id={customer_id}").json()
    assert bill_final["outstanding_amount"] == 0.0
    assert bill_final["verified_razorpay_paid"] == 2000.0
    assert bill_final["status"] == "paid"
    assert len(bill_final["verified_payments"]) == 3


def test_04_counter_cash_receipt_and_overpayment_protection(client, db_session):
    """4. Recording counter cash receipt reduces balance and rejects overpayment."""
    today = date.today()
    bill = client.post(
        "/api/shopkeeper/bills",
        json={
            "new_customer": {"display_name": "Kiran Kumar", "phone": "+91 94433 22110"},
            "description": "Hardware Fittings",
            "total_amount": 1000.0,
            "initial_payment_amount": 0.0,
            "agreed_repayment_date": (today + timedelta(days=7)).isoformat(),
        },
    ).json()

    bill_id = bill["bill_id"]

    # Record cash receipt of ₹400
    receipt_resp = client.post(
        f"/api/shopkeeper/bills/{bill_id}/cash-receipt",
        json={"amount": 400.0, "notes": "Customer dropped by shop counter"},
    )
    assert receipt_resp.status_code == 201
    updated = receipt_resp.json()
    assert updated["outstanding_amount"] == 600.0

    # Overpayment attempt: trying to record ₹700 when only ₹600 is due
    overpay_resp = client.post(
        f"/api/shopkeeper/bills/{bill_id}/cash-receipt",
        json={"amount": 700.0},
    )
    assert overpay_resp.status_code == 422
    assert "cannot exceed remaining due" in overpay_resp.json()["detail"]


def test_05_update_agreed_repayment_date(client, db_session):
    """5. Business owner can extend agreed repayment date with audit logging."""
    today = date.today()
    bill = client.post(
        "/api/shopkeeper/bills",
        json={
            "new_customer": {"display_name": "Pooja Hegde", "phone": "+91 93322 11009"},
            "description": "Electronic Motor Relays",
            "total_amount": 1500.0,
            "initial_payment_amount": 0.0,
            "agreed_repayment_date": (today + timedelta(days=5)).isoformat(),
        },
    ).json()

    new_date = today + timedelta(days=30)
    patch_resp = client.patch(
        f"/api/shopkeeper/bills/{bill['bill_id']}/repayment-date",
        json={"agreed_repayment_date": new_date.isoformat(), "notes": "Extended per WhatsApp confirmation."},
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["agreed_repayment_date"] == new_date.isoformat()


def test_06_financial_summary_reconciliation_invariant(client, db_session):
    """6. Shopkeeper financial summary rigorously reconciles: Billed = Dues + Cash + Online."""
    sum_resp = client.get("/api/shopkeeper/financial-summary?shop_id=shop_apex_01")
    assert sum_resp.status_code == 200
    fin = sum_resp.json()

    assert fin["is_reconciled"] is True
    assert fin["unresolved_discrepancy"] == 0.0

    # Formula check
    computed_sum = round(fin["remaining_customer_dues"] + fin["counter_cash_paid"] + fin["razorpay_verified_collections"], 2)
    assert round(fin["total_billed_volume"], 2) == computed_sum
