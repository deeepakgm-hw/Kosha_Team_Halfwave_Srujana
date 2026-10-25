import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Receipt,
  Clock,
  ArrowDownLeft,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { apiClient, formatApiError } from "../../lib/api";
import { CustomerDashboardSummary, CreditTransaction, BillPaymentHistory, CustomerProfile } from "../../types/customer";
import { AutopayMandate } from "../../types/autopay";
import { formatINR } from "../../lib/utils";
import { RepayModal } from "./RepayModal";
import { RazorpayCheckoutModal } from "../payments/RazorpayCheckoutModal";
import { DigitalBillModal } from "../../components/bills/DigitalBillModal";
import { BillTimelineModal } from "../../components/bills/BillTimelineModal";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";
import { useAuth } from "../../context/AuthContext";

export const CustomerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<CustomerDashboardSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customerBills, setCustomerBills] = useState<BillPaymentHistory[]>([]);
  const [customerMandates, setCustomerMandates] = useState<AutopayMandate[]>([]);
  const [currentCustomerId, setCurrentCustomerId] = useState<string>(() => {
    return user?.customer_id || localStorage.getItem("kosha_active_customer_id") || "";
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedTxnForRepay, setSelectedTxnForRepay] = useState<CreditTransaction | null>(null);
  const [selectedBillForCheckout, setSelectedBillForCheckout] = useState<BillPaymentHistory | null>(null);
  const [selectedBillForDigitalModal, setSelectedBillForDigitalModal] = useState<BillPaymentHistory | null>(null);
  const [selectedBillIdForTimeline, setSelectedBillIdForTimeline] = useState<string | null>(null);
  const [showMyQrModal, setShowMyQrModal] = useState<boolean>(false);
  const [myQrDataUrl, setMyQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (user?.customer_id && user.customer_id !== currentCustomerId) {
      setCurrentCustomerId(user.customer_id);
    }
  }, [user?.customer_id]);

  const fetchDashboard = useCallback(
    async (isSilent = false, custId?: string) => {
      const targetId = custId || currentCustomerId || user?.customer_id;
      if (!targetId) {
        setIsLoading(false);
        return;
      }
      if (!isSilent) setIsLoading(true);
      setError(null);
      try {
        const [dashRes, custList, billsList, mandatesList] = await Promise.all([
          apiClient.getCustomerDashboard(targetId),
          user?.role === "customer" ? Promise.resolve([]) : apiClient.listShopkeeperCustomers().catch(() => []),
          apiClient.listCustomerBills(targetId).catch(() => []),
          apiClient.listCustomerAutopayMandates(targetId).catch(() => []),
        ]);
        setData(dashRes);
        if (custList.length > 0) setCustomers(custList);
        setCustomerBills(billsList || []);
        setCustomerMandates(mandatesList || []);
      } catch (err: unknown) {
        setError(formatApiError(err));
      } finally {
        if (!isSilent) setIsLoading(false);
      }
    },
    [currentCustomerId, user?.customer_id, user?.role]
  );

  // Real-Time SSE listener
  const { isRealTime } = useRealTimeSync({
    onRefresh: () => fetchDashboard(true),
  });

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  // Generate Customer QR Code
  useEffect(() => {
    if (showMyQrModal && data?.customer) {
      const payload = `upi://pay?pa=kosha.customer@razorpay&pn=${encodeURIComponent(data.customer.display_name)}&cu=INR&tn=KOSHA-CUST-${data.customer.id}`;
      QRCode.toDataURL(payload, {
        width: 280,
        margin: 2,
        color: {
          dark: "#064e3b",
          light: "#ffffff",
        },
      }).then(setMyQrDataUrl).catch(() => {});
    }
  }, [showMyQrModal, data?.customer]);

  const handleSelectCustomer = (newId: string) => {
    setCurrentCustomerId(newId);
    localStorage.setItem("kosha_active_customer_id", newId);
    fetchDashboard(false, newId);
  };

  const handleOpenUpiCheckout = async (txn: CreditTransaction) => {
    const custId = data?.customer?.id || user?.customer_id || "cust_rahul_01";
    try {
      const history = await apiClient.getBillPaymentHistory(txn.id, custId);
      setSelectedBillForCheckout(history);
    } catch {
      setSelectedBillForCheckout({
        bill_id: txn.id,
        id: txn.id,
        bill_reference: txn.reference,
        shop_id: txn.shop_id,
        shop_name: txn.shop_name,
        customer_id: custId,
        customer_name: data?.customer?.display_name || user?.full_name || "Customer",
        total_amount: txn.purchase_amount,
        initial_manual_paid: txn.initial_paid_amount || 0,
        verified_razorpay_paid: 0,
        outstanding_amount: txn.outstanding_amount,
        status: txn.status,
        agreed_repayment_date: txn.agreed_repayment_date,
        description: txn.description,
        verified_payments: [],
      });
    }
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

  // Find nearest unpaid bill
  const nearestUnpaidBill = customerBills
    .filter((b) => b.outstanding_amount > 0)
    .sort((a, b) => new Date(a.agreed_repayment_date || "").getTime() - new Date(b.agreed_repayment_date || "").getTime())[0];

  // Active AutoPay mandate detection
  const activeMandate = customerMandates.find((m) => m.status === "active");

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading your UPI payment dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-rose-200 text-center space-y-3 max-w-lg mx-auto mt-8">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Dashboard Unavailable</h2>
        <p className="text-xs text-slate-500">{error || "Unable to retrieve customer data."}</p>
        <button
          onClick={() => fetchDashboard(false)}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const customerFirstName = (data.customer.display_name || user?.full_name || "Member").split(" ")[0];

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* A. Top Header: User Greeting & Account Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {getGreeting()}, {customerFirstName}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Customer</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            KOSHA UPI Payments, Smart Dues &amp; Instant Counter Settlements
          </p>
        </div>

        {/* Right Switcher / Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {customers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Account:</span>
              <select
                value={currentCustomerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer"
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </span>
          )}

          <button
            onClick={() => fetchDashboard(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* B. LEVEL 1: Primary UPI Payment Actions Grid (Large & Touch-Friendly) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Action 1: Scan & Pay (Hero Emphasis) */}
        <button
          onClick={() => navigate("/customer/pay")}
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-left transition-all group flex flex-col justify-between gap-3 shadow-md shadow-emerald-600/25 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black block">Scan &amp; Pay</span>
              <ChevronRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-emerald-100 block mt-0.5 font-medium">Scan merchant UPI QR</span>
          </div>
        </button>

        {/* Action 2: Receive Money / My QR */}
        <button
          onClick={() => setShowMyQrModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 block">My QR Code</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">Receive credit &amp; refund</span>
          </div>
        </button>

        {/* Action 3: Pay Bills */}
        <button
          onClick={() => navigate("/customer/dues")}
          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 block">Pay Bills</span>
              {data.total_outstanding > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              )}
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">Clear pending balance</span>
          </div>
        </button>

        {/* Action 4: View Transactions */}
        <button
          onClick={() => navigate("/customer/activity")}
          className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 text-left transition-all group flex flex-col justify-between gap-3 shadow-xs hover:border-emerald-300 active:scale-[0.98] cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 block">History</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">Receipts &amp; timeline</span>
          </div>
        </button>
      </div>

      {/* C. LEVEL 2: Outstanding Dues Hero Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Current Outstanding Dues</span>
            </span>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">
                {formatINR(data.total_outstanding)}
              </span>
              {data.overdue_amount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>{formatINR(data.overdue_amount)} Overdue</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>No Overdue Penalties</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data.shops_count} participating store{data.shops_count === 1 ? "" : "s"} with active balances
            </p>
          </div>

          {/* Pay Now & View All Dues Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {data.total_outstanding > 0 && nearestUnpaidBill ? (
              <button
                onClick={() => setSelectedBillForCheckout(nearestUnpaidBill)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Now ({formatINR(nearestUnpaidBill.outstanding_amount)})</span>
              </button>
            ) : (
              <button
                onClick={() => navigate("/customer/dues")}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                View Bills
              </button>
            )}

            <button
              onClick={() => navigate("/customer/dues")}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              View All Dues
            </button>
          </div>
        </div>

        {/* Financial Ledger Invariant Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs pt-1">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Credit Incurred</span>
            <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
              {formatINR(data.total_purchase_amount || data.total_outstanding)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Counter Cash Paid</span>
            <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
              - {formatINR(data.total_initial_paid || 0)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Razorpay Online Paid</span>
            <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">
              - {formatINR(data.total_verified_online_paid || 0)}
            </span>
          </div>
          <div>
            <span className="text-rose-600 block text-[10px] uppercase font-black">(=) Remaining Balance</span>
            <span className="text-sm font-black text-rose-600 font-mono mt-0.5 block">
              = {formatINR(data.total_outstanding)}
            </span>
          </div>
        </div>
      </div>

      {/* D. AutoPay Status Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">AutoPay &amp; Smart Recurring Dues</h3>
              {activeMandate ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Mandate
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  Not Configured
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeMandate
                ? `Protected with authorized auto-collection on repayment deadline (Limit: ${formatINR(activeMandate.max_amount)}).`
                : "Authorize scheduled bank collection to protect your credit score without manual intervention."}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate("/customer/dues?tab=autopay")}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 transition-colors cursor-pointer shrink-0"
        >
          {activeMandate ? "Manage AutoPay" : "Setup AutoPay"}
        </button>
      </div>

      {/* E. LEVEL 1: Recent Payment Transactions Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Recent Transactions</span>
            </h2>
            <p className="text-xs text-slate-500">Verified payment receipts, credit purchases, and settlement receipts</p>
          </div>
          <button
            onClick={() => navigate("/customer/activity")}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!data.upcoming_repayments || data.upcoming_repayments.length === 0) ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-medium">No transactions recorded yet.</p>
            <button
              onClick={() => navigate("/customer/pay")}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Make First Payment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.upcoming_repayments.map((txn: CreditTransaction) => (
              <div
                key={txn.id}
                onClick={() => setSelectedBillIdForTimeline(txn.id)}
                className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-xs cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">
                      {txn.shop_name}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {txn.description} &bull; {txn.transaction_date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 font-mono block">
                      {formatINR(txn.purchase_amount)}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider ${
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
                  {txn.status !== "paid" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUpiCheckout(txn);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                    >
                      Pay
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer QR Modal */}
      {showMyQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                My Customer UPI QR
              </span>
              <button
                onClick={() => setShowMyQrModal(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">{data.customer.display_name}</h3>
              <p className="text-xs text-slate-500 font-mono">{data.customer.phone}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl inline-block border border-slate-200/80 shadow-inner">
              {myQrDataUrl ? (
                <img
                  src={myQrDataUrl}
                  alt="My UPI QR"
                  className="w-48 h-48 mx-auto rounded-lg shadow-xs"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Show this QR code at participating KOSHA stores to verify your credit ledger or receive digital refunds.
            </p>

            <button
              onClick={() => setShowMyQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Digital Bill Modal */}
      {selectedBillForDigitalModal && (
        <DigitalBillModal
          bill={selectedBillForDigitalModal}
          onClose={() => setSelectedBillForDigitalModal(null)}
        />
      )}

      {/* Bill Timeline Modal */}
      {selectedBillIdForTimeline && (
        <BillTimelineModal
          billId={selectedBillIdForTimeline}
          onClose={() => setSelectedBillIdForTimeline(null)}
        />
      )}

      {/* Razorpay Checkout Modal */}
      {selectedBillForCheckout && (
        <RazorpayCheckoutModal
          isOpen={!!selectedBillForCheckout}
          bill={selectedBillForCheckout}
          onClose={() => setSelectedBillForCheckout(null)}
          onSuccess={() => {
            setSelectedBillForCheckout(null);
            fetchDashboard(true);
          }}
        />
      )}

      {/* Repay Modal */}
      {selectedTxnForRepay && (
        <RepayModal
          isOpen={!!selectedTxnForRepay}
          transaction={selectedTxnForRepay}
          onClose={() => setSelectedTxnForRepay(null)}
          onSuccess={() => {
            setSelectedTxnForRepay(null);
            fetchDashboard(true);
          }}
        />
      )}
    </div>
  );
};
