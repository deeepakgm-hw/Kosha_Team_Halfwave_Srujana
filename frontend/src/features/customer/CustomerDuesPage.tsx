import React, { useState, useEffect, useCallback } from "react";
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
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { BillPaymentHistory, CreditTransaction, CustomerDuesResponse } from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { RepayModal } from "./RepayModal";
import { RazorpayCheckoutModal } from "../payments/RazorpayCheckoutModal";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";

export const CustomerDuesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get("status") || "all";
  const currentCustomerId = searchParams.get("customer_id") || "cust_rahul_01";

  const [activeTab, setActiveTab] = useState<"all" | "upi_bills">("all");
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [data, setData] = useState<CustomerDuesResponse | null>(null);
  const [customerBills, setCustomerBills] = useState<BillPaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [selectedTxnForRepay, setSelectedTxnForRepay] = useState<CreditTransaction | null>(null);
  const [selectedBillForCheckout, setSelectedBillForCheckout] = useState<BillPaymentHistory | null>(null);
  const [isResolvingCheckout, setIsResolvingCheckout] = useState<boolean>(false);

  const fetchDues = useCallback(async (filter: string, isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    try {
      const [duesRes, billsRes] = await Promise.all([
        apiClient.getCustomerDues(currentCustomerId, filter === "all" ? undefined : filter),
        apiClient.listCustomerBills(currentCustomerId, filter === "all" ? undefined : filter).catch(() => []),
      ]);
      setData(duesRes);
      setCustomerBills(billsRes);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [currentCustomerId]);

  // Real-Time Server-Sent Events listener (silent refresh in background)
  const { isRealTime } = useRealTimeSync({
    onRefresh: () => fetchDues(activeFilter, true),
  });

  useEffect(() => {
    fetchDues(activeFilter, false);
  }, [fetchDues, activeFilter]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    const newParams: Record<string, string> = {};
    if (filter !== "all") newParams.status = filter;
    if (currentCustomerId !== "cust_rahul_01") newParams.customer_id = currentCustomerId;
    setSearchParams(newParams);
  };

  const handleRepaySuccess = (_updatedTxn: CreditTransaction) => {
    fetchDues(activeFilter);
  };

  const handleCheckoutSuccess = (_updatedBill: BillPaymentHistory) => {
    fetchDues(activeFilter);
    setSelectedBillForCheckout(null);
  };

  const handleInitiateUpiPayment = async (txnId: string, txnFallback: CreditTransaction) => {
    setIsResolvingCheckout(true);
    try {
      const history = await apiClient.getBillPaymentHistory(txnId, currentCustomerId);
      setSelectedBillForCheckout(history);
    } catch {
      setSelectedBillForCheckout({
        bill_id: txnFallback.id,
        id: txnFallback.id,
        bill_reference: txnFallback.reference || `BILL-${txnFallback.id.slice(-6)}`,
        bill_number: txnFallback.reference || `BILL-${txnFallback.id.slice(-6)}`,
        customer_id: currentCustomerId,
        customer_name: data?.customer?.display_name || "Valued Customer",
        shop_code: txnFallback.shop_code,
        shop_name: txnFallback.shop_name,
        description: txnFallback.description,
        purchase_date: txnFallback.transaction_date,
        agreed_repayment_date: txnFallback.agreed_repayment_date,
        repayment_due_date: txnFallback.agreed_repayment_date,
        total_amount: txnFallback.purchase_amount,
        initial_manual_paid: txnFallback.initial_paid_amount || 0,
        initial_paid_amount: txnFallback.initial_paid_amount || 0,
        verified_razorpay_paid: 0,
        total_verified_payments: 0,
        outstanding_amount: txnFallback.outstanding_amount,
        status: (txnFallback.status === "upcoming" || txnFallback.status === "due_today" || txnFallback.status === "overdue" || txnFallback.status === "paid") ? txnFallback.status : "upcoming",
        payment_status: "unpaid",
        payment_requests: [],
        verified_payments: [],
      });
    } finally {
      setIsResolvingCheckout(false);
    }
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

  const filteredBills = customerBills.filter((bill) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      bill.shop_name.toLowerCase().includes(q) ||
      (bill.bill_number || bill.bill_reference || "").toLowerCase().includes(q)
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isRealTime ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Polling (15s)
            </span>
          )}
          <button
            onClick={() => fetchDues(activeFilter)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-600 border border-slate-200 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
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

      {/* View Switcher: Credit Ledger vs Razorpay UPI Bills */}
      <div className="flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-glass-sm max-w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "all"
              ? "bg-kosha-blue text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Shop Credit Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab("upi_bills")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "upi_bills"
              ? "bg-kosha-blue text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Razorpay UPI Invoices</span>
          {customerBills.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
              {customerBills.length}
            </span>
          )}
        </button>
      </div>

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
      ) : activeTab === "upi_bills" ? (
        filteredBills.length === 0 ? (
          <div className="bg-white/80 rounded-3xl p-10 border border-dashed border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No UPI bills match your filter</h3>
            <p className="text-xs text-slate-400">
              {searchQuery ? "Try clearing your search query" : "No active Razorpay payment requests created yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBills.map((bill) => {
              const isPaid = bill.status === "paid" || bill.payment_status === "paid";
              const isOverdue = bill.status === "overdue";
              const isPartiallyPaid = bill.payment_status === "partially_paid";
              const isExpanded = expandedTxnId === bill.id;

              return (
                <div
                  key={bill.id}
                  className={`bg-white/95 backdrop-blur-xl rounded-2xl border transition-all overflow-hidden ${
                    isPaid
                      ? "border-emerald-200 shadow-xs"
                      : isOverdue
                      ? "border-rose-200 shadow-xs"
                      : "border-slate-200/90 shadow-glass-sm"
                  }`}
                >
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900">{bill.shop_name}</span>
                        <span className="text-xs font-mono font-bold text-kosha-blue bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                          {bill.bill_number}
                        </span>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isPartiallyPaid
                              ? "bg-sky-100 text-sky-800"
                              : bill.payment_status === "pending_verification"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {bill.payment_status === "paid"
                            ? "Verified Paid"
                            : bill.payment_status === "partially_paid"
                            ? "Partially Paid"
                            : bill.payment_status === "pending_verification"
                            ? "Pending Verification"
                            : "Unpaid"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Issued: {bill.purchase_date || bill.agreed_repayment_date}</span>
                        <span>·</span>
                        <span>
                          Repayment Due: <strong className="text-slate-800">{bill.repayment_due_date || bill.agreed_repayment_date}</strong>
                        </span>
                      </div>

                      {/* Amounts summary pills */}
                      <div className="flex items-center gap-3 pt-1 text-xs flex-wrap">
                        <span className="text-slate-500">
                          Total: <strong className="text-slate-800 font-mono">{formatINR(bill.total_amount)}</strong>
                        </span>
                        {(bill.initial_paid_amount ?? bill.initial_manual_paid ?? 0) > 0 && (
                          <span className="text-slate-500">
                            Initial Down Payment:{" "}
                            <strong className="text-slate-700 font-mono">
                              {formatINR(bill.initial_paid_amount ?? bill.initial_manual_paid ?? 0)}
                            </strong>
                          </span>
                        )}
                        {(bill.total_verified_payments ?? bill.verified_razorpay_paid ?? 0) > 0 && (
                          <span className="text-emerald-700 font-medium">
                            Verified Online:{" "}
                            <strong className="font-mono font-bold">
                              +{formatINR(bill.total_verified_payments ?? bill.verified_razorpay_paid ?? 0)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                          Remaining Due
                        </span>
                        <span
                          className={`text-xl font-black font-mono ${
                            isPaid ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {formatINR(bill.outstanding_amount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {bill.outstanding_amount > 0 && (
                          <button
                            onClick={() => setSelectedBillForCheckout(bill)}
                            className="px-4 py-2 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay via UPI / QR</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedTxnId(isExpanded ? null : (bill.id || bill.bill_id || ""))}
                          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                          title="View Verified Payment History"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Verified Payment History Drawer */}
                  {isExpanded && (
                    <div className="bg-slate-50/90 border-t border-slate-100 p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Verified Razorpay Collections & Audit Trail</span>
                        </span>
                        <span>{bill.verified_payments.length} Verified Payment(s)</span>
                      </div>

                      {bill.verified_payments.length === 0 ? (
                        <p className="text-slate-400 text-xs py-1">No online verified payments recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {bill.verified_payments.map((vp) => (
                            <div
                              key={vp.id}
                              className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between text-slate-700 shadow-2xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900 text-xs">
                                    {vp.payment_id || vp.razorpay_payment_id}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                                    {vp.status}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 block">
                                  Verified on {new Date(vp.verified_at).toLocaleString()} · Method:{" "}
                                  <strong className="uppercase">{vp.method || vp.payment_method}</strong>
                                </span>
                              </div>
                              <span className="font-mono font-black text-sm text-emerald-700">
                                +{formatINR(vp.amount_inr)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
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
                        <>
                          <button
                            onClick={() => handleInitiateUpiPayment(txn.id, txn)}
                            disabled={isResolvingCheckout}
                            className="px-3.5 py-1.5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5"
                            title="Pay instantly with UPI QR or Razorpay"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay via UPI</span>
                          </button>

                          <button
                            onClick={() => setSelectedTxnForRepay(txn)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5"
                            title="Document manual counter payment"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Manual</span>
                          </button>
                        </>
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

      {/* Razorpay Checkout & UPI Modal */}
      {selectedBillForCheckout && (
        <RazorpayCheckoutModal
          isOpen={Boolean(selectedBillForCheckout)}
          bill={selectedBillForCheckout}
          onClose={() => setSelectedBillForCheckout(null)}
          onSuccess={handleCheckoutSuccess}
          customerId={currentCustomerId}
        />
      )}
    </div>
  );
};
