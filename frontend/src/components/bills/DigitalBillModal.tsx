import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  CreditCard,
  QrCode,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Store,
  User,
  Edit2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { BillPaymentHistory, RazorpayPaymentRequest } from "../../types/customer";
import { formatINR, parseUtcDate } from "../../lib/utils";
import { apiClient, formatApiError } from "../../lib/api";

interface DigitalBillModalProps {
  bill: BillPaymentHistory;
  onClose: () => void;
  isBusinessOwner?: boolean;
  customerId?: string;
  onRefresh?: () => void;
}

export const DigitalBillModal: React.FC<DigitalBillModalProps> = ({
  bill,
  onClose,
  isBusinessOwner = false,
  customerId: _customerId,
  onRefresh,
}) => {
  const [currentBill, setCurrentBill] = useState<BillPaymentHistory>(bill);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeRequest, setActiveRequest] = useState<RazorpayPaymentRequest | null>(
    bill.active_payment_request || null
  );

  // Partial Payment State
  const [showPartialPayInput, setShowPartialPayInput] = useState<boolean>(false);
  const [customPayAmount, setCustomPayAmount] = useState<string>("");
  const [isGeneratingRequest, setIsGeneratingRequest] = useState<boolean>(false);

  // Cash Receipt State (Business Owner only)
  const [showCashReceiptModal, setShowCashReceiptModal] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cashNotes, setCashNotes] = useState<string>("");
  const [isSubmittingCash, setIsSubmittingCash] = useState<boolean>(false);

  // Repayment Date Edit State (Business Owner only)
  const [showDateModal, setShowDateModal] = useState<boolean>(false);
  const [newRepaymentDate, setNewRepaymentDate] = useState<string>(bill.agreed_repayment_date || "");
  const [dateNotes, setDateNotes] = useState<string>("");
  const [isSubmittingDate, setIsSubmittingDate] = useState<boolean>(false);

  // Timer & Error State
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Sync bill data when prop changes
  useEffect(() => {
    setCurrentBill(bill);
    setActiveRequest(bill.active_payment_request || null);
  }, [bill]);

  // 5-minute countdown timer effect
  useEffect(() => {
    if (!activeRequest || activeRequest.status !== "active") {
      setCountdownSeconds(300);
      return;
    }

    const calcSeconds = () => {
      if (activeRequest.expires_at) {
        const parsed = parseUtcDate(activeRequest.expires_at);
        if (parsed) {
          const diff = Math.max(0, Math.floor((parsed.getTime() - Date.now()) / 1000));
          return Math.min(300, diff);
        }
      }
      return 300;
    };

    setCountdownSeconds(calcSeconds());
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRequest?.id, activeRequest?.expires_at]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate Payment Request for Custom or Full Remaining Amount
  const handleGeneratePaymentRequest = async (amountToPay: number) => {
    setIsGeneratingRequest(true);
    setActionError(null);
    try {
      const targetBillId = currentBill.bill_id || currentBill.id || "";
      const res = await apiClient.createRazorpayPaymentRequest({
        bill_id: targetBillId,
        partial_amount: amountToPay,
      });
      setActiveRequest(res);
      setShowPartialPayInput(false);
      setActionSuccess(`Payment QR generated for ${formatINR(amountToPay)}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      setActionError(formatApiError(err));
    } finally {
      setIsGeneratingRequest(false);
    }
  };

  // Record Manual Cash Collection (Business Owner)
  const handleRecordCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(cashAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setActionError("Please enter a valid cash amount greater than ₹0.");
      return;
    }
    if (parsed > currentBill.outstanding_amount) {
      setActionError(`Amount cannot exceed remaining balance of ${formatINR(currentBill.outstanding_amount)}.`);
      return;
    }

    setIsSubmittingCash(true);
    setActionError(null);
    try {
      const targetBillId = currentBill.bill_id || currentBill.id || "";
      const updated = await apiClient.recordBillCashReceipt(targetBillId, parsed, cashNotes.trim() || undefined);
      setCurrentBill(updated);
      setShowCashReceiptModal(false);
      setCashAmount("");
      setCashNotes("");
      setActionSuccess(`Recorded ${formatINR(parsed)} cash payment.`);
      if (onRefresh) onRefresh();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setActionError(formatApiError(err));
    } finally {
      setIsSubmittingCash(false);
    }
  };

  // Update Repayment Date (Business Owner)
  const handleUpdateDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepaymentDate) {
      setActionError("Please select a valid repayment date.");
      return;
    }

    setIsSubmittingDate(true);
    setActionError(null);
    try {
      const targetBillId = currentBill.bill_id || currentBill.id || "";
      const updated = await apiClient.updateBillRepaymentDate(
        targetBillId,
        newRepaymentDate,
        dateNotes.trim() || undefined
      );
      setCurrentBill(updated);
      setShowDateModal(false);
      setActionSuccess("Repayment date updated successfully.");
      if (onRefresh) onRefresh();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setActionError(formatApiError(err));
    } finally {
      setIsSubmittingDate(false);
    }
  };

  // Determine Bill Status Badge
  const getStatusBadge = () => {
    if (currentBill.outstanding_amount <= 0 || currentBill.status === "paid") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Paid</span>
        </span>
      );
    }
    if (currentBill.status === "overdue") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wide">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Overdue</span>
        </span>
      );
    }
    const hasPaidSomething = (currentBill.total_amount - currentBill.outstanding_amount) > 0;
    if (hasPaidSomething) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wide">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Partially Paid</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        <span>Awaiting Payment</span>
      </span>
    );
  };

  const billNumber = currentBill.bill_reference || currentBill.bill_number || `KSH-${currentBill.bill_id?.slice(-8).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl border border-[#E1E7EC] shadow-paypal overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Top Header / Actions Bar */}
        <div className="px-6 py-4 bg-[#F5F7FA] border-b border-[#E1E7EC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0070E0] text-white flex items-center justify-center font-black text-sm">
              K
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#545D68] uppercase tracking-wider block">
                Digital Invoice &amp; Credit Bill
              </span>
              <span className="text-sm font-black text-[#001C64] font-mono">
                {billNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-full hover:bg-white text-slate-600 hover:text-[#001C64] border border-transparent hover:border-[#E1E7EC] transition-all"
              title="Print Bill"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white text-slate-600 hover:text-rose-600 border border-transparent hover:border-[#E1E7EC] transition-all"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Bill Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          {/* Status Banners */}
          {actionError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Store & Customer Header Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#F5F7FA] border border-[#E1E7EC]">
            {/* Store Information */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#545D68] uppercase tracking-wider flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-[#0070E0]" />
                <span>Issued By Merchant</span>
              </span>
              <h4 className="text-sm font-black text-[#001C64]">
                {currentBill.shop_name}
              </h4>
              <p className="text-xs text-[#545D68] font-mono">
                Store Code: {currentBill.shop_code || "KOSHA-APEX"}
              </p>
            </div>

            {/* Customer Information */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#545D68] uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#0070E0]" />
                <span>Billed To Customer</span>
              </span>
              <h4 className="text-sm font-black text-[#001C64]">
                {currentBill.customer_name}
              </h4>
              <p className="text-xs text-[#545D68] font-mono">
                {currentBill.customer_phone || "+91 Customer"}
              </p>
            </div>
          </div>

          {/* Purchase Description & Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
                Purchase Order Details
              </span>
              {getStatusBadge()}
            </div>

            <div className="p-4 rounded-2xl border border-[#E1E7EC] bg-white space-y-3">
              <p className="text-sm font-bold text-slate-800">
                {currentBill.description}
              </p>

              {/* Line items table if present */}
              {currentBill.line_items && currentBill.line_items.length > 0 && (
                <div className="pt-2 border-t border-[#E1E7EC]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#545D68] border-b border-[#E1E7EC] text-left">
                        <th className="pb-1 font-bold">Item</th>
                        <th className="pb-1 font-bold text-center">Qty</th>
                        <th className="pb-1 font-bold text-right">Price</th>
                        <th className="pb-1 font-bold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentBill.line_items.map((it, idx) => (
                        <tr key={idx} className="py-1.5">
                          <td className="py-1 font-medium text-slate-800">{it.name}</td>
                          <td className="py-1 text-center font-mono">{it.quantity}</td>
                          <td className="py-1 text-right font-mono">{formatINR(it.unit_price)}</td>
                          <td className="py-1 text-right font-bold text-slate-900 font-mono">
                            {formatINR(it.line_total || (it.quantity * it.unit_price))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {currentBill.notes && (
                <div className="p-2.5 rounded-xl bg-[#F5F7FA] text-xs text-slate-600 border border-[#E1E7EC]">
                  <span className="font-bold text-[#001C64]">Notes: </span>
                  <span>{currentBill.notes}</span>
                </div>
              )}

              {/* Agreed Repayment Date Row */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E1E7EC] text-xs">
                <span className="text-[#545D68] font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0070E0]" />
                  <span>Agreed Repayment Deadline:</span>
                  <span className="font-black text-[#001C64]">
                    {currentBill.agreed_repayment_date}
                  </span>
                </span>

                {isBusinessOwner && currentBill.outstanding_amount > 0 && (
                  <button
                    onClick={() => setShowDateModal(true)}
                    className="text-xs font-bold text-[#0070E0] hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Change Date</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Financial Totals Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-[#F5F7FA] border border-[#E1E7EC]">
              <span className="text-[10px] font-bold text-[#545D68] uppercase block">
                Total Bill
              </span>
              <span className="text-base font-black text-[#001C64] font-mono mt-0.5 block">
                {formatINR(currentBill.total_amount)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F5F7FA] border border-[#E1E7EC]">
              <span className="text-[10px] font-bold text-[#545D68] uppercase block">
                Counter Cash Paid
              </span>
              <span className="text-base font-black text-slate-700 font-mono mt-0.5 block">
                {formatINR(currentBill.initial_manual_paid)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F5F7FA] border border-[#E1E7EC]">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                Verified Online
              </span>
              <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                {formatINR(currentBill.verified_razorpay_paid)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">
                Remaining Due
              </span>
              <span className="text-base font-black text-amber-900 font-mono mt-0.5 block">
                {formatINR(currentBill.outstanding_amount)}
              </span>
            </div>
          </div>

          {/* Dynamic Payment QR & UPI Action Section */}
          {currentBill.outstanding_amount > 0 ? (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#0070E0] text-white flex items-center justify-center font-bold">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-[#001C64]">
                      Pay Dues via Razorpay UPI QR
                    </h5>
                    <p className="text-[11px] text-[#545D68]">
                      Scan with any UPI app (PhonePe, GPay, Paytm) for instant verification.
                    </p>
                  </div>
                </div>

                {activeRequest && activeRequest.status === "active" && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-xs font-mono font-bold text-slate-700 border border-blue-200 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-[#0070E0] animate-pulse" />
                    <span>{formatTimer(countdownSeconds)}</span>
                  </div>
                )}
              </div>

              {/* QR Image & Payment Instructions */}
              {activeRequest && activeRequest.status === "active" && activeRequest.qr_image_url ? (
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-white border border-blue-100 shadow-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-44 h-44 rounded-xl border border-slate-200 p-2 bg-white flex items-center justify-center shrink-0 shadow-2xs">
                      <img
                        src={activeRequest.qr_image_url}
                        alt="UPI Dynamic Payment QR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Scan with GPay, PhonePe, Paytm, BHIM</span>
                    </div>
                  </div>

                  <div className="space-y-3 flex-1 text-center sm:text-left">
                    <div>
                      <span className="text-[10px] font-bold text-[#545D68] uppercase">Amount to Pay</span>
                      <div className="text-2xl font-black text-[#001C64] font-mono">
                        {formatINR(activeRequest.amount_inr)}
                      </div>
                      <p className="text-[11px] text-[#545D68] mt-0.5">
                        NPCI compliant UPI Intent URI. Opens directly in your mobile banking app.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      {activeRequest.upi_qr_payload && (
                        <a
                          href={activeRequest.upi_qr_payload}
                          className="w-full sm:w-auto px-4 py-2 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98]"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pay via UPI App (GPay / PhonePe / Paytm)</span>
                        </a>
                      )}

                      {activeRequest.upi_qr_payload && (
                        <button
                          onClick={() => handleCopy(activeRequest.upi_qr_payload || "")}
                          className="px-3.5 py-1.5 rounded-full bg-[#F5F7FA] hover:bg-slate-100 border border-[#E1E7EC] text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#0070E0]" />}
                          <span>{copiedLink ? "Copied!" : "Copy UPI Link"}</span>
                        </button>
                      )}

                      {activeRequest.short_url && (
                        <a
                          href={activeRequest.short_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Pay via Web Checkout</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <button
                    onClick={() => handleGeneratePaymentRequest(currentBill.outstanding_amount)}
                    disabled={isGeneratingRequest}
                    className="paypal-btn-primary text-xs inline-flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Generate Instant Payment QR ({formatINR(currentBill.outstanding_amount)})</span>
                  </button>
                </div>
              )}

              {/* Action Buttons for Custom Partial Payment or Cash Record */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-200/60">
                {!showPartialPayInput ? (
                  <button
                    onClick={() => {
                      setShowPartialPayInput(true);
                      setCustomPayAmount(currentBill.outstanding_amount.toString());
                    }}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-white hover:bg-blue-50 text-[#0070E0] border border-blue-300 transition-all"
                  >
                    Pay Custom Partial Amount
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={currentBill.outstanding_amount}
                      value={customPayAmount}
                      onChange={(e) => setCustomPayAmount(e.target.value)}
                      placeholder="Amount to pay (₹)"
                      className="px-3.5 py-1.5 text-xs font-mono font-bold border border-blue-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0070E0] bg-white w-36"
                    />
                    <button
                      onClick={() => handleGeneratePaymentRequest(parseFloat(customPayAmount))}
                      disabled={isGeneratingRequest || !customPayAmount || parseFloat(customPayAmount) <= 0}
                      className="px-4 py-1.5 rounded-full bg-[#0070E0] text-white text-xs font-bold hover:bg-[#003087] transition-all disabled:opacity-50"
                    >
                      Generate QR
                    </button>
                    <button
                      onClick={() => setShowPartialPayInput(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Business Owner Record Cash Action */}
                {isBusinessOwner && (
                  <button
                    onClick={() => {
                      setShowCashReceiptModal(true);
                      setCashAmount(currentBill.outstanding_amount.toString());
                    }}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all flex items-center gap-1.5 ml-auto"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Record Cash Received</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h5 className="text-sm font-black text-emerald-900">
                  Bill Fully Cleared
                </h5>
                <p className="text-xs text-emerald-700">
                  All receivables for this bill have been authoritatively settled and reconciled.
                </p>
              </div>
            </div>
          )}

          {/* Payment History Audit Table */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider block">
              Payment &amp; Settlement History
            </span>

            {currentBill.verified_payments && currentBill.verified_payments.length > 0 || (currentBill.all_repayments && currentBill.all_repayments.length > 0) ? (
              <div className="rounded-2xl border border-[#E1E7EC] overflow-hidden bg-white text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F5F7FA] text-[#545D68] border-b border-[#E1E7EC] text-left">
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold">Method</th>
                      <th className="p-3 font-bold">Reference ID</th>
                      <th className="p-3 font-bold text-right">Amount</th>
                      <th className="p-3 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E7EC]">
                    {/* Verified online payments */}
                    {currentBill.verified_payments.map((vp) => (
                      <tr key={vp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-medium text-slate-700">
                          {new Date(vp.verified_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-[#0070E0] uppercase flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Razorpay UPI</span>
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {vp.razorpay_payment_id}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                          {formatINR(vp.amount_inr)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Manual / Cash repayments */}
                    {(currentBill.all_repayments || [])
                      .filter((r) => r.payment_method !== "razorpay_upi")
                      .map((rep) => (
                        <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-medium text-slate-700">
                            {rep.repayment_date}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 uppercase flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{rep.payment_method === "cash" ? "Counter Cash" : rep.payment_method}</span>
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {rep.provider_reference || "CASH-RECEIPT"}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 font-mono">
                            {formatINR(rep.amount)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                              Completed
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#F5F7FA] text-center text-xs text-[#545D68] border border-[#E1E7EC]">
                No payment transactions recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#F5F7FA] border-t border-[#E1E7EC] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#545D68] font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>KOSHA Authoritative Real-Time Ledger</span>
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-[#E1E7EC] shadow-2xs transition-all"
          >
            Done
          </button>
        </div>
      </div>

      {/* Cash Receipt Sub-Modal (Business Owner) */}
      {showCashReceiptModal && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-5 rounded-3xl border border-[#E1E7EC] shadow-paypal space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#001C64]">
                Record Counter Cash Receipt
              </h4>
              <button onClick={() => setShowCashReceiptModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordCash} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cash Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={currentBill.outstanding_amount}
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E1E7EC] text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Actor (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Received at shop counter"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E1E7EC] text-xs focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCashReceiptModal(false)}
                  className="px-4 py-2 rounded-full border border-[#E1E7EC] text-slate-600 font-bold hover:bg-[#F5F7FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCash}
                  className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmittingCash ? "Recording..." : "Confirm Cash Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Date Sub-Modal (Business Owner) */}
      {showDateModal && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-5 rounded-3xl border border-[#E1E7EC] shadow-paypal space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#001C64]">
                Extend Agreed Repayment Date
              </h4>
              <button onClick={() => setShowDateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateDate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  New Repayment Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={newRepaymentDate}
                  onChange={(e) => setNewRepaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E1E7EC] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Customer requested 2-week extension"
                  value={dateNotes}
                  onChange={(e) => setDateNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E1E7EC] text-xs focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="px-4 py-2 rounded-full border border-[#E1E7EC] text-slate-600 font-bold hover:bg-[#F5F7FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDate}
                  className="px-5 py-2 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmittingDate ? "Updating..." : "Save Deadline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
