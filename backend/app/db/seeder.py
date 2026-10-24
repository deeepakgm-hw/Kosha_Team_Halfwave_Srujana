"""
Database Seeder for KOSHA.
Pre-populates SQLite with realistic synthetic enterprise personas, bank accounts,
customer invoices, vendor bills, and operational expenses if the database is unseeded.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.db.models import (
    BankAccountModel,
    BankTransactionModel,
    BusinessModel,
    CustomerInvoiceModel,
    OperatingExpenseModel,
    VendorBillModel,
)


def seed_demo_data(db: Session, force: bool = False) -> None:
    """Seeds synthetic business personas if not already present."""
    existing = db.query(BusinessModel).filter_by(id="apex_precision_mfg").first()
    if existing and not force:
        return

    today = date.today()

    # ==========================================
    # Persona 1: Manufacturer (Apex Precision Components)
    # ==========================================
    mfg = BusinessModel(
        id="apex_precision_mfg",
        legal_name="Apex Precision Components Pvt Ltd",
        trade_name="Apex Precision Components",
        industry="Auto Ancillary Manufacturing",
        msme_category="Small",
        currency="INR",
        registration_number="UDYAM-MH-01-0084920",
        is_demo=True,
    )
    db.merge(mfg)

    # Bank Account
    mfg_account = BankAccountModel(
        id="acc_apex_01",
        business_id="apex_precision_mfg",
        bank_name="HDFC Bank Current A/C",
        account_number_mask="...4920",
        currency="INR",
        opening_balance=Decimal("450000.00"),
        opening_balance_date=today - timedelta(days=90),
        is_verified=True,
    )
    db.merge(mfg_account)

    # Invoices (Receivables)
    invoices = [
        CustomerInvoiceModel(
            id="inv_112",
            business_id="apex_precision_mfg",
            invoice_number="#112",
            customer_name="Bharat Auto Parts",
            customer_id="cust_bap_01",
            issue_date=today - timedelta(days=68),
            due_date=today - timedelta(days=38),
            expected_payment_date=today + timedelta(days=5),
            amount=Decimal("140000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            msmed_eligible=True,
            notes="38 days overdue. Section 43B(h) disallowance risk flagged.",
        ),
        CustomerInvoiceModel(
            id="inv_121",
            business_id="apex_precision_mfg",
            invoice_number="#121",
            customer_name="Kumar Fabricators",
            customer_id="cust_kf_02",
            issue_date=today - timedelta(days=95),
            due_date=today - timedelta(days=65),
            expected_payment_date=today + timedelta(days=12),
            amount=Decimal("40000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            msmed_eligible=True,
            notes="65 days overdue. Tax deduction disallowed for buyer under Section 43B(h).",
        ),
        CustomerInvoiceModel(
            id="inv_118",
            business_id="apex_precision_mfg",
            invoice_number="#118",
            customer_name="Sri Motors",
            customer_id="cust_sm_03",
            issue_date=today - timedelta(days=18),
            due_date=today + timedelta(days=12),
            expected_payment_date=today + timedelta(days=12),
            amount=Decimal("60000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            msmed_eligible=True,
            notes="Within agreed 30-day payment term.",
        ),
        CustomerInvoiceModel(
            id="inv_130",
            business_id="apex_precision_mfg",
            invoice_number="#130",
            customer_name="Western Auto Assemblers",
            customer_id="cust_waa_04",
            issue_date=today - timedelta(days=5),
            due_date=today + timedelta(days=25),
            expected_payment_date=today + timedelta(days=25),
            amount=Decimal("180000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            msmed_eligible=True,
            notes="Contractual 30-day credit term for machined bracket delivery.",
        ),
    ]
    for inv in invoices:
        db.merge(inv)

    # Vendor Bills (Committed Payables)
    bills = [
        VendorBillModel(
            id="bill_701",
            business_id="apex_precision_mfg",
            bill_number="BILL-701",
            vendor_name="Hindalco Raw Material Ingots",
            vendor_id="vend_hindalco",
            issue_date=today - timedelta(days=20),
            due_date=today + timedelta(days=10),
            category="vendor",
            amount=Decimal("140000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            priority="critical",
            notes="Agreed 30-day supplier credit settlement.",
        ),
        VendorBillModel(
            id="bill_702",
            business_id="apex_precision_mfg",
            bill_number="BILL-702",
            vendor_name="Industrial Packaging Material",
            vendor_id="vend_pkg",
            issue_date=today - timedelta(days=5),
            due_date=today + timedelta(days=25),
            category="vendor",
            amount=Decimal("45000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            priority="normal",
            notes="Corrugated shipping cartons.",
        ),
        VendorBillModel(
            id="bill_703",
            business_id="apex_precision_mfg",
            bill_number="BILL-703",
            vendor_name="Steel Traders Raw Material",
            vendor_id="vend_steel",
            issue_date=today - timedelta(days=12),
            due_date=today + timedelta(days=18),
            category="vendor",
            amount=Decimal("80000.00"),
            paid_amount=Decimal("0.00"),
            status="unpaid",
            priority="critical",
            notes="Alloy steel bar stock supply.",
        ),
    ]
    for b in bills:
        db.merge(b)

    # Recurring Operating Expenses
    opex = [
        OperatingExpenseModel(
            id="opex_mfg_payroll",
            business_id="apex_precision_mfg",
            title="Workforce Payroll (Factory & Engineering Salaries)",
            category="payroll",
            amount=Decimal("180000.00"),
            frequency="monthly",
            day_of_month=1,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_rent",
            business_id="apex_precision_mfg",
            title="MIDC Industrial Shed Lease Rent",
            category="rent",
            amount=Decimal("65000.00"),
            frequency="monthly",
            day_of_month=10,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_emi",
            business_id="apex_precision_mfg",
            title="Machinery Term Loan EMI (HDFC Bank)",
            category="emi",
            amount=Decimal("60000.00"),
            frequency="monthly",
            day_of_month=5,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_utility",
            business_id="apex_precision_mfg",
            title="State Electricity Board (MSEDCL High-Tension Power)",
            category="utility",
            amount=Decimal("35000.00"),
            frequency="monthly",
            day_of_month=12,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_tds",
            business_id="apex_precision_mfg",
            title="TDS Monthly Deposit (Section 194C / 194J)",
            category="statutory",
            amount=Decimal("30000.00"),
            frequency="monthly",
            day_of_month=7,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_pf",
            business_id="apex_precision_mfg",
            title="Provident Fund Contribution (EPFO)",
            category="statutory",
            amount=Decimal("40000.00"),
            frequency="monthly",
            day_of_month=15,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_esi",
            business_id="apex_precision_mfg",
            title="Employee State Insurance (ESIC)",
            category="statutory",
            amount=Decimal("10000.00"),
            frequency="monthly",
            day_of_month=15,
            is_active=True,
        ),
        OperatingExpenseModel(
            id="opex_mfg_gst",
            business_id="apex_precision_mfg",
            title="GSTR-3B Monthly Return Tax Settlement",
            category="statutory",
            amount=Decimal("90000.00"),
            frequency="monthly",
            day_of_month=20,
            is_active=True,
        ),
    ]
    for o in opex:
        db.merge(o)

    # ==========================================
    # Persona 2: Seasonal Trader (GreenGrocer Hub)
    # ==========================================
    trader = BusinessModel(
        id="biz_ret_03",
        legal_name="GreenGrocer Distribution Pvt Ltd",
        trade_name="GreenGrocer Hub",
        industry="FMCG / Agri Wholesale",
        msme_category="Small",
        currency="INR",
        registration_number="UDYAM-KA-02-0043120",
        is_demo=True,
    )
    db.merge(trader)

    trader_account = BankAccountModel(
        id="acc_trd_01",
        business_id="biz_ret_03",
        bank_name="ICICI Bank Current A/C",
        account_number_mask="...8841",
        currency="INR",
        opening_balance=Decimal("620000.00"),
        opening_balance_date=today - timedelta(days=90),
        is_verified=True,
    )
    db.merge(trader_account)

    # ==========================================
    # Persona 3: Services Firm (PixelCraft Studio)
    # ==========================================
    srv = BusinessModel(
        id="biz_srv_02",
        legal_name="PixelCraft Digital Solutions LLP",
        trade_name="PixelCraft Studio",
        industry="Software & Digital Agency",
        msme_category="Micro",
        currency="INR",
        registration_number="UDYAM-DL-03-0091845",
        is_demo=True,
    )
    db.merge(srv)

    srv_account = BankAccountModel(
        id="acc_srv_01",
        business_id="biz_srv_02",
        bank_name="Axis Bank Current A/C",
        account_number_mask="...1290",
        currency="INR",
        opening_balance=Decimal("280000.00"),
        opening_balance_date=today - timedelta(days=90),
        is_verified=True,
    )
    db.merge(srv_account)

    db.commit()
