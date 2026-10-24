import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Download, Share2, Info, ArrowRight, Printer } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useBusiness } from "../../context/BusinessContext";
import { ActionItem } from "../actions/ActActionsPage";

export const PlanPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBusinessId } = useBusiness();
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);

  // Retrieve chosen action or default
  const storedPlan = sessionStorage.getItem("kosha_chosen_plan");
  const plan: ActionItem = storedPlan
    ? JSON.parse(storedPlan)
    : {
        id: "act-1",
        badge: "#1 Recommended",
        category: "discount",
        title: "Offer a 2% early-payment discount on Invoice #112",
        categoryLabel: "Offer early-payment discount",
        cashFlowImpact: "+₹1,37,200 liquidity accelerated by 18 days",
        riskShift: "Risk 71% → 34%",
        cost: "₹2,800 discount cost",
        relationshipCost: "Low",
        relationshipNotes: "Builds buyer goodwill through a structured commercial win-win incentive.",
        assumptions: "Main buyer finance team accepts standard 2/10 net 30 prompt clearance.",
        practicalSteps: [
          "Issue revised early settlement credit note of 2% (₹2,800) to Accounts Payable.",
          "Request direct NEFT/RTGS bank remittance confirmation within 5 business days.",
          "Record invoice settlement in Kosha ledger to clear the projected shortfall zone.",
        ],
      };

  const handleDownloadCsv = () => {
    const csvRows = [
      ["Plan_Property", "Value"],
      ["Business_Entity", `"${activeBusinessId || 'apex_precision_mfg'}"`],
      ["Action_Title", `"${plan.title.replace(/"/g, '""')}"`],
      ["Category", `"${plan.categoryLabel.replace(/"/g, '""')}"`],
      ["Risk_Shift", `"${plan.riskShift.replace(/"/g, '""')}"`],
      ["Financial_Cost", `"${plan.cost.replace(/"/g, '""')}"`],
      ["Relationship_Cost", `"${plan.relationshipCost}"`],
      ["Cash_Flow_Impact", `"${plan.cashFlowImpact.replace(/"/g, '""')}"`],
      ["Assumptions_Caveats", `"${plan.assumptions.replace(/"/g, '""')}"`],
      ["Step_1", `"${(plan.practicalSteps[0] || '').replace(/"/g, '""')}"`],
      ["Step_2", `"${(plan.practicalSteps[1] || '').replace(/"/g, '""')}"`],
      ["Step_3", `"${(plan.practicalSteps[2] || '').replace(/"/g, '""')}"`],
      ["Formulated_At", `"${new Date().toISOString()}"`],
      ["Status", "Formulated - Pending Management Execution"],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kosha_action_plan_${activeBusinessId || 'apex'}_${plan.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handleShareSummary = async () => {
    const summaryText = `KOSHA Treasury Action Plan:\nAction: ${plan.title}\nImpact: ${plan.cashFlowImpact}\nRisk Shift: ${plan.riskShift}\nEstimated Cost: ${plan.cost}\nRelationship Impact: ${plan.relationshipCost}\nAssumptions: ${plan.assumptions}\nExecution Steps:\n1. ${plan.practicalSteps[0] || ''}\n2. ${plan.practicalSteps[1] || ''}\n3. ${plan.practicalSteps[2] || ''}`;
    try {
      await navigator.clipboard.writeText(summaryText);
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = summaryText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleStartOver = () => {
    sessionStorage.removeItem("kosha_chosen_plan");
    sessionStorage.removeItem("kosha_active_scenario");
    navigate("/load");
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col justify-between py-2">
      {/* Centered Main Glass Card */}
      <div className="glass-panel rounded-4xl p-8 sm:p-12 shadow-glass-lg text-center flex flex-col items-center">
        {/* Blue Circular Checkmark Icon */}
        <div className="w-16 h-16 rounded-full border-2 border-kosha-blue bg-blue-50/70 flex items-center justify-center text-kosha-blue mb-5 shadow-xs print:hidden">
          <Check className="w-8 h-8 stroke-[3]" />
        </div>

        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue mb-2.5 print:hidden">
          Step 5 · {t("step5")}
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-kosha-navy tracking-tight">
          {t("planHeading")}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-2 font-medium max-w-xl">
          {plan.title}
        </p>

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-7">
          <div className="bg-white/85 rounded-3xl p-5 border border-white/90 shadow-xs text-left">
            <span className="text-xs font-semibold text-slate-400 block">{t("cashFlowImpact")}</span>
            <div className="text-xl font-extrabold text-kosha-blue mt-1">
              {plan.cashFlowImpact.split(" liquidity")[0] || plan.cashFlowImpact}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Net liquidity recovery</span>
          </div>

          <div className="bg-white/85 rounded-3xl p-5 border border-white/90 shadow-xs text-left">
            <span className="text-xs font-semibold text-slate-400 block">{t("riskShift")}</span>
            <div className="text-xl font-extrabold text-kosha-navy mt-1">
              {plan.riskShift.replace("Risk ", "")}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Projected probability shift</span>
          </div>

          <div className="bg-white/85 rounded-3xl p-5 border border-white/90 shadow-xs text-left">
            <span className="text-xs font-semibold text-slate-400 block">{t("estimatedCost")}</span>
            <div className="text-xl font-extrabold text-kosha-navy mt-1">
              {plan.cost.split(" ")[0]}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Direct implementation fee</span>
          </div>
        </div>

        {/* Implementation Steps Card */}
        <div className="bg-white/90 rounded-3xl p-6 sm:p-7 border border-white/90 shadow-xs text-left w-full mt-6 space-y-4">
          <div>
            <span className="text-xs font-bold text-kosha-navy uppercase tracking-wider block mb-3">
              {t("practicalSteps")}
            </span>
            <div className="space-y-2 text-xs text-slate-700">
              {plan.practicalSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-kosha-blue font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assumptions & Caveats */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700">Assumptions & Caveats:</span> {plan.assumptions}
              <div className="mt-1 text-slate-400">
                Notice: Plan formulated for management review. Selecting this recommendation does not automatically debit or disburse funds from your bank account.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-7 w-full sm:w-auto print:hidden">
          <button
            onClick={handleDownloadCsv}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{downloaded ? "CSV Downloaded!" : t("exportCsv")}</span>
          </button>

          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-white/90 hover:bg-white border border-slate-200 text-kosha-navy text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4 text-kosha-blue" />
            <span>Print Action Plan</span>
          </button>

          <button
            onClick={handleShareSummary}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-white/90 hover:bg-white border border-slate-200 text-kosha-navy text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span>{shared ? "Summary Copied!" : t("shareSummary")}</span>
          </button>
        </div>
      </div>

      {/* Bottom Bar: Back & Start Over */}
      <div className="flex items-center justify-between mt-6 px-2 print:hidden">
        <button
          onClick={() => navigate("/compare-actions")}
          className="px-6 py-2.5 rounded-full bg-white/80 hover:bg-white text-sm font-bold text-kosha-navy border border-white/80 shadow-xs transition-colors"
        >
          {t("backCompareActions")}
        </button>

        <button
          onClick={handleStartOver}
          className="px-6 py-2.5 rounded-full bg-white/80 hover:bg-white text-sm font-bold text-kosha-navy border border-white/80 shadow-xs transition-colors flex items-center gap-1.5"
        >
          <span>{t("startOverLoadData")}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
