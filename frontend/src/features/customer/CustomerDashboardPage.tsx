import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  CreditCard,
  Receipt,
  Keyboard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building2,
  Sparkles,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { CustomerDashboardSummary, CreditTransaction } from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { RepayModal } from "./RepayModal";

export const CustomerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxnForRepay, setSelectedTxnForRepay] = useState<CreditTransaction | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCustomerDashboard();
      setData(res);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleRepaySuccess = (_updatedTxn: CreditTransaction) => {
    fetchDashboard();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-3 border-kosha-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading your shop credit overview...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white/80 rounded-3xl p-8 border border-rose-200 text-center max-w-md mx-auto my-12 shadow-sm space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">Failed to load dashboard</h3>
        <p className="text-xs text-slate-500">{error || "Unable to retrieve customer data."}</p>
        <button
          onClick={fetchDashboard}
          className="px-5 py-2.5 rounded-xl bg-kosha-blue text-white text-xs font-bold shadow-md hover:bg-kosha-deep"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* A. Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-kosha-navy tracking-tight">
              {getGreeting()}, {data.customer.display_name.split(" ")[0]}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-kosha-blue border border-blue-200/80">
              <Sparkles className="w-3 h-3 text-kosha-blue" />
              <span>Synthetic Demo</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Here is your shop-credit overview across participating merchants.
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-600 border border-slate-200 shadow-xs transition-colors"
          title="Refresh dashboard"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* F. Helpful Status Message Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
          data.overdue_amount > 0
            ? "bg-amber-50/90 border-amber-200/90 text-amber-900"
            : data.total_outstanding > 0
            ? "bg-blue-50/90 border-blue-200/90 text-blue-900"
            : "bg-emerald-50/90 border-emerald-200/90 text-emerald-900"
        }`}
      >
        {data.overdue_amount > 0 ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
          <p>{data.status_message}</p>
        </div>
        {data.overdue_amount > 0 && (
          <button
            onClick={() => navigate("/customer/dues?status=overdue")}
            className="text-xs font-bold text-amber-800 underline hover:text-amber-950 shrink-0"
          >
            Review Overdue
          </button>
        )}
      </div>

      {/* B. Outstanding Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Outstanding */}
        <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/90 shadow-glass-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Outstanding
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-kosha-navy font-mono">
              {formatINR(data.total_outstanding)}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Across all shops</p>
          </div>
        </div>

        {/* Due within 7 Days */}
        <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/90 shadow-glass-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Due in 7 Days</span>
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
              {formatINR(data.due_within_7_days)}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Upcoming commitments</p>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/90 shadow-glass-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue Amount</span>
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
              {formatINR(data.overdue_amount)}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Past agreed date</p>
          </div>
        </div>

        {/* Participating Shops with Dues */}
        <div className="bg-white/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/90 shadow-glass-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Active Shops</span>
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
              {data.shops_count}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">With pending dues</p>
          </div>
        </div>
      </div>

      {/* C. Quick Actions (4 Actions) */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-glass-sm">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Action 1: Scan shop QR */}
          <button
            onClick={() => navigate("/customer/pay")}
            className="p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-950 block">Scan Shop QR</span>
              <span className="text-[10px] text-emerald-700 font-medium">Record credit buy</span>
            </div>
          </button>

          {/* Action 2: Pay a Due */}
          <button
            onClick={() => navigate("/customer/dues")}
            className="p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-kosha-blue text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Pay a Due</span>
              <span className="text-[10px] text-slate-500 font-medium">Clear pending balance</span>
            </div>
          </button>

          {/* Action 3: View My Dues */}
          <button
            onClick={() => navigate("/customer/dues")}
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">View My Dues</span>
              <span className="text-[10px] text-slate-500 font-medium">Filtered dues list</span>
            </div>
          </button>

          {/* Action 4: Enter Shop Code */}
          <button
            onClick={() => navigate("/customer/pay?mode=code")}
            className="p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-950 block">Enter Shop Code</span>
              <span className="text-[10px] text-indigo-700 font-medium">Manual merchant code</span>
            </div>
          </button>
        </div>
      </div>

      {/* D. Upcoming Repayments */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-glass-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-kosha-navy">Upcoming Repayments</h2>
            <p className="text-xs text-slate-500">Nearest agreed dates across shops</p>
          </div>
          <button
            onClick={() => navigate("/customer/dues")}
            className="text-xs font-bold text-kosha-blue hover:text-kosha-deep inline-flex items-center gap-1"
          >
            <span>View All ({data.upcoming_repayments.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {data.upcoming_repayments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <p className="text-xs font-bold text-slate-700">No upcoming commitments</p>
            <p className="text-[11px] text-slate-400">All your shop purchases are clear!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.upcoming_repayments.slice(0, 4).map((txn) => {
              const isOverdue = txn.status === "overdue";
              const isDueToday = txn.status === "due_today";

              return (
                <div
                  key={txn.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isOverdue
                      ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
                      : isDueToday
                      ? "bg-amber-50/40 border-amber-200 hover:border-amber-300"
                      : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{txn.shop_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isOverdue
                            ? "bg-rose-100 text-rose-800"
                            : isDueToday
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-kosha-blue"
                        }`}
                      >
                        {isOverdue ? "Overdue" : isDueToday ? "Due Today" : "Upcoming"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">{txn.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Agreed due: <strong className="text-slate-600">{txn.agreed_repayment_date}</strong></span>
                      <span>·</span>
                      <span>Total: {formatINR(txn.purchase_amount)}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Remaining Due</span>
                      <span className="text-base font-black text-rose-600 font-mono">
                        {formatINR(txn.outstanding_amount)}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedTxnForRepay(txn)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* E. Recent Activity */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-5 border border-white/90 shadow-glass-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-kosha-navy">Recent Activity</h2>
            <p className="text-xs text-slate-500">Audit timeline of purchases and repayments</p>
          </div>
          <button
            onClick={() => navigate("/customer/activity")}
            className="text-xs font-bold text-kosha-blue hover:text-kosha-deep inline-flex items-center gap-1"
          >
            <span>Full History</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {data.recent_activity.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No recent activity recorded.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recent_activity.slice(0, 5).map((act) => (
              <div key={act.id} className="py-3 flex items-start justify-between gap-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                    {act.event_type.includes("repayment") ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-kosha-blue" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{act.title}</p>
                    <p className="text-[11px] text-slate-500 leading-snug">{act.description}</p>
                  </div>
                </div>

                {act.amount !== undefined && act.amount !== null && (
                  <span className="text-xs font-mono font-bold text-slate-700 shrink-0">
                    {formatINR(act.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repay Modal */}
      {selectedTxnForRepay && (
        <RepayModal
          isOpen={Boolean(selectedTxnForRepay)}
          transaction={selectedTxnForRepay}
          onClose={() => setSelectedTxnForRepay(null)}
          onSuccess={handleRepaySuccess}
        />
      )}
    </div>
  );
};
