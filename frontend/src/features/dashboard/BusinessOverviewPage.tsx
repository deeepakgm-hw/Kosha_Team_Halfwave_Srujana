import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  CreditCard,
  Receipt,
  PlusCircle,
  ArrowDownLeft,
  TrendingUp,
  ShieldCheck,
  Clock,
  RefreshCw,
  ChevronRight,
  Building2,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import {
  Shop,
  ShopkeeperSummary,
  ShopkeeperTransaction,
} from "../../types/customer";
import { BusinessAutopayDashboardSummary } from "../../types/autopay";
import { formatINR } from "../../lib/utils";
import { useBusiness } from "../../context/BusinessContext";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";

export const BusinessOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusiness } = useBusiness();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopCode, setSelectedShopCode] = useState<string>("KOSHA-APEX");
  const [summary, setSummary] = useState<ShopkeeperSummary | null>(null);
  const [autopaySummary, setAutopaySummary] = useState<BusinessAutopayDashboardSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<ShopkeeperTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Real-Time SSE listener
  const { isRealTime } = useRealTimeSync({
    onRefresh: () => loadDashboardData(true),
  });

  const loadDashboardData = useCallback(
    async (_isSilent = false) => {
      setError(null);
      try {
        const [shopsList, summaryData, autopayData, txnsList] = await Promise.all([
          apiClient.listShops().catch(() => []),
          apiClient.getShopkeeperSummary(selectedShopCode).catch(() => null),
          apiClient.getBusinessAutopayDashboard(selectedShopCode).catch(() => null),
          apiClient.getShopkeeperTransactions(selectedShopCode).catch(() => []),
        ]);

        if (shopsList.length > 0) setShops(shopsList);
        setSummary(summaryData);
        setAutopaySummary(autopayData);
        setRecentTransactions(txnsList.slice(0, 8));
      } catch (err: unknown) {
        setError(formatApiError(err));
      }
    },
    [selectedShopCode]
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const activeShopObj = shops.find((s) => s.shop_code === selectedShopCode) || shops[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* A. Top Header with Business Identity & Shop Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {activeBusiness?.trade_name || activeShopObj?.shop_name || "Merchant Portal"}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Razorpay Verified</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            UPI-First Real-Time Payments, Customer Dues &amp; Treasury Intelligence
          </p>
        </div>

        {/* Header Right: Store Selector & Live Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {shops.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Counter:</span>
              <select
                value={selectedShopCode}
                onChange={(e) => setSelectedShopCode(e.target.value)}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer"
                aria-label="Select Shop Counter"
              >
                {shops.map((s) => (
                  <option key={s.shop_code} value={s.shop_code}>
                    {s.shop_name} ({s.shop_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isRealTime && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Payments</span>
            </span>
          )}

          <button
            onClick={() => loadDashboardData(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
            title="Refresh portal"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Error banner if load failed */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* B. LEVEL 1: Primary UPI Payment Actions Grid (Prominent & Touch-Friendly) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Action 1: Receive Payment */}
        <button
          onClick={() => navigate("/payments")}
          className="p-4 sm:p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left transition-all group flex flex-col justify-between gap-3 shadow-md shadow-emerald-600/20 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold block">Receive Payment</span>
              <ChevronRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-emerald-100 block mt-0.5">Instant dynamic UPI QR</span>
          </div>
        </button>

        {/* Action 2: My Business QR */}
        <button
          onClick={() => navigate("/shop-credit?tab=qr")}
          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 block">My Business QR</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">Shop standee &amp; VPA</span>
          </div>
        </button>

        {/* Action 3: Create Digital Bill */}
        <button
          onClick={() => navigate("/payments?create=true")}
          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 block">Create Bill</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">Itemized bill with QR</span>
          </div>
        </button>

        {/* Action 4: View Transactions */}
        <button
          onClick={() => navigate("/shop-credit?tab=transactions")}
          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 block">Transactions</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">Authoritative history</span>
          </div>
        </button>
      </div>

      {/* C. Today's Payment Summary & Outstanding Dues Hero Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Today's Verified UPI Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Today's Collections</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Authoritative
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                {formatINR(summary?.collected_today || 0)}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                {summary?.total_transactions_count || 0} successful customer settlements today
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Active Register:</span>
            <span className="font-bold text-slate-700 font-mono">{activeShopObj?.upi_id || "merchant@razorpay"}</span>
          </div>
        </div>

        {/* Card 2: Total Outstanding Customer Dues */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                <span>Outstanding Dues</span>
              </span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {summary?.active_transactions_count || 0} Active Ledger Accounts
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                {formatINR(summary?.total_customer_receivables || 0)}
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Across {summary?.customers_with_balance_count || 0} participating credit customers
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => navigate("/shop-credit")}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Customer Dues</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-slate-400 font-mono">
              Overdue: {formatINR(summary?.overdue_receivables || 0)}
            </span>
          </div>
        </div>

        {/* Card 3: AutoPay Protection Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>AutoPay Coverage</span>
              </span>
              <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {autopaySummary?.active_mandates_count || 0} Mandates Active
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {formatINR(autopaySummary?.total_protected_outstanding_inr || 0)}
                </span>
                <span className="text-xs text-slate-400 font-medium">Protected Overdue</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-sm font-bold text-rose-600 font-mono">
                  {formatINR(autopaySummary?.total_unprotected_outstanding_inr || 0)}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Unprotected at Risk</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => navigate("/shop-credit?tab=autopay_smart_dues")}
              className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Smart Dues &amp; AutoPay</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-500 font-medium">Auto-collect ready</span>
          </div>
        </div>
      </div>

      {/* D. LEVEL 1: Recent Payment Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Recent Payment Transactions</span>
            </h2>
            <p className="text-xs text-slate-500">Live feed of verified customer repayments and QR settlements</p>
          </div>
          <button
            onClick={() => navigate("/shop-credit?tab=transactions")}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-medium">No payment transactions recorded yet.</p>
            <button
              onClick={() => navigate("/payments")}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Receive First Payment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map((txn) => (
              <div
                key={txn.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">
                      {txn.customer_name}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {txn.description} &bull; {txn.transaction_date}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-slate-900 font-mono block">
                    {formatINR(txn.purchase_amount)}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      txn.status === "paid"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : txn.status === "overdue"
                        ? "bg-rose-50 text-rose-800 border border-rose-200"
                        : "bg-blue-50 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {txn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* E. LEVEL 3: Secondary Financial Tools & Cash-Flow Intelligence (Below the Fold) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Financial Management &amp; Treasury Intelligence</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Predictive 90-day cash flow runway, MSMED compliance, and cash calendar
            </p>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            Tier 1 Forecasting
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <button
            onClick={() => navigate("/understand-cash-flow")}
            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300">90-Day Simulation</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white">Understand Cash Flow</h4>
            <p className="text-[11px] text-slate-400 mt-1">Simulate inflows, inventory outflows, and runway days.</p>
          </button>

          <button
            onClick={() => navigate("/receivables")}
            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300">MSMED Act 2006</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white">Receivables Law</h4>
            <p className="text-[11px] text-slate-400 mt-1">Automatic 3x RBI compounding interest on overdue receivables.</p>
          </button>

          <button
            onClick={() => navigate("/calendar")}
            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300">42-Day Timeline</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-sm font-bold text-white">Cash Calendar</h4>
            <p className="text-[11px] text-slate-400 mt-1">Daily GST, rent, salary commitments and liquidity checks.</p>
          </button>
        </div>
      </div>
    </div>
  );
};
