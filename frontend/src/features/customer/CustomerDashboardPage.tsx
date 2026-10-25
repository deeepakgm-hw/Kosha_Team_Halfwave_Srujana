import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building2,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Bell,
  Smartphone,
  FileText,
  Receipt,
  Clock,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { CustomerDashboardSummary, CreditTransaction, BillPaymentHistory, CustomerProfile } from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { RepayModal } from "./RepayModal";
import { RazorpayCheckoutModal } from "../payments/RazorpayCheckoutModal";
import { DigitalBillModal } from "../../components/bills/DigitalBillModal";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";

export const CustomerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerDashboardSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customerBills, setCustomerBills] = useState<BillPaymentHistory[]>([]);
  const [billFilter, setBillFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [currentCustomerId, setCurrentCustomerId] = useState<string>(() => {
    return localStorage.getItem("kosha_active_customer_id") || "cust_amit_03";
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxnForRepay, setSelectedTxnForRepay] = useState<CreditTransaction | null>(null);
  const [selectedBillForCheckout, setSelectedBillForCheckout] = useState<BillPaymentHistory | null>(null);
  const [selectedBillForDigitalModal, setSelectedBillForDigitalModal] = useState<BillPaymentHistory | null>(null);

  const fetchDashboard = useCallback(
    async (isSilent = false, custId?: string) => {
      if (!isSilent) setIsLoading(true);
      setError(null);
      const targetId = custId || currentCustomerId;
      try {
        const [dashRes, custList, billsList] = await Promise.all([
          apiClient.getCustomerDashboard(targetId),
          apiClient.listShopkeeperCustomers().catch(() => []),
          apiClient.listCustomerBills(targetId).catch(() => []),
        ]);
        setData(dashRes);
        if (custList.length > 0) setCustomers(custList);
        setCustomerBills(billsList || []);
      } catch (err: unknown) {
        setError(formatApiError(err));
      } finally {
        if (!isSilent) setIsLoading(false);
      }
    },
    [currentCustomerId]
  );

  // Real-Time Server-Sent Events listener for live balance updates (silent refresh in background)
  const { isRealTime } = useRealTimeSync({
    onRefresh: () => fetchDashboard(true),
  });

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  const handleSelectCustomer = (newId: string) => {
    setCurrentCustomerId(newId);
    localStorage.setItem("kosha_active_customer_id", newId);
    fetchDashboard(false, newId);
  };

  const handleOpenUpiCheckout = async (txn: CreditTransaction) => {
    const custId = data?.customer?.id || "cust_rahul_01";
    try {
      const history = await apiClient.getBillPaymentHistory(txn.id, custId);
      setSelectedBillForCheckout(history);
    } catch {
      setSelectedBillForCheckout({
        bill_id: txn.id,
        id: txn.id,
        bill_reference: txn.reference || `BILL-${txn.id.slice(-6)}`,
        bill_number: txn.reference || `BILL-${txn.id.slice(-6)}`,
        customer_id: custId,
        customer_name: data?.customer?.display_name || "Valued Customer",
        shop_code: txn.shop_code,
        shop_name: txn.shop_name,
        description: txn.description,
        purchase_date: txn.transaction_date,
        agreed_repayment_date: txn.agreed_repayment_date,
        repayment_due_date: txn.agreed_repayment_date,
        total_amount: txn.purchase_amount,
        initial_manual_paid: txn.initial_paid_amount || 0,
        initial_paid_amount: txn.initial_paid_amount || 0,
        verified_razorpay_paid: 0,
        total_verified_payments: 0,
        outstanding_amount: txn.outstanding_amount,
        status: (txn.status === "upcoming" || txn.status === "due_today" || txn.status === "overdue" || txn.status === "paid") ? txn.status : "upcoming",
        payment_status: "unpaid",
        payment_requests: [],
        verified_payments: [],
      });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleRepaySuccess = (_updatedTxn: CreditTransaction) => {
    fetchDashboard(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-9 h-9 border-3 border-[#0070E0] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[#545D68]">Loading your PayPal Credit overview...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-[#E1E7EC] text-center max-w-md mx-auto my-12 shadow-paypal space-y-4">
        <AlertTriangle className="w-10 h-10 text-[#D9383A] mx-auto" />
        <h3 className="text-lg font-bold text-[#001C64]">Failed to load dashboard</h3>
        <p className="text-xs text-[#545D68]">{error || "Unable to retrieve customer data."}</p>
        <button
          onClick={() => fetchDashboard(false)}
          className="px-6 py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-xs"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* A. Welcome Header (PayPal Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-[#001C64] tracking-tight">
              {getGreeting()}, {data.customer.display_name.split(" ")[0]}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#003087] border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0070E0]" />
              <span>Verified Account</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#545D68] font-medium mt-1">
            PayPal MSME Credit Ledger &amp; Instant Counter Collections
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
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}
          <button
            onClick={() => fetchDashboard(false)}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-slate-50 text-[#001C64] border border-[#E1E7EC] shadow-2xs transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* F. Helpful Status Message Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors shadow-paypal ${
          data.overdue_amount > 0
            ? "bg-rose-50/70 border-rose-200 text-rose-900"
            : data.total_outstanding > 0
            ? "bg-blue-50/70 border-blue-200 text-blue-900"
            : "bg-white border-[#E1E7EC] text-[#001C64]"
        }`}
      >
        {data.overdue_amount > 0 ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-5 h-5 text-[#0070E0] shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
          <p>{data.status_message}</p>
        </div>
        {data.overdue_amount > 0 && (
          <button
            onClick={() => navigate("/customer/dues?status=overdue")}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900 shrink-0"
          >
            Review Overdue
          </button>
        )}
      </div>

      {/* B. Outstanding Balance Cards (PayPal Clean Fintech Card) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between hover:shadow-paypal-lg transition-all">
          <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
            Total Outstanding
          </span>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-[#001C64] font-mono tracking-tight">
              {formatINR(data.total_outstanding)}
            </span>
            <p className="text-[11px] text-[#545D68] mt-0.5">Across all registered shops</p>
          </div>
        </div>

        {/* Due within 7 Days */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between hover:shadow-paypal-lg transition-all">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Due in 7 Days</span>
          </span>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono tracking-tight">
              {formatINR(data.due_within_7_days)}
            </span>
            <p className="text-[11px] text-[#545D68] mt-0.5">Upcoming commitments</p>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between hover:shadow-paypal-lg transition-all">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue Amount</span>
          </span>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 font-mono tracking-tight">
              {formatINR(data.overdue_amount)}
            </span>
            <p className="text-[11px] text-[#545D68] mt-0.5">Past agreed payment date</p>
          </div>
        </div>

        {/* Participating Shops with Dues */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between hover:shadow-paypal-lg transition-all">
          <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>Active Shops</span>
          </span>
          <div className="mt-2">
            <span className="text-2xl sm:text-3xl font-black text-[#001C64] font-mono tracking-tight">
              {data.shops_count}
            </span>
            <p className="text-[11px] text-[#545D68] mt-0.5">Participating merchants</p>
          </div>
        </div>
      </div>

      {/* Exact Financial Reconciliation Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal">
        <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EC]">
          <span className="text-xs font-bold text-[#001C64] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0070E0]" />
            <span>Reconciled Financial Ledger Details</span>
          </span>
          <span className="text-xs font-bold text-[#0070E0] bg-blue-50 px-2.5 py-0.5 rounded-full">
            Exact Invariant Formula
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 text-xs">
          <div>
            <span className="text-[#545D68] block text-[10px] uppercase font-bold">Total Credit Incurred</span>
            <span className="text-base font-black text-[#001C64] font-mono mt-0.5 block">
              {formatINR(data.total_purchase_amount || (data.total_outstanding + (data.total_paid_amount || 0)))}
            </span>
          </div>
          <div>
            <span className="text-[#545D68] block text-[10px] uppercase font-bold">Counter Cash Paid</span>
            <span className="text-base font-bold text-[#0C0C0D] font-mono mt-0.5 block">
              - {formatINR(data.total_initial_paid || 0)}
            </span>
          </div>
          <div>
            <span className="text-[#545D68] block text-[10px] uppercase font-bold">Razorpay Online Paid</span>
            <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
              - {formatINR(data.total_verified_online_paid || 0)}
            </span>
          </div>
          <div>
            <span className="text-rose-600 block text-[10px] uppercase font-black">(=) Exact Remaining Due</span>
            <span className="text-base font-black text-rose-600 font-mono mt-0.5 block">
              = {formatINR(data.total_outstanding)}
            </span>
          </div>
        </div>
      </div>

      {/* C. Quick Actions (PayPal Rounded Cards) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E1E7EC] shadow-paypal">
        <h2 className="text-xs font-bold text-[#545D68] uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Action 1: Scan shop QR */}
          <button
            onClick={() => navigate("/customer/pay")}
            className="p-4 rounded-2xl bg-white hover:bg-blue-50/40 border border-[#E1E7EC] hover:border-[#0070E0] text-left transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-paypal"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0070E0] flex items-center justify-center group-hover:bg-[#0070E0] group-hover:text-white transition-colors">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#001C64] block">Scan Shop QR</span>
              <span className="text-[11px] text-[#545D68]">Instant credit purchase</span>
            </div>
          </button>

          {/* Action 2: Pay a Due (PayPal Gold Accent) */}
          <button
            onClick={() => navigate("/customer/dues")}
            className="p-4 rounded-2xl bg-white hover:bg-amber-50/40 border border-[#E1E7EC] hover:border-[#FFC439] text-left transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-paypal"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#001C64] flex items-center justify-center group-hover:bg-[#FFC439] transition-colors">
              <CreditCard className="w-5 h-5 text-[#001C64]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#001C64] block">Pay a Due</span>
              <span className="text-[11px] text-[#545D68]">Clear pending balance</span>
            </div>
          </button>

          {/* Action 3: View My Dues */}
          <button
            onClick={() => navigate("/customer/dues")}
            className="p-4 rounded-2xl bg-white hover:bg-blue-50/40 border border-[#E1E7EC] hover:border-[#0070E0] text-left transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-paypal"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0070E0] flex items-center justify-center group-hover:bg-[#0070E0] group-hover:text-white transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#001C64] block">View My Dues</span>
              <span className="text-[11px] text-[#545D68]">Filter by merchant</span>
            </div>
          </button>

          {/* Action 4: Enter Shop Code */}
          <button
            onClick={() => navigate("/customer/pay")}
            className="p-4 rounded-2xl bg-white hover:bg-blue-50/40 border border-[#E1E7EC] hover:border-[#0070E0] text-left transition-all group flex flex-col justify-between gap-3 shadow-2xs hover:shadow-paypal"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0070E0] flex items-center justify-center group-hover:bg-[#0070E0] group-hover:text-white transition-colors">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#001C64] block">Enter Shop Code</span>
              <span className="text-[11px] text-[#545D68]">Manual store lookup</span>
            </div>
          </button>
        </div>
      </div>

      {/* D. Repayment Reminders & Alerts */}
      {data.reminders && data.reminders.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#E1E7EC] shadow-paypal space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-extrabold text-[#001C64]">Repayment Reminders</h2>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-0.5 rounded-full border border-amber-200">
              {data.reminders.length} Active Notice{data.reminders.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-2">
            {data.reminders.map((rem) => {
              const isOverdue = rem.urgency === "overdue";
              const isDueToday = rem.urgency === "due_today";

              return (
                <div
                  key={rem.transaction_id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    isOverdue
                      ? "bg-rose-50/70 border-rose-200 text-rose-900"
                      : isDueToday
                      ? "bg-amber-50/70 border-amber-200 text-amber-900"
                      : "bg-blue-50/50 border-blue-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isOverdue ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <p className="font-bold">{rem.message}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">
                        Agreed date: {rem.due_date} · Amount: {formatINR(rem.amount)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const matched = data.upcoming_repayments.find(
                        (t) => t.id === rem.transaction_id
                      );
                      if (matched) setSelectedTxnForRepay(matched);
                      else navigate("/customer/dues");
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-black shrink-0 transition-all ${
                      isOverdue
                        ? "bg-[#D9383A] hover:bg-rose-700 text-white"
                        : "bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64]"
                    }`}
                  >
                    Clear Due
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comprehensive Customer Bills & Purchase Invoices Section */}
      <div className="bg-white rounded-2xl p-5 border border-[#E1E7EC] shadow-paypal space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-[#001C64]">My Store Bills &amp; Invoices</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#003087] border border-blue-200">
                {customerBills.length} Total Bill{customerBills.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-[#545D68]">Complete itemized breakdown, verified cash receipts &amp; UPI payments</p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {(["all", "unpaid", "paid"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setBillFilter(filter)}
                className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                  billFilter === filter
                    ? "bg-[#0070E0] text-white shadow-2xs"
                    : "bg-[#F5F7FA] text-[#545D68] hover:bg-slate-100 border border-[#E1E7EC]"
                }`}
              >
                {filter === "all" ? "All Bills" : filter === "unpaid" ? "Pending Dues" : "Paid & Settled"}
              </button>
            ))}
          </div>
        </div>

        {customerBills.filter((b) => {
          if (billFilter === "paid") return b.outstanding_amount === 0 || b.status === "paid";
          if (billFilter === "unpaid") return b.outstanding_amount > 0 && b.status !== "paid";
          return true;
        }).length === 0 ? (
          <div className="text-center py-8 text-[#545D68] bg-[#F5F7FA] rounded-xl border border-dashed border-[#E1E7EC]">
            <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-[#001C64]">No bills found in this filter</p>
            <p className="text-[11px] text-[#545D68] mt-0.5">Purchases recorded at participating shops will appear here with full line items.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customerBills
              .filter((b) => {
                if (billFilter === "paid") return b.outstanding_amount === 0 || b.status === "paid";
                if (billFilter === "unpaid") return b.outstanding_amount > 0 && b.status !== "paid";
                return true;
              })
              .map((b) => {
                const isPaid = b.outstanding_amount === 0 || b.status === "paid";
                const isOverdue = b.status === "overdue";
                const isDueToday = b.status === "due_today";

                return (
                  <div
                    key={b.bill_id || b.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isPaid
                        ? "bg-emerald-50/20 border-emerald-200 hover:border-emerald-300"
                        : isOverdue
                        ? "bg-rose-50/30 border-rose-200 hover:border-rose-300"
                        : isDueToday
                        ? "bg-amber-50/30 border-amber-200 hover:border-amber-300"
                        : "bg-[#F5F7FA]/70 border-[#E1E7EC] hover:border-[#0070E0]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#001C64] font-mono">
                          {b.bill_reference || b.bill_number}
                        </span>
                        <span className="text-xs font-bold text-slate-700">· {b.shop_name}</span>
                        {b.shop_code && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {b.shop_code}
                          </span>
                        )}
                      </div>

                      <div>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Fully Paid (Settled)</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Overdue</span>
                          </span>
                        ) : isDueToday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Due Today</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-[#003087] border border-blue-200">
                            <Calendar className="w-3 h-3" />
                            <span>Upcoming Due</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#0C0C0D] font-medium">{b.description}</p>

                    {/* Financial 4-metric strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                      <div className="p-2 rounded-xl bg-white border border-[#E1E7EC]">
                        <span className="text-[10px] font-bold text-[#545D68] uppercase block">Total Bill</span>
                        <span className="text-sm font-black text-[#001C64] font-mono mt-0.5 block">{formatINR(b.total_amount)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-[#E1E7EC]">
                        <span className="text-[10px] font-bold text-[#545D68] uppercase block">Counter Cash</span>
                        <span className="text-sm font-bold text-slate-700 font-mono mt-0.5 block">{formatINR(b.initial_manual_paid ?? (b as any).initial_paid_amount ?? 0)}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-[#E1E7EC]">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Verified Online</span>
                        <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">{formatINR(b.verified_razorpay_paid ?? (b as any).total_verified_payments ?? 0)}</span>
                      </div>
                      <div className={`p-2 rounded-xl border ${b.outstanding_amount === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                        <span className="text-[10px] font-bold uppercase block">{b.outstanding_amount === 0 ? "Remaining Balance" : "Remaining Due"}</span>
                        <span className="text-sm font-black font-mono mt-0.5 block">{formatINR(b.outstanding_amount)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                      <span className="text-[11px] text-[#545D68]">
                        Due Date: <strong className="text-slate-800">{b.agreed_repayment_date}</strong>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedBillForDigitalModal(b)}
                          className="px-3.5 py-1.5 rounded-full border border-[#E1E7EC] hover:bg-slate-100 text-[#001C64] text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#0070E0]" />
                          <span>View Digital Bill &amp; Breakdown</span>
                        </button>

                        {b.outstanding_amount > 0 && (
                          <button
                            onClick={() => setSelectedBillForDigitalModal(b)}
                            className="px-4 py-1.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black shadow-xs flex items-center gap-1.5 active:scale-[0.98] transition-all"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pay via UPI ({formatINR(b.outstanding_amount)})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* E. Upcoming Repayments (PayPal Card Style with Gold Action Pill) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E1E7EC] shadow-paypal space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#001C64]">Upcoming Repayments</h2>
            <p className="text-xs text-[#545D68]">Nearest agreed dates across shops</p>
          </div>
          <button
            onClick={() => navigate("/customer/dues")}
            className="text-xs font-bold text-[#0070E0] hover:text-[#003087] inline-flex items-center gap-1"
          >
            <span>View All ({data.upcoming_repayments.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {data.upcoming_repayments.length === 0 ? (
          <div className="text-center py-10 text-[#545D68] bg-[#F5F7FA] rounded-xl border border-dashed border-[#E1E7EC]">
            <CheckCircle2 className="w-9 h-9 mx-auto text-[#0070E0] mb-2" />
            <p className="text-xs font-bold text-[#001C64]">No upcoming commitments</p>
            <p className="text-[11px] text-[#545D68] mt-0.5">All your shop purchases are clear!</p>
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
                      : "bg-[#F5F7FA]/70 border-[#E1E7EC] hover:border-[#0070E0]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#001C64]">{txn.shop_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isOverdue
                            ? "bg-rose-100 text-rose-800"
                            : isDueToday
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-[#003087]"
                        }`}
                      >
                        {isOverdue ? "Overdue" : isDueToday ? "Due Today" : "Upcoming"}
                      </span>
                    </div>
                    <p className="text-xs text-[#0C0C0D] font-medium">{txn.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-[#545D68]">
                      <span>Agreed due: <strong className="text-[#001C64]">{txn.agreed_repayment_date}</strong></span>
                      <span>·</span>
                      <span>Total: {formatINR(txn.purchase_amount)}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-[#545D68] block">Remaining Due</span>
                      <span className="text-base font-black text-rose-600 font-mono">
                        {formatINR(txn.outstanding_amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const custId = data?.customer?.id || "cust_rahul_01";
                          try {
                            const b = await apiClient.getBillPaymentHistory(txn.id, custId);
                            setSelectedBillForDigitalModal(b);
                          } catch {
                            handleOpenUpiCheckout(txn);
                          }
                        }}
                        className="px-3 py-2 rounded-full border border-[#E1E7EC] hover:bg-slate-100 text-[#001C64] text-xs font-bold transition-all flex items-center gap-1"
                        title="View Official Digital Bill & Itemized Breakdown"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#0070E0]" />
                        <span>View Bill</span>
                      </button>

                      {/* PayPal Gold Action Button */}
                      <button
                        onClick={() => handleOpenUpiCheckout(txn)}
                        className="px-4 py-2 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 active:scale-[0.98]"
                        title="Pay instantly via UPI QR or Razorpay"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Pay UPI</span>
                      </button>
                      <button
                        onClick={() => setSelectedTxnForRepay(txn)}
                        className="px-3 py-2 rounded-full border border-[#E1E7EC] hover:bg-slate-100 text-[#545D68] text-xs font-bold transition-all"
                        title="Document counter or manual repayment"
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* E. Recent Activity */}
      <div className="bg-white rounded-2xl p-5 border border-[#E1E7EC] shadow-paypal space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#001C64]">Recent Activity</h2>
            <p className="text-xs text-[#545D68]">Audit timeline of purchases and repayments</p>
          </div>
          <button
            onClick={() => navigate("/customer/activity")}
            className="text-xs font-bold text-[#0070E0] hover:text-[#003087] inline-flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {data.recent_activity.length === 0 ? (
          <div className="text-center py-8 text-[#545D68] bg-[#F5F7FA] rounded-xl border border-dashed border-[#E1E7EC]">
            <p className="text-xs font-bold text-[#001C64]">No recent activity</p>
            <p className="text-[11px] text-[#545D68]">Transactions recorded at shops will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl border border-[#E1E7EC] hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <p className="font-bold text-[#001C64]">{act.title}</p>
                  <p className="text-[11px] text-[#545D68] mt-0.5">{act.description}</p>
                </div>
                {act.amount !== undefined && (
                  <span className="font-mono font-bold text-[#001C64] text-xs">
                    {formatINR(act.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
          onSuccess={() => {
            setSelectedBillForCheckout(null);
            fetchDashboard(true);
          }}
          customerId={data.customer.id}
        />
      )}

      {selectedBillForDigitalModal && (
        <DigitalBillModal
          bill={selectedBillForDigitalModal}
          onClose={() => setSelectedBillForDigitalModal(null)}
          isBusinessOwner={false}
          customerId={data.customer.id}
          onRefresh={() => fetchDashboard(true)}
        />
      )}
    </div>
  );
};
