import React from "react";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export const ScenariosPage: React.FC = () => {
  const scenarioTemplates = [
    {
      title: "Delayed Key Customer",
      description: "Model what happens if your largest debtor delays payment by 30 or 60 days.",
      impact: "-₹ 2,80,000 liquidity shift",
      risk: "HIGH",
    },
    {
      title: "Sudden Revenue Contraction",
      description: "Simulate an immediate 20% drop in uncommitted monthly receipts.",
      impact: "Runway reduced by 19 days",
      risk: "CRITICAL",
    },
    {
      title: "Unplanned Machinery Breakdown",
      description: "Add an emergency capital expense of ₹ 1,20,000 on Day 15.",
      impact: "Triggers immediate overdraft",
      risk: "MODERATE",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Decide — Scenario Simulator</h1>
            <Badge variant="info">Phase 2 Reserved</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Test business resilience against payment defaults, tax cliffs, and operational shocks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {scenarioTemplates.map((template, idx) => (
          <Card key={idx} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">{template.title}</span>
                <Badge variant={template.risk === "CRITICAL" ? "danger" : "warning"}>
                  {template.risk}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-2">{template.description}</p>
              <div className="mt-4 p-2.5 rounded bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">
                Projected Impact: <span className="text-rose-700">{template.impact}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" className="w-full text-xs justify-between" disabled>
                <span>Configure Stress Test</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center">
          <SlidersHorizontal className="w-8 h-8 text-slate-400 mb-2" />
          <h4 className="font-semibold text-slate-700 text-sm">Interactive Parameter Sliders Planned for Phase 2</h4>
          <p className="max-w-md mt-1">
            Backend logic stubbed in <code>backend.app.domain.scenarios</code> with <code>POST /api/simulate</code> reserved.
          </p>
        </div>
      </Card>
    </div>
  );
};
