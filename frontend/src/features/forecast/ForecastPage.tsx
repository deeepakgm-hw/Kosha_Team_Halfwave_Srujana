import React, { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Info,
  UploadCloud,
  ShieldAlert,
  Sliders,
  Database,
  Building2,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/feedback/LoadingSpinner";
import { ErrorMessage } from "../../components/feedback/ErrorMessage";
import { formatINR, formatDate } from "../../lib/utils";
import { apiClient } from "../../lib/api";
import { ForecastResponse } from "../../types/cashflow";
import { useBusiness } from "../../context/BusinessContext";
import { StatementImportModal } from "../statements/StatementImportModal";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      starting_cash: number;
      expected_inflow: number;
      committed_outflow: number;
      net_cash_flow: number;
      ending_cash: number;
      is_shortfall: boolean;
      shortfall_amount: number;
      is_reserve_breach?: boolean;
    };
  }>;
}

const CustomTooltip: React.FC<TooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-xs p-3.5 rounded-lg shadow-lg border border-slate-200 text-xs space-y-1.5 min-w-[210px]">
        <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
          <span>{formatDate(data.date)}</span>
          {data.is_shortfall ? (
            <span className="text-rose-600 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Deficit
            </span>
          ) : data.is_reserve_breach ? (
            <span className="text-amber-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Reserve Dip
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">Solvent</span>
          )}
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-slate-500">Opening Balance:</span>
          <span className="font-medium text-slate-700">{formatINR(data.starting_cash)}</span>
        </div>
        <div className="flex justify-between py-0.5 text-emerald-700">
          <span className="flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3" /> Inflow:
          </span>
          <span className="font-medium">+{formatINR(data.expected_inflow)}</span>
        </div>
        <div className="flex justify-between py-0.5 text-rose-700">
          <span className="flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Outflow:
          </span>
          <span className="font-medium">-{formatINR(data.committed_outflow)}</span>
        </div>
        <div className="flex justify-between py-1 border-t border-slate-100 font-bold">
          <span className="text-slate-800">Closing Balance:</span>
          <span className={data.ending_cash < 0 ? "text-rose-600" : "text-emerald-700"}>
            {formatINR(data.ending_cash)}
          </span>
        </div>
        {data.is_shortfall && (
          <div className="text-[11px] text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-100 font-medium text-center">
            Deficit: {formatINR(data.shortfall_amount)}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const ForecastPage: React.FC = () => {
  const { isDemoMode, activeBusinessId, activeBusiness, setIsDemoMode } = useBusiness();
  const [horizon, setHorizon] = useState<number>(90);
  const [minimumReserve, setMinimumReserve] = useState<number>(50000);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [showReserveInput, setShowReserveInput] = useState<boolean>(false);

  const fetchForecast = useCallback(
    async (horizonDays: number, reserveAmount: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.getForecast({
          business_id: isDemoMode ? "apex_precision_mfg" : activeBusinessId || undefined,
          horizon_days: horizonDays,
          minimum_reserve: reserveAmount,
          use_sample_data: isDemoMode,
        });
        setForecastData(response);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load forecast data";
        setError(msg);
        setForecastData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [isDemoMode, activeBusinessId]
  );

  useEffect(() => {
    fetchForecast(horizon, minimumReserve);
  }, [horizon, minimumReserve, fetchForecast]);

  const hasShortfall = Boolean(forecastData?.first_projected_shortfall_date);
  const hasReserveBreach = Boolean(forecastData?.first_reserve_breach_date);
  const hasWarnings = Boolean(
    forecastData?.data_quality_warnings && forecastData.data_quality_warnings.length > 0
  );

  // Check if real business has no data recorded
  const isLedgerEmpty =
    !isDemoMode &&
    forecastData &&
    forecastData.starting_cash === 0 &&
    forecastData.total_inflows === 0 &&
    forecastData.total_outflows === 0 &&
    forecastData.data_quality_warnings?.includes("EMPTY_LEDGER");

  // Transform daily projection data for Recharts display
  const chartData = (forecastData?.daily_projections || []).map((pt) => ({
    ...pt,
    formattedDate: formatDate(pt.date).replace(" 2026", ""),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {horizon}-Day Rolling Cash Forecast
            </h1>
            <Badge variant="neutral">Deterministic Simulation</Badge>
            {isDemoMode ? (
              <Badge variant="warning">Synthetic Profile</Badge>
            ) : (
              <Badge variant="success">Persistent DB Record</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isDemoMode
              ? "Reconciling synthetic receivables and contractual dues for Apex Precision Components."
              : `Derived from persisted statement batches, customer invoices, and operating expenses for ${
                  activeBusiness?.legal_name || "selected business"
                }.`}
          </p>
        </div>

        {/* Toolbar: Horizon, Reserve threshold, CSV Import, Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Horizon switcher */}
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center gap-1 text-xs font-medium">
            {[30, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setHorizon(days)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  horizon === days
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>

          {/* Config Reserve button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReserveInput(!showReserveInput)}
            className="gap-1.5"
            title="Configure Minimum Reserve Cushion"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs">Reserve: ₹{(minimumReserve / 1000).toFixed(0)}k</span>
          </Button>

          {/* Import CSV button for real business */}
          {!isDemoMode && activeBusinessId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import CSV</span>
            </Button>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchForecast(horizon, minimumReserve)}
            disabled={isLoading}
            className="gap-1.5"
            title="Refresh forecast projection"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Reserve Configuration Drawer */}
      {showReserveInput && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="font-semibold text-slate-800">Minimum Cash Reserve Target:</span>
              <p className="text-slate-500 text-[11px]">
                KOSHA triggers early warnings before your balance falls below this safety cushion.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">₹</span>
            <input
              type="number"
              step="5000"
              min="0"
              value={minimumReserve}
              onChange={(e) => setMinimumReserve(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-32 border border-slate-300 rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchForecast(horizon, minimumReserve)}
            >
              Apply Target
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <LoadingSpinner
            label={`Calculating ${horizon}-day rolling cash-flow trajectory...`}
            size="lg"
          />
        </Card>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <ErrorMessage
          title="Forecasting Error"
          message={error}
          onRetry={() => fetchForecast(horizon, minimumReserve)}
        />
      )}

      {/* First-Run Empty State for Real Persistent Business */}
      {!isLoading && isLedgerEmpty && (
        <Card className="p-8 text-center border-dashed border-2 border-slate-300">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <Database className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No Financial Records Found</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            This enterprise workspace has no verified bank statements, invoices, or operating
            expenses in the database yet. Import your first bank CSV statement to begin forecasting.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-2"
            >
              <UploadCloud className="w-4 h-4" /> Import Bank Statement CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDemoMode(true)}
              className="gap-2"
            >
              <Building2 className="w-4 h-4" /> Switch to Demo Mode
            </Button>
          </div>
        </Card>
      )}

      {/* Success View */}
      {!isLoading && forecastData && !isLedgerEmpty && (
        <>
          {/* Data Quality Warnings Banner */}
          {hasWarnings && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 flex items-start gap-3 shadow-xs">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h3 className="font-bold text-amber-900">Data Reliability & Quality Advisories</h3>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
                  {forecastData.data_quality_warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
                {forecastData.assumptions_used && forecastData.assumptions_used.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200 text-amber-900 text-[11px]">
                    <strong>Assumptions applied:</strong> {forecastData.assumptions_used.join(" • ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shortfall Alert or Reserve Breach or Solvent Banner */}
          {hasShortfall ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 text-rose-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-rose-900">
                    Projected Cash Shortfall Alert
                  </h3>
                  <Badge variant="danger">Action Required</Badge>
                </div>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  Cash balance is projected to dip below zero on{" "}
                  <strong>{formatDate(forecastData.first_projected_shortfall_date!)}</strong>.
                  Projected deficit reaches{" "}
                  <strong className="text-rose-900">
                    {formatINR(forecastData.minimum_projected_balance)}
                  </strong>
                  . A total of <strong>{forecastData.negative_cash_days_count} days</strong> are
                  projected in negative liquidity without corrective action.
                </p>
              </div>
            </div>
          ) : hasReserveBreach ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-amber-900">
                    Minimum Reserve Breach Warning
                  </h3>
                  <Badge variant="warning">Reserve Cushion Breached</Badge>
                </div>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Cash remains above zero, but breaches your{" "}
                  <strong>{formatINR(forecastData.minimum_reserve)}</strong> minimum reserve safety
                  threshold starting on{" "}
                  <strong>{formatDate(forecastData.first_reserve_breach_date!)}</strong>. Projected
                  to spend <strong>{forecastData.days_below_reserve_count} days</strong> below
                  reserve.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950 flex items-start gap-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm text-emerald-900">
                  Solvent Cash Runway Projected
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Projected cash balance remains positive and above reserve target throughout all{" "}
                  {horizon} days. Lowest forecasted balance is{" "}
                  {formatINR(forecastData.minimum_projected_balance)}.
                </p>
              </div>
            </div>
          )}

          {/* 5 Key Metric Cards from Real API */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Starting Cash */}
            <Card>
              <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <span>Opening Cash</span>
                <Wallet className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {formatINR(forecastData.starting_cash)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {isDemoMode ? "Settled reconciled funds" : "Verified ledger balance"}
              </div>
            </Card>

            {/* 2. Minimum Projected Balance */}
            <Card>
              <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <span>Minimum Cash</span>
                <TrendingUp
                  className={`w-4 h-4 ${
                    forecastData.minimum_projected_balance < 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                />
              </div>
              <div
                className={`mt-2 text-xl font-bold ${
                  forecastData.minimum_projected_balance < 0
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}
              >
                {formatINR(forecastData.minimum_projected_balance)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Lowest forecasted point</div>
            </Card>

            {/* 3. Earliest Shortfall Date */}
            <Card>
              <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <span>First Shortfall</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-sm font-bold text-slate-900">
                {forecastData.first_projected_shortfall_date ? (
                  <span className="text-rose-700">
                    {formatDate(forecastData.first_projected_shortfall_date)}
                  </span>
                ) : (
                  <span className="text-emerald-700">None Projected</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {forecastData.runway_days !== null
                  ? `${forecastData.runway_days} days of runway`
                  : "Continuous runway"}
              </div>
            </Card>

            {/* 4. Days in Deficit */}
            <Card>
              <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <span>Negative Days</span>
                <AlertTriangle className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {forecastData.negative_cash_days_count} Days
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {forecastData.negative_cash_days_count > 0 ? "Deficit periods" : "Full coverage"}
              </div>
            </Card>

            {/* 5. Ending Cash */}
            <Card>
              <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <span>Closing Balance</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div
                className={`mt-2 text-xl font-bold ${
                  forecastData.closing_cash < 0 ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {formatINR(forecastData.closing_cash)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Day {forecastData.horizon_days} projected
              </div>
            </Card>
          </div>

          {/* Interactive Recharts Line Chart */}
          <Card
            header={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 text-sm">
                  Daily Cash Balance Trajectory (Rolling {horizon} Days)
                </span>
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-600 inline-block" /> Closing Balance
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-rose-600 inline-block border-t border-dashed" /> Zero
                    Threshold
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block border-t border-dotted" /> Reserve
                    Target (₹{(minimumReserve / 1000).toFixed(0)}k)
                  </span>
                </div>
              </div>
            }
          >
            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 15, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />

                  {/* Clearly labeled zero-cash reference threshold line */}
                  <ReferenceLine
                    y={0}
                    stroke="#e11d48"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: "Zero-Cash Threshold (₹0)",
                      position: "insideTopLeft",
                      fill: "#e11d48",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />

                  {/* Minimum Reserve reference line */}
                  {minimumReserve > 0 && (
                    <ReferenceLine
                      y={minimumReserve}
                      stroke="#d97706"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      label={{
                        value: `Reserve Cushion (₹${(minimumReserve / 1000).toFixed(0)}k)`,
                        position: "insideTopRight",
                        fill: "#d97706",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="ending_cash"
                    name="Projected Closing Cash"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, fill: "#059669" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Ledger Conservation & Model Honesty Disclaimer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 bg-slate-50/60 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  <strong>Ledger Reconciled:</strong> Closing = Opening (
                  {formatINR(forecastData.starting_cash)}) + Inflows (
                  {formatINR(forecastData.total_inflows)}) - Outflows (
                  {formatINR(forecastData.total_outflows)}) = {formatINR(forecastData.closing_cash)}.
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Deterministic daily resolution • Non-probabilistic
              </span>
            </div>
          </Card>

          {/* Daily Cash Breakdown Table */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <span>Daily Ledger Projection Breakdown</span>
                <span className="text-xs font-normal text-slate-500">
                  Showing {forecastData.daily_projections.length} Daily Points
                </span>
              </div>
            }
          >
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Opening Cash</th>
                    <th className="px-4 py-3 text-right text-emerald-700">Expected Inflow</th>
                    <th className="px-4 py-3 text-right text-rose-700">Committed Outflow</th>
                    <th className="px-4 py-3 text-right">Net Flow</th>
                    <th className="px-4 py-3 text-right">Closing Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {forecastData.daily_projections.map((row) => (
                    <tr
                      key={row.date}
                      className={`hover:bg-slate-50/70 ${
                        row.is_shortfall
                          ? "bg-rose-50/40"
                          : row.is_reserve_breach
                          ? "bg-amber-50/30"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                        {formatINR(row.starting_cash)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-medium">
                        {row.expected_inflow > 0 ? `+${formatINR(row.expected_inflow)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-rose-700 font-medium">
                        {row.committed_outflow > 0 ? `-${formatINR(row.committed_outflow)}` : "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-medium ${
                          row.net_cash_flow > 0
                            ? "text-emerald-700"
                            : row.net_cash_flow < 0
                            ? "text-rose-700"
                            : "text-slate-400"
                        }`}
                      >
                        {row.net_cash_flow > 0
                          ? `+${formatINR(row.net_cash_flow)}`
                          : row.net_cash_flow < 0
                          ? formatINR(row.net_cash_flow)
                          : "0"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-bold ${
                          row.ending_cash < 0 ? "text-rose-600" : "text-slate-900"
                        }`}
                      >
                        {formatINR(row.ending_cash)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.is_shortfall ? (
                          <Badge variant="danger">Deficit</Badge>
                        ) : row.is_reserve_breach ? (
                          <Badge variant="warning">Reserve Dip</Badge>
                        ) : (
                          <Badge variant="success">Solvent</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Bank Statement CSV Import Modal */}
      {!isDemoMode && activeBusinessId && (
        <StatementImportModal
          businessId={activeBusinessId}
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            fetchForecast(horizon, minimumReserve);
          }}
        />
      )}
    </div>
  );
};
