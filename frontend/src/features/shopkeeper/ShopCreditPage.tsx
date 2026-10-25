import React, { useState, useEffect } from "react";
import {
  QrCode,
  Download,
  Copy,
  Check,
  Search,
  DollarSign,
  AlertTriangle,
  Users,
  CheckCircle2,
  Calendar,
  Store,
  CreditCard,
  X,
  Eye,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  FileText,
} from "lucide-react";
import QRCode from "qrcode";
import { apiClient, formatApiError } from "../../lib/api";
import {
  Shop,
  ShopkeeperSummary,
  ShopkeeperTransaction,
  BillPaymentHistory,
} from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { BusinessPaymentsSection } from "../payments/BusinessPaymentsSection";
import { DigitalBillModal } from "../../components/bills/DigitalBillModal";

export const ShopCreditPage: React.FC = () => {
  const [selectedShopCode, setSelectedShopCode] = useState<string>("KOSHA-APEX");
  const [activeTab, setActiveTab] = useState<"credit_ledger" | "razorpay_upi">("credit_ledger");
  const [shops, setShops] = useState<Shop[]>([]);
  const [summary, setSummary] = useState<ShopkeeperSummary | null>(null);
  const [transactions, setTransactions] = useState<ShopkeeperTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // QR Code State
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Modals
  const [selectedTxnForDetails, setSelectedTxnForDetails] = useState<ShopkeeperTransaction | null>(null);
  const [selectedTxnForPayment, setSelectedTxnForPayment] = useState<ShopkeeperTransaction | null>(null);
  const [selectedBillForDigitalModal, setSelectedBillForDigitalModal] = useState<BillPaymentHistory | null>(null);

  // Payment Recording State
  const [repayAmount, setRepayAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("shopkeeper_cash");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 1. Load Shops List
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const res = await apiClient.listShops();
        setShops(res);
      } catch {
        // Fallback default
      }
    };
    fetchShops();
  }, []);

  // 2. Load Data for Selected Shop
  const loadShopData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, txnsRes] = await Promise.all([
        apiClient.getShopkeeperSummary(selectedShopCode),
        apiClient.getShopkeeperTransactions(selectedShopCode, statusFilter, searchQuery),
      ]);
      setSummary(sumRes);
      setTransactions(txnsRes);

      // Generate crisp QR code data URL client-side safely
      try {
        const qrPayload = `kosha://shop/${selectedShopCode}`;
        const url = await QRCode.toDataURL(qrPayload, {
          width: 320,
          margin: 2,
          color: {
            dark: "#0a2540",
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);
      } catch {
        // Fallback in environments without canvas (e.g. jsdom tests)
        setQrDataUrl("");
      }
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShopData();
  }, [selectedShopCode, statusFilter]);

  // Handle Search on Submit or Debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadShopData();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedShopCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `KOSHA_QR_${selectedShopCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openPaymentModal = (txn: ShopkeeperTransaction) => {
    setSelectedTxnForPayment(txn);
    setRepayAmount(txn.outstanding_amount.toString());
    setPaymentMethod("shopkeeper_cash");
    setPaymentNotes("");
    setPaymentError(null);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxnForPayment) return;

    const parsed = parseFloat(repayAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setPaymentError("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    if (parsed > selectedTxnForPayment.outstanding_amount) {
      setPaymentError(`Payment amount cannot exceed outstanding balance of ${formatINR(selectedTxnForPayment.outstanding_amount)}.`);
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentError(null);
    try {
      await apiClient.recordShopkeeperRepayment(
        selectedTxnForPayment.id,
        {
          amount: parsed,
          payment_method: paymentMethod,
          notes: paymentNotes.trim() || undefined,
        },
        selectedShopCode
      );
      setSelectedTxnForPayment(null);
      loadShopData();
    } catch (err: unknown) {
      setPaymentError(formatApiError(err));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Shop Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E1E7EC] shadow-paypal">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0070E0]/10 text-[#0070E0] flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#001C64] tracking-tight">
                Shop Credit &amp; Receivables
              </h1>
              <p className="text-xs text-[#545D68] font-medium mt-0.5">
                Real-time customer credit ledger, QR codes, and counter collections.
              </p>
            </div>
          </div>
        </div>

        {/* Shop Switcher & Refresh */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] text-xs font-bold text-slate-700">
            <span className="px-3 text-[#545D68] font-semibold uppercase text-[10px]">
              Active Store:
            </span>
            {shops.length > 0 ? (
              shops.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedShopCode(s.shop_code)}
                  className={`px-3.5 py-1.5 rounded-full transition-all text-xs ${
                    selectedShopCode === s.shop_code
                      ? "bg-white text-[#001C64] shadow-xs font-black border border-[#E1E7EC]"
                      : "text-[#545D68] hover:text-[#0C0C0D]"
                  }`}
                >
                  {s.shop_name.split(" ")[0]} ({s.shop_code})
                </button>
              ))
            ) : (
              <span className="px-3 text-slate-600">Apex Precision Works</span>
            )}
          </div>

          <button
            onClick={() => setActiveTab("razorpay_upi")}
            className="px-5 py-2 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white font-bold text-xs shadow-paypal flex items-center gap-1.5 transition-all active:scale-[0.98]"
            title="Create new customer bill with Razorpay UPI QR"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Customer Bill</span>
          </button>

          <button
            onClick={loadShopData}
            className="p-2.5 rounded-full bg-white hover:bg-[#F5F7FA] border border-[#E1E7EC] shadow-xs text-[#545D68] hover:text-[#001C64] transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-full border border-[#E1E7EC] shadow-paypal max-w-fit">
        <button
          onClick={() => setActiveTab("credit_ledger")}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "credit_ledger"
              ? "bg-[#0070E0] text-white shadow-xs"
              : "text-[#545D68] hover:text-[#0C0C0D] hover:bg-[#F5F7FA]"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Shop Credit Ledger &amp; Counter</span>
        </button>
        <button
          onClick={() => setActiveTab("razorpay_upi")}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "razorpay_upi"
              ? "bg-[#0070E0] text-white shadow-xs"
              : "text-[#545D68] hover:text-[#0C0C0D] hover:bg-[#F5F7FA]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Razorpay UPI Payments</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-800 font-black uppercase">
            Live Gateway
          </span>
        </button>
      </div>

      {activeTab === "razorpay_upi" ? (
        <BusinessPaymentsSection />
      ) : (
        <>
          {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>Total Receivables</span>
          </span>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-[#001C64] font-mono tracking-tight">
              {summary ? formatINR(summary.total_customer_receivables) : "₹0"}
            </span>
            <p className="text-[10px] text-[#545D68] mt-0.5">Outstanding customer dues</p>
          </div>
        </div>

        {/* Collected Today */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Collected Today</span>
          </span>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight">
              {summary ? formatINR(summary.collected_today) : "₹0"}
            </span>
            <p className="text-[10px] text-[#545D68] mt-0.5">Counter cash &amp; verified digital</p>
          </div>
        </div>

        {/* Due in 7 Days */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Due in 7 Days</span>
          </span>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono tracking-tight">
              {summary ? formatINR(summary.due_in_7_days) : "₹0"}
            </span>
            <p className="text-[10px] text-[#545D68] mt-0.5">Upcoming commitments</p>
          </div>
        </div>

        {/* Overdue Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue Receivables</span>
          </span>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono tracking-tight">
              {summary ? formatINR(summary.overdue_receivables) : "₹0"}
            </span>
            <p className="text-[10px] text-[#545D68] mt-0.5">Past agreed date</p>
          </div>
        </div>

        {/* Customers with Balance */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#545D68]" />
            <span>Active Debtors</span>
          </span>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-[#001C64] font-mono tracking-tight">
              {summary ? summary.customers_with_balance_count : 0}
            </span>
            <p className="text-[10px] text-[#545D68] mt-0.5">Customers with balance</p>
          </div>
        </div>
      </div>

      {/* 3. Shop QR Code Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E1E7EC] shadow-paypal flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#0070E0]/10 text-[#0070E0] border border-[#0070E0]/20">
            <QrCode className="w-3.5 h-3.5" />
            <span>Official Shop Identification QR</span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#001C64] tracking-tight">
              {summary?.shop.shop_name || "Merchant Shop"}
            </h2>
            <p className="text-xs sm:text-sm text-[#545D68] font-medium mt-1 leading-relaxed">
              Display this QR code at your checkout counter. When customers scan it using KOSHA, it securely resolves your store details to record credit purchases.
            </p>
          </div>

          <div className="flex items-center gap-2.5 pt-1 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#F5F7FA] text-xs font-mono font-bold text-slate-800 border border-[#E1E7EC]">
              <span className="text-[#545D68]">Shop Code:</span>
              <span className="text-[#0070E0]">{selectedShopCode}</span>
            </div>

            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white hover:bg-[#F5F7FA] text-[#001C64] border border-[#E1E7EC] shadow-xs transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#0070E0]" />}
              <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
            </button>

            <button
              onClick={handleDownloadQr}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-[#0070E0] hover:bg-[#003087] text-white shadow-paypal transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download QR (PNG)</span>
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#F5F7FA] hover:bg-[#E1E7EC] text-[#001C64] border border-[#E1E7EC] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Fullscreen QR Display</span>
            </button>
          </div>
        </div>

        {/* QR Preview Thumbnail */}
        <div
          onClick={() => setShowQrModal(true)}
          className="cursor-pointer bg-white p-3 rounded-2xl border-2 border-[#E1E7EC] shadow-paypal hover:border-[#0070E0] transition-all group shrink-0 text-center"
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Shop QR" className="w-32 h-32 rounded-xl object-contain mx-auto" />
          ) : (
            <div className="w-32 h-32 bg-[#F5F7FA] rounded-xl flex items-center justify-center">
              <QrCode className="w-8 h-8 text-slate-300 animate-pulse" />
            </div>
          )}
          <span className="text-[10px] font-bold text-[#545D68] group-hover:text-[#0070E0] block mt-1.5">
            Click to expand
          </span>
        </div>
      </div>

      {/* 4. Transactions Ledger Table */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E1E7EC] shadow-paypal space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#001C64]">Customer Transactions Ledger</h2>
            <p className="text-xs text-[#545D68] font-medium">
              Synchronized credit purchases and repayment history for this store.
            </p>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[#545D68] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, customer..."
              className="w-full pl-9 pr-3 py-2 rounded-full border border-[#E1E7EC] text-xs focus:outline-none focus:ring-2 focus:ring-[#0070E0] bg-[#F5F7FA]"
            />
          </form>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-semibold">
          {[
            { id: "all", label: "All Transactions" },
            { id: "outstanding", label: "Outstanding" },
            { id: "due_today", label: "Due Today" },
            { id: "upcoming", label: "Upcoming" },
            { id: "overdue", label: "Overdue" },
            { id: "paid", label: "Fully Settled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap text-xs font-semibold ${
                statusFilter === tab.id
                  ? "bg-[#0070E0] text-white shadow-xs font-bold"
                  : "bg-[#F5F7FA] text-[#545D68] hover:bg-[#E1E7EC]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-[#0070E0] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#545D68]">Loading shop transactions...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center text-xs text-rose-700">
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 rounded-2xl bg-[#F5F7FA] border border-dashed border-[#E1E7EC] text-center space-y-2">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No transactions found</h3>
            <p className="text-xs text-[#545D68] max-w-sm mx-auto">
              No transactions match the selected filter for {selectedShopCode}. Customers can record credit by scanning your store's QR code.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E1E7EC] text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Purchase Date</th>
                  <th className="py-3 px-3">Agreed Repayment</th>
                  <th className="py-3 px-3 text-right">Original</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E7EC] text-xs">
                {transactions.map((t) => {
                  const isPaid = t.status === "paid";
                  const isOverdue = t.status === "overdue";
                  const isDueToday = t.status === "due_today";

                  return (
                    <tr key={t.id} className="hover:bg-[#F5F7FA]/70 transition-colors">
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-[#001C64] block">{t.reference}</span>
                        <span className="text-[11px] text-[#545D68] line-clamp-1">{t.description}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 block">{t.customer_name}</span>
                        <span className="text-[11px] text-[#545D68]">{t.customer_phone}</span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {new Date(t.transaction_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-3 font-medium">
                        <span
                          className={
                            isOverdue
                              ? "text-rose-600 font-bold"
                              : isDueToday
                              ? "text-amber-700 font-bold"
                              : "text-slate-700"
                          }
                        >
                          {new Date(t.agreed_repayment_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-700">
                        {formatINR(t.purchase_amount)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black">
                        <span
                          className={
                            isPaid
                              ? "text-emerald-600"
                              : isOverdue
                              ? "text-rose-600"
                              : "text-[#001C64]"
                          }
                        >
                          {formatINR(t.outstanding_amount)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isOverdue
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isDueToday
                              ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                              : "bg-[#0070E0]/10 text-[#0070E0] border border-[#0070E0]/20"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={async () => {
                              try {
                                const bill = await apiClient.getShopkeeperBill(t.id);
                                setSelectedBillForDigitalModal(bill);
                              } catch {
                                setSelectedTxnForDetails(t);
                              }
                            }}
                            className="p-1.5 rounded-full text-[#0070E0] hover:bg-[#0070E0]/10 transition-colors"
                            title="View Official Digital Bill & Itemized Breakdown"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedTxnForDetails(t)}
                            className="p-1.5 rounded-full text-[#545D68] hover:text-[#001C64] hover:bg-[#F5F7FA] transition-colors"
                            title="View Payment History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isPaid && (
                            <button
                              onClick={() => openPaymentModal(t)}
                              className="px-3.5 py-1.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] font-bold text-[11px] shadow-xs transition-colors flex items-center gap-1"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Record Pay</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Fullscreen QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full border border-[#E1E7EC] text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0070E0] bg-[#0070E0]/10 px-3 py-1 rounded-full border border-[#0070E0]/20">
                Counter QR Code
              </span>
              <h3 className="text-xl font-black text-[#001C64] mt-2 tracking-tight">
                {summary?.shop.shop_name}
              </h3>
              <p className="text-xs text-[#545D68] font-medium mt-0.5">
                Scan with KOSHA app to record credit
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border-2 border-[#E1E7EC] shadow-sm inline-block">
              {qrDataUrl && <img src={qrDataUrl} alt="Store QR" className="w-56 h-56 mx-auto" />}
            </div>

            <div className="bg-[#F5F7FA] rounded-full p-3 text-xs font-mono font-bold text-slate-700 border border-[#E1E7EC]">
              Shop Code: <span className="text-[#0070E0]">{selectedShopCode}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleDownloadQr}
                className="w-full py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-paypal transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Save Image</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-full bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 text-xs font-bold transition-colors border border-[#E1E7EC]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Transaction Details & Payment History Modal */}
      {selectedTxnForDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full border border-[#E1E7EC] my-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EC]">
              <div>
                <h3 className="text-base font-black text-[#001C64]">Transaction Details</h3>
                <span className="font-mono text-xs font-bold text-[#0070E0]">{selectedTxnForDetails.reference}</span>
              </div>
              <button
                onClick={() => setSelectedTxnForDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overview */}
            <div className="bg-[#F5F7FA] rounded-2xl p-4 space-y-2.5 border border-[#E1E7EC] text-xs">
              <div className="flex justify-between">
                <span className="text-[#545D68] font-medium">Customer:</span>
                <span className="font-bold text-slate-800">{selectedTxnForDetails.customer_name} ({selectedTxnForDetails.customer_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#545D68] font-medium">Description:</span>
                <span className="font-bold text-slate-800">{selectedTxnForDetails.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#545D68] font-medium">Original Purchase:</span>
                <span className="font-mono font-bold text-[#001C64]">{formatINR(selectedTxnForDetails.purchase_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#545D68] font-medium">Initial Paid:</span>
                <span className="font-mono font-bold text-emerald-700">{formatINR(selectedTxnForDetails.initial_paid_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E1E7EC] pt-2 font-bold">
                <span className="text-[#001C64]">Remaining Balance:</span>
                <span className="font-mono text-sm text-[#001C64]">{formatINR(selectedTxnForDetails.outstanding_amount)}</span>
              </div>
            </div>

            {/* Repayment History */}
            <div>
              <h4 className="text-xs font-bold text-[#545D68] uppercase tracking-wider mb-2">
                Payment History ({selectedTxnForDetails.repayments.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedTxnForDetails.repayments.map((r, i) => (
                  <div key={r.id || i} className="p-3 rounded-xl bg-[#F5F7FA] border border-[#E1E7EC] text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{formatINR(r.amount)}</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-semibold">
                          {r.payment_method.replace("_", " ")}
                        </span>
                        {r.recorded_by === "shopkeeper" && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#0070E0]/10 text-[#0070E0] font-bold border border-[#0070E0]/20">
                            By Shop
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#545D68] mt-0.5">{r.notes || "No notes"}</p>
                    </div>
                    <span className="text-[10px] font-medium text-[#545D68]">
                      {new Date(r.repayment_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E1E7EC]">
              <button
                onClick={() => setSelectedTxnForDetails(null)}
                className="px-5 py-2 rounded-full bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 text-xs font-bold border border-[#E1E7EC]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Record Counter Payment Modal */}
      {selectedTxnForPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full border border-[#E1E7EC] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EC]">
              <div>
                <h3 className="text-base font-black text-[#001C64]">Record Received Payment</h3>
                <p className="text-xs text-[#545D68]">Record cash/UPI collected directly from customer</p>
              </div>
              <button
                onClick={() => setSelectedTxnForPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div className="bg-[#F5F7FA] p-3.5 rounded-2xl border border-[#E1E7EC] text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#545D68]">Customer:</span>
                  <span className="font-bold text-slate-800">{selectedTxnForPayment.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#545D68]">Reference:</span>
                  <span className="font-mono font-bold text-[#0070E0]">{selectedTxnForPayment.reference}</span>
                </div>
                <div className="flex justify-between border-t border-[#E1E7EC] pt-1.5 font-bold">
                  <span className="text-[#001C64]">Outstanding Balance:</span>
                  <span className="font-mono text-sm text-rose-600">{formatINR(selectedTxnForPayment.outstanding_amount)}</span>
                </div>
              </div>

              {paymentError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {paymentError}
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedTxnForPayment.outstanding_amount}
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E1E7EC] font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                  required
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setRepayAmount(selectedTxnForPayment.outstanding_amount.toString())}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    Full ({formatINR(selectedTxnForPayment.outstanding_amount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayAmount((selectedTxnForPayment.outstanding_amount / 2).toFixed(2))}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-[#F5F7FA] text-slate-700 border border-[#E1E7EC]"
                  >
                    Half ({formatINR(selectedTxnForPayment.outstanding_amount / 2)})
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E7EC] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0070E0] bg-white"
                >
                  <option value="shopkeeper_cash">Cash at Counter</option>
                  <option value="shopkeeper_upi">Direct Store UPI</option>
                  <option value="shopkeeper_bank">Bank Transfer / IMPS</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Received in 500 notes / GPay receipt"
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E7EC] text-xs focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E1E7EC]">
                <button
                  type="button"
                  onClick={() => setSelectedTxnForPayment(null)}
                  className="px-5 py-2.5 rounded-full bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 text-xs font-bold border border-[#E1E7EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-6 py-2.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-bold shadow-paypal transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingPayment ? (
                    <span>Recording...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#001C64]" />
                      <span>Confirm Received Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
      {/* Digital Bill Modal */}
      {selectedBillForDigitalModal && (
        <DigitalBillModal
          bill={selectedBillForDigitalModal}
          onClose={() => setSelectedBillForDigitalModal(null)}
          isBusinessOwner={true}
          onRefresh={loadShopData}
        />
      )}
    </div>
  );
};
