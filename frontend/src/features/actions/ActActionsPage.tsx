import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, HeartHandshake, AlertCircle, Info, ArrowRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useBusiness } from "../../context/BusinessContext";
import { apiClient } from "../../lib/api";

export interface ActionItem {
  id: string;
  badge: string;
  category: "discount" | "supplier_extension" | "chase_debtor" | "defer_expense";
  title: string;
  categoryLabel: string;
  whyRecommended: string;
  cashFlowImpact: string;
  riskShift: string;
  cost: string;
  relationshipCost: "Low" | "Medium" | "High";
  relationshipNotes: string;
  assumptions: string;
  practicalSteps: string[];
}

export const ActActionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBusinessId } = useBusiness();
  const [selectedActionId, setSelectedActionId] = useState<string>("act-1");
  const [actions, setActions] = useState<ActionItem[]>([
    {
      id: "act-1",
      badge: "#1 Recommended",
      category: "discount",
      title: "Offer a 2% early-payment discount on Invoice #112",
      categoryLabel: "Offer early-payment discount",
      whyRecommended: "Achieves the fastest liquidity acceleration (+₹1.37L in 18 days) with low counterparty friction and minimal financial cost (₹2,800).",
      cashFlowImpact: "+₹1,37,200 liquidity accelerated by 18 days",
      riskShift: "Risk 71% → 34%",
      cost: "₹2,800 discount cost",
      relationshipCost: "Low",
      relationshipNotes: "Positive commercial incentive that builds buyer goodwill.",
      assumptions: "Main buyer accounts payable processes payment within 10 days of incentive notice.",
      practicalSteps: [
        "Issue revised early settlement credit note of 2% (₹2,800) to Accounts Payable.",
        "Request direct NEFT/RTGS bank remittance confirmation within 5 business days.",
        "Record invoice settlement in Kosha ledger to clear the projected shortfall zone.",
      ],
    },
    {
      id: "act-2",
      badge: "#2",
      category: "supplier_extension",
      title: "Negotiate a 10-day payment extension with Steel Traders",
      categoryLabel: "Negotiate supplier payment extension",
      whyRecommended: "Defers ₹80,000 outflow past the acute deficit window without any direct cash fee, though requires active supplier agreement.",
      cashFlowImpact: "₹80,000 outflow deferred past liquidity deficit window",
      riskShift: "Risk 71% → 42%",
      cost: "₹0 direct financial cost",
      relationshipCost: "Medium",
      relationshipNotes: "Requires proactive supplier communication; not guaranteed without vendor agreement.",
      assumptions: "Raw material supplier agrees to revised 10-day credit window without interrupting ongoing alloy dispatches.",
      practicalSteps: [
        "Call procurement lead at Steel Traders to propose 10-day staggered settlement.",
        "Commit to firm post-dated payment date following customer invoice clearance.",
        "Reconcile payment voucher in Kosha calendar.",
      ],
    },
    {
      id: "act-3",
      badge: "#3",
      category: "chase_debtor",
      title: "Follow up with Western Auto Assemblers for prompt settlement",
      categoryLabel: "Follow up with customer",
      whyRecommended: "Secures full contract value (+₹1.40L) without discount costs, but persistent debtor follow-up carries relationship friction.",
      cashFlowImpact: "+₹1,40,000 received 7 days earlier",
      riskShift: "Risk 71% → 38%",
      cost: "₹0 direct cost",
      relationshipCost: "High",
      relationshipNotes: "Tier-1 OEM buyers often resist off-cycle collection escalation.",
      assumptions: "Buyer's monthly ERP approval batch cycle allows an off-cycle vendor payment release.",
      practicalSteps: [
        "Draft polite statutory reminder citing MSMED Act Section 15 timeline.",
        "Send reminder directly to corporate finance controller.",
        "Follow up telephonically with vendor desk.",
      ],
    },
    {
      id: "act-4",
      badge: "#4",
      category: "defer_expense",
      title: "Defer non-critical CNC tooling spares purchase by 30 days",
      categoryLabel: "Reduce or defer discretionary expense",
      whyRecommended: "Zero-cost internal capex deferral preserving ₹45,000 in liquid reserve, though with lesser overall risk reduction.",
      cashFlowImpact: "₹45,000 cash conserved during high-risk period",
      riskShift: "Risk 71% → 56%",
      cost: "₹0 direct cost",
      relationshipCost: "Low",
      relationshipNotes: "Purely internal decision with zero external counterparty impact.",
      assumptions: "Current machine inventory operates reliably without unscheduled maintenance disruption.",
      practicalSteps: [
        "Inform factory shop-floor manager to utilize buffer tooling stock.",
        "Postpone purchase requisition approval to next month's cash cycle.",
        "Unfreeze order once reserve balance exceeds ₹1,50,000 threshold.",
      ],
    },
  ]);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getRankedActions({
        business_id: activeBusinessId || "apex_precision_mfg",
        shortfall_amount: 65000,
        days_until_shortfall: 18,
        baseline_risk_pct: 71,
      })
      .then((res) => {
        if (isMounted && res && res.actions && res.actions.length > 0) {
          const mapped: ActionItem[] = res.actions.map((a) => ({
            id: a.id,
            badge: a.badge,
            category: a.category,
            title: a.title,
            categoryLabel: a.category_label,
            whyRecommended: a.why_recommended,
            cashFlowImpact: a.cash_flow_impact,
            riskShift: a.risk_shift,
            cost: a.cost,
            relationshipCost: a.relationship_cost,
            relationshipNotes: a.relationship_notes,
            assumptions: a.assumptions,
            practicalSteps: a.practical_steps,
          }));
          setActions(mapped);
          if (mapped[0]) setSelectedActionId(mapped[0].id);
        }
      })
      .catch(() => {
        // Fallback to default presets
      });

    return () => {
      isMounted = false;
    };
  }, [activeBusinessId]);


  const handleNext = () => {
    const chosen = actions.find((a) => a.id === selectedActionId) || actions[0];
    sessionStorage.setItem("kosha_chosen_plan", JSON.stringify(chosen));
    navigate("/action-plan");
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col justify-between py-2">
      {/* Section Header */}
      <div className="mb-6">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue mb-2.5">
          Step 4 · {t("step4")}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-kosha-navy tracking-tight text-center sm:text-left">
          {t("actionsHeading")}
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 font-medium text-center sm:text-left leading-relaxed">
          {t("actionsSubtitle")}
        </p>
      </div>

      {/* Stack of Action Cards */}
      <div className="space-y-4">
        {actions.map((act) => {
          const isSelected = selectedActionId === act.id;
          return (
            <div
              key={act.id}
              onClick={() => setSelectedActionId(act.id)}
              className={`glass-panel rounded-3xl p-6 sm:p-7 transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                isSelected
                  ? "bg-white/95 border-2 border-kosha-blue shadow-glass-lg ring-4 ring-blue-100/60"
                  : "bg-white/70 border border-white/90 hover:bg-white/85"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue">
                      {act.badge}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {act.categoryLabel}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-kosha-navy">{act.title}</h2>
                  <p className="text-xs text-slate-600 font-medium pt-0.5 leading-relaxed">
                    <span className="font-semibold text-slate-700">Why recommended:</span> {act.whyRecommended}
                  </p>
                  <p className="text-xs text-kosha-blue font-semibold pt-0.5">
                    {act.cashFlowImpact}
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedActionId(act.id);
                    }}
                    className={`px-7 py-2.5 rounded-full text-sm font-bold transition-all shadow-xs ${
                      isSelected
                        ? "bg-kosha-blue hover:bg-kosha-deep text-white shadow-md"
                        : "bg-white/90 hover:bg-white border border-slate-200 text-kosha-navy"
                    }`}
                  >
                    {isSelected ? "Selected" : "Choose"}
                  </button>
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Risk Reduction</span>
                    <span className="font-bold text-kosha-navy">{act.riskShift}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Financial Cost</span>
                    <span className="font-bold text-kosha-navy">{act.cost}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <HeartHandshake className="w-4 h-4 text-kosha-blue shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Relationship Impact</span>
                    <span
                      className={`font-bold ${
                        act.relationshipCost === "Low"
                          ? "text-emerald-700"
                          : act.relationshipCost === "Medium"
                          ? "text-amber-700"
                          : "text-rose-700"
                      }`}
                    >
                      {act.relationshipCost} ({act.relationshipNotes})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Advisory Note */}
      <div className="mt-6 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/70 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>
          <strong>Operational Notice:</strong> KOSHA recommends ranked actions for managerial decision support. The application does not automatically contact counterparties, execute legal filings, modify customer invoices, or transfer funds.
        </span>
      </div>

      {/* Bottom Bar: Back & Next */}
      <div className="flex items-center justify-between mt-6 px-2">
        <button
          onClick={() => navigate("/test-scenarios")}
          className="px-6 py-2.5 rounded-full bg-white/80 hover:bg-white text-sm font-bold text-kosha-navy border border-white/80 shadow-xs transition-colors"
        >
          {t("backTestScenarios")}
        </button>

        <button
          onClick={handleNext}
          className="px-8 py-3 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span>{t("nextActionPlan")}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
