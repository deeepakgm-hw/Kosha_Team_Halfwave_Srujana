import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_get_shop_qr_code():
    """Verifies that shop QR endpoint generates non-sensitive SVG QR code."""
    res = client.get("/api/shops/KOSHA-APEX/qr")
    assert res.status_code == 200
    data = res.json()
    assert data["shop_code"] == "KOSHA-APEX"
    assert data["shop_name"] == "Apex Precision Works"
    assert data["qr_payload"] == "kosha://shop/KOSHA-APEX"
    assert "<svg" in data["qr_svg"]
    assert "instructions" in data
    # Security check: QR payload must not leak sensitive financial/personal data
    assert "password" not in data["qr_payload"]
    assert "balance" not in data["qr_payload"]


def test_get_shopkeeper_summary():
    """Verifies shopkeeper receivables summary KPIs calculated from authoritative records."""
    res = client.get("/api/shopkeeper/shop/summary?shop_id=shop_apex_01")
    assert res.status_code == 200
    data = res.json()
    assert data["shop"]["shop_code"] == "KOSHA-APEX"
    assert data["total_customer_receivables"] > 0
    assert data["customers_with_balance_count"] >= 1
    assert data["total_transactions_count"] >= 1
    assert "due_in_7_days" in data
    assert "overdue_receivables" in data
    assert "collected_today" in data


def test_shopkeeper_transaction_list_and_filters():
    """Verifies that shopkeeper transactions list supports status filters and search."""
    # List all
    res = client.get("/api/shopkeeper/shop/transactions?shop_id=shop_apex_01&status=all")
    assert res.status_code == 200
    all_txns = res.json()
    assert len(all_txns) >= 1

    # Filter overdue
    res_overdue = client.get("/api/shopkeeper/shop/transactions?shop_id=shop_apex_01&status=overdue")
    assert res_overdue.status_code == 200
    overdue_txns = res_overdue.json()
    for t in overdue_txns:
        assert t["status"] == "overdue"

    # Search filter
    first_ref = all_txns[0]["reference"]
    res_search = client.get(f"/api/shopkeeper/shop/transactions?shop_id=shop_apex_01&search={first_ref}")
    assert res_search.status_code == 200
    searched = res_search.json()
    assert len(searched) >= 1
    assert searched[0]["reference"] == first_ref


def test_shopkeeper_records_counter_payment():
    """
    Verifies that a shopkeeper can record a payment received directly from a customer,
    which updates the shared source of truth.
    """
    # 1. Fetch transactions for Apex shop to find an outstanding one
    res = client.get("/api/shopkeeper/shop/transactions?shop_id=shop_apex_01&status=overdue")
    assert res.status_code == 200
    overdue_txns = res.json()
    assert len(overdue_txns) > 0
    target_txn = overdue_txns[0]
    initial_outstanding = target_txn["outstanding_amount"]
    assert initial_outstanding > 0

    # 2. Record a partial repayment by shopkeeper
    repay_amount = 100.0
    payload = {
        "amount": repay_amount,
        "payment_method": "shopkeeper_cash",
        "notes": "Handed cash at workshop counter",
    }
    repay_res = client.post(
        f"/api/shopkeeper/transactions/{target_txn['id']}/repayments?shop_id=shop_apex_01",
        json=payload,
    )
    assert repay_res.status_code == 201
    updated = repay_res.json()
    expected_remaining = round(initial_outstanding - repay_amount, 2)
    assert updated["outstanding_amount"] == expected_remaining

    # 3. Verify customer also sees the updated balance on customer dues endpoint
    cust_res = client.get(
        f"/api/customer/transactions/{target_txn['id']}?customer_id={target_txn['customer_id']}"
    )
    assert cust_res.status_code == 200
    cust_txn = cust_res.json()
    assert cust_txn["outstanding_amount"] == expected_remaining
    # Verify repayment history includes shopkeeper payment
    assert any(
        r["payment_method"] == "shopkeeper_cash" and r["amount"] == repay_amount
        for r in cust_txn["repayments"]
    )


def test_shopkeeper_cannot_modify_other_shop_transaction():
    """Verifies that Shop A cannot record repayment on Shop B's transaction."""
    # Find a transaction belonging to City Hardware (shop_city_03)
    res = client.get("/api/shopkeeper/shop/transactions?shop_id=shop_city_03")
    assert res.status_code == 200
    city_txns = res.json()
    assert len(city_txns) > 0
    city_txn = city_txns[0]

    # Try to modify it as Apex Precision (shop_apex_01)
    hack_res = client.post(
        f"/api/shopkeeper/transactions/{city_txn['id']}/repayments?shop_id=shop_apex_01",
        json={"amount": 50.0, "payment_method": "shopkeeper_cash"},
    )
    assert hack_res.status_code in (404, 403, 400)


def test_shopkeeper_overpayment_rejected():
    """Verifies that shopkeeper overpayments are rejected with 422."""
    res = client.get("/api/shopkeeper/shop/transactions?shop_id=shop_apex_01&status=due_today")
    assert res.status_code == 200
    txns = res.json()
    if not txns:
        res = client.get("/api/shopkeeper/shop/transactions?shop_id=shop_apex_01")
        txns = [t for t in res.json() if t["outstanding_amount"] > 0]

    target = txns[0]
    huge_amount = target["outstanding_amount"] + 5000.0

    bad_res = client.post(
        f"/api/shopkeeper/transactions/{target['id']}/repayments?shop_id=shop_apex_01",
        json={"amount": huge_amount, "payment_method": "shopkeeper_cash"},
    )
    assert bad_res.status_code == 422
    err_body = bad_res.json()
    err_msg = (err_body.get("error", {}).get("message") or err_body.get("detail", "")).lower()
    assert "exceeds" in err_msg


def test_customer_reminders_endpoint():
    """Verifies that customer reminders are returned sorted by urgency."""
    res = client.get("/api/customer/reminders?customer_id=cust_rahul_01")
    assert res.status_code == 200
    reminders = res.json()
    assert isinstance(reminders, list)
    for r in reminders:
        assert "transaction_id" in r
        assert "shop_name" in r
        assert "amount" in r
        assert "due_date" in r
        assert "days_diff" in r
        assert r["urgency"] in ("overdue", "due_today", "approaching", "upcoming", "completed")


def test_payment_gateway_boundary():
    """Verifies payment gateway status and sandbox initiation."""
    status_res = client.get("/api/payment-gateway/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_sandbox"] is True
    assert "demo_upi" in status_data["supported_methods"]

    # Initiate order
    order_res = client.post(
        "/api/payment-gateway/initiate",
        json={"transaction_id": "ctx_demo_01", "amount": 250.0, "payment_method": "demo_upi"},
    )
    assert order_res.status_code == 200
    order_data = order_res.json()
    assert order_data["order_id"].startswith("ORDER_SANDBOX_")
    assert order_data["is_sandbox"] is True
