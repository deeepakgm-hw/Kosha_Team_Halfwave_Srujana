import React from "react";
import { TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export const ForecastPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">90-Day Cash Forecast</h1>
            <Badge variant="info">Phase 2 Reserved</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Rolling daily liquidity trajectory with stochastic receivables confidence bands.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Calendar className="w-4 h-4 mr-1.5" /> Date Range: Next 90 Days
          </Button>
          <Button variant="outline" size="sm" disabled>
            Export Forecast CSV
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">Forecast Engine Scaffolded</h3>
          <p className="text-sm text-slate-500 max-w-lg mt-2">
            Endpoint <code>POST /api/forecast</code> is reserved in the API contract. In Phase 2, the Recharts multi-line chart will visualize daily opening cash, committed payables, probabilistic receivables, and earliest shortfall alerts.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Synthetic simulation baseline: 450,000 INR opening liquidity.</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
