import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Receipt,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { CreditTransaction, CustomerDuesResponse } from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { RepayModal } from "./RepayModal";

export const CustomerDuesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get("status") || "all";

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [data, setData] = useState<CustomerDuesResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [selectedTxnForRepay, setSelectedTxnForRepay] = useState<CreditTransaction | null>(null);

  const fetchDues = async (filter: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCustomerDues("cust_rahul_01", filter === "all" ? undefined : filter);
      setData(res);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDues(activeFilter);
  }, [activeFilter]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setSearchParams(filter === "all" ? {} : { status: filter });
  };

  const handleRepaySuccess = (_updatedTxn: CreditTransaction) => {
    fetchDues(activeFilter);
  };

  const filteredTransactions = (data?.transactions || []).filter((txn) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      txn.shop_name.toLowerCase().includes(q) ||
      txn.description.toLowerCase().includes(q) ||
      txn.reference.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-kosha-navy tracking-tight flex items-center gap-2">
            <Receipt className="w-7 h-7 text-kosha-blue" />
            <span>My Shop Dues</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Track all credit purchases, agreed repayment deadlines, and payment histories.
          </p>
        </div>

        <button
          onClick={() => fetchDues(activeFilter)}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-600 border border-slate-200 shadow-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Overview Pills */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white/90 p-3.5 rounded-2xl border border-white/90 shadow-glass-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Outstanding
            </span>
            <span className="text-lg font-black text-kosha-navy font-mono mt-0.5 block">
              {formatINR(data.total_outstanding)}
            </span>
          </div>

          <div className="bg-rose-50/90 p-3.5 rounded-2xl border border-rose-200 shadow-glass-sm">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
              Overdue Dues
            </span>
            <span className="text-lg font-black text-rose-700 font-mono mt-0.5 block">
              {formatINR(data.overdue_amount)}
            </span>
          </div>

          <div className="bg-amber-50/90 p-3.5 rounded-2xl border border-amber-200 shadow-glass-sm">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              Upcoming Dues
            </span>
            <span className="text-lg font-black text-amber-700 font-mono mt-0.5 block">
              {formatINR(data.upcoming_amount + data.due_today_amount)}
            </span>
          </div>

          <div className="bg-emerald-50/90 p-3.5 rounded-2xl border border-emerald-200 shadow-glass-sm">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Paid Purchases
            </span>
            <span className="text-lg font-black text-emerald-700 font-mono mt-0.5 block">
              {formatINR(data.paid_amount)}
            </span>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white/80 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto text-xs font-semibold">
          {[
            { id: "all", label: "All" },
            { id: "overdue", label: "Overdue" },
            { id: "due_today", label: "Due Today" },
            { id: "upcoming", label: "Upcoming" },
            { id: "paid", label: "Paid" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeFilter === tab.id
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shop, item, ref..."
            className="w-full sm:w-60 pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-kosha-blue bg-white/90"
          />
        </div>
      </div>

      {/* Dues Transaction List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-kosha-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white/80 rounded-3xl p-10 border border-dashed border-slate-200 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No transactions match this filter</h3>
          <p className="text-xs text-slate-400">
            {searchQuery ? "Try clearing your search query" : "You have no records in this category."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((txn) => {
            const isOverdue = txn.status === "overdue";
            const isDueToday = txn.status === "due_today";
            const isPaid = txn.status === "paid";
            const isExpanded = expandedTxnId === txn.id;

            return (
              <div
                key={txn.id}
                className={`bg-white/90 backdrop-blur-xl rounded-2xl border transition-all overflow-hidden ${
                  isOverdue
                    ? "border-rose-200/90 shadow-xs"
                    : isDueToday
                    ? "border-amber-200/90 shadow-xs"
                    : isPaid
                    ? "border-emerald-100 shadow-xs"
                    : "border-slate-200/80 shadow-xs"
                }`}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">{txn.shop_name}</span>
                      <span className="text-[11px] font-mono text-slate-400">({txn.shop_code})</span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isOverdue
                            ? "bg-rose-100 text-rose-800"
                            : isDueToday
                            ? "bg-amber-100 text-amber-800"
                            : isPaid
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-kosha-blue"
                        }`}
                      >
                        {isOverdue ? "Overdue" : isDueToday ? "Due Today" : isPaid ? "Paid" : "Upcoming"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium">{txn.description}</p>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                      <span>Purchased: {txn.transaction_date}</span>
                      <span>·</span>
                      <span>Agreed Due: <strong className="text-slate-700">{txn.agreed_repayment_date}</strong></span>
                      <span>·</span>
                      <span className="font-mono">{txn.reference}</span>
                    </div>
                  </div>

                  {/* Amounts & Pay Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block">
                        {isPaid ? "Total Settled" : "Remaining Outstanding"}
                      </span>
                      <span
                        className={`text-lg font-black font-mono ${
                          isPaid ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {formatINR(isPaid ? txn.purchase_amount : txn.outstanding_amount)}
                      </span>
                      {!isPaid && txn.initial_paid_amount > 0 && (
                        <span className="text-[10px] text-slate-400 block">
                          Paid so far: {formatINR(txn.purchase_amount - txn.outstanding_amount)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isPaid && (
                        <button
                          onClick={() => setSelectedTxnForRepay(txn)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Repay</span>
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedTxnId(isExpanded ? null : txn.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        title="View Payment History"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Payment History Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-100 p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-kosha-blue" />
                        <span>Payment History & Audit Trail</span>
                      </span>
                      <span>Total Purchase: {formatINR(txn.purchase_amount)}</span>
                    </div>

                    <div className="space-y-1.5">
                      {/* Initial Downpayment */}
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-slate-600">
                        <div>
                          <span className="font-bold text-slate-800">Initial Down Payment</span>
                          <span className="text-[11px] text-slate-400 block">Paid at merchant checkout</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700">
                          {formatINR(txn.initial_paid_amount)}
                        </span>
                      </div>

                      {/* Subsequent Repayments */}
                      {txn.repayments.map((r) => (
                        <div
                          key={r.id}
                          className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-center justify-between text-slate-700"
                        >
                          <div>
                            <span className="font-bold text-emerald-900">
                              {r.payment_method === "initial_downpayment" ? "Down Payment" : "Demo Repayment"}
                            </span>
                            <span className="text-[10px] text-emerald-700 block">
                              Recorded on {r.repayment_date} {r.provider_reference ? `(${r.provider_reference})` : ""}
                            </span>
                            {r.notes && <p className="text-[10px] text-slate-500 mt-0.5">{r.notes}</p>}
                          </div>
                          <span className="font-mono font-bold text-emerald-800">
                            +{formatINR(r.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
