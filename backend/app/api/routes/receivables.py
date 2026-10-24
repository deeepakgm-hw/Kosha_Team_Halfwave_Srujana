"""
Receivables & MSMED Act 2006 Statutory Law API Route.
Calculates overdue invoices, Section 16 compound penal interest at 3x RBI Bank Rate,
Section 43B(h) buyer tax disallowance warnings, and editable statutory reminder drafts.
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import BusinessModel, CustomerInvoiceModel
from backend.app.domain.msmed_law import (
    calculate_msmed_penal_interest,
    generate_statutory_reminder_text,
)
from backend.app.schemas.cashflow import (
    ReceivablesLawInvoice,
    ReceivablesLawResponse,
)

router = APIRouter()


@router.get(
    "/law",
    response_model=ReceivablesLawResponse,
    status_code=status.HTTP_200_OK,
    summary="Get MSMED 2006 Overdue Receivables & Accrued Penal Interest",
    description=(
        "Retrieves customer receivables with statutory interest calculations under Section 16 "
        "of the MSMED Act, 2006 (compounded with monthly rests at 3x RBI Bank Rate) and Section 43B(h) "
        "income tax disallowance status for the buyer."
    ),
)
def get_receivables_law(
    business_id: str = Query("apex_precision_mfg", description="Business entity ID"),
    rbi_bank_rate: float = Query(0.065, description="Prevailing RBI Bank Rate (default 6.50% p.a.)"),
    db: Session = Depends(get_db),
) -> ReceivablesLawResponse:
    """Computes statutory overdue interest and Section 43B(h) compliance for customer receivables."""
    today = date.today()

    biz = db.query(BusinessModel).filter_by(id=business_id).first()
    trade_name = biz.trade_name if biz else "Apex Precision Components"
    udyam_no = biz.registration_number if biz else "UDYAM-MH-01-0084920"

    invoices = (
        db.query(CustomerInvoiceModel)
        .filter(CustomerInvoiceModel.business_id == business_id)
        .all()
    )

    # If DB has no invoices, provide the standard demo set
    if not invoices:
        demo_invoices = [
            ("#112", "Bharat Auto Parts", 140000.0, 38, "inv_112"),
            ("#121", "Kumar Fabricators", 40000.0, 65, "inv_121"),
            ("#118", "Sri Motors", 60000.0, -12, "inv_118"),
        ]
        invoice_rows = []
        total_overdue = 0.0
        total_penal = 0.0

        for num, cust, amt, ov_days, i_id in demo_invoices:
            calc = calculate_msmed_penal_interest(
                principal_amount=amt,
                days_overdue=ov_days,
                rbi_bank_rate=rbi_bank_rate,
            )
            if ov_days > 0:
                total_overdue += amt
                total_penal += calc["accrued_penal_interest"]

            reminder = generate_statutory_reminder_text(
                invoice_number=num,
                customer_name=cust,
                principal_amount=amt,
                days_overdue=max(0, ov_days),
                accrued_interest=calc["accrued_penal_interest"],
                penal_rate_pct=calc["penal_rate_annual_pct"],
                supplier_trade_name=trade_name,
                supplier_udyam=udyam_no,
            )

            rate_str = (
                f"{calc['penal_rate_annual_pct']}% p.a. (3x RBI Bank Rate)"
                if calc["is_violation"]
                else "Credit grace period"
            )

            invoice_rows.append(
                ReceivablesLawInvoice(
                    id=i_id,
                    invoice_number=num,
                    customer_name=cust,
                    amount=amt,
                    due_date=today.isoformat(),
                    overdue_days=max(0, ov_days),
                    is_violation=calc["is_violation"],
                    penal_rate_annual=rate_str,
                    accrued_penal_interest=calc["accrued_penal_interest"],
                    total_claimable=calc["total_claimable_amount"],
                    section_43b_status=calc["section_43b_status"],
                    section_43b_notes=calc["section_43b_notes"],
                    statutory_reminder_draft=reminder,
                )
            )

        return ReceivablesLawResponse(
            business_id=business_id,
            rbi_bank_rate_pct=round(rbi_bank_rate * 100, 2),
            msmed_penal_rate_pct=round(3 * rbi_bank_rate * 100, 2),
            compounding_frequency="Monthly rests (Section 16 MSMED Act)",
            total_overdue_principal=round(total_overdue, 2),
            total_accrued_penal_interest=round(total_penal, 2),
            invoices=invoice_rows,
            disclaimer=(
                "Statutory penal calculations are modeled under Sections 15 & 16 of the MSMED Act, 2006 "
                "and Section 43B(h) of the Income Tax Act, 1961 for financial forecasting and early-warning management. "
                "This does not constitute formal legal or tax counsel."
            ),
        )

    # Build from persisted DB records
    invoice_rows = []
    total_overdue = 0.0
    total_penal = 0.0

    for inv in invoices:
        outstanding = float(inv.amount) - float(inv.paid_amount)
        if outstanding <= 0:
            continue

        days_overdue = (today - inv.due_date).days
        calc = calculate_msmed_penal_interest(
            principal_amount=outstanding,
            days_overdue=days_overdue,
            rbi_bank_rate=rbi_bank_rate,
        )

        if days_overdue > 0:
            total_overdue += outstanding
            total_penal += calc["accrued_penal_interest"]

        reminder = generate_statutory_reminder_text(
            invoice_number=inv.invoice_number,
            customer_name=inv.customer_name,
            principal_amount=outstanding,
            days_overdue=max(0, days_overdue),
            accrued_interest=calc["accrued_penal_interest"],
            penal_rate_pct=calc["penal_rate_annual_pct"],
            supplier_trade_name=trade_name,
            supplier_udyam=udyam_no,
        )

        rate_str = (
            f"{calc['penal_rate_annual_pct']}% p.a. (3x RBI Bank Rate)"
            if calc["is_violation"]
            else "Credit grace period"
        )

        invoice_rows.append(
            ReceivablesLawInvoice(
                id=inv.id,
                invoice_number=inv.invoice_number,
                customer_name=inv.customer_name,
                amount=outstanding,
                due_date=inv.due_date.isoformat(),
                overdue_days=max(0, days_overdue),
                is_violation=calc["is_violation"],
                penal_rate_annual=rate_str,
                accrued_penal_interest=calc["accrued_penal_interest"],
                total_claimable=calc["total_claimable_amount"],
                section_43b_status=calc["section_43b_status"],
                section_43b_notes=calc["section_43b_notes"],
                statutory_reminder_draft=reminder,
            )
        )

    return ReceivablesLawResponse(
        business_id=business_id,
        rbi_bank_rate_pct=round(rbi_bank_rate * 100, 2),
        msmed_penal_rate_pct=round(3 * rbi_bank_rate * 100, 2),
        compounding_frequency="Monthly rests (Section 16 MSMED Act)",
        total_overdue_principal=round(total_overdue, 2),
        total_accrued_penal_interest=round(total_penal, 2),
        invoices=invoice_rows,
        disclaimer=(
            "Statutory penal calculations are modeled under Sections 15 & 16 of the MSMED Act, 2006 "
            "and Section 43B(h) of the Income Tax Act, 1961 for financial forecasting and early-warning management. "
            "This does not constitute formal legal or tax counsel."
        ),
    )
