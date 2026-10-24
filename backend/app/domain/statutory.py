"""
Statutory Calendar & Outflow Engine.
Encapsulates Indian compliance deadlines, operational disbursements, and recurring commitments
across an upcoming 42-day (6-week) treasury planning horizon.

Statutory Outflows Modeled:
- TDS Deposit: 7th of every month (Section 201(1A))
- PF Remittance: 15th of every month (EPF & MP Act)
- ESI Remittance: 15th of every month (ESI Act)
- GSTR-3B Tax Settlement: 20th of every month (CGST Act Section 50)
- Advance Income Tax: June 15, Sept 15, Dec 15, March 15 (Section 208/211)
"""

from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Dict, List, Optional


def get_upcoming_cash_calendar(
    reference_date: date,
    window_days: int = 42,
    vendor_bills: Optional[List[Dict[str, Any]]] = None,
    operating_expenses: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Generates scheduled outflows across the 42-day window categorized into:
    - Statutory
    - Payroll
    - Loan repayments
    - Supplier payments
    - Other recurring expenses
    """
    end_date = reference_date + timedelta(days=window_days)
    outflows: List[Dict[str, Any]] = []

    # 1. Expand Statutory Dates for each month touched by the window
    # Touch reference_date's month and next two months if within window
    months_to_check = set()
    cur = reference_date
    while cur <= end_date:
        months_to_check.add((cur.year, cur.month))
        cur += timedelta(days=15)
    months_to_check.add((end_date.year, end_date.month))

    for yr, mo in sorted(months_to_check):
        # TDS: 7th of month
        tds_date = date(yr, mo, 7)
        if reference_date <= tds_date <= end_date:
            outflows.append({
                "id": f"stat-tds-{yr}-{mo:02d}",
                "date": tds_date.isoformat(),
                "formatted_date": tds_date.strftime("%d %b"),
                "title": "TDS deposit (Section 194C / 194J)",
                "category": "Statutory",
                "amount": "₹0.3L",
                "amount_num": 30000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Monthly withholding tax deposit due by 7th to avoid 1.5% per month penal interest.",
            })

        # PF: 15th of month
        pf_date = date(yr, mo, 15)
        if reference_date <= pf_date <= end_date:
            outflows.append({
                "id": f"stat-pf-{yr}-{mo:02d}",
                "date": pf_date.isoformat(),
                "formatted_date": pf_date.strftime("%d %b"),
                "title": "PF contribution (EPFO)",
                "category": "Statutory",
                "amount": "₹0.4L",
                "amount_num": 40000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Provident fund monthly employer & employee remittance due by 15th.",
            })

        # ESI: 15th of month
        esi_date = date(yr, mo, 15)
        if reference_date <= esi_date <= end_date:
            outflows.append({
                "id": f"stat-esi-{yr}-{mo:02d}",
                "date": esi_date.isoformat(),
                "formatted_date": esi_date.strftime("%d %b"),
                "title": "ESI contribution (ESIC)",
                "category": "Statutory",
                "amount": "₹0.1L",
                "amount_num": 10000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Employee state insurance statutory remittance.",
            })

        # GST GSTR-3B: 20th of month
        gst_date = date(yr, mo, 20)
        if reference_date <= gst_date <= end_date:
            outflows.append({
                "id": f"stat-gst-{yr}-{mo:02d}",
                "date": gst_date.isoformat(),
                "formatted_date": gst_date.strftime("%d %b"),
                "title": "GST GSTR-3B monthly filing & tax",
                "category": "Statutory",
                "amount": "₹0.9L",
                "amount_num": 90000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Monthly outward supply GST cash ledger settlement due by 20th.",
            })

        # Advance Tax: 15th of June, Sept, Dec, March
        if mo in (3, 6, 9, 12):
            adv_date = date(yr, mo, 15)
            if reference_date <= adv_date <= end_date:
                outflows.append({
                    "id": f"stat-advtax-{yr}-{mo:02d}",
                    "date": adv_date.isoformat(),
                    "formatted_date": adv_date.strftime("%d %b"),
                    "title": f"Advance income tax installment (Q{(mo // 3)})",
                    "category": "Statutory",
                    "amount": "₹1.2L",
                    "amount_num": 120000.0,
                    "priority": "critical",
                    "is_confirmed": True,
                    "notes": f"Statutory advance tax quarterly installment under Section 208/211.",
                })

    # 2. Add Supplier Payments (Vendor Bills)
    if vendor_bills:
        for b in vendor_bills:
            b_due_str = b.get("due_date", "")[:10]
            try:
                b_date = date.fromisoformat(b_due_str)
            except (ValueError, TypeError):
                continue
            if reference_date <= b_date <= end_date:
                amt = float(b.get("amount", 0)) - float(b.get("paid_amount", 0))
                if amt > 0:
                    lakh_str = f"₹{(amt / 100000.0):.1f}L" if amt >= 100000 else f"₹{(amt / 1000.0):.0f}k"
                    outflows.append({
                        "id": f"bill-{b.get('id', 'x')}",
                        "date": b_date.isoformat(),
                        "formatted_date": b_date.strftime("%d %b"),
                        "title": b.get("vendor_name", f"Bill #{b.get('bill_number', '1')}"),
                        "category": "Supplier payments",
                        "amount": lakh_str,
                        "amount_num": amt,
                        "priority": b.get("priority", "normal"),
                        "is_confirmed": True,
                        "notes": b.get("notes", "Agreed supplier credit settlement."),
                    })
    else:
        # Realistic default supplier bills for sample persona
        default_bills = [
            (reference_date + timedelta(days=10), "Raw Material Ingot Delivery (Hindalco)", 140000.0, "₹1.4L", "Agreed 30-day supplier credit settlement."),
            (reference_date + timedelta(days=18), "Steel Traders Raw Material Alloy Stock", 80000.0, "₹0.8L", "Alloy steel bar stock supply."),
            (reference_date + timedelta(days=25), "Industrial Packaging Material", 45000.0, "₹0.45L", "Corrugated box vendor fortnightly batch."),
        ]
        for b_date, title, amt, l_str, notes in default_bills:
            if reference_date <= b_date <= end_date:
                outflows.append({
                    "id": f"sample-bill-{b_date.strftime('%d%m')}",
                    "date": b_date.isoformat(),
                    "formatted_date": b_date.strftime("%d %b"),
                    "title": title,
                    "category": "Supplier payments",
                    "amount": l_str,
                    "amount_num": amt,
                    "priority": "normal",
                    "is_confirmed": True,
                    "notes": notes,
                })

    # 3. Add Payroll & Recurring Operating Expenses
    for yr, mo in sorted(months_to_check):
        # Payroll: 1st of month
        p_date = date(yr, mo, 1)
        if reference_date <= p_date <= end_date:
            outflows.append({
                "id": f"opex-payroll-{yr}-{mo:02d}",
                "date": p_date.isoformat(),
                "formatted_date": p_date.strftime("%d %b"),
                "title": "Workforce payroll (Salaries)",
                "category": "Payroll",
                "amount": "₹1.8L",
                "amount_num": 180000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Direct bank transfer to workforce accounts on 1st of month.",
            })

        # EMI: 5th of month
        emi_date = date(yr, mo, 5)
        if reference_date <= emi_date <= end_date:
            outflows.append({
                "id": f"opex-emi-{yr}-{mo:02d}",
                "date": emi_date.isoformat(),
                "formatted_date": emi_date.strftime("%d %b"),
                "title": "Machinery Term Loan EMI",
                "category": "Loan repayments",
                "amount": "₹0.6L",
                "amount_num": 60000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Auto-debit from primary current account.",
            })

        # Factory Shed Rent: 10th of month
        rent_date = date(yr, mo, 10)
        if reference_date <= rent_date <= end_date:
            outflows.append({
                "id": f"opex-rent-{yr}-{mo:02d}",
                "date": rent_date.isoformat(),
                "formatted_date": rent_date.strftime("%d %b"),
                "title": "Factory Shed Lease Rent",
                "category": "Other recurring expenses",
                "amount": "₹0.65L",
                "amount_num": 65000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "Monthly MIDC industrial shed lease.",
            })

        # Power Bill: 12th of month
        pwr_date = date(yr, mo, 12)
        if reference_date <= pwr_date <= end_date:
            outflows.append({
                "id": f"opex-pwr-{yr}-{mo:02d}",
                "date": pwr_date.isoformat(),
                "formatted_date": pwr_date.strftime("%d %b"),
                "title": "State Electricity Board (MSEDCL)",
                "category": "Other recurring expenses",
                "amount": "₹0.35L",
                "amount_num": 35000.0,
                "priority": "critical",
                "is_confirmed": True,
                "notes": "High-tension 3-phase factory power billing.",
            })

    # Sort all outflows chronologically
    outflows.sort(key=lambda x: x["date"])

    total_committed = sum(o["amount_num"] for o in outflows)
    statutory_total = sum(o["amount_num"] for o in outflows if o["category"] == "Statutory")
    payroll_total = sum(o["amount_num"] for o in outflows if o["category"] == "Payroll")
    loans_total = sum(o["amount_num"] for o in outflows if o["category"] == "Loan repayments")
    suppliers_total = sum(o["amount_num"] for o in outflows if o["category"] == "Supplier payments")
    recurring_total = sum(o["amount_num"] for o in outflows if o["category"] == "Other recurring expenses")

    return {
        "reference_date": reference_date.isoformat(),
        "horizon_days": window_days,
        "end_date": end_date.isoformat(),
        "total_committed_amount": total_committed,
        "category_totals": {
            "Statutory": statutory_total,
            "Payroll": payroll_total,
            "Loan repayments": loans_total,
            "Supplier payments": suppliers_total,
            "Other recurring expenses": recurring_total,
        },
        "payments_count": len(outflows),
        "scheduled_payments": outflows,
    }
