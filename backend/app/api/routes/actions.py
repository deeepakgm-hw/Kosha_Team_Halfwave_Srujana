"""
Corrective Actions Ranking API Route.
Ranks potential treasury interventions (early payment discounts, supplier extensions,
debtor escalation, capex deferral) using multi-criteria utility scoring.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import BusinessModel, CustomerInvoiceModel, VendorBillModel
from backend.app.domain.actions import rank_corrective_actions
from backend.app.schemas.cashflow import ActionRankingRequest, ActionRankingResponse

router = APIRouter()


@router.post(
    "/rank",
    response_model=ActionRankingResponse,
    status_code=status.HTTP_200_OK,
    summary="Rank Corrective Cash-Flow Interventions",
    description=(
        "Evaluates and prioritizes corrective actions to resolve a projected cash shortfall. "
        "Calculates liquidity yield, execution velocity, financial cost, and counterparty relationship friction "
        "using multi-criteria decision analysis (MCDA)."
    ),
)
def get_ranked_actions(
    request: ActionRankingRequest = ActionRankingRequest(),
    db: Session = Depends(get_db),
) -> ActionRankingResponse:
    """Ranks corrective interventions tailored to the active business context."""
    biz_id = request.business_id or "apex_precision_mfg"

    # Query invoices and bills for custom calculations if present
    invoices = (
        db.query(CustomerInvoiceModel)
        .filter(CustomerInvoiceModel.business_id == biz_id, CustomerInvoiceModel.status != "paid")
        .all()
    )
    rec_list = [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer_name,
            "amount": float(inv.amount),
            "paid_amount": float(inv.paid_amount),
            "due_date": inv.due_date.isoformat(),
        }
        for inv in invoices
    ]

    bills = (
        db.query(VendorBillModel)
        .filter(VendorBillModel.business_id == biz_id, VendorBillModel.status != "paid")
        .all()
    )
    pay_list = [
        {
            "id": b.id,
            "bill_number": b.bill_number,
            "vendor_name": b.vendor_name,
            "amount": float(b.amount),
            "paid_amount": float(b.paid_amount),
            "due_date": b.due_date.isoformat(),
        }
        for b in bills
    ]

    ranked = rank_corrective_actions(
        shortfall_amount=request.shortfall_amount,
        days_until_shortfall=request.days_until_shortfall,
        available_receivables=rec_list if rec_list else None,
        available_payables=pay_list if pay_list else None,
        baseline_risk_pct=request.baseline_risk_pct,
    )

    return ActionRankingResponse(
        business_id=biz_id,
        shortfall_amount=request.shortfall_amount,
        days_until_shortfall=request.days_until_shortfall,
        actions=ranked,
    )
