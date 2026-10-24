"""
Cashflow Service: Coordinates data fetching, domain logic execution, and result transformation.
Handles both real persisted enterprise ledgers and explicitly isolated synthetic demo personas.
"""

from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundException
from backend.app.data.personas import get_sample_forecast_dataset
from backend.app.db.models import (
    BankAccountModel,
    BankTransactionModel,
    BusinessModel,
    CustomerInvoiceModel,
    OperatingExpenseModel,
    VendorBillModel,
)
from backend.app.domain.simulator import simulate_cash_runway, simulate_scenario
from backend.app.schemas.cashflow import (
    BusinessStateSummary,
    ForecastRequest,
    ForecastResponse,
    RiskComparisonMetrics,
    ScenarioShocksApplied,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
)


class CashflowService:
    """Application service for cash flow forecasting and treasury operations."""

    def get_state_summary(self, business_id: str, db: Session) -> BusinessStateSummary:
        """
        Calculates the operational financial state of the business from real database records.
        """
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        if not biz:
            raise NotFoundException(f"Business '{business_id}' does not exist.")

        warnings: List[str] = []

        # Bank accounts
        accounts = db.query(BankAccountModel).filter_by(business_id=biz.id).all()
        verified_opening: Optional[float] = None
        reconciliation_status = "no_accounts"

        if not accounts:
            warnings.append("NO_BANK_ACCOUNT: No bank accounts configured.")
        else:
            verified_accs = [a for a in accounts if a.is_verified]
            if verified_accs:
                verified_opening = float(sum(a.opening_balance for a in verified_accs))
                reconciliation_status = "verified"
            else:
                reconciliation_status = "unverified"
                warnings.append("UNVERIFIED_ACCOUNTS: Bank accounts configured without verified opening balance.")

        # Bank transactions
        txns = db.query(BankTransactionModel).filter_by(business_id=biz.id).all()
        total_inflow = sum((t.amount for t in txns if t.amount > 0), Decimal("0.00"))
        total_outflow = sum((abs(t.amount) for t in txns if t.amount < 0), Decimal("0.00"))
        net_txn_movement = total_inflow - total_outflow

        current_cash = (verified_opening or 0.0) + float(net_txn_movement)

        # Invoices
        unpaid_invoices = (
            db.query(CustomerInvoiceModel)
            .filter(
                CustomerInvoiceModel.business_id == biz.id,
                CustomerInvoiceModel.status.in_(["unpaid", "partially_paid"]),
            )
            .all()
        )
        total_unpaid_receivables = sum(
            (inv.amount - inv.paid_amount for inv in unpaid_invoices), Decimal("0.00")
        )

        # Bills
        unpaid_bills = (
            db.query(VendorBillModel)
            .filter(
                VendorBillModel.business_id == biz.id,
                VendorBillModel.status.in_(["unpaid", "partially_paid"]),
            )
            .all()
        )
        total_unpaid_payables = sum(
            (b.amount - b.paid_amount for b in unpaid_bills), Decimal("0.00")
        )

        if len(txns) == 0:
            warnings.append("ZERO_TRANSACTION_HISTORY: No bank transactions imported.")

        return BusinessStateSummary(
            business_id=biz.id,
            legal_name=biz.legal_name,
            currency=biz.currency,
            is_demo=biz.is_demo,
            current_cash=round(current_cash, 2),
            verified_opening_balance=round(verified_opening, 2) if verified_opening is not None else None,
            total_settled_inflows=float(total_inflow),
            total_settled_outflows=float(total_outflow),
            total_unpaid_receivables=float(total_unpaid_receivables),
            total_unpaid_payables=float(total_unpaid_payables),
            active_invoices_count=len(unpaid_invoices),
            active_bills_count=len(unpaid_bills),
            imported_transactions_count=len(txns),
            reconciliation_status=reconciliation_status,
            data_quality_warnings=warnings,
        )

    def generate_forecast(self, req: ForecastRequest, db: Session) -> ForecastResponse:
        """
        Executes rolling cash-flow simulation using either real persisted database records
        or isolated synthetic demo fixtures when explicitly selected.
        """
        ref_date = date.today()
        if req.start_date:
            try:
                ref_date = date.fromisoformat(req.start_date.strip()[:10])
            except (ValueError, TypeError):
                ref_date = date.today()

        business_id = req.business_id or "apex_precision_mfg"

        # Check if business exists in DB
        biz = db.query(BusinessModel).filter_by(id=business_id).first()

        # Determine whether to run in synthetic demo mode
        is_demo_persona = business_id in ("apex_precision_mfg", "biz_mfg_01", "biz_srv_02", "biz_ret_03")
        is_demo_mode = req.use_sample_data or (biz and biz.is_demo) or (is_demo_persona and not biz)

        if is_demo_mode:
            sample_cash, sample_rec, sample_out = get_sample_forecast_dataset(
                start_date=ref_date, persona_id=business_id
            )
            starting_cash = req.starting_cash if req.starting_cash is not None else sample_cash
            receivables = (
                [r.model_dump() for r in req.receivables]
                if req.receivables is not None
                else sample_rec
            )
            outflows = (
                [o.model_dump() for o in req.outflows]
                if req.outflows is not None
                else sample_out
            )

            warnings = [
                "DEMO_DATA: Forecast generated using synthetic sample enterprise profiles.",
                "ISOLATED_ENVIRONMENT: Results are simulated for demonstration purposes only.",
            ]
            assumptions = [
                "Synthetic demo business persona (Apex Precision Components Pvt Ltd).",
                "Contractual customer receivables modeled under nominal credit terms.",
            ]

            sim_result = simulate_cash_runway(
                starting_balance=starting_cash,
                start_date=ref_date,
                horizon_days=req.horizon_days,
                receivables=receivables,
                outflows=outflows,
                minimum_reserve=req.minimum_reserve,
                data_quality_warnings=warnings,
                assumptions_used=assumptions,
                is_synthetic=True,
            )

            now_utc = datetime.now(timezone.utc).isoformat()
            return ForecastResponse(
                business_id=business_id,
                forecast_generated_at=now_utc,
                start_date=sim_result["start_date"],
                horizon_days=sim_result["horizon_days"],
                starting_cash=sim_result["starting_cash"],
                closing_cash=sim_result["closing_cash"],
                total_inflows=sim_result["total_inflows"],
                total_outflows=sim_result["total_outflows"],
                net_change=sim_result["net_change"],
                minimum_projected_balance=sim_result["minimum_projected_balance"],
                minimum_reserve=sim_result["minimum_reserve"],
                first_projected_shortfall_date=sim_result["first_projected_shortfall_date"],
                first_reserve_breach_date=sim_result["first_reserve_breach_date"],
                negative_cash_days_count=sim_result["negative_cash_days_count"],
                days_below_reserve_count=sim_result["days_below_reserve_count"],
                runway_days=sim_result["runway_days"],
                is_probabilistic=sim_result["is_probabilistic"],
                is_synthetic=True,
                data_quality_warnings=sim_result["data_quality_warnings"],
                assumptions_used=sim_result["assumptions_used"],
                daily_projections=sim_result["daily_projections"],
            )

        # Allow ad-hoc simulation if custom receivables and outflows are provided directly
        if not biz and (req.receivables is not None or req.outflows is not None):
            sim_result = simulate_cash_runway(
                starting_balance=req.starting_cash or 0.0,
                start_date=ref_date,
                horizon_days=req.horizon_days,
                receivables=[r.model_dump() for r in req.receivables] if req.receivables else [],
                outflows=[o.model_dump() for o in req.outflows] if req.outflows else [],
                minimum_reserve=req.minimum_reserve,
                data_quality_warnings=["AD_HOC_SIMULATION: Running unpersisted custom receivables and outflows."],
                is_synthetic=False,
            )
            now_utc = datetime.now(timezone.utc).isoformat()
            return ForecastResponse(
                business_id=business_id,
                forecast_generated_at=now_utc,
                start_date=sim_result["start_date"],
                horizon_days=sim_result["horizon_days"],
                starting_cash=sim_result["starting_cash"],
                closing_cash=sim_result["closing_cash"],
                total_inflows=sim_result["total_inflows"],
                total_outflows=sim_result["total_outflows"],
                net_change=sim_result["net_change"],
                minimum_projected_balance=sim_result["minimum_projected_balance"],
                minimum_reserve=sim_result["minimum_reserve"],
                first_projected_shortfall_date=sim_result["first_projected_shortfall_date"],
                first_reserve_breach_date=sim_result["first_reserve_breach_date"],
                negative_cash_days_count=sim_result["negative_cash_days_count"],
                days_below_reserve_count=sim_result["days_below_reserve_count"],
                runway_days=sim_result["runway_days"],
                is_probabilistic=False,
                is_synthetic=False,
                data_quality_warnings=sim_result["data_quality_warnings"],
                assumptions_used=sim_result["assumptions_used"],
                daily_projections=sim_result["daily_projections"],
            )

        # Real registered business workflow
        if not biz:
            raise NotFoundException(f"Business '{business_id}' does not exist.")

        data_warnings: List[str] = []
        assumptions: List[str] = [
            f"Enterprise: {biz.legal_name} ({biz.currency}).",
            "Receipts projected on contractual or expected payment dates.",
            "Committed vendor bills and active recurring expenses scheduled on due dates.",
        ]
        if req.minimum_reserve > 0:
            assumptions.append(f"Configured minimum cash reserve cushion: ₹{req.minimum_reserve:,.2f}.")

        # 1. Starting cash calculation from accounts and settled transactions
        accounts = db.query(BankAccountModel).filter_by(business_id=biz.id).all()
        if not accounts:
            data_warnings.append("NO_BANK_ACCOUNT: No bank accounts configured. Opening balance cannot be reconciled.")
            opening_cash = Decimal("0.00")
        else:
            verified_accs = [a for a in accounts if a.is_verified]
            if verified_accs:
                opening_cash = sum((a.opening_balance for a in verified_accs), Decimal("0.00"))
            else:
                data_warnings.append("UNVERIFIED_OPENING_BALANCE: Bank accounts have unverified opening balances.")
                opening_cash = sum((a.opening_balance for a in accounts), Decimal("0.00"))

        # Add settled transactions up to ref_date
        settled_net = (
            db.query(func.coalesce(func.sum(BankTransactionModel.amount), Decimal("0.00")))
            .filter(
                BankTransactionModel.business_id == biz.id,
                BankTransactionModel.transaction_date <= ref_date,
            )
            .scalar()
        )
        reconciled_opening_cash = float(opening_cash + Decimal(str(settled_net)))

        if req.starting_cash is not None:
            reconciled_opening_cash = float(req.starting_cash)
            assumptions.append(f"Opening cash explicitly overridden by user to ₹{reconciled_opening_cash:,.2f}.")

        # 2. Invoices (receivables)
        if req.receivables is not None:
            receivables = [r.model_dump() for r in req.receivables]
            assumptions.append("Custom receivables provided in forecast request override database invoice records.")
        else:
            invoices = (
                db.query(CustomerInvoiceModel)
                .filter(
                    CustomerInvoiceModel.business_id == biz.id,
                    CustomerInvoiceModel.status.in_(["unpaid", "partially_paid"]),
                )
                .all()
            )
            receivables = []
            for inv in invoices:
                outstanding = inv.amount - inv.paid_amount
                if outstanding > 0:
                    receivables.append({
                        "id": inv.id,
                        "customer_name": inv.customer_name,
                        "amount": float(outstanding),
                        "due_date": inv.due_date.isoformat(),
                        "expected_payment_date": (
                            inv.expected_payment_date.isoformat()
                            if inv.expected_payment_date
                            else inv.due_date.isoformat()
                        ),
                        "status": inv.status,
                        "paid_amount": 0.0,
                    })

        # 3. Payables (outflows)
        if req.outflows is not None:
            outflows = [o.model_dump() for o in req.outflows]
            assumptions.append("Custom outflows provided in forecast request override database bill records.")
        else:
            bills = (
                db.query(VendorBillModel)
                .filter(
                    VendorBillModel.business_id == biz.id,
                    VendorBillModel.status.in_(["unpaid", "partially_paid"]),
                )
                .all()
            )
            outflows = []
            for b in bills:
                outstanding = b.amount - b.paid_amount
                if outstanding > 0:
                    outflows.append({
                        "id": b.id,
                        "title": f"Bill #{b.bill_number}: {b.vendor_name}",
                        "amount": float(outstanding),
                        "due_date": b.due_date.isoformat(),
                        "category": b.category,
                        "priority": b.priority,
                    })

            # 4. Active recurring operating expenses (payroll, rent, etc.)
            expenses = (
                db.query(OperatingExpenseModel)
                .filter_by(business_id=biz.id, is_active=True)
                .all()
            )
            for exp in expenses:
                # Project monthly occurrences across horizon
                for day_offset in range(req.horizon_days):
                    target_dt = ref_date + timedelta(days=day_offset)
                    # Check if target_dt matches day_of_month
                    max_days = monthrange(target_dt.year, target_dt.month)[1]
                    effective_day = min(exp.day_of_month, max_days)
                    if target_dt.day == effective_day:
                        outflows.append({
                            "id": f"rec_{exp.id}_{target_dt.isoformat()}",
                            "title": exp.title,
                            "amount": float(exp.amount),
                            "due_date": target_dt.isoformat(),
                            "category": exp.category,
                            "priority": "critical" if exp.category in ("payroll", "rent") else "normal",
                        })

        # Data quality checks
        total_txns = db.query(BankTransactionModel).filter_by(business_id=biz.id).count()
        if total_txns == 0:
            data_warnings.append("ZERO_TRANSACTION_HISTORY: No historical bank transactions imported. Model accuracy cannot be backtested.")

        if len(accounts) == 0 and len(receivables) == 0 and len(outflows) == 0 and total_txns == 0:
            data_warnings.append("EMPTY_LEDGER: No imported statement transactions, invoices, or vendor bills found for this business. Import a bank CSV statement or enter customer invoices to generate a predictive cash-flow forecast.")

        sim_result = simulate_cash_runway(
            starting_balance=reconciled_opening_cash,
            start_date=ref_date,
            horizon_days=req.horizon_days,
            receivables=receivables,
            outflows=outflows,
            minimum_reserve=req.minimum_reserve,
            data_quality_warnings=data_warnings,
            assumptions_used=assumptions,
            is_synthetic=False,
        )

        now_utc = datetime.now(timezone.utc).isoformat()

        return ForecastResponse(
            business_id=biz.id,
            forecast_generated_at=now_utc,
            start_date=sim_result["start_date"],
            horizon_days=sim_result["horizon_days"],
            starting_cash=sim_result["starting_cash"],
            closing_cash=sim_result["closing_cash"],
            total_inflows=sim_result["total_inflows"],
            total_outflows=sim_result["total_outflows"],
            net_change=sim_result["net_change"],
            minimum_projected_balance=sim_result["minimum_projected_balance"],
            minimum_reserve=sim_result["minimum_reserve"],
            first_projected_shortfall_date=sim_result["first_projected_shortfall_date"],
            first_reserve_breach_date=sim_result["first_reserve_breach_date"],
            negative_cash_days_count=sim_result["negative_cash_days_count"],
            days_below_reserve_count=sim_result["days_below_reserve_count"],
            runway_days=sim_result["runway_days"],
            is_probabilistic=False,
            is_synthetic=False,
            data_quality_warnings=sim_result["data_quality_warnings"],
            assumptions_used=sim_result["assumptions_used"],
            daily_projections=sim_result["daily_projections"],
        )

    def simulate_scenario(
        self,
        req: ScenarioSimulationRequest,
        db: Session,
    ) -> ScenarioSimulationResponse:
        """
        Executes a comparative scenario simulation applying shocks against the baseline forecast.
        """
        ref_date = date.today()
        now_utc = datetime.now(timezone.utc).isoformat()
        business_id = req.business_id or "apex_precision_mfg"

        # Check DB
        biz = db.query(BusinessModel).filter_by(id=business_id).first()
        is_demo_mode = req.use_sample_data or (biz and biz.is_demo) or (not biz)

        if is_demo_mode:
            sample_cash, sample_rec, sample_out = get_sample_forecast_dataset(
                start_date=ref_date,
                persona_id=req.persona_id or business_id,
            )
            sim_res = simulate_scenario(
                starting_balance=sample_cash,
                start_date=ref_date,
                horizon_days=req.horizon_days,
                receivables=sample_rec,
                outflows=sample_out,
                minimum_reserve=req.minimum_reserve,
                buyer_delay_days=req.buyer_delay_days,
                sales_drop_percent=req.sales_drop_percent,
                surprise_expense=req.surprise_expense,
                surprise_expense_day=req.surprise_expense_day,
                is_synthetic=True,
            )
        else:
            # Build from real DB records
            accounts = db.query(BankAccountModel).filter_by(business_id=biz.id).all()
            verified_opening = float(sum(a.opening_balance for a in accounts if a.is_verified))
            txns = db.query(BankTransactionModel).filter_by(business_id=biz.id).all()
            net_movement = sum((t.amount for t in txns), Decimal("0.00"))
            reconciled_opening_cash = float(Decimal(str(verified_opening)) + net_movement)

            # Invoices
            unpaid_invoices = (
                db.query(CustomerInvoiceModel)
                .filter(
                    CustomerInvoiceModel.business_id == biz.id,
                    CustomerInvoiceModel.status.in_(["unpaid", "partially_paid"]),
                )
                .all()
            )
            real_rec = [
                {
                    "id": inv.id,
                    "customer_name": inv.customer_name,
                    "amount": float(inv.amount),
                    "paid_amount": float(inv.paid_amount),
                    "due_date": inv.due_date.isoformat(),
                    "expected_payment_date": (
                        inv.expected_payment_date.isoformat()
                        if inv.expected_payment_date
                        else inv.due_date.isoformat()
                    ),
                    "status": inv.status,
                }
                for inv in unpaid_invoices
            ]

            # Bills & Opex
            unpaid_bills = (
                db.query(VendorBillModel)
                .filter(
                    VendorBillModel.business_id == biz.id,
                    VendorBillModel.status.in_(["unpaid", "partially_paid"]),
                )
                .all()
            )
            real_out = [
                {
                    "id": b.id,
                    "title": f"Bill {b.bill_number}: {b.vendor_name}",
                    "amount": float(b.amount),
                    "paid_amount": float(b.paid_amount),
                    "due_date": b.due_date.isoformat(),
                    "category": "vendor",
                    "priority": "critical" if b.is_essential else "normal",
                }
                for b in unpaid_bills
            ]

            sim_res = simulate_scenario(
                starting_balance=reconciled_opening_cash,
                start_date=ref_date,
                horizon_days=req.horizon_days,
                receivables=real_rec,
                outflows=real_out,
                minimum_reserve=req.minimum_reserve,
                buyer_delay_days=req.buyer_delay_days,
                sales_drop_percent=req.sales_drop_percent,
                surprise_expense=req.surprise_expense,
                surprise_expense_day=req.surprise_expense_day,
                is_synthetic=False,
            )

        baseline_data = sim_res["baseline"]
        scenario_data = sim_res["scenario"]

        baseline_resp = ForecastResponse(
            business_id=business_id,
            forecast_generated_at=now_utc,
            start_date=baseline_data["start_date"],
            horizon_days=baseline_data["horizon_days"],
            starting_cash=baseline_data["starting_cash"],
            closing_cash=baseline_data["closing_cash"],
            total_inflows=baseline_data["total_inflows"],
            total_outflows=baseline_data["total_outflows"],
            net_change=baseline_data["net_change"],
            minimum_projected_balance=baseline_data["minimum_projected_balance"],
            minimum_reserve=baseline_data["minimum_reserve"],
            first_projected_shortfall_date=baseline_data["first_projected_shortfall_date"],
            first_reserve_breach_date=baseline_data["first_reserve_breach_date"],
            negative_cash_days_count=baseline_data["negative_cash_days_count"],
            days_below_reserve_count=baseline_data["days_below_reserve_count"],
            runway_days=baseline_data["runway_days"],
            is_probabilistic=False,
            is_synthetic=is_demo_mode,
            data_quality_warnings=baseline_data["data_quality_warnings"],
            assumptions_used=baseline_data["assumptions_used"],
            daily_projections=baseline_data["daily_projections"],
        )

        scenario_resp = ForecastResponse(
            business_id=business_id,
            forecast_generated_at=now_utc,
            start_date=scenario_data["start_date"],
            horizon_days=scenario_data["horizon_days"],
            starting_cash=scenario_data["starting_cash"],
            closing_cash=scenario_data["closing_cash"],
            total_inflows=scenario_data["total_inflows"],
            total_outflows=scenario_data["total_outflows"],
            net_change=scenario_data["net_change"],
            minimum_projected_balance=scenario_data["minimum_projected_balance"],
            minimum_reserve=scenario_data["minimum_reserve"],
            first_projected_shortfall_date=scenario_data["first_projected_shortfall_date"],
            first_reserve_breach_date=scenario_data["first_reserve_breach_date"],
            negative_cash_days_count=scenario_data["negative_cash_days_count"],
            days_below_reserve_count=scenario_data["days_below_reserve_count"],
            runway_days=scenario_data["runway_days"],
            is_probabilistic=False,
            is_synthetic=is_demo_mode,
            data_quality_warnings=scenario_data["data_quality_warnings"],
            assumptions_used=scenario_data["assumptions_used"],
            daily_projections=scenario_data["daily_projections"],
        )

        return ScenarioSimulationResponse(
            baseline=baseline_resp,
            scenario=scenario_resp,
            risk_comparison=RiskComparisonMetrics(**sim_res["risk_comparison"]),
            shocks_applied=ScenarioShocksApplied(**sim_res["shocks_applied"]),
        )



cashflow_service = CashflowService()
