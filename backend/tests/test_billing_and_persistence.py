from datetime import date, timedelta
from decimal import Decimal
import pytest
from backend.app.core.errors import AppException, ValidationError
from backend.app.db.models import (
    BankAccountModel,
    BankTransactionModel,
    BusinessModel,
    CustomerInvoiceModel,
    VendorBillModel,
)
from backend.app.schemas.cashflow import ForecastRequest
from backend.app.services.billing_service import billing_service
from backend.app.services.cashflow_service import cashflow_service


def test_invoice_lifecycle_and_overpayment_rejection(db_session):
    """
    Test customer invoice creation, partial payment, full payment,
    and strict rejection of overpayments.
    """
    biz = BusinessModel(id="biz_inv_1", legal_name="Precision Engineering Ltd", trade_name="Precision", industry="Auto")
    db_session.add(biz)
    db_session.commit()

    # 1. Create invoice for ₹1,00,000
    inv = billing_service.create_invoice(
        db=db_session,
        business_id="biz_inv_1",
        invoice_number="INV-2026-001",
        customer_name="Tata Motors Tier-1",
        issue_date=date(2026, 10, 1),
        due_date=date(2026, 10, 31),
        amount=Decimal("100000.00"),
    )
    assert inv.status == "unpaid"
    assert inv.paid_amount == Decimal("0.00")
    assert (inv.amount - inv.paid_amount) == Decimal("100000.00")

    # 2. Record partial payment of ₹40,000
    pay1 = billing_service.record_invoice_payment(
        db=db_session,
        invoice_id=inv.id,
        amount=Decimal("40000.00"),
        payment_date=date(2026, 10, 15),
        reference="NEFT-PART-1",
    )
    assert pay1.amount == Decimal("40000.00")
    assert inv.paid_amount == Decimal("40000.00")
    assert inv.status == "partially_paid"
    assert (inv.amount - inv.paid_amount) == Decimal("60000.00")

    # 3. Attempt overpayment of ₹70,000 (only 60,000 outstanding) -> must reject with ValidationError
    with pytest.raises(ValidationError) as exc:
        billing_service.record_invoice_payment(
            db=db_session,
            invoice_id=inv.id,
            amount=Decimal("70000.00"),
            payment_date=date(2026, 10, 20),
        )
    assert "Overpayment rejected" in str(exc.value)

    # 4. Settle remaining ₹60,000
    pay2 = billing_service.record_invoice_payment(
        db=db_session,
        invoice_id=inv.id,
        amount=Decimal("60000.00"),
        payment_date=date(2026, 10, 25),
        reference="NEFT-FINAL",
    )
    assert inv.paid_amount == Decimal("100000.00")
    assert inv.status == "paid"

    # 5. Attempt payment on already fully paid invoice -> must reject
    with pytest.raises(ValidationError):
        billing_service.record_invoice_payment(
            db=db_session,
            invoice_id=inv.id,
            amount=Decimal("1000.00"),
            payment_date=date(2026, 10, 26),
        )


def test_vendor_bill_lifecycle_and_overpayment_rejection(db_session):
    """
    Test vendor bill creation, partial payment, and overpayment rejection.
    """
    biz = BusinessModel(id="biz_bill_1", legal_name="Fabrication Works", trade_name="FabWorks", industry="Fabrication")
    db_session.add(biz)
    db_session.commit()

    bill = billing_service.create_bill(
        db=db_session,
        business_id="biz_bill_1",
        bill_number="BILL-STEEL-88",
        vendor_name="Tata Steel Distribution",
        issue_date=date(2026, 10, 5),
        due_date=date(2026, 10, 25),
        category="raw_material",
        amount=Decimal("80000.00"),
        priority="critical",
    )
    assert bill.status == "unpaid"
    assert bill.paid_amount == Decimal("0.00")

    # Partial payment of ₹30,000
    billing_service.record_bill_payment(
        db=db_session,
        bill_id=bill.id,
        amount=Decimal("30000.00"),
        payment_date=date(2026, 10, 18),
    )
    assert bill.paid_amount == Decimal("30000.00")
    assert bill.status == "partially_paid"

    # Reject overpayment
    with pytest.raises(ValidationError) as exc:
        billing_service.record_bill_payment(
            db=db_session,
            bill_id=bill.id,
            amount=Decimal("55000.00"),
            payment_date=date(2026, 10, 20),
        )
    assert "Overpayment rejected" in str(exc.value)


def test_real_data_cash_flow_forecast(db_session):
    """
    Comprehensive test of forecast generated directly from persisted DB records:
    - Verified Bank Account Opening Balance
    - Settled Bank Transactions
    - Unpaid Customer Invoices (only outstanding portion counted)
    - Unpaid Vendor Bills (only outstanding portion counted)
    - Active Recurring Operating Expense
    - Configured Minimum Cash Reserve
    """
    ref_date = date(2026, 11, 1)

    # 1. Create real business
    biz = BusinessModel(id="biz_real_fc", legal_name="Apex Precision Mfg Pvt Ltd", trade_name="Apex", industry="Auto", is_demo=False)
    db_session.add(biz)
    db_session.commit()

    # 2. Add bank account with verified opening balance of ₹2,00,000 on 2026-10-01
    acc = BankAccountModel(
        id="acc_fc",
        business_id="biz_real_fc",
        bank_name="Axis Bank",
        account_number_mask="...9821",
        opening_balance=Decimal("200000.00"),
        opening_balance_date=date(2026, 10, 1),
        is_verified=True,
    )
    db_session.add(acc)

    # 3. Add settled historical transactions prior to 2026-11-01 (+50,000 net)
    txn1 = BankTransactionModel(
        id="t1",
        business_id="biz_real_fc",
        transaction_date=date(2026, 10, 10),
        description="Customer Receipt",
        amount=Decimal("100000.00"),
        transaction_type="credit",
        fingerprint="fp1",
    )
    txn2 = BankTransactionModel(
        id="t2",
        business_id="biz_real_fc",
        transaction_date=date(2026, 10, 20),
        description="Electricity Bill",
        amount=Decimal("-50000.00"),
        transaction_type="debit",
        fingerprint="fp2",
    )
    db_session.add_all([txn1, txn2])

    # Reconciled opening cash on 2026-11-01 should be: 200,000 + 50,000 = 250,000!

    # 4. Add Customer Invoice: ₹1,50,000 due 2026-11-10 with ₹50,000 already paid (Outstanding = ₹1,00,000)
    inv = CustomerInvoiceModel(
        id="inv_fc",
        business_id="biz_real_fc",
        invoice_number="INV-NOV-01",
        customer_name="Mahindra Tier 1",
        issue_date=date(2026, 10, 25),
        due_date=date(2026, 11, 10),
        expected_payment_date=date(2026, 11, 10),
        amount=Decimal("150000.00"),
        paid_amount=Decimal("50000.00"),
        status="partially_paid",
    )
    # Fully paid invoice (must be completely excluded from future expected inflows)
    inv_paid = CustomerInvoiceModel(
        id="inv_paid",
        business_id="biz_real_fc",
        invoice_number="INV-OLD-99",
        customer_name="Old Customer",
        issue_date=date(2026, 10, 1),
        due_date=date(2026, 11, 5),
        expected_payment_date=date(2026, 11, 5),
        amount=Decimal("80000.00"),
        paid_amount=Decimal("80000.00"),
        status="paid",
    )
    db_session.add_all([inv, inv_paid])

    # 5. Add Vendor Bill: ₹1,20,000 due 2026-11-15 (Outstanding = ₹1,20,000)
    bill = VendorBillModel(
        id="bill_fc",
        business_id="biz_real_fc",
        bill_number="BILL-TOOL-01",
        vendor_name="Sandvik Coromant",
        issue_date=date(2026, 10, 20),
        due_date=date(2026, 11, 15),
        category="tooling",
        amount=Decimal("120000.00"),
        paid_amount=Decimal("0.00"),
        status="unpaid",
    )
    db_session.add(bill)

    # 6. Add recurring Operating Expense: Monthly payroll ₹80,000 due on day 7 of every month
    exp = billing_service.create_operating_expense(
        db=db_session,
        business_id="biz_real_fc",
        title="Factory Staff Payroll",
        category="payroll",
        amount=Decimal("80000.00"),
        frequency="monthly",
        day_of_month=7,
    )

    db_session.commit()

    # 7. Generate forecast with minimum reserve of ₹1,00,000
    req = ForecastRequest(
        business_id="biz_real_fc",
        start_date="2026-11-01",
        horizon_days=30,
        minimum_reserve=100000.0,
        use_sample_data=False,
    )
    fc = cashflow_service.generate_forecast(req, db=db_session)

    # Verify real data metadata
    assert fc.is_synthetic is False
    assert fc.business_id == "biz_real_fc"
    assert fc.starting_cash == 250000.0
    assert fc.horizon_days == 30
    assert fc.minimum_reserve == 100000.0

    # Inflow check: only 100,000 from unpaid invoice portion (not 150,000 and not the paid invoice)
    assert fc.total_inflows == 100000.0

    # Outflow check: Bill (120,000 on Nov 15) + Payroll (80,000 on Nov 7) = 200,000
    assert fc.total_outflows == 200000.0

    # Reconciled closing cash: 250k + 100k - 200k = 150,000
    assert fc.closing_cash == 150000.0
    assert fc.net_change == -100000.0

    # Daily trajectory checks:
    # Nov 1-6: 250,000
    # Nov 7 (Payroll 80k): 170,000
    # Nov 10 (Inflow 100k): 270,000
    # Nov 15 (Bill 120k): 150,000
    # Nov 16-30: 150,000
    assert fc.minimum_projected_balance == 150000.0
    # No shortfall (never < 0)
    assert fc.first_projected_shortfall_date is None
    assert fc.negative_cash_days_count == 0
    # No reserve breach (min balance 150k > 100k reserve)
    assert fc.first_reserve_breach_date is None
    assert fc.days_below_reserve_count == 0


def test_reserve_breach_detection(db_session):
    """
    Verify detection of minimum cash reserve cushion breaches.
    """
    biz = BusinessModel(id="biz_res_test", legal_name="Reserve Test Enterprise", trade_name="ResTest", industry="Services")
    db_session.add(biz)
    acc = BankAccountModel(
        id="acc_res",
        business_id="biz_res_test",
        bank_name="ICICI",
        account_number_mask="...1111",
        opening_balance=Decimal("150000.00"),
        opening_balance_date=date(2026, 11, 1),
        is_verified=True,
    )
    db_session.add(acc)
    # Bill of 80,000 on day 5 drops cash to 70,000
    bill = VendorBillModel(
        id="b_res",
        business_id="biz_res_test",
        bill_number="B-1",
        vendor_name="Vendor 1",
        issue_date=date(2026, 11, 1),
        due_date=date(2026, 11, 5),
        amount=Decimal("80000.00"),
        paid_amount=Decimal("0.00"),
        status="unpaid",
    )
    db_session.add(bill)
    db_session.commit()

    # Minimum reserve set to 100,000. On day 5, cash dips to 70,000 (< 100,000)
    req = ForecastRequest(
        business_id="biz_res_test",
        start_date="2026-11-01",
        horizon_days=10,
        minimum_reserve=100000.0,
    )
    fc = cashflow_service.generate_forecast(req, db=db_session)

    # Cash remains positive (> 0) so no shortfall, but reserve is breached on Nov 5!
    assert fc.first_projected_shortfall_date is None
    assert fc.first_reserve_breach_date == "2026-11-05"
    assert fc.days_below_reserve_count == 6  # Nov 5 through Nov 10
    assert fc.minimum_projected_balance == 70000.0


def test_business_data_isolation(db_session):
    """
    Verify multi-tenant isolation: records for Business A never leak into Business B.
    """
    biz_a = BusinessModel(id="biz_a", legal_name="Enterprise A", trade_name="A", industry="Ind A")
    biz_b = BusinessModel(id="biz_b", legal_name="Enterprise B", trade_name="B", industry="Ind B")
    db_session.add_all([biz_a, biz_b])
    db_session.commit()

    billing_service.create_invoice(
        db=db_session,
        business_id="biz_a",
        invoice_number="INV-A-1",
        customer_name="Client A",
        issue_date=date(2026, 11, 1),
        due_date=date(2026, 11, 10),
        amount=Decimal("50000.00"),
    )

    invoices_a = billing_service.list_invoices(db=db_session, business_id="biz_a")
    invoices_b = billing_service.list_invoices(db=db_session, business_id="biz_b")

    assert len(invoices_a) == 1
    assert len(invoices_b) == 0


def test_empty_financial_data_reports_warnings(db_session):
    """
    Verify that an empty real business reports data quality warnings
    instead of fabricating synthetic numbers.
    """
    biz = BusinessModel(id="biz_empty", legal_name="Brand New Company", trade_name="NewCo", industry="Consulting", is_demo=False)
    db_session.add(biz)
    db_session.commit()

    req = ForecastRequest(business_id="biz_empty", start_date="2026-11-01", horizon_days=30)
    fc = cashflow_service.generate_forecast(req, db=db_session)

    assert fc.is_synthetic is False
    assert fc.starting_cash == 0.0
    assert fc.total_inflows == 0.0
    assert fc.total_outflows == 0.0
    assert any("EMPTY_LEDGER" in w for w in fc.data_quality_warnings)
    assert any("NO_BANK_ACCOUNT" in w for w in fc.data_quality_warnings)
