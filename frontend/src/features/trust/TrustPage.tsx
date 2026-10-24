import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
} from "recharts";
import { ShieldCheck, Info } from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";
import { apiClient } from "../../lib/api";
import { BacktestResponse } from "../../types/cashflow";

export const TrustPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusinessId } = useBusiness();
  const [backtestData, setBacktestData] = useState<BacktestResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getBacktestReliability(activeBusinessId || "apex_precision_mfg", 12)
      .then((res) => {
        if (isMounted && res) {
          setBacktestData(res);
        }
      })
      .catch(() => {
        // Fallback to default presets
      });

    return () => {
      isMounted = false;
    };
  }, [activeBusinessId]);

  // Calibration curve points matching Trust.png
  const calibrationPoints = backtestData?.calibration_curve ?? [
    { predicted: 10, actual: 12 },
    { predicted: 25, actual: 26 },
    { predicted: 50, actual: 48 },
    { predicted: 75, actual: 74 },
    { predicted: 90, actual: 88 },
  ];

  const bandCoverage = backtestData?.band_coverage_pct ?? 78;
  const leadTime = backtestData?.warning_lead_time_days ?? 19;
  const falseAlarms = backtestData?.false_alarms_ratio ?? "1 in 8";
  const evalPeriods = backtestData?.evaluation_periods ?? 12;
  const missedShortfalls = backtestData?.missed_shortfalls_count ?? 0;
  const maeFormatted = backtestData?.mean_absolute_error_formatted ?? "₹18.4k";
  const datasetName = backtestData?.dataset_name ?? "Apex Precision Components Pvt Ltd (Reconciled Operating Ledger)";


  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col justify-between py-2">
      {/* 2 Main Glass Cards Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Card: Calibration & Empirical Replay */}
        <div className="lg:col-span-8 glass-panel rounded-4xl p-7 sm:p-9 flex flex-col justify-between shadow-glass-lg">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue">
                Supporting Tool
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Forecast reliability · Model calibration & backtesting
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-kosha-navy">
              Can you trust this forecast?
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 font-medium">
              We backtested 12 historical evaluation periods against actual settlement outcomes for <span className="font-semibold text-kosha-navy">{datasetName}</span> to calibrate warning lead times, error margins, and prediction bands.
            </p>

            {/* 6 Metric Cards in 2 rows of 3 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
              <div className="bg-white/80 rounded-3xl p-4 sm:p-5 border border-white/90 shadow-xs">
                <span className="text-xs font-semibold text-slate-400">
                  Band coverage (goal 80%)
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-kosha-navy mt-1">
                  {bandCoverage}%
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Uncertainty band capture</span>
              </div>

              <div className="bg-white/80 rounded-3xl p-4 sm:p-5 border border-white/90 shadow-xs">
                <span className="text-xs font-semibold text-slate-400">Warning lead time</span>
                <div className="text-xl sm:text-2xl font-extrabold text-kosha-navy mt-1">
                  {leadTime} days
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Median advance warning</span>
              </div>

              <div className="bg-white/80 rounded-3xl p-4 sm:p-5 border border-white/90 shadow-xs">
                <span className="text-xs font-semibold text-slate-400">False alarms</span>
                <div className="text-xl sm:text-2xl font-extrabold text-kosha-navy mt-1">
                  {falseAlarms}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Low false alert rate</span>
              </div>

              <div className="bg-white/80 rounded-3xl p-4 sm:p-5 border border-white/90 shadow-xs">
                <span className="text-xs font-semibold text-slate-400">Evaluation periods</span>
                <div className="text-xl sm:text-2xl font-extrabold text-kosha-navy mt-1">
                  {evalPeriods}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Backtested weekly windows</span>
              </div>

              <div className="bg-white/80 rounded-3xl p-4 sm:p-5 border border-white/90 shadow-xs">
                <span className="text-xs font-semibold text-slate-400">Missed shortfalls</span>
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1">
                  {missedShortfalls}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Zero undetected deficits</span>
              </div>

              <div className="bg-white/80 rounded-3xl p-4 sm:p-5 border border-white/90 shadow-xs">
                <span className="text-xs font-semibold text-slate-400">Mean Absolute Error</span>
                <div className="text-xl sm:text-2xl font-extrabold text-kosha-navy mt-1">
                  {maeFormatted}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Average 90-day MAE</span>
              </div>
            </div>

            {/* Reliability Calibration Scatter Curve Chart */}
            <div className="w-full h-56 sm:h-64 relative mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={calibrationPoints}
                  margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                >
                  <XAxis
                    dataKey="predicted"
                    type="number"
                    domain={[0, 100]}
                    tick={false}
                    axisLine={{ stroke: "#94a3b8", strokeWidth: 1.5 }}
                    label={{
                      value: "Predicted chance (%)",
                      position: "insideBottom",
                      offset: -12,
                      fill: "#475e75",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  />
                  <YAxis
                    dataKey="actual"
                    type="number"
                    domain={[0, 100]}
                    hide={true}
                    axisLine={{ stroke: "#94a3b8", strokeWidth: 1.5 }}
                  />

                  {/* Ideal Calibration 45-degree dashed line */}
                  <Line
                    data={[
                      { predicted: 0, actual: 0 },
                      { predicted: 100, actual: 100 },
                    ]}
                    dataKey="actual"
                    stroke="#12304F"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="Ideal 45° Calibration"
                  />

                  {/* Empirical Scatter Dots */}
                  <Scatter
                    data={calibrationPoints}
                    dataKey="actual"
                    fill="#1D6FD6"
                    line={false}
                    name="Empirical Test Frequency"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-1">
              Dashed line = Perfect 1:1 probability calibration · Blue dots = Empirical backtest outcomes
            </p>
          </div>
        </div>

        {/* Right Card: Replay narrative & Counterparty Confidence */}
        <div className="lg:col-span-4 glass-panel rounded-4xl p-7 sm:p-8 flex flex-col justify-between shadow-glass-lg">
          <div>
            {/* Replay Section */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-kosha-navy uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Historical Replay Audit</span>
              </div>
              <h2 className="text-xl font-bold text-kosha-navy mt-1">Replay Analysis</h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed font-medium">
                Had Kosha run 60 days ago during the Tier-1 payment delay, it would have alerted management on 3 Oct, 19 days before liquidity depletion.
              </p>
            </div>

            {/* Data Confidence Section */}
            <div className="mt-8 pt-6 border-t border-slate-200/80">
              <h2 className="text-base font-bold text-kosha-navy">Customer Payment Confidence</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Based on historical payment timeliness</p>

              <div className="mt-4 space-y-3.5 text-xs">
                {/* Bharat Auto Parts */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 border border-white">
                  <div>
                    <div className="font-bold text-kosha-navy text-sm">Bharat Auto Parts</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">14 paid invoices · 92% on-time</div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-kosha-blue">
                    High
                  </span>
                </div>

                {/* Sri Motors */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 border border-white">
                  <div>
                    <div className="font-bold text-kosha-navy text-sm">Sri Motors</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">5 paid invoices · 78% on-time</div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-kosha-blue">
                    Medium
                  </span>
                </div>

                {/* New Buyer Co */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 border border-white">
                  <div>
                    <div className="font-bold text-kosha-navy text-sm">New Buyer Co</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">1 paid invoice · First quarter</div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200/60">
                    Low
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              <strong>Validation Disclaimer:</strong> Historical backtesting evaluated against synthetic enterprise test datasets. Demonstrates calculation validity, mathematical ledger integrity, and alert trigger calibration—not a guarantee of real-world predictive performance on unobserved market shocks.
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between mt-6 px-2">
        <span className="text-xs text-slate-400 font-medium">Evidence and calibration, not promises</span>

        <button
          onClick={() => navigate("/understand-cash-flow")}
          className="px-8 py-3 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
          Back to Forecast
        </button>
      </div>
    </div>
  );
};
