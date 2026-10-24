"""
Action Ranking Engine: Generates, prioritizes, and scores corrective interventions
to resolve cash-flow shortfalls using Multi-Criteria Decision Analysis (MCDA).

Evaluates actions across four primary criteria:
1. Liquidity Yield (INR amount accelerated or conserved)
2. Execution Velocity (Days until cash is in bank)
3. Financial Cost (Discount offered or interest incurred)
4. Counterparty Relationship Friction (Low / Medium / High impact on supply chain)
"""

from typing import Any, Dict, List, Optional


class CorrectiveActionCategory:
    EARLY_PAYMENT_DISCOUNT = "discount"
    SUPPLIER_EXTENSION = "supplier_extension"
    CHASE_DEBTOR = "chase_debtor"
    DEFER_EXPENSE = "defer_expense"


def rank_corrective_actions(
    shortfall_amount: float = 65000.0,
    days_until_shortfall: int = 18,
    available_receivables: Optional[List[Dict[str, Any]]] = None,
    available_payables: Optional[List[Dict[str, Any]]] = None,
    baseline_risk_pct: int = 71,
) -> List[Dict[str, Any]]:
    """
    Ranks corrective actions tailored to the shortfall magnitude and timing.
    Uses multi-criteria scoring to identify the highest-impact, lowest-friction intervention.
    """
    shortfall = max(10000.0, float(shortfall_amount))
    horizon_days = max(1, int(days_until_shortfall))

    # Determine highest-value overdue or pending receivable
    top_receivable_amt = 140000.0
    top_receivable_customer = "Bharat Auto Parts"
    top_receivable_invoice = "Invoice #112"

    if available_receivables:
        sorted_rec = sorted(
            available_receivables,
            key=lambda r: float(r.get("amount", 0)) - float(r.get("paid_amount", 0)),
            reverse=True,
        )
        if sorted_rec:
            top = sorted_rec[0]
            top_receivable_amt = float(top.get("amount", 140000.0)) - float(top.get("paid_amount", 0.0))
            top_receivable_customer = top.get("customer_name", "Tier-1 Customer")
            top_receivable_invoice = top.get("invoice_number", f"Invoice #{top.get('id', '112')}")

    # Determine candidate payable for deferral
    top_payable_amt = 80000.0
    top_payable_vendor = "Steel Traders"
    if available_payables:
        sorted_bills = sorted(
            available_payables,
            key=lambda b: float(b.get("amount", 0)) - float(b.get("paid_amount", 0)),
            reverse=True,
        )
        if sorted_bills:
            top_b = sorted_bills[0]
            top_payable_amt = float(top_b.get("amount", 80000.0)) - float(top_b.get("paid_amount", 0.0))
            top_payable_vendor = top_b.get("vendor_name", "Primary Supplier")

    # Candidate 1: 2% Early-Payment Discount
    discount_rate = 0.02
    discount_cost = round(top_receivable_amt * discount_rate, 2)
    discount_net_yield = round(top_receivable_amt - discount_cost, 2)
    discount_days_to_cash = 3
    discount_risk_after = max(15, baseline_risk_pct - 37)

    # Candidate 2: Negotiate 10-Day Supplier Payment Extension
    extension_days = 10
    extension_yield = round(top_payable_amt, 2)
    extension_cost = 0.0
    extension_risk_after = max(20, baseline_risk_pct - 29)

    # Candidate 3: Debtor Follow-up & Statutory Collections Escalation
    chase_yield = round(top_receivable_amt, 2)
    chase_cost = 0.0
    chase_days_to_cash = 7
    chase_risk_after = max(25, baseline_risk_pct - 33)

    # Candidate 4: Defer Discretionary Capex / Tooling Spares
    defer_yield = round(min(shortfall * 0.7, 45000.0), 2)
    defer_cost = 0.0
    defer_risk_after = max(35, baseline_risk_pct - 15)

    candidates = [
        {
            "id": "act-1",
            "category": CorrectiveActionCategory.EARLY_PAYMENT_DISCOUNT,
            "category_label": "Offer early-payment discount",
            "title": f"Offer a 2% early-payment discount on {top_receivable_invoice}",
            "why_recommended": (
                f"Achieves the fastest liquidity acceleration (+₹{discount_net_yield:,.0f} in {discount_days_to_cash} days) "
                f"with low counterparty friction and minimal financial cost (₹{discount_cost:,.0f})."
            ),
            "cash_flow_impact": f"+₹{discount_net_yield:,.0f} liquidity accelerated by {horizon_days} days",
            "risk_shift": f"Risk {baseline_risk_pct}% → {discount_risk_after}%",
            "cost": f"₹{discount_cost:,.0f} discount cost",
            "cost_inr": discount_cost,
            "yield_inr": discount_net_yield,
            "days_to_cash": discount_days_to_cash,
            "relationship_cost": "Low",
            "relationship_notes": "Positive commercial incentive that builds buyer goodwill through win-win prompt settlement.",
            "assumptions": f"{top_receivable_customer} accounts payable processes prompt payment within 48-72 hours of incentive credit note.",
            "practical_steps": [
                f"Issue revised early settlement credit note of 2% (₹{discount_cost:,.0f}) on {top_receivable_invoice} to {top_receivable_customer} Accounts Payable.",
                "Request direct NEFT/RTGS bank remittance confirmation within 3 business days.",
                "Reconcile settled invoice in Kosha ledger to clear the projected shortfall zone.",
            ],
            "mcda_score": (discount_net_yield / shortfall) * 0.45 + (1.0 / discount_days_to_cash) * 0.35 - (discount_cost / top_receivable_amt) * 0.20,
        },
        {
            "id": "act-2",
            "category": CorrectiveActionCategory.SUPPLIER_EXTENSION,
            "category_label": "Negotiate supplier payment extension",
            "title": f"Negotiate a {extension_days}-day payment extension with {top_payable_vendor}",
            "why_recommended": (
                f"Defers ₹{extension_yield:,.0f} outflow past the acute deficit window without any direct cash fee, "
                f"though requires active supplier agreement."
            ),
            "cash_flow_impact": f"₹{extension_yield:,.0f} outflow deferred past liquidity deficit window",
            "risk_shift": f"Risk {baseline_risk_pct}% → {extension_risk_after}%",
            "cost": "₹0 direct financial cost",
            "cost_inr": 0.0,
            "yield_inr": extension_yield,
            "days_to_cash": 1,
            "relationship_cost": "Medium",
            "relationship_notes": "Requires proactive supplier communication; not guaranteed without vendor agreement.",
            "assumptions": f"{top_payable_vendor} agrees to revised {extension_days}-day window without interrupting ongoing material deliveries.",
            "practical_steps": [
                f"Call procurement lead at {top_payable_vendor} to propose {extension_days}-day staggered settlement.",
                "Commit to firm post-dated payment date following customer invoice clearance.",
                "Reconcile payment voucher in Kosha calendar.",
            ],
            "mcda_score": (extension_yield / shortfall) * 0.40 + 0.25 - 0.15,
        },
        {
            "id": "act-3",
            "category": CorrectiveActionCategory.CHASE_DEBTOR,
            "category_label": "Follow up with customer",
            "title": f"Follow up with {top_receivable_customer} for prompt settlement",
            "why_recommended": (
                f"Secures full contract value (+₹{chase_yield:,.0f}) without discount costs, "
                f"but persistent debtor follow-up carries counterparty relationship friction."
            ),
            "cash_flow_impact": f"+₹{chase_yield:,.0f} received {chase_days_to_cash} days earlier",
            "risk_shift": f"Risk {baseline_risk_pct}% → {chase_risk_after}%",
            "cost": "₹0 direct cost",
            "cost_inr": 0.0,
            "yield_inr": chase_yield,
            "days_to_cash": chase_days_to_cash,
            "relationship_cost": "High",
            "relationship_notes": "Tier-1 OEM buyers often resist off-cycle collection escalation.",
            "assumptions": f"{top_receivable_customer}'s ERP payment batch cycle permits an off-cycle emergency vendor release.",
            "practical_steps": [
                "Draft polite statutory reminder citing MSMED Act Section 15 timeline.",
                "Send reminder directly to corporate finance controller.",
                "Follow up telephonically with vendor desk.",
            ],
            "mcda_score": (chase_yield / shortfall) * 0.35 + (1.0 / chase_days_to_cash) * 0.20 - 0.25,
        },
        {
            "id": "act-4",
            "category": CorrectiveActionCategory.DEFER_EXPENSE,
            "category_label": "Reduce or defer discretionary expense",
            "title": "Defer non-critical tooling spares purchase by 30 days",
            "why_recommended": (
                f"Zero-cost internal capex deferral preserving ₹{defer_yield:,.0f} in liquid reserve, "
                f"though with lesser overall risk reduction."
            ),
            "cash_flow_impact": f"₹{defer_yield:,.0f} cash conserved during high-risk period",
            "risk_shift": f"Risk {baseline_risk_pct}% → {defer_risk_after}%",
            "cost": "₹0 direct cost",
            "cost_inr": 0.0,
            "yield_inr": defer_yield,
            "days_to_cash": 1,
            "relationship_cost": "Low",
            "relationship_notes": "Purely internal decision with zero external counterparty impact.",
            "assumptions": "Current machine buffer tooling operates reliably without unscheduled maintenance disruption.",
            "practical_steps": [
                "Inform factory shop-floor manager to utilize buffer tooling stock.",
                "Postpone purchase requisition approval to next month's cash cycle.",
                "Unfreeze order once reserve balance exceeds safety buffer threshold.",
            ],
            "mcda_score": (defer_yield / shortfall) * 0.25 + 0.15 - 0.05,
        },
    ]

    # Sort by MCDA score descending
    ranked = sorted(candidates, key=lambda x: x["mcda_score"], reverse=True)

    # Assign badges
    for idx, act in enumerate(ranked):
        act["badge"] = "#1 Recommended" if idx == 0 else f"#{idx + 1}"

    return ranked
