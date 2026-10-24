"""
MSMED Act 2006 & Section 43B(h) Domain Logic.
Models statutory rights for Micro and Small Enterprises under Indian law:
- Section 15: Payment due within agreed credit period (max 45 days) or 15 days without written contract.
- Section 16: Compound interest with monthly rests at 3 times RBI Bank Rate.
- Section 43B(h) of Income Tax Act: Tax deduction disallowed for buyer on overdue MSME payables.

DISCLAIMER: This module provides algorithmic estimations for financial forecasting,
early-warning liquidity management, and commercial follow-up. It does not constitute formal legal or tax advice.
"""

from datetime import date, datetime
import math
from typing import Any, Dict, List, Optional


def calculate_msmed_penal_interest(
    principal_amount: float,
    days_overdue: int,
    rbi_bank_rate: float = 0.065,  # Prevailing RBI Bank Rate (6.50% p.a.)
    has_written_agreement: bool = True,
    agreed_credit_days: int = 30,
) -> Dict[str, Any]:
    """
    Computes statutory penal interest under Section 16 of the MSMED Act, 2006.
    Penal interest = Compounded monthly at 3x RBI Bank Rate.

    Formulation:
      penal_rate = 3 * rbi_bank_rate (e.g. 19.50% p.a.)
      monthly_rate = penal_rate / 12
      full_months = days_overdue // 30
      remaining_days = days_overdue % 30
      compounded_amount = principal * ((1 + monthly_rate) ** full_months) * (1 + penal_rate * (remaining_days / 365.0))
      interest = compounded_amount - principal
    """
    if principal_amount <= 0 or days_overdue <= 0:
        return {
            "is_violation": False,
            "statutory_limit_days": min(45, agreed_credit_days) if has_written_agreement else 15,
            "overdue_days": max(0, days_overdue),
            "rbi_bank_rate_pct": round(rbi_bank_rate * 100, 2),
            "penal_rate_annual_pct": round(3 * rbi_bank_rate * 100, 2),
            "compounding_frequency": "Monthly rests",
            "accrued_penal_interest": 0.0,
            "total_claimable_amount": round(principal_amount, 2),
            "section_43b_status": "COMPLIANT",
            "section_43b_notes": "Invoice is within the statutory settlement window.",
        }

    penal_rate = 3 * rbi_bank_rate
    monthly_rate = penal_rate / 12.0

    full_months = days_overdue // 30
    remaining_days = days_overdue % 30

    # Compounding with monthly rests
    growth_factor = ((1.0 + monthly_rate) ** full_months) * (1.0 + penal_rate * (remaining_days / 365.0))
    compounded_principal = principal_amount * growth_factor
    interest_est = compounded_principal - principal_amount

    # Section 43B(h) evaluation
    statutory_limit = min(45, agreed_credit_days) if has_written_agreement else 15
    if days_overdue > 45:
        section_43b_status = "DISALLOWED"
        section_43b_notes = (
            "Breached 45-day statutory ceiling under MSMED Act Section 15. "
            "Buyer cannot claim expenditure deduction under Section 43B(h) of Income Tax Act until actually paid."
        )
    else:
        section_43b_status = "PENDING_DISALLOWANCE"
        section_43b_notes = (
            f"Overdue by {days_overdue} days past contractual due date. "
            "Exceeding 45 days will trigger income tax disallowance for the buyer under Section 43B(h)."
        )

    return {
        "is_violation": True,
        "statutory_limit_days": statutory_limit,
        "overdue_days": days_overdue,
        "rbi_bank_rate_pct": round(rbi_bank_rate * 100, 2),
        "penal_rate_annual_pct": round(penal_rate * 100, 2),
        "compounding_frequency": "Monthly rests (Section 16 MSMED Act)",
        "accrued_penal_interest": round(interest_est, 2),
        "total_claimable_amount": round(principal_amount + interest_est, 2),
        "section_43b_status": section_43b_status,
        "section_43b_notes": section_43b_notes,
    }


def generate_statutory_reminder_text(
    invoice_number: str,
    customer_name: str,
    principal_amount: float,
    days_overdue: int,
    accrued_interest: float,
    penal_rate_pct: float,
    supplier_trade_name: str,
    supplier_udyam: Optional[str] = None,
) -> str:
    """Generates a professional, legally formatted statutory reminder notice draft."""
    udyam_ref = f" (UDYAM: {supplier_udyam})" if supplier_udyam else ""
    return (
        f"Subject: Statutory Notice: Overdue Invoice {invoice_number} & MSMED Act Interest Remittance\n\n"
        f"Dear Accounts Team at {customer_name},\n\n"
        f"We appreciate our ongoing business partnership. This communication serves as a formal follow-up "
        f"regarding Invoice {invoice_number} for ₹{principal_amount:,.2f}, which is currently overdue by "
        f"{days_overdue} days past the agreed credit term.\n\n"
        f"STATUTORY REGULATORY NOTICE:\n"
        f"1. Under Sections 15 & 16 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, "
        f"delayed settlements beyond the statutory period incur mandatory compound interest at 3x the prevailing "
        f"Reserve Bank of India (RBI) Bank Rate ({penal_rate_pct}% p.a., compounded with monthly rests). "
        f"Accrued statutory penal interest to date: ₹{accrued_interest:,.2f}.\n"
        f"2. Under Section 43B(h) of the Income Tax Act, buyers unable to clear MSME dues within agreed statutory "
        f"timelines cannot claim expenditure deductions in their tax computation for the assessment year.\n\n"
        f"To preserve seamless trade terms and avoid formal reporting under the MSME Samadhaan portal, please confirm "
        f"settlement of ₹{principal_amount:,.2f} to our registered bank account this week.\n\n"
        f"Kind regards,\n"
        f"Finance & Treasury Department\n"
        f"{supplier_trade_name}{udyam_ref}"
    )
