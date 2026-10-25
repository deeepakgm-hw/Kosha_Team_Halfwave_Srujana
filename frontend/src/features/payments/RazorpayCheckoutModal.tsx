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
  Maximize2,
  Smartphone,
} from "lucide-react";
import { apiClient, formatApiError, getApiBaseUrl } from "../../lib/api";
import { BillPaymentHistory, RazorpayPaymentRequest, RazorpayConfig } from "../../types/customer";
import { formatINR, parseUtcDate } from "../../lib/utils";

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
    const parsed = parseUtcDate(paymentRequest.expires_at);
    const expiresTime = parsed ? parsed.getTime() : Date.now() + 300000;
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
      gatewayConfig?.merchant_name || bill.shop_name || "KOSHA Merchant Treasury";

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

  const handleOpenQrInNewWindow = () => {
    if (!paymentRequest || !paymentRequest.qr_image_url || !bill) return;

    const popupWidth = 520;
    const popupHeight = 780;
    const left = window.screen.width ? (window.screen.width - popupWidth) / 2 : 100;
    const top = window.screen.height ? (window.screen.height - popupHeight) / 2 : 100;

    const popup = window.open(
      "",
      `KoshaQR_${paymentRequest.id}`,
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
    );

    if (!popup) {
      alert("Popup blocked! Please allow popups for this site to open the standalone clear QR window.");
      return;
    }

    const merchantName = gatewayConfig?.merchant_name || bill.shop_name || "KOSHA MSME Treasury";
    const billRef = bill.bill_number || bill.bill_reference || bill.id?.slice(0, 8) || "INV";
    const custName = bill.customer_name || "Customer";
    const amountFormatted = formatINR(paymentRequest.amount_inr);
    const upiPayload = paymentRequest.upi_qr_payload || "";
    const shortUrl = paymentRequest.short_url || "";
    const qrImg = paymentRequest.qr_image_url;
    const requestId = paymentRequest.id;
    const expiresUtcIso = paymentRequest.expires_at || new Date(Date.now() + 300000).toISOString();
    const apiBase = getApiBaseUrl();

    const popupHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KOSHA Real-Time UPI QR - ${billRef}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0b132b 0%, #1c2541 50%, #0b132b 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: rgba(255, 255, 255, 0.98);
      color: #0f172a;
      border-radius: 28px;
      width: 100%;
      max-width: 460px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
      padding: 28px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .top-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .merchant {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      margin-top: 8px;
    }
    .bill-title {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .amount-box {
      margin: 14px 0 12px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1.5px solid #86efac;
      border-radius: 18px;
      padding: 12px 16px;
    }
    .amount-label {
      font-size: 11px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 900;
      color: #14532d;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.02em;
    }
    .qr-container {
      background: #ffffff;
      border: 2px solid #e2e8f0;
      border-radius: 20px;
      padding: 14px;
      display: inline-block;
      margin: 8px auto 14px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06);
    }
    .qr-container img {
      width: 270px;
      height: 270px;
      display: block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    .timer-bar-wrap {
      width: 100%;
      background: #e2e8f0;
      border-radius: 9999px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .timer-bar {
      height: 100%;
      background: #2563eb;
      transition: width 1s linear, background-color 0.3s;
    }
    .timer-text {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 14px;
    }
    .timer-badge {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: #dbeafe;
      color: #1e40af;
    }
    .upi-apps {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .btn {
      flex: 1;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
    }
    .btn-primary {
      background: #2563eb;
      color: white;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .success-view {
      display: none;
      padding: 20px 10px;
      text-align: center;
    }
    .success-icon {
      width: 72px;
      height: 72px;
      background: #dcfce7;
      color: #16a34a;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 38px;
      margin-bottom: 16px;
      animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pop {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .success-title {
      font-size: 24px;
      font-weight: 900;
      color: #14532d;
    }
    .success-sub {
      font-size: 13px;
      color: #475569;
      margin-top: 6px;
    }
    .pill {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      color: #0f172a;
      display: inline-block;
      margin: 12px 0;
    }
  </style>
</head>
<body>
  <div class="card" id="mainCard">
    <div id="activeView">
      <div class="top-badge">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#2563eb;"></span>
        Official Razorpay UPI QR
      </div>
      <div class="merchant">${merchantName}</div>
      <h2 class="bill-title">${custName} &bull; ${billRef}</h2>

      <div class="amount-box">
        <div class="amount-label">Amount Payable</div>
        <div class="amount-value">${amountFormatted}</div>
      </div>

      <div class="qr-container">
        <img src="${qrImg}" alt="Crisp Razorpay UPI QR" id="qrImage" />
      </div>

      <div class="timer-bar-wrap">
        <div class="timer-bar" id="progressBar" style="width: 100%;"></div>
      </div>

      <div class="timer-text">
        <span>Session Expiry:</span>
        <span class="timer-badge" id="timerBadge">⏳ 05:00</span>
      </div>

      <div class="upi-apps">
        <span>Scan via Google Pay &bull; PhonePe &bull; Paytm &bull; BHIM &bull; Any UPI</span>
      </div>

      <div class="btn-row">
        ${upiPayload ? `<a href="${upiPayload}" class="btn btn-primary" id="btnOpenUpi" style="background:#FFC439; color:#001C64; font-weight:900; font-size:13px; width:100%;">⚡ Open in UPI App (GPay / PhonePe / Paytm)</a>` : ""}
      </div>
      <div class="btn-row">
        ${shortUrl ? `<a href="${shortUrl}" target="_blank" class="btn btn-secondary">💳 Open Web Checkout</a>` : ""}
        <button class="btn btn-secondary" onclick="copyUpi()" id="btnCopy">📋 Copy UPI Link</button>
        <button class="btn btn-secondary" onclick="window.close()">✕ Close</button>
      </div>
    </div>

    <!-- Success View -->
    <div class="success-view" id="successView">
      <div class="success-icon">✓</div>
      <h1 class="success-title">Payment Received!</h1>
      <p class="success-sub">Recognized & verified instantly via Razorpay Real-Time UPI Engine.</p>
      <div><span class="pill" id="txnPill">Payment ID: ...</span></div>
      <div class="amount-box" style="margin: 10px 0 16px;">
        <div class="amount-label">Verified Amount</div>
        <div class="amount-value" id="successAmount">${amountFormatted}</div>
      </div>
      <button class="btn btn-primary" style="width: 100%; padding: 12px;" onclick="window.close()">Done & Close Window</button>
    </div>
  </div>

  <script>
    const expiresUtcStr = "${expiresUtcIso}";
    const expiresTime = new Date(expiresUtcStr.endsWith("Z") || expiresUtcStr.includes("+") ? expiresUtcStr : expiresUtcStr.replace(" ", "T") + "Z").getTime();
    const requestId = "${requestId}";
    const upiPayload = "${upiPayload.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}";
    const apiBase = "${apiBase}";

    function copyUpi() {
      if (!upiPayload) return;
      navigator.clipboard.writeText(upiPayload);
      const btn = document.getElementById("btnCopy");
      btn.innerText = "✓ Copied!";
      setTimeout(() => { btn.innerText = "📋 Copy UPI Link"; }, 2000);
    }

    function playSuccessChime() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      } catch (e) {}
    }

    let countdownInterval = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((expiresTime - now) / 1000));
      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      const timerBadge = document.getElementById("timerBadge");
      const progressBar = document.getElementById("progressBar");

      if (timerBadge) {
        timerBadge.innerText = "⏳ " + String(m).padStart(2, '0') + ":" + String(s).padStart(2, '0');
      }
      if (progressBar) {
        const pct = Math.max(0, Math.min(100, (diffSec / 300) * 100));
        progressBar.style.width = pct + "%";
        if (diffSec < 60) {
          progressBar.style.backgroundColor = "#ef4444";
        } else if (diffSec < 120) {
          progressBar.style.backgroundColor = "#f59e0b";
        }
      }

      if (diffSec <= 0) {
        clearInterval(countdownInterval);
        if (timerBadge) {
          timerBadge.innerText = "🔒 Window Expired";
          timerBadge.style.background = "#fee2e2";
          timerBadge.style.color = "#991b1b";
        }
      }
    }, 1000);

    let isPolling = true;
    async function checkStatus() {
      if (!isPolling) return;
      try {
        const res = await fetch(apiBase + "/v1/payments/gateway/requests/" + requestId + "/sync", {
          method: "POST"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.outcome === "success" && data.verified) {
            isPolling = false;
            clearInterval(countdownInterval);
            playSuccessChime();

            document.getElementById("activeView").style.display = "none";
            document.getElementById("successView").style.display = "block";
            document.getElementById("txnPill").innerText = "Payment ID: " + (data.payment_id || "Captured");
            if (data.amount_inr) {
              document.getElementById("successAmount").innerText = "₹" + Number(data.amount_inr).toFixed(2);
            }

            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: "KOSHA_PAYMENT_SUCCESS",
                paymentId: data.payment_id,
                amount: data.amount_inr,
                newOutstanding: data.new_outstanding
              }, "*");
            }
          }
        }
      } catch (e) {}
    }

    const pollInterval = setInterval(checkStatus, 2500);
    checkStatus();
  </script>
</body>
</html>
    `;

    popup.document.open();
    popup.document.write(popupHtml);
    popup.document.close();
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
              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={handleOpenQrInNewWindow}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-kosha-deep hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Generate &amp; Open QR in New Window Clearly</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateRequest(payAmountType === "full" ? bill.outstanding_amount : parseFloat(customAmount) || bill.outstanding_amount)}
                  className="w-full py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                >
                  Generate Fresh QR (Here)
                </button>
              </div>
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
                Pay to: <span className="font-bold text-slate-700">{gatewayConfig?.merchant_name || bill.shop_name || "KOSHA Merchant Treasury"}</span>
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
            <div className="w-full flex flex-col gap-2 pt-1">
              {paymentRequest.upi_qr_payload && (
                <a
                  href={paymentRequest.upi_qr_payload}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98]"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>⚡ Pay via UPI App (GPay / PhonePe / Paytm)</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleOpenQrInNewWindow}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-kosha-deep hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98]"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Open QR in New Window Clearly</span>
              </button>

              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2">
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
