import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Receipt,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Smartphone,
  ShieldCheck,
  FileText,
  Clock,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { BillPaymentHistory, CreditTransaction, CustomerDuesResponse, CustomerProfile } from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { RepayModal } from "./RepayModal";
import { RazorpayCheckoutModal } from "../payments/RazorpayCheckoutModal";
import { DigitalBillModal } from "../../components/bills/DigitalBillModal";
import { AutoPayCard } from "../../components/bills/AutoPayCard";
import { BillTimelineModal } from "../../components/bills/BillTimelineModal";
import { CustomerDisputeModal } from "../../components/bills/CustomerDisputeModal";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";
import { useAuth } from "../../context/AuthContext";

export const CustomerDuesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const initialFilter = searchParams.get("status") || "all";
  const [currentCustomerId, setCurrentCustomerId] = useState<string>(() => {
    return (
      user?.customer_id ||
      searchParams.get("customer_id") ||
      localStorage.getItem("kosha_active_customer_id") ||
      ""
    );
  });
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);

  useEffect(() => {
    if (user?.customer_id && user.customer_id !== currentCustomerId) {
      setCurrentCustomerId(user.customer_id);
    }
  }, [user?.customer_id]);

  const [activeTab, setActiveTab] = useState<"all" | "upi_bills" | "autopay">("all");
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [data, setData] = useState<CustomerDuesResponse | null>(null);
  const [customerBills, setCustomerBills] = useState<BillPaymentHistory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);
  const [selectedTxnForRepay, setSelectedTxnForRepay] = useState<CreditTransaction | null>(null);
  const [selectedBillForCheckout, setSelectedBillForCheckout] = useState<BillPaymentHistory | null>(null);
  const [selectedBillForDigitalModal, setSelectedBillForDigitalModal] = useState<BillPaymentHistory | null>(null);
  const [selectedBillForTimeline, setSelectedBillForTimeline] = useState<BillPaymentHistory | null>(null);
  const [selectedTxnForDispute, setSelectedTxnForDispute] = useState<{ id: string; reference: string; shop_name: string; outstanding_amount: number } | null>(null);
  const [isResolvingCheckout, setIsResolvingCheckout] = useState<boolean>(false);

  const fetchDues = useCallback(async (filter: string, isSilent = false) => {
    const targetId = currentCustomerId || user?.customer_id;
    if (!targetId) {
      setIsLoading(false);
      return;
    }
    if (!isSilent) setIsLoading(true);
    setError(null);
    try {
      const [duesRes, billsRes, custList] = await Promise.all([
        apiClient.getCustomerDues(targetId, filter === "all" ? undefined : filter),
        apiClient.listCustomerBills(targetId, filter === "all" ? undefined : filter).catch(() => []),
        user?.role === "customer" ? Promise.resolve([]) : apiClient.listShopkeeperCustomers().catch(() => []),
      ]);
      setData(duesRes);
      setCustomerBills(billsRes);
      if (custList.length > 0) setCustomers(custList);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [currentCustomerId, user?.customer_id, user?.role]);

  // Real-Time Server-Sent Events listener (silent refresh in background)
  const { isRealTime } = useRealTimeSync({
    onRefresh: () => fetchDues(activeFilter, true),
  });

  useEffect(() => {
    fetchDues(activeFilter, false);
  }, [fetchDues, activeFilter]);

  const handleSelectCustomer = (newId: string) => {
    setCurrentCustomerId(newId);
    localStorage.setItem("kosha_active_customer_id", newId);
    const newParams: Record<string, string> = {};
    if (activeFilter !== "all") newParams.status = activeFilter;
    newParams.customer_id = newId;
    setSearchParams(newParams);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    const newParams: Record<string, string> = {};
    if (filter !== "all") newParams.status = filter;
    newParams.customer_id = currentCustomerId;
    setSearchParams(newParams);
  };

  const handleRepaySuccess = (_updatedTxn: CreditTransaction) => {
    fetchDues(activeFilter, true);
  };

  const handleCheckoutSuccess = (_updatedBill: BillPaymentHistory) => {
    fetchDues(activeFilter, true);
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
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      txn.reference.toLowerCase().includes(q) ||
      txn.shop_name.toLowerCase().includes(q) ||
      txn.description.toLowerCase().includes(q)
    );
  });

  const filteredBills = customerBills.filter((bill) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (bill.bill_number || "").toLowerCase().includes(q) ||
      (bill.shop_name || "").toLowerCase().includes(q) ||
      (bill.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-[#001C64] tracking-tight">
              My Dues &amp; Repayments
            </h1>
            <span className="text-xs font-bold text-[#003087] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {data?.customer?.display_name || "Rahul Sharma"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#545D68] font-medium mt-1">
            Track and settle store credit with instant Razorpay UPI verification.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {customers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-full border border-[#E1E7EC] shadow-2xs">
              <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">Account:</span>
              <select
                value={currentCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="text-xs font-bold text-[#001C64] bg-transparent focus:outline-hidden cursor-pointer"
                aria-label="Select Customer Account"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isRealTime && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0070E0] border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070E0] animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}
          <button
            onClick={() => fetchDues(activeFilter, false)}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-slate-50 text-[#001C64] border border-[#E1E7EC] shadow-2xs transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E1E7EC] shadow-paypal">
            <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider block">
              Total Outstanding
            </span>
            <span className="text-xl sm:text-2xl font-black text-[#001C64] font-mono mt-0.5 block tracking-tight">
              {formatINR(data.total_outstanding)}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-paypal">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
              Overdue Dues
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono mt-0.5 block tracking-tight">
              {formatINR(data.overdue_amount)}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-paypal">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
              Upcoming Dues
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono mt-0.5 block tracking-tight">
              {formatINR(data.upcoming_amount + data.due_today_amount)}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-paypal">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
              Paid Purchases
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-0.5 block tracking-tight">
              {formatINR(data.paid_amount)}
            </span>
          </div>
        </div>
      )}

      {/* KOSHA TrustScore Live Summary Strip */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white p-4 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0070E0] text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
            {data?.trust_score ?? "NEW"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">KOSHA TrustScore</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-[#003087]">
                {data?.trust_score_category ? data.trust_score_category.replace('_', ' ') : 'Reliability Rating'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Internal 4-factor reliability score (40% On-time, 25% Overdue duration, 20% Overdue ratio, 15% Recency)
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/customer/trustscore")}
          className="px-3.5 py-1.5 text-xs font-bold text-[#0070E0] bg-white border border-blue-200 hover:bg-blue-50 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>View Factor Breakdown</span>
        </button>
      </div>

      {/* View Switcher: Credit Ledger vs Razorpay UPI Bills */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-full border border-[#E1E7EC] shadow-2xs max-w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "all"
              ? "bg-[#0070E0] text-white shadow-xs"
              : "text-[#545D68] hover:text-[#001C64] hover:bg-slate-50"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Shop Credit Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab("upi_bills")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "upi_bills"
              ? "bg-[#0070E0] text-white shadow-xs"
              : "text-[#545D68] hover:text-[#001C64] hover:bg-slate-50"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>UPI Store Bills</span>
          {customerBills.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
              {customerBills.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("autopay")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "autopay"
              ? "bg-[#0070E0] text-white shadow-xs"
              : "text-[#545D68] hover:text-[#001C64] hover:bg-slate-50"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AutoPay &amp; Smart Dues</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white rounded-full border border-[#E1E7EC] shadow-2xs overflow-x-auto text-xs font-semibold">
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
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                activeFilter === tab.id
                  ? "bg-[#003087] text-white shadow-xs font-bold"
                  : "text-[#545D68] hover:text-[#001C64]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#545D68] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shop, item, ref..."
            className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-full border border-[#E1E7EC] text-xs focus:outline-none focus:ring-2 focus:ring-[#0070E0] bg-white shadow-2xs text-[#0C0C0D]"
          />
        </div>
      </div>

      {/* Dues Transaction List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 border-3 border-[#0070E0] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : activeTab === "upi_bills" ? (
        filteredBills.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-dashed border-[#E1E7EC] text-center space-y-2 shadow-paypal">
            <CheckCircle2 className="w-10 h-10 text-[#0070E0] mx-auto" />
            <h3 className="text-sm font-bold text-[#001C64]">No UPI bills match your filter</h3>
            <p className="text-xs text-[#545D68]">
              {searchQuery ? "Try clearing your search query" : "No active payment requests created yet."}
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
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    isPaid
                      ? "border-emerald-200 shadow-paypal"
                      : isOverdue
                      ? "border-rose-200 shadow-paypal"
                      : "border-[#E1E7EC] shadow-paypal hover:shadow-paypal-lg"
                  }`}
                >
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-[#001C64]">{bill.shop_name}</span>
                        <span className="text-xs font-mono font-bold text-[#0070E0] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                          {bill.bill_number}
                        </span>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
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

                        {bill.outstanding_amount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            AutoPay Eligible
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#545D68]">
                        <span>{bill.description}</span>
                        <span>·</span>
                        <span>Due: {bill.agreed_repayment_date}</span>
                      </div>

                      <div className="text-xs font-semibold text-[#001C64] font-mono">
                        Total Bill: {formatINR(bill.total_amount)}
                        {bill.initial_manual_paid > 0 && (
                          <span className="text-[#545D68] font-normal ml-2">
                            (Downpayment: {formatINR(bill.initial_manual_paid)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E1E7EC]">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-[#545D68] block font-semibold uppercase">
                          Remaining Due
                        </span>
                        <span
                          className={`text-2xl font-black font-mono ${
                            isPaid ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {formatINR(bill.outstanding_amount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedBillForDigitalModal(bill)}
                          className="px-3.5 py-2.5 rounded-full border border-[#E1E7EC] hover:bg-slate-50 text-[#001C64] text-xs font-bold transition-all flex items-center gap-1.5"
                          title="View Official Digital Bill & Itemized Breakdown"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#0070E0]" />
                          <span>View Bill</span>
                        </button>

                        {bill.outstanding_amount > 0 && (
                          <button
                            onClick={() => setSelectedBillForCheckout(bill)}
                            className="px-5 py-2.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 active:scale-[0.98]"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay via UPI / QR</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedTxnId(isExpanded ? null : (bill.id || bill.bill_id || ""))}
                          className="p-2.5 rounded-full border border-[#E1E7EC] text-[#545D68] hover:bg-slate-50"
                          title="View Verified Payment History"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Verified Payment History Drawer */}
                  {isExpanded && (
                    <div className="bg-[#F5F7FA] border-t border-[#E1E7EC] p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between font-bold text-[#001C64] text-[11px] uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Verified Razorpay Collections &amp; Audit Trail</span>
                        </span>
                        <span>{bill.verified_payments.length} Verified Payment(s)</span>
                      </div>

                      {bill.verified_payments.length === 0 ? (
                        <p className="text-[#545D68] text-xs py-1">No online verified payments recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {bill.verified_payments.map((vp) => (
                            <div
                              key={vp.id}
                              className="p-3 bg-white rounded-xl border border-[#E1E7EC] flex items-center justify-between text-slate-700 shadow-2xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#001C64] text-xs">
                                    {vp.payment_id || vp.razorpay_payment_id}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                                    {vp.status}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#545D68] block">
                                  Verified on {new Date(vp.verified_at).toLocaleString()} · Method:{" "}
                                  <strong className="uppercase">{vp.method || vp.payment_method}</strong>
                                </span>
                              </div>
                              <span className="font-mono font-black text-emerald-700 text-sm">
                                + {formatINR(vp.amount_inr)}
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
      ) : activeTab === "autopay" ? (
        <div className="space-y-4">
          {/* Transparent Mathematical Formula Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-paypal space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    KOSHA AutoPay &amp; Smart Dues Protection
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automated, authorized settlement strictly after agreed deadline • Zero early debits
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                Authoritative Ledger Invariant
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
              <span className="font-bold text-slate-700 block mb-1">
                How Your AutoPay Remaining Balance is Calculated:
              </span>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold text-slate-800">
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Total Purchase Bill</span>
                <span>-</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Counter Cash Paid</span>
                <span>-</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Verified Online Paid</span>
                <span>=</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Exact Collectible Due
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                If you make a manual cash or UPI payment anytime, your authorized AutoPay collection is automatically recalculated and reduced immediately. If the bill reaches ₹0, AutoPay will never charge your bank account.
              </p>
            </div>
          </div>

          {/* Bills with AutoPay Cards */}
          {customerBills.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-dashed border-[#E1E7EC] text-center space-y-2 shadow-paypal">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-[#001C64]">No store bills registered</h3>
              <p className="text-xs text-[#545D68]">Bills from participating merchants will appear here with AutoPay protection controls.</p>
            </div>
          ) : (
            customerBills.map((b) => (
              <div key={b.bill_id || b.id} className="bg-white rounded-2xl border border-slate-200 shadow-paypal p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-slate-900">
                        {b.bill_reference || b.bill_number}
                      </span>
                      <span className="text-xs font-bold text-slate-700">· {b.shop_name}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{b.description || "Credit purchase"}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedBillForTimeline(b)}
                      className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#0070E0]" />
                      <span>View Lifecycle Timeline</span>
                    </button>

                    <button
                      onClick={() => setSelectedBillForDigitalModal(b)}
                      className="px-3.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Digital Bill</span>
                    </button>
                  </div>
                </div>

                <AutoPayCard
                  billId={b.bill_id || b.id || ""}
                  billReference={b.bill_reference || b.bill_number}
                  shopName={b.shop_name}
                  totalAmount={b.total_amount}
                  paidAmount={b.total_amount - b.outstanding_amount}
                  outstandingAmount={b.outstanding_amount}
                  agreedRepaymentDate={b.agreed_repayment_date}
                  customerId={currentCustomerId || user?.customer_id || undefined}
                  isBusinessOwner={false}
                  onMandateUpdated={() => fetchDues(activeFilter, true)}
                />
              </div>
            ))
          )}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-dashed border-[#E1E7EC] text-center space-y-2 shadow-paypal">
          <CheckCircle2 className="w-10 h-10 text-[#0070E0] mx-auto" />
          <h3 className="text-sm font-bold text-[#001C64]">No store transactions found</h3>
          <p className="text-xs text-[#545D68]">
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
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isOverdue
                    ? "border-rose-200 shadow-paypal"
                    : isDueToday
                    ? "border-amber-200 shadow-paypal"
                    : isPaid
                    ? "border-emerald-200 shadow-paypal"
                    : "border-[#E1E7EC] shadow-paypal hover:shadow-paypal-lg"
                }`}
              >
                {/* Main Card Header */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#001C64]">{txn.shop_name}</span>
                      <span className="text-[11px] font-mono text-[#545D68]">({txn.shop_code})</span>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isOverdue
                            ? "bg-rose-100 text-rose-800"
                            : isDueToday
                            ? "bg-amber-100 text-amber-800"
                            : isPaid
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-[#003087]"
                        }`}
                      >
                        {isOverdue ? "Overdue" : isDueToday ? "Due Today" : isPaid ? "Paid" : "Upcoming"}
                      </span>
                    </div>

                    <p className="text-xs text-[#0C0C0D] font-medium">{txn.description}</p>

                    <div className="flex items-center gap-2 text-[11px] text-[#545D68] pt-0.5">
                      <span>Purchased: {txn.transaction_date}</span>
                      <span>·</span>
                      <span>Due: <strong className="text-[#001C64]">{txn.agreed_repayment_date}</strong></span>
                      <span>·</span>
                      <span>Ref: <strong className="font-mono text-[#001C64]">{txn.reference}</strong></span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E1E7EC]">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-[#545D68] block">
                        {isPaid ? "Total Settled" : "Remaining Outstanding"}
                      </span>
                      <span
                        className={`text-2xl font-black font-mono ${
                          isPaid ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {formatINR(isPaid ? txn.purchase_amount : txn.outstanding_amount)}
                      </span>
                      {!isPaid && txn.initial_paid_amount > 0 && (
                        <span className="text-[10px] text-[#545D68] block">
                          Paid so far: {formatINR(txn.purchase_amount - txn.outstanding_amount)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const b = await apiClient.getBillPaymentHistory(txn.id, currentCustomerId);
                            setSelectedBillForDigitalModal(b);
                          } catch {
                            handleInitiateUpiPayment(txn.id, txn);
                          }
                        }}
                        className="px-3.5 py-2 rounded-full border border-[#E1E7EC] hover:bg-slate-50 text-[#001C64] text-xs font-bold transition-all flex items-center gap-1.5"
                        title="View Official Digital Bill & Itemized Breakdown"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#0070E0]" />
                        <span>View Bill</span>
                      </button>

                      {!isPaid && (
                        <>
                          <button
                            onClick={() => handleInitiateUpiPayment(txn.id, txn)}
                            disabled={isResolvingCheckout}
                            className="px-4 py-2 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 active:scale-[0.98]"
                            title="Pay instantly with UPI QR or Razorpay"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay via UPI</span>
                          </button>

                          <button
                            onClick={() => setSelectedTxnForRepay(txn)}
                            className="px-3.5 py-2 rounded-full border border-[#E1E7EC] hover:bg-slate-100 text-[#545D68] text-xs font-bold transition-all flex items-center gap-1.5"
                            title="Document manual counter payment"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Manual</span>
                          </button>

                          {!txn.is_disputed ? (
                            <button
                              onClick={() => setSelectedTxnForDispute({
                                id: txn.id,
                                reference: txn.reference,
                                shop_name: txn.shop_name,
                                outstanding_amount: txn.outstanding_amount,
                              })}
                              className="px-3 py-2 rounded-full border border-amber-200 hover:bg-amber-50 text-amber-700 text-xs font-bold transition-all flex items-center gap-1"
                              title="Flag incorrect amount or payment missing"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Dispute</span>
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                              <span>Disputed · Frozen</span>
                            </span>
                          )}
                        </>
                      )}

                      <button
                        onClick={() => setExpandedTxnId(isExpanded ? null : txn.id)}
                        className="p-2.5 rounded-full border border-[#E1E7EC] text-[#545D68] hover:bg-slate-100"
                        title="View Repayment Ledger"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Repayment History Drawer */}
                {isExpanded && (
                  <div className="bg-[#F5F7FA] border-t border-[#E1E7EC] p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-[#001C64] text-[11px] uppercase tracking-wider">
                      <span>Repayment History</span>
                      <span>{txn.repayments.length} Payments Recorded</span>
                    </div>

                    {txn.repayments.length === 0 ? (
                      <p className="text-[#545D68] text-xs py-1">No repayments recorded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {txn.repayments.map((rep) => (
                          <div
                            key={rep.id}
                            className="p-3 bg-white rounded-xl border border-[#E1E7EC] flex items-center justify-between text-slate-700 shadow-2xs"
                          >
                            <div>
                              <span className="font-bold text-[#001C64] capitalize">
                                {rep.payment_method.replace(/_/g, " ")}
                              </span>
                              <span className="text-[11px] text-[#545D68] ml-2">
                                on {rep.repayment_date}
                              </span>
                              {rep.notes && (
                                <p className="text-[11px] text-[#545D68] italic mt-0.5">{rep.notes}</p>
                              )}
                            </div>
                            <span className="font-mono font-black text-emerald-700 text-sm">
                              + {formatINR(rep.amount)}
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
      )}

      {/* Modals */}
      {selectedTxnForRepay && (
        <RepayModal
          transaction={selectedTxnForRepay}
          isOpen={true}
          onClose={() => setSelectedTxnForRepay(null)}
          onSuccess={handleRepaySuccess}
        />
      )}

      {selectedBillForCheckout && (
        <RazorpayCheckoutModal
          bill={selectedBillForCheckout}
          isOpen={true}
          onClose={() => setSelectedBillForCheckout(null)}
          onSuccess={handleCheckoutSuccess}
          customerId={currentCustomerId}
        />
      )}

      {selectedBillForDigitalModal && (
        <DigitalBillModal
          bill={selectedBillForDigitalModal}
          onClose={() => setSelectedBillForDigitalModal(null)}
          isBusinessOwner={false}
          customerId={currentCustomerId}
          onRefresh={() => fetchDues(activeFilter, true)}
        />
      )}

      {selectedBillForTimeline && (
        <BillTimelineModal
          billId={selectedBillForTimeline.bill_id || selectedBillForTimeline.id || ""}
          onClose={() => setSelectedBillForTimeline(null)}
          customerId={currentCustomerId || user?.customer_id || undefined}
          businessId={selectedBillForTimeline.shop_id || undefined}
        />
      )}

      {selectedTxnForDispute && (
        <CustomerDisputeModal
          billId={selectedTxnForDispute.id}
          billReference={selectedTxnForDispute.reference}
          shopName={selectedTxnForDispute.shop_name}
          outstandingAmount={selectedTxnForDispute.outstanding_amount}
          customerId={currentCustomerId}
          onClose={() => setSelectedTxnForDispute(null)}
          onSuccess={() => fetchDues(activeFilter, true)}
        />
      )}
    </div>
  );
};
