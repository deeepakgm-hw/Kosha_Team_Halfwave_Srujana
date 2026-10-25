import React, { useState, useEffect } from "react";
import {
  X,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  RefreshCw,
  CreditCard,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { BillPaymentHistory, RazorpayPaymentRequest, RazorpayConfig } from "../../types/customer";
import { formatINR } from "../../lib/utils";

interface RazorpayCheckoutModalProps {
  bill: BillPaymentHistory | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedBill: BillPaymentHistory) => void;
  customerId?: string;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  bill,
  isOpen,
  onClose,
  onSuccess,
  customerId = "cust_rahul_01",
}) => {
  const [payAmountType, setPayAmountType] = useState<"full" | "partial">("full");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [paymentRequest, setPaymentRequest] = useState<RazorpayPaymentRequest | null>(null);
  const [gatewayConfig, setGatewayConfig] = useState<RazorpayConfig | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "awaiting" | "pending_verification" | "verified" | "failed"
  >("awaiting");
  const [statusMessage, setStatusMessage] = useState<string>("Awaiting payment via UPI QR or Razorpay Checkout");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 5-Minute Countdown Effect
  useEffect(() => {
    if (!isOpen || !paymentRequest || verificationStatus === "verified") {
      setCountdownSeconds(300);
      return;
    }
    const expiresTime = paymentRequest.expires_at ? new Date(paymentRequest.expires_at).getTime() : Date.now() + 300000;
    const diff = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
    setCountdownSeconds(Math.min(300, diff));

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, paymentRequest?.id, verificationStatus]);

  useEffect(() => {
    // Load public gateway config to get official merchant name & public key ID
    apiClient.getRazorpayConfig().then(setGatewayConfig).catch(() => {});
  }, []);

  // Real-Time Recognition Polling Loop
  useEffect(() => {
    if (!isOpen || !paymentRequest || verificationStatus === "verified") return;
    if (paymentRequest.status !== "active" && paymentRequest.status !== "pending_verification") return;

    let isMounted = true;
    const pollStatus = async () => {
      if (!bill) return;
      try {
        const res = await apiClient.syncPaymentRequestStatus(paymentRequest.id);
        if (!isMounted) return;
        if (res.outcome === "success" && res.verified) {
          setVerificationStatus("verified");
          setStatusMessage(`Payment verified! Reference: ${res.payment_id}`);
          const targetBillId = bill.bill_id || bill.id || "";
          const updated = await apiClient.getBillPaymentHistory(targetBillId, customerId);
          onSuccess(updated);
        } else if (res.outcome === "failed") {
          setVerificationStatus("failed");
          setStatusMessage(res.reason || "Payment declined or cancelled.");
          setErrorMessage(res.reason || "Payment transaction failed.");
        }
      } catch {
        // silent
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, paymentRequest?.id, verificationStatus]);

  useEffect(() => {
    if (bill && isOpen) {
      setErrorMessage(null);
      setVerificationStatus("awaiting");
      setStatusMessage("Awaiting payment via UPI QR or Razorpay Checkout");
      setPayAmountType("full");
      setCustomAmount(bill.outstanding_amount.toString());

      // If bill already has an active payment request, use it
      if (bill.active_payment_request && bill.active_payment_request.status === "active") {
        setPaymentRequest(bill.active_payment_request);
      } else {
        // Automatically create payment request for full remaining amount
        handleGenerateRequest(bill.outstanding_amount);
      }
    }
  }, [bill, isOpen]);

  if (!isOpen || !bill) return null;

  const handleGenerateRequest = async (amountInr: number) => {
    setIsLoadingRequest(true);
    setErrorMessage(null);
    try {
      const amountPaise = Math.round(amountInr * 100);
      const targetBillId = bill.bill_id || bill.id || "";
      const req = await apiClient.createRazorpayPaymentRequest({
        billId: targetBillId,
        amountPaise,
        customerId,
      });
      setPaymentRequest(req);
      setVerificationStatus("awaiting");
      setStatusMessage("Awaiting payment via UPI QR or Razorpay Checkout");
    } catch (err: unknown) {
      setErrorMessage(formatApiError(err));
    } finally {
      setIsLoadingRequest(false);
    }
  };

  const handleCustomAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(customAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMessage("Please enter a valid amount greater than ₹0.");
      return;
    }
    if (parsed > bill.outstanding_amount) {
      setErrorMessage(
        `Payment amount cannot exceed the remaining balance of ${formatINR(bill.outstanding_amount)}.`
      );
      return;
    }
    handleGenerateRequest(parsed);
  };

  const handleCopyUpiLink = () => {
    const targetLink = paymentRequest?.short_url || paymentRequest?.upi_qr_payload;
    if (!targetLink) return;
    navigator.clipboard.writeText(targetLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Authoritative server-side verification request
  const handleServerVerify = async () => {
    if (!paymentRequest) return;
    setIsVerifying(true);
    setVerificationStatus("pending_verification");
    setStatusMessage("Payment pending verification... Confirming with Razorpay");
    setErrorMessage(null);

    try {
      const testPaymentId = `pay_test_${Math.random().toString(36).substring(2, 10)}`;
      const targetBillId = bill.bill_id || bill.id || "";
      const res = await apiClient.verifyRazorpayPayment({
        transaction_id: targetBillId,
        order_id: paymentRequest.razorpay_order_id || `order_test_${paymentRequest.id}`,
        payment_id: testPaymentId,
        customerId,
      });

      if (res.verified) {
        setVerificationStatus("verified");
        setStatusMessage(`Payment verified! Reference: ${res.payment_id}`);

        // Fetch fresh authoritative bill details from server
        const updated = await apiClient.getBillPaymentHistory(targetBillId, customerId);
        onSuccess(updated);
      }
    } catch (err: unknown) {
      setVerificationStatus("failed");
      setStatusMessage("Payment not yet confirmed. Balance remains unchanged.");
      setErrorMessage(formatApiError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  // Open Razorpay Standard Checkout Modal
  const handleOpenRazorpayCheckout = () => {
    if (!paymentRequest) return;

    const publicRazorpayKey =
      paymentRequest.key_id || gatewayConfig?.key_id || "rzp_test_kosha_sandbox";
    const merchantDisplayName =
      gatewayConfig?.merchant_name || bill.shop_name || "Halfwaveplatforms";

    const win = window as any;
    if (win.Razorpay) {
      const options = {
        key: publicRazorpayKey,
        amount: paymentRequest.amount_paise,
        currency: "INR",
        name: merchantDisplayName,
        description: `Payment for ${bill.bill_number} - ${bill.description}`,
        order_id: paymentRequest.razorpay_order_id?.startsWith("order_test_")
          ? undefined
          : paymentRequest.razorpay_order_id,
        handler: async function (response: any) {
          setIsVerifying(true);
          setVerificationStatus("pending_verification");
          setStatusMessage("Payment received... Confirming signature server-side");
          try {
            const targetBillId = bill.bill_id || bill.id || "";
            const res = await apiClient.verifyRazorpayPayment({
              transaction_id: targetBillId,
              order_id: response.razorpay_order_id || paymentRequest.razorpay_order_id || "",
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              customerId,
            });
            if (res.verified) {
              setVerificationStatus("verified");
              setStatusMessage("Payment verified! Balance updated.");
              const updated = await apiClient.getBillPaymentHistory(targetBillId, customerId);
              onSuccess(updated);
            }
          } catch (err: unknown) {
            setErrorMessage(formatApiError(err));
            setVerificationStatus("failed");
          } finally {
            setIsVerifying(false);
          }
        },
        prefill: {
          name: bill.customer_name,
          contact: bill.customer_phone || "+919876543210",
        },
        theme: {
          color: "#0a2540",
        },
      };

      try {
        const rzp = new win.Razorpay(options);
        rzp.open();
      } catch {
        // Fallback to hosted URL if popup fails
        if (paymentRequest.short_url) {
          window.open(paymentRequest.short_url, "_blank");
        }
      }
    } else if (paymentRequest.short_url) {
      window.open(paymentRequest.short_url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-lg text-kosha-navy">Razorpay UPI Checkout</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  paymentRequest?.is_test_mode === false || gatewayConfig?.mode === "live"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : "bg-amber-100 text-amber-800 border-amber-200"
                }`}
              >
                {paymentRequest?.is_test_mode === false || gatewayConfig?.mode === "live"
                  ? "Live Razorpay"
                  : "Test Mode"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Secure UPI & QR Payment for {gatewayConfig?.merchant_name || bill.shop_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bill Summary */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-kosha-blue uppercase tracking-wider block">
                {bill.bill_number}
              </span>
              <p className="font-bold text-sm text-slate-900 mt-0.5">{bill.description}</p>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                bill.status === "paid"
                  ? "bg-emerald-100 text-emerald-800"
                  : bill.status === "overdue"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {bill.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-500 block">Original Bill:</span>
              <span className="font-bold text-slate-800">{formatINR(bill.total_amount)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Remaining Due:</span>
              <span className="font-extrabold text-amber-800 text-sm">
                {formatINR(bill.outstanding_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Payment Type Selection (Full vs Partial) */}
        {bill.status !== "paid" && (
          <div className="space-y-3 mb-4">
            <label className="block text-xs font-bold text-slate-700">Choose Payment Amount</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayAmountType("full");
                  handleGenerateRequest(bill.outstanding_amount);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left ${
                  payAmountType === "full"
                    ? "bg-blue-50 border-kosha-blue text-kosha-navy shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div>Pay Full Remaining</div>
                <div className="text-sm font-extrabold text-kosha-blue mt-0.5">
                  {formatINR(bill.outstanding_amount)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPayAmountType("partial")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left ${
                  payAmountType === "partial"
                    ? "bg-blue-50 border-kosha-blue text-kosha-navy shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div>Pay Partial Amount</div>
                <div className="text-[11px] text-slate-400 font-normal mt-0.5">Enter custom amount</div>
              </button>
            </div>

            {/* Custom Partial Amount Input */}
            {payAmountType === "partial" && (
              <form onSubmit={handleCustomAmountSubmit} className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={bill.outstanding_amount}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoadingRequest}
                  className="px-4 py-2 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shrink-0 transition-all shadow-xs"
                >
                  {isLoadingRequest ? "Updating..." : "Update QR"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* QR Code & UPI Instructions */}
        {paymentRequest && bill.status !== "paid" && (
          countdownSeconds <= 0 ? (
            <div className="bg-amber-50 rounded-2xl p-5 border-2 border-amber-300 text-center space-y-3.5 my-3">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 uppercase">
                  5-Minute Session Expired
                </span>
                <h4 className="font-bold text-sm text-slate-900 mt-1.5">
                  Payment Window Timed Out
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  For your security, QR codes expire after 5 minutes. Click below to generate a fresh QR code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateRequest(payAmountType === "full" ? bill.outstanding_amount : parseFloat(customAmount) || bill.outstanding_amount)}
                className="w-full py-2.5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white font-bold text-xs shadow-xs transition-colors"
              >
                Generate Fresh QR (New 5-Min Window)
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col items-center text-center space-y-3">
              {/* 5-Minute Countdown Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-semibold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-slate-600 text-[11px]">Security Window:</span>
                <span className={`font-mono font-bold text-xs ${countdownSeconds < 60 ? "text-rose-600 animate-pulse" : "text-blue-700"}`}>
                  ⏳ {formatTimer(countdownSeconds)}
                </span>
              </div>

              <div className="relative p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                {paymentRequest.qr_image_url ? (
                  <img
                    src={paymentRequest.qr_image_url}
                    alt="Razorpay UPI Payment QR Code"
                    className="w-44 h-44 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 bg-slate-100 flex items-center justify-center text-slate-400">
                    <QrCode className="w-12 h-12" />
                  </div>
                )}
              </div>

            <div>
              <div className="text-sm font-black text-slate-900">
                Amount: {formatINR(paymentRequest.amount_inr)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pay to: <span className="font-bold text-slate-700">{gatewayConfig?.merchant_name || "Halfwaveplatforms"}</span>
              </p>
            </div>

            {/* Scanning Guidance */}
            <div className="w-full bg-blue-50/80 border border-blue-200/80 rounded-xl p-2.5 text-left text-xs text-slate-700 space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Camera & Lens Scanning:</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Scan with your <strong>Phone Camera</strong> or <strong>Google Lens</strong> to open the live payment page and pay via Google Pay, PhonePe, Paytm, or Cards.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenRazorpayCheckout}
                className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Open Razorpay Checkout</span>
              </button>

              {paymentRequest.short_url && (
                <button
                  type="button"
                  onClick={() => window.open(paymentRequest.short_url, "_blank")}
                  className="w-full sm:w-auto py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Payment Link</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyUpiLink}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Link Copied" : "Copy Link"}</span>
              </button>
            </div>
          </div>
          )
        )}

        {/* Live Status Indicator */}
        <div className="mt-4 p-3 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {verificationStatus === "verified" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : verificationStatus === "pending_verification" ? (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            ) : verificationStatus === "failed" ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span
              className={`font-semibold ${
                verificationStatus === "verified"
                  ? "text-emerald-700"
                  : verificationStatus === "failed"
                  ? "text-rose-700"
                  : "text-slate-700"
              }`}
            >
              {statusMessage}
            </span>
          </div>

          {bill.status !== "paid" && (
            <button
              type="button"
              onClick={handleServerVerify}
              disabled={isVerifying}
              className="text-[11px] font-bold text-kosha-blue hover:underline shrink-0"
            >
              {isVerifying ? "Verifying..." : "Verify Status"}
            </button>
          )}
        </div>

        {/* Security & Invariant Notice */}
        <div className="pt-3 text-[10px] text-slate-400 text-center leading-relaxed">
          <p>
            Payments are verified directly via Razorpay webhook and server verification.
            Outstanding balance reduces only upon confirmed capture.
          </p>
        </div>
      </div>
    </div>
  );
};
