import React from "react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export const ActionsPage: React.FC = () => {
  const rankedActions = [
    {
      id: "act_1",
      title: "Offer 2% Quick-Pay Discount on Invoice #091",
      category: "Receivable Acceleration",
      yieldInr: 313600,
      daysToCash: 2,
      costInr: 6400,
      priority: "HIGH",
      summary: "Incentivize Tier-1 buyer to clear pending payment early, averting payroll shortfall.",
    },
    {
      id: "act_2",
      title: "Defer CNC Lathe Preventive Capex",
      category: "Outflow Postponement",
      yieldInr: 85000,
      daysToCash: 1,
      costInr: 0,
      priority: "MEDIUM",
      summary: "Reschedule discretionary maintenance past month-end GST filing date.",
    },
    {
      id: "act_3",
      title: "Issue Formal MSMED Notice for 45+ Day Overdue Invoice",
      category: "Legal Recovery",
      yieldInr: 195000,
      daysToCash: 14,
      costInr: 0,
      priority: "HIGH",
      summary: "Leverage statutory 3x bank rate compound interest notice under MSMED Act Section 16.",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Act — Corrective Actions</h1>
            <Badge variant="info">Phase 2 Reserved</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Prioritized interventions to defend your cash runway ranked by yield, speed, and cost.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {rankedActions.map((action, idx) => (
          <Card key={action.id} className="p-5 hover:border-slate-300 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">#0{idx + 1}</span>
                  <h3 className="font-semibold text-slate-900 text-sm">{action.title}</h3>
                  <Badge variant={action.priority === "HIGH" ? "success" : "neutral"}>
                    {action.priority} Priority
                  </Badge>
                </div>
                <p className="text-xs text-slate-600">{action.summary}</p>
                <div className="text-[11px] text-slate-400 font-medium">
                  Category: {action.category}
                </div>
              </div>

              {/* Action Metrics */}
              <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Liquidity Yield</div>
                  <div className="text-sm font-bold text-emerald-700">₹ {action.yieldInr.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Speed</div>
                  <div className="text-sm font-bold text-slate-800">{action.daysToCash} Days</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Cost</div>
                  <div className="text-sm font-bold text-slate-800">₹ {action.costInr.toLocaleString("en-IN")}</div>
                </div>
                <Button variant="secondary" size="sm" disabled>
                  Simulate Impact
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
