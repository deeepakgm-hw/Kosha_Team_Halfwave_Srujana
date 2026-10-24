import React from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export const TrustPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trust — Forecast Validation</h1>
            <Badge variant="info">Phase 2 Reserved</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Empirical backtesting engine comparing model projections against historical bank statements.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="text-center p-6">
          <div className="text-3xl font-extrabold text-emerald-600">89.4%</div>
          <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
            Forecast Trust Score
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Weighted composite score based on directional accuracy and 30-day error bounds.
          </p>
        </Card>

        <Card className="text-center p-6">
          <div className="text-3xl font-extrabold text-slate-900">7.2%</div>
          <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
            MAPE (30-Day Window)
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Mean Absolute Percentage Error across reconciled historical cash cycles.
          </p>
        </Card>

        <Card className="text-center p-6">
          <div className="text-3xl font-extrabold text-blue-600">94.1%</div>
          <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider mt-1">
            Shortfall Early Warning Rate
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Successful warnings generated at least 14 days before liquidity dips.
          </p>
        </Card>
      </div>

      <Card>
        <div className="p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">Backtesting Engine Ready for Pipeline Integration</h3>
          <p className="text-sm text-slate-500 max-w-lg mt-2">
            Endpoint <code>POST /api/backtest</code> is reserved. Pure backtest calculation module implemented in <code>backend.app.domain.backtest</code>.
          </p>
          <div className="mt-5">
            <Button variant="outline" size="sm" disabled>
              Run Rolling Backtest (Last 6 Months)
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
