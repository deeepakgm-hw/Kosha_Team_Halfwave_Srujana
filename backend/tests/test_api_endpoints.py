import io
from decimal import Decimal


def test_business_and_account_api(client):
    """Test creating and listing businesses and bank accounts via REST API."""
    # 1. Create business
    biz_payload = {
        "id": "biz_api_test",
        "legal_name": "API Test Components Pvt Ltd",
        "trade_name": "API Test",
        "industry": "Manufacturing",
        "msme_category": "Small",
        "currency": "INR",
    }
    res = client.post("/api/businesses", json=biz_payload)
    assert res.status_code == 201
    biz_data = res.json()
    assert biz_data["id"] == "biz_api_test"
    assert biz_data["currency"] == "INR"
    assert biz_data["is_demo"] is False

    # 2. Add bank account
    acc_payload = {
        "bank_name": "Kotak Mahindra Bank",
        "account_number_mask": "...5521",
        "currency": "INR",
        "opening_balance": 150000.0,
        "opening_balance_date": "2026-10-01",
        "is_verified": True,
    }
    res_acc = client.post("/api/businesses/biz_api_test/accounts", json=acc_payload)
    assert res_acc.status_code == 201
    acc_data = res_acc.json()
    assert acc_data["opening_balance"] == 150000.0
    assert acc_data["is_verified"] is True

    # 3. Query state summary
    res_state = client.get("/api/businesses/biz_api_test/state")
    assert res_state.status_code == 200
    state_data = res_state.json()
    assert state_data["current_cash"] == 150000.0
    assert state_data["reconciliation_status"] == "verified"


def test_csv_upload_api_multipart(client):
    """Test importing bank statement CSV via HTTP multipart/form-data upload."""
    # Setup business
    client.post("/api/businesses", json={
        "id": "biz_upload_test",
        "legal_name": "Upload Test Corp",
        "trade_name": "Upload Corp",
        "industry": "Trading",
    })

    csv_data = (
        "Date,Description,Amount,Reference\n"
        "2026-10-05,Customer Receipt,80000.00,REF1\n"
        "2026-10-12,Vendor Payment,-30000.00,REF2\n"
    )
    files = {"file": ("statement.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    data = {"business_id": "biz_upload_test", "amount_sign_mode": "standard"}

    res = client.post("/api/statements/import-csv", data=data, files=files)
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["accepted_rows"] == 2
    assert res_json["rejected_rows"] == 0
    assert res_json["reconciliation"]["total_credits"] == 80000.0
    assert res_json["reconciliation"]["total_debits"] == 30000.0
    assert res_json["reconciliation"]["net_movement"] == 50000.0

    # Verify transactions listing endpoint
    res_txns = client.get("/api/transactions?business_id=biz_upload_test")
    assert res_txns.status_code == 200
    txns = res_txns.json()
    assert len(txns) == 2


def test_invoices_and_bills_api(client):
    """Test invoices and bills CRUD and payment recording via REST API."""
    client.post("/api/businesses", json={
        "id": "biz_bill_api",
        "legal_name": "Billing API Test",
        "trade_name": "BillTest",
        "industry": "Services",
    })

    # 1. Create Invoice
    inv_payload = {
        "invoice_number": "INV-API-001",
        "customer_name": "Anchor Client",
        "issue_date": "2026-10-01",
        "due_date": "2026-10-31",
        "amount": 75000.0,
    }
    res_inv = client.post("/api/invoices?business_id=biz_bill_api", json=inv_payload)
    assert res_inv.status_code == 201
    inv_data = res_inv.json()
    inv_id = inv_data["id"]
    assert inv_data["outstanding_amount"] == 75000.0
    assert inv_data["status"] == "unpaid"

    # 2. Record partial payment
    pay_res = client.post(f"/api/invoices/{inv_id}/payments", json={
        "amount": 25000.0,
        "payment_date": "2026-10-15",
        "reference": "CHQ-100",
    })
    assert pay_res.status_code == 201

    # Check updated invoice
    inv_updated = client.get(f"/api/invoices/{inv_id}").json()
    assert inv_updated["paid_amount"] == 25000.0
    assert inv_updated["outstanding_amount"] == 50000.0
    assert inv_updated["status"] == "partially_paid"

    # 3. Create Bill
    bill_payload = {
        "bill_number": "BILL-API-001",
        "vendor_name": "Key Supplier",
        "issue_date": "2026-10-05",
        "due_date": "2026-10-25",
        "category": "vendor",
        "amount": 40000.0,
    }
    res_bill = client.post("/api/bills?business_id=biz_bill_api", json=bill_payload)
    assert res_bill.status_code == 201
    bill_id = res_bill.json()["id"]

    # Record full payment
    bill_pay_res = client.post(f"/api/bills/{bill_id}/payments", json={
        "amount": 40000.0,
        "payment_date": "2026-10-20",
    })
    assert bill_pay_res.status_code == 201
    bill_updated = client.get(f"/api/bills/{bill_id}").json()
    assert bill_updated["status"] == "paid"
    assert bill_updated["outstanding_amount"] == 0.0
