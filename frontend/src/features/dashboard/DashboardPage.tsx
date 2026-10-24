import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  SlidersHorizontal,
  Zap,
  Clock,
  CheckCircle2,
  LineChart,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatINR } from "../../lib/utils";
import { apiClient } from "../../lib/api";
import { ApiHealthResponse } from "../../types/api";
import { useBusiness } from "../../context/BusinessContext";

export const DashboardPage: React.FC = () => {
  const { isDemoMode, activeBusiness, stateSummary } = useBusiness();
  const [healthData, setHealthData] = useState<ApiHealthResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);

  useEffect(() => {
    setIsHealthLoading(true);
    apiClient
      .getHealth()
      .then((data) => setHealthData(data))
      .catch(() => setHealthData(null))
      .finally(() => setIsHealthLoading(false));
  }, []);

  // Compute metrics depending on demo mode vs persistent DB
  const settledCash = isDemoMode
    ? 450000
    : stateSummary
    ? stateSummary.current_cash
    : 0;

  const expectedInflow = isDemoMode
    ? 475000
    : stateSummary
    ? stateSummary.total_unpaid_receivables
    : 0;

  const committedOutflow = isDemoMode
    ? 390000
    : stateSummary
    ? stateSummary.total_unpaid_payables
    : 0;

  const runwayDays = isDemoMode
    ? 64
    : stateSummary && stateSummary.current_cash > 0 && committedOutflow > 0
    ? Math.round((stateSummary.current_cash / committedOutflow) * 30)
    : 0;

  const isVerified = isDemoMode
    ? true
    : stateSummary?.reconciliation_status === "verified";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Know — Treasury Overview
            </h1>
            {isDemoMode ? (
              <Badge variant="warning">Synthetic Demo Profile</Badge>
            ) : (
              <Badge variant="success">Persistent DB Record</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isDemoMode
              ? "Real-time cash positioning, scheduled commitments, and forward runway projections."
              : `Active ledger balances for ${
                  activeBusiness?.legal_name || "selected business"
                } derived from persistent SQLite records.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/forecast">
            <Button variant="primary" size="sm" className="gap-2">
              <LineChart className="w-4 h-4" /> 90-Day Forecast
            </Button>
          </Link>
          <Link to="/scenarios">
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Simulate Scenario
            </Button>
          </Link>
          <Link to="/actions">
            <Button variant="outline" size="sm" className="gap-2">
              <Zap className="w-4 h-4" /> View Actions
            </Button>
          </Link>
        </div>
      </div>

      {/* Financial Category Distinction Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Actual Cash Received */}
        <Card className="hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Settled Bank Cash</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{formatINR(settledCash)}</div>
            <p
              className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                isVerified ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {isVerified ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled Balance
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Unverified Opening
                </>
              )}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            {isDemoMode
              ? "Liquid balance across verified accounts"
              : `${stateSummary?.imported_transactions_count || 0} imported statement transactions`}
          </div>
        </Card>

        {/* 2. Expected Inflow */}
        <Card className="hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Expected Inflows (30d)</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-700">{formatINR(expectedInflow)}</div>
            <p className="text-xs text-slate-500 mt-1">
              {isDemoMode
                ? "Weighted probability: 78%"
                : `${stateSummary?.active_invoices_count || 0} active customer invoices`}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Contractual receivables pending collection
          </div>
        </Card>

        {/* 3. Committed Outflows */}
        <Card className="hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Committed Dues (30d)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-700">{formatINR(committedOutflow)}</div>
            <p className="text-xs text-slate-500 mt-1">
              {isDemoMode
                ? "Payroll, Rent & Statutory"
                : `${stateSummary?.active_bills_count || 0} vendor bills & recurring expenses`}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Strict contractual & legal deadlines
          </div>
        </Card>

        {/* 4. Runway & Shortfall Risk */}
        <Card className="hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Estimated Runway</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{runwayDays} Days</div>
            <div className="mt-1">
              <Badge variant={runwayDays > 30 ? "success" : "warning"}>
                {runwayDays > 30 ? "Comfortable Buffer" : "Attention Required"}
              </Badge>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Calculated against committed monthly burn
          </div>
        </Card>
      </div>

      {/* 90-Day Trajectory Overview & Category Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center justify-between">
                <span>90-Day Predictive Cash Trajectory</span>
                <span className="text-xs font-normal text-slate-500">Rolling Daily Forecast</span>
              </div>
            }
          >
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                <Wallet className="w-5 h-5" />
              </div>
              <p className="font-semibold text-sm text-slate-800">
                Deterministic 90-Day Rolling Simulation
              </p>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Deterministic daily liquidity simulation powered by <code>POST /api/forecast</code>.
                View rolling closing balances, zero-cash reference thresholds, reserve alerts, and
                shortfall warnings.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Link to="/forecast">
                  <Button variant="primary" size="sm">
                    Open Interactive Forecast
                  </Button>
                </Link>
              </div>
            </div>

            {/* Category Distinction Explanation Footer */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-start gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700">Settled Cash:</span>
                  <p className="text-slate-500 text-[11px]">Historical cleared funds in bank.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700">Expected Inflow:</span>
                  <p className="text-slate-500 text-[11px]">Uncollected invoices with delay weighting.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700">Committed Dues:</span>
                  <p className="text-slate-500 text-[11px]">
                    Fixed payroll, tax & contractual vendor dues.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Backend Connection Status Card */}
        <div className="space-y-6">
          <Card
            header={
              <div className="flex items-center justify-between">
                <span>FastAPI Service Health</span>
                <Badge variant={healthData ? "success" : "danger"}>
                  {healthData ? "Online" : "Connecting"}
                </Badge>
              </div>
            }
          >
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Service:</span>
                <span className="font-medium text-slate-800">
                  {healthData?.app_name || "KOSHA Backend"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Version:</span>
                <span className="font-mono text-slate-800">{healthData?.version || "0.1.0"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Active Mode:</span>
                <span className="font-medium text-slate-800">
                  {isDemoMode ? "Synthetic Persona" : "Persistent Database"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Server UTC Time:</span>
                <span className="font-mono text-slate-600 text-[11px]">
                  {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                isLoading={isHealthLoading}
                onClick={() => {
                  setIsHealthLoading(true);
                  apiClient
                    .getHealth()
                    .then((data) => setHealthData(data))
                    .catch(() => setHealthData(null))
                    .finally(() => setIsHealthLoading(false));
                }}
              >
                Refresh Backend Check
              </Button>
            </div>
          </Card>

          {/* MSMED 45-Day Alert Card */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>MSMED 45-Day Protection</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Unpaid invoices past 45 days accrue compound penal interest with monthly rests at 3x the
              RBI Bank Rate under Section 16 of the MSMED Act.
            </p>
            <Link
              to="/receivables"
              className="text-amber-800 font-semibold underline block text-[11px]"
            >
              View receivables ledger & penal interest &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
