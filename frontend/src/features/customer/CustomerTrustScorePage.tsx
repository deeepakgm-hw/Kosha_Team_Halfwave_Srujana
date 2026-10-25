import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Receipt,
  ArrowRight,
  Info,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { apiClient, formatApiError } from "../../lib/api";
import { TrustScoreDetail, TrustScoreHistoryItem } from "../../types/customer";
import { useAuth } from "../../context/AuthContext";

export const CustomerTrustScorePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerId = user?.customer_id || "cust_rahul_01";

  const [scoreData, setScoreData] = useState<TrustScoreDetail | null>(null);
  const [history, setHistory] = useState<TrustScoreHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    try {
      const [scoreRes, histRes] = await Promise.all([
        apiClient.getCustomerTrustScore(customerId),
        apiClient.getTrustScoreHistory(customerId).catch(() => []),
      ]);
      setScoreData(scoreRes);
      setHistory(histRes);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const updated = await apiClient.recalculateTrustScore(customerId, "user_manual_refresh");
      setScoreData(updated);
      const updatedHist = await apiClient.getTrustScoreHistory(customerId);
      setHistory(updatedHist);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsRecalculating(false);
    }
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "excellent":
        return {
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          border: "border-emerald-200",
          badge: "bg-emerald-500",
          ring: "stroke-emerald-500",
          label: "Excellent Reliability",
          desc: "Consistent on-time repayments across all local store credits.",
        };
      case "good":
        return {
          bg: "bg-blue-50",
          text: "text-[#0070E0]",
          border: "border-blue-200",
          badge: "bg-[#0070E0]",
          ring: "stroke-[#0070E0]",
          label: "Good Reliability",
          desc: "Dependable repayment history with minimal delays.",
        };
      case "fair":
        return {
          bg: "bg-amber-50",
          text: "text-amber-700",
          border: "border-amber-200",
          badge: "bg-amber-500",
          ring: "stroke-amber-500",
          label: "Fair Standing",
          desc: "Some overdue payments recorded; on-time settlements recommended.",
        };
      case "needs_attention":
        return {
          bg: "bg-rose-50",
          text: "text-rose-700",
          border: "border-rose-200",
          badge: "bg-rose-500",
          ring: "stroke-rose-500",
          label: "Needs Attention",
          desc: "Active overdue balance requires prompt settlement.",
        };
      default:
        return {
          bg: "bg-sky-50",
          text: "text-sky-700",
          border: "border-sky-200",
          badge: "bg-sky-500",
          ring: "stroke-sky-500",
          label: "New / Insufficient History",
          desc: "Requires at least 2 recorded shop purchases to establish score.",
        };
    }
  };

  const theme = getCategoryTheme(scoreData?.score_category || "insufficient_history");

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0070E0] border border-blue-200 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-[#0070E0]" />
              <span>Internal Reliability Index</span>
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Model {scoreData?.model_version || "v1.0"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            KOSHA TrustScore
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Internal customer repayment reliability rating based on recorded local shop obligations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/customer/dues")}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            <span>View Bills</span>
          </button>
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating || isLoading}
            className="px-4 py-2 text-xs font-bold text-white bg-[#0070E0] hover:bg-[#005bb5] active:bg-[#004791] rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
            <span>{isRecalculating ? "Recalculating..." : "Recalculate"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-medium text-rose-700 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Primary Score Gauge Card & High-Level Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Score Radial Display */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Current Reliability Score
              </span>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold mt-1.5 ${theme.bg} ${theme.text} border ${theme.border}`}>
                {theme.label}
              </span>
            </div>
            {scoreData?.delta?.score_change !== null && scoreData?.delta?.score_change !== undefined && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                scoreData.delta.score_change >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {scoreData.delta.score_change > 0 ? `+${scoreData.delta.score_change}` : scoreData.delta.score_change} pts
              </span>
            )}
          </div>

          {/* Semi-Circular SVG Meter */}
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  className="stroke-slate-100"
                  fill="transparent"
                />
                {/* Score Arc */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  strokeDasharray={`${(scoreData?.score ?? 75) * 2.51} 251`}
                  strokeLinecap="round"
                  className={`${theme.ring} transition-all duration-1000 ease-out`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {scoreData?.has_sufficient_history ? (
                  <>
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                      {scoreData.score}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      / 100
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-slate-900">
                      NEW
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 px-2">
                      Awaiting History
                    </span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium text-center max-w-xs mt-3">
              {theme.desc}
            </p>
          </div>

          {/* Quick Metrics Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On-Time Ratio</span>
              <span className="text-base font-black text-slate-900 mt-0.5 block">
                {scoreData?.metrics?.on_time_ratio_pct ?? 0}%
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Settled Bills</span>
              <span className="text-base font-black text-slate-900 mt-0.5 block">
                {scoreData?.metrics?.completed_obligations ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Right: 4 Factor Weighting Breakdown */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Transparent Factor Breakdown
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                100% Deterministic Rule-Based
              </span>
            </div>

            <div className="space-y-4">
              {/* Factor 1: On-time (40%) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">1. On-Time Repayment Performance</span>
                  <span className="text-slate-900 font-extrabold">
                    {scoreData?.breakdown?.on_time_performance?.score ?? 0} / 40.0 pts (40%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((scoreData?.breakdown?.on_time_performance?.score ?? 0) / 40.0) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Measures the ratio of settled obligations paid on or before agreed repayment deadlines.
                </span>
              </div>

              {/* Factor 2: Overdue Frequency & Duration (25%) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">2. Overdue Frequency & Duration</span>
                  <span className="text-slate-900 font-extrabold">
                    {scoreData?.breakdown?.overdue_frequency_duration?.score ?? 0} / 25.0 pts (25%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0070E0] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((scoreData?.breakdown?.overdue_frequency_duration?.score ?? 0) / 25.0) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Penalizes frequent late payments and extended days past due. Disputed bills are exempt.
                </span>
              </div>

              {/* Factor 3: Current Overdue Ratio (20%) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">3. Current Verified Overdue Balance</span>
                  <span className="text-slate-900 font-extrabold">
                    {scoreData?.breakdown?.current_overdue_ratio?.score ?? 0} / 20.0 pts (20%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((scoreData?.breakdown?.current_overdue_ratio?.score ?? 0) / 20.0) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Proportion of active overdue balance relative to total borrowed volume (0 overdue = full 20 pts).
                </span>
              </div>

              {/* Factor 4: Consistency & Recency (15%) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">4. Consistency & Recency of Repayments</span>
                  <span className="text-slate-900 font-extrabold">
                    {scoreData?.breakdown?.recency_consistency?.score ?? 0} / 15.0 pts (15%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((scoreData?.breakdown?.recency_consistency?.score ?? 0) / 15.0) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Rewards active, verified repayment events within the last 30, 60, and 90 days.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Sum of all factors</span>
            <span className="font-extrabold text-slate-900">
              Total Score: {scoreData?.score ?? "N/A"} / 100
            </span>
          </div>
        </div>
      </div>

      {/* 3. Signals & Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positive Signals */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Positive Reliability Factors
            </h3>
          </div>
          {scoreData?.signals?.positive_factors && scoreData.signals.positive_factors.length > 0 ? (
            <ul className="space-y-2">
              {scoreData.signals.positive_factors.map((p, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 font-medium">No recorded positive signals yet.</p>
          )}
        </div>

        {/* Improvement Tips / Risk Factors */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Improvement Opportunities
            </h3>
          </div>
          {scoreData?.signals?.risk_factors && scoreData.signals.risk_factors.length > 0 ? (
            <ul className="space-y-2">
              {scoreData.signals.risk_factors.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 font-medium">
              Zero overdue risks detected! Keep maintaining on-time settlements.
            </p>
          )}
        </div>
      </div>

      {/* 4. Score Trend History Chart */}
      {history.length > 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                TrustScore Trajectory & History
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Historical snapshot evaluations over time.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {history.length} snapshots recorded
            </span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0070E0" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0070E0" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(val) => new Date(val).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as TrustScoreHistoryItem;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-lg space-y-1">
                          <p className="font-bold">Score: {d.score ?? "N/A"}</p>
                          <p className="text-slate-400 text-[10px]">
                            {new Date(d.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {d.change_reason && (
                            <p className="text-emerald-400 text-[10px]">{d.change_reason}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#0070E0"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#scoreGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. Inaccuracy Review & Dispute Action Banner */}
      <div className="p-5 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-glass-md">
        <div className="space-y-1">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Notice an inaccurate bill or missing payment?
          </h4>
          <p className="text-xs text-slate-300 max-w-xl">
            You can flag any disputed bill from your Dues dashboard. Raising a dispute immediately pauses AutoPay collections and exempts the bill from TrustScore penalties while your merchant reviews the claim.
          </p>
        </div>
        <button
          onClick={() => navigate("/customer/dues")}
          className="px-4 py-2.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
        >
          <span>Review Dues & Raise Dispute</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 6. Regulatory & Non-Bureau Disclaimer */}
      <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 text-[11px] text-slate-500 font-medium leading-relaxed">
        <p className="flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Disclaimer:</strong> KOSHA TrustScore is an internal reliability index computed strictly from your verified local store credit and repayment obligations recorded on KOSHA. It is <strong>NOT an official credit bureau score (such as CIBIL, Experian, or CRIF High Mark)</strong>, nor does it guarantee loan approval or external commercial creditworthiness.
          </span>
        </p>
      </div>
    </div>
  );
};
