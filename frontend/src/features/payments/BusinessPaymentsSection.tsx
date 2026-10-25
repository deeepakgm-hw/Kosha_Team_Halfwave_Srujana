import React, { useState, useEffect } from "react";
import {
  CreditCard,
  QrCode,
  PlusCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Receipt,
  X,
  XCircle,
  Maximize2,
} from "lucide-react";
import { apiClient, formatApiError, getApiBaseUrl } from "../../lib/api";
import {
  BillPaymentHistory,
  CustomerProfile,
  RazorpayConfig,
  ShopkeeperFinancialSummary,
} from "../../types/customer";
import { formatINR, parseUtcDate } from "../../lib/utils";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";

export const BusinessPaymentsSection: React.FC = () => {
  const [bills, setBills] = useState<BillPaymentHistory[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedShop] = useState<string>("shop_apex_01");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Bill Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [billDescription, setBillDescription] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [initialManualPaid, setInitialManualPaid] = useState<string>("0");
  const [agreedRepaymentDate, setAgreedRepaymentDate] = useState<string>("");
  const [generatePaymentReq, setGeneratePaymentReq] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selected Bill for Payment History / QR Inspection
  const [selectedBillForDetail, setSelectedBillForDetail] = useState<BillPaymentHistory | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300);

  // Real-Time Recognition Outcome State
  const [recognitionOutcome, setRecognitionOutcome] = useState<{
    type: "success" | "failed" | null;
    paymentId?: string;
    amount?: number;
    newOutstanding?: number;
    reason?: string;
    timestamp?: string;
  }>({ type: null });

  // Format mm:ss timer helper
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Config
  const [razorpayConfig, setRazorpayConfig] = useState<RazorpayConfig | null>(null);
  const [financialSummary, setFinancialSummary] = useState<ShopkeeperFinancialSummary | null>(null);

  // Web Audio synthesizer chime for Soundbox-style real-time payment audio confirmation
  const playSound = (type: "success" | "failed") => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (type === "success") {
        const osc1 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc1.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc1.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.6);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch {
      // Audio autoplay restrictions or unsupported
    }
  };

  useEffect(() => {
    // Set default repayment date to 14 days from now
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setAgreedRepaymentDate(d.toISOString().split("T")[0]);

    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [billsRes, custsRes, cfgRes, finRes] = await Promise.all([
        apiClient.listShopkeeperBills(selectedShop, statusFilter, searchQuery),
        apiClient.listShopkeeperCustomers(),
        apiClient.getRazorpayConfig(),
        apiClient.getShopkeeperFinancialSummary(selectedShop),
      ]);
      setBills(billsRes);
      setCustomers(custsRes);
      setRazorpayConfig(cfgRes);
      setFinancialSummary(finRes);
      if (custsRes.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custsRes[0].id);
      }
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadBillsOnly = async () => {
    try {
      const [billsRes, finRes] = await Promise.all([
        apiClient.listShopkeeperBills(selectedShop, statusFilter, searchQuery),
        apiClient.getShopkeeperFinancialSummary(selectedShop),
      ]);
      setBills(billsRes);
      setFinancialSummary(finRes);
      if (selectedBillForDetail) {
        const targetId = selectedBillForDetail.bill_id || selectedBillForDetail.id;
        const updated = billsRes.find((b) => (b.bill_id || b.id) === targetId);
        if (updated) setSelectedBillForDetail(updated);
      }
    } catch {
      // quiet fallback
    }
  };

  const { isRealTime } = useRealTimeSync({
    onRefresh: loadBillsOnly,
  });

  // Real-time recognition polling for active payment request
  useEffect(() => {
    const activeReq = selectedBillForDetail?.active_payment_request;
    if (!activeReq || (activeReq.status !== "active" && activeReq.status !== "pending_verification")) {
      return;
    }

    let isMounted = true;

    const checkRecognition = async () => {
      try {
        const res = await apiClient.syncPaymentRequestStatus(activeReq.id);
        if (!isMounted) return;

        if (res.outcome === "success" && res.verified) {
          playSound("success");
          setRecognitionOutcome({
            type: "success",
            paymentId: res.payment_id,
            amount: res.amount_inr,
            newOutstanding: res.new_outstanding,
            timestamp: new Date().toLocaleTimeString(),
          });
          loadBillsOnly();
        } else if (res.outcome === "failed") {
          playSound("failed");
          setRecognitionOutcome({
            type: "failed",
            reason: res.reason || "Payment declined or expired",
            timestamp: new Date().toLocaleTimeString(),
          });
          loadBillsOnly();
        }
      } catch {
        // silent retry
      }
    };

    // Immediate check + interval every 2.5s
    checkRecognition();
    const interval = setInterval(checkRecognition, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedBillForDetail?.active_payment_request?.id]);

  const handleManualCheckStatus = async () => {
    if (!selectedBillForDetail?.active_payment_request) return;
    setIsCheckingStatus(true);
    try {
      const res = await apiClient.syncPaymentRequestStatus(selectedBillForDetail.active_payment_request.id);
      if (res.outcome === "success" && res.verified) {
        playSound("success");
        setRecognitionOutcome({
          type: "success",
          paymentId: res.payment_id,
          amount: res.amount_inr,
          newOutstanding: res.new_outstanding,
          timestamp: new Date().toLocaleTimeString(),
        });
        loadBillsOnly();
      } else if (res.outcome === "failed") {
        playSound("failed");
        setRecognitionOutcome({
          type: "failed",
          reason: res.reason || "Payment declined or expired",
          timestamp: new Date().toLocaleTimeString(),
        });
        loadBillsOnly();
      }
    } catch {
      // quiet
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSimulateRecognition = async (outcome: "success" | "failed") => {
    if (!selectedBillForDetail?.active_payment_request) return;
    setIsCheckingStatus(true);
    try {
      const res = await apiClient.simulatePaymentRecognition(
        selectedBillForDetail.active_payment_request.id,
        outcome
      );
      if (outcome === "success") {
        playSound("success");
        setRecognitionOutcome({
          type: "success",
          paymentId: res.payment_id,
          amount: res.amount_inr,
          newOutstanding: res.new_outstanding,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        playSound("failed");
        setRecognitionOutcome({
          type: "failed",
          reason: res.reason || "Simulated UPI payment declined by customer",
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      loadBillsOnly();
    } catch {
      // quiet
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Listen for real-time payment success broadcasts from standalone QR popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "KOSHA_PAYMENT_SUCCESS") {
        playSound("success");
        setRecognitionOutcome({
          type: "success",
          paymentId: event.data.paymentId,
          amount: event.data.amount,
          newOutstanding: event.data.newOutstanding,
          timestamp: new Date().toLocaleTimeString(),
        });
        loadBillsOnly();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 5-Minute Payment Window Countdown Effect
  useEffect(() => {
    const activeReq = selectedBillForDetail?.active_payment_request;
    if (!activeReq || activeReq.status !== "active") {
      setCountdownSeconds(300);
      return;
    }

    const calculateRemaining = () => {
      if (activeReq.expires_at) {
        const parsed = parseUtcDate(activeReq.expires_at);
        if (parsed) {
          const expiresTime = parsed.getTime();
          const diff = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
          return Math.min(300, diff);
        }
      }
      return 300;
    };

    setCountdownSeconds(calculateRemaining());

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
  }, [selectedBillForDetail?.active_payment_request?.id, selectedBillForDetail?.active_payment_request?.expires_at]);


  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTotal = parseFloat(totalAmount);
    const parsedInitial = parseFloat(initialManualPaid) || 0;

    if (!selectedCustomerId) {
      setFormError("Please select a customer.");
      return;
    }
    if (!billDescription.trim()) {
      setFormError("Please enter a goods or order description.");
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setFormError("Total bill amount must be greater than ₹0.");
      return;
    }
    if (parsedInitial > parsedTotal) {
      setFormError("Initial manual down-payment cannot exceed total bill amount.");
      return;
    }
    if (!agreedRepaymentDate) {
      setFormError("Please select an agreed repayment date.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await apiClient.createShopkeeperBill(
        {
          customer_id: selectedCustomerId,
          description: billDescription.trim(),
          total_amount: parsedTotal,
          initial_manual_paid: parsedInitial,
          agreed_repayment_date: agreedRepaymentDate,
          generate_payment_request: generatePaymentReq,
        },
        selectedShop
      );

      // Add to list and select for display
      setBills([created, ...bills]);
      setSelectedBillForDetail(created);
      setShowCreateModal(false);

      // Reset form
      setBillDescription("");
      setTotalAmount("");
      setInitialManualPaid("0");
    } catch (err: unknown) {
      setFormError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateRequest = async (requestId: string) => {
    setIsRegenerating(true);
    try {
      const regenerated = await apiClient.regenerateRazorpayPaymentRequest(requestId);
      if (selectedBillForDetail) {
        const updatedBill = {
          ...selectedBillForDetail,
          active_payment_request: regenerated,
        };
        setSelectedBillForDetail(updatedBill);
        setBills(bills.map((b) => (b.id === updatedBill.id ? updatedBill : b)));
      }
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyUpiLink = (payload?: string) => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenQrInNewWindow = async (billToOpen?: BillPaymentHistory) => {
    const targetBill = billToOpen || selectedBillForDetail;
    if (!targetBill) return;

    let activeReq = targetBill.active_payment_request;

    // Check if request is missing or expired, regenerate if needed
    const isExpired =
      !activeReq ||
      activeReq.status === "expired" ||
      (activeReq.expires_at && (parseUtcDate(activeReq.expires_at)?.getTime() || 0) <= Date.now());

    if (isExpired) {
      try {
        setIsRegenerating(true);
        if (activeReq) {
          activeReq = await apiClient.regenerateRazorpayPaymentRequest(activeReq.id);
        } else {
          activeReq = await apiClient.createRazorpayPaymentRequest({
            bill_id: targetBill.bill_id || targetBill.id || "",
            partial_amount: targetBill.outstanding_amount,
          });
        }
        const updatedBill: BillPaymentHistory = {
          ...targetBill,
          active_payment_request: activeReq,
        };
        setSelectedBillForDetail(updatedBill);
        setBills((prev) =>
          prev.map((b) =>
            (b.bill_id || b.id) === (updatedBill.bill_id || updatedBill.id) ? updatedBill : b
          )
        );
      } catch (err: unknown) {
        setError("Failed to generate fresh QR code for new window: " + formatApiError(err));
        setIsRegenerating(false);
        return;
      } finally {
        setIsRegenerating(false);
      }
    }

    if (!activeReq || !activeReq.qr_image_url) {
      setError("QR code image data is not available yet.");
      return;
    }

    const popupWidth = 520;
    const popupHeight = 780;
    const left = window.screen.width ? (window.screen.width - popupWidth) / 2 : 100;
    const top = window.screen.height ? (window.screen.height - popupHeight) / 2 : 100;

    const popup = window.open(
      "",
      `KoshaQR_${activeReq.id}`,
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
    );

    if (!popup) {
      alert("Popup blocked! Please allow popups for this site to open the standalone clear QR window.");
      return;
    }

    const merchantName = razorpayConfig?.merchant_name || "KOSHA MSME Treasury";
    const billRef = targetBill.bill_number || targetBill.bill_reference || targetBill.id?.slice(0, 8) || "INV";
    const custName = targetBill.customer_name || "Customer";
    const amountFormatted = formatINR(activeReq.amount_inr);
    const upiPayload = activeReq.upi_qr_payload || "";
    const shortUrl = activeReq.short_url || "";
    const qrImg = activeReq.qr_image_url;
    const requestId = activeReq.id;
    const expiresUtcIso = activeReq.expires_at || new Date(Date.now() + 300000).toISOString();
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
        ${upiPayload ? `<a href="${upiPayload}" class="btn btn-secondary" id="btnOpenUpi">📱 Pay via App</a>` : ""}
        ${shortUrl ? `<a href="${shortUrl}" target="_blank" class="btn btn-primary">💳 Open Checkout</a>` : ""}
      </div>
      <div class="btn-row">
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

  // Derive status badge styling and text
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return {
          label: "Fully Paid",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: CheckCircle2,
        };
      case "partially_paid":
        return {
          label: "Partially Paid",
          bg: "bg-teal-100 text-teal-800 border-teal-200",
          icon: Clock,
        };
      case "overdue":
        return {
          label: "Overdue",
          bg: "bg-rose-100 text-rose-800 border-rose-200",
          icon: AlertTriangle,
        };
      case "due_today":
        return {
          label: "Due Today",
          bg: "bg-amber-100 text-amber-800 border-amber-200",
          icon: Clock,
        };
      default:
        return {
          label: "Awaiting Payment",
          bg: "bg-blue-100 text-blue-800 border-blue-200",
          icon: Clock,
        };
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 select-none">
      {/* Top Banner & Header */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue border border-blue-200 inline-flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Razorpay UPI Engine</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                !razorpayConfig?.is_configured
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : (razorpayConfig?.mode === "live" || razorpayConfig?.has_live_credentials)
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-amber-100 text-amber-800 border-amber-200"
              }`}>
                {!razorpayConfig?.is_configured
                  ? "Razorpay Not Configured"
                  : (razorpayConfig?.mode === "live" || razorpayConfig?.has_live_credentials)
                  ? "Live Gateway Active"
                  : "Test Sandbox Mode"}
              </span>
              {isRealTime && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-Time SSE</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-kosha-navy">
              Customer UPI Billing & Payment Requests
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Create customer bills, generate dynamic Razorpay UPI QR codes, and track verified settlements.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-kosha-blue to-kosha-deep hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Customer Bill</span>
          </button>
        </div>
      </div>

      {/* Executive Financial Dues & Audit KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Active Remaining Dues */}
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/90 shadow-glass-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Remaining Customer Dues
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {financialSummary?.active_bills_count ?? 0} Active {(financialSummary?.active_bills_count ?? 0) === 1 ? "Bill" : "Bills"}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono tracking-tight">
              {formatINR(financialSummary?.remaining_customer_dues ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Across all customers &amp; credit commitments
            </p>
          </div>
        </div>

        {/* Card 2: Razorpay Online Verified Collections */}
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/90 shadow-glass-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Razorpay Online Verified
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>UPI Verified</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight">
              {formatINR(financialSummary?.razorpay_verified_collections ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Direct bank settlements via UPI QR &amp; links
            </p>
          </div>
        </div>

        {/* Card 3: Counter Cash Downpayments */}
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/90 shadow-glass-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Counter Cash Paid
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Cash Receipts
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tracking-tight">
              {formatINR(financialSummary?.counter_cash_paid ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Initial downpayments &amp; counter settlements
            </p>
          </div>
        </div>

        {/* Card 4: Total Billed Value & Settlement Rate */}
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/90 shadow-glass-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Billed Volume
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              {financialSummary?.settled_bills_count ?? 0} Settled
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-kosha-navy font-mono tracking-tight">
              {formatINR(financialSummary?.total_billed_volume ?? 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>Settlement Rate:</span>
              <strong className="text-slate-800 font-bold">
                {financialSummary?.settlement_rate_percentage ?? 0}% Settled
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Authoritative Single Source of Truth Invariant Strip */}
      <div className="bg-white/80 rounded-2xl px-5 py-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-slate-700">Financial Invariant:</span>
          <span className="font-mono text-slate-600">
            {formatINR(financialSummary?.total_billed_volume ?? 0)} Billed = {formatINR(financialSummary?.remaining_customer_dues ?? 0)} Due + {formatINR(financialSummary?.counter_cash_paid ?? 0)} Cash + {formatINR(financialSummary?.razorpay_verified_collections ?? 0)} Razorpay
          </span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
          (financialSummary?.is_reconciled ?? true)
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          {(financialSummary?.is_reconciled ?? true) ? "✓ 100% Mathematically Reconciled" : "⚠ Reconciliation Discrepancy"}
        </span>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Error loading payment data</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={loadInitialData} className="text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Main Grid: Bills List (Left 7 cols) & Active Payment Detail (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Customer Bills Directory */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filters Bar */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadInitialData()}
                placeholder="Search bills, customer..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
              {["all", "outstanding", "paid", "overdue"].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    apiClient
                      .listShopkeeperBills(selectedShop, st, searchQuery)
                      .then((res) => setBills(res));
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    statusFilter === st
                      ? "bg-kosha-blue text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Bills List */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-kosha-blue" />
              <span className="text-xs font-semibold">Loading verified customer bills...</span>
            </div>
          ) : bills.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-slate-300" />
              <h4 className="font-bold text-sm text-slate-800">No bills found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create a bill for an existing customer to generate a dynamic Razorpay UPI payment QR.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => {
                const badge = getStatusBadge(bill.status);
                const BadgeIcon = badge.icon;
                const isSelected = selectedBillForDetail?.id === bill.id;

                return (
                  <div
                    key={bill.id}
                    onClick={() => setSelectedBillForDetail(bill)}
                    className={`group bg-white rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected
                        ? "border-kosha-blue ring-2 ring-blue-500/20"
                        : "border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-kosha-navy font-mono">
                            {bill.bill_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${badge.bg}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">{bill.description}</h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Customer: <strong className="text-slate-700">{bill.customer_name}</strong>
                          {bill.customer_phone ? ` (${bill.customer_phone})` : ""}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-slate-400 font-medium">Outstanding</div>
                        <div className="text-base sm:text-lg font-black text-slate-900">
                          {formatINR(bill.outstanding_amount)}
                        </div>
                        <div className="text-[11px] text-slate-400">Total: {formatINR(bill.total_amount)}</div>
                      </div>
                    </div>

                    {/* Breakdown strip */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <div className="flex items-center gap-4">
                        <span>
                          Manual Cash:{" "}
                          <strong className="text-slate-700">
                            {formatINR(bill.initial_paid_amount ?? (bill as any).initial_manual_paid ?? 0)}
                          </strong>
                        </span>
                        <span>
                          Razorpay Verified:{" "}
                          <strong className="text-emerald-700">
                            {formatINR(bill.total_verified_payments ?? (bill as any).verified_razorpay_paid ?? 0)}
                          </strong>
                        </span>
                      </div>
                      <span className="text-kosha-blue group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
                        View QR &amp; History <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Bill QR & Payment History Card (5 cols) */}
        <div className="lg:col-span-5 sticky top-24">
          {selectedBillForDetail ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-glass-lg space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-kosha-blue block">
                    Active Payment Request
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {selectedBillForDetail.bill_number}
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    getStatusBadge(selectedBillForDetail.status).bg
                  }`}
                >
                  {getStatusBadge(selectedBillForDetail.status).label}
                </span>
              </div>

              {/* Authoritative Financial Reconciliation Box */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                  <span>Ledger Reconciliation</span>
                  <span>Financial Invariant</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Total Billed Amount:</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(selectedBillForDetail.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>(-) Counter Cash Downpayment:</span>
                  <span className="font-mono font-bold text-slate-700">
                    - {formatINR(selectedBillForDetail.initial_paid_amount ?? (selectedBillForDetail as any).initial_manual_paid ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>(-) Razorpay Verified Collections:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    - {formatINR(selectedBillForDetail.total_verified_payments ?? (selectedBillForDetail as any).verified_razorpay_paid ?? 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                  <span className="text-slate-900">(=) Exact Remaining Due:</span>
                  <span className={`font-mono text-base ${selectedBillForDetail.outstanding_amount === 0 ? "text-emerald-600" : "text-rose-600 font-extrabold"}`}>
                    {formatINR(selectedBillForDetail.outstanding_amount)}
                  </span>
                </div>
              </div>

              {/* Real-Time Recognition Outcome: SUCCESS */}
              {recognitionOutcome.type === "success" ? (
                <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-300 text-center space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 ring-8 ring-emerald-50">
                    <CheckCircle2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                      ✓ Real-Time Payment Verified
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 mt-2">
                      + {formatINR(recognitionOutcome.amount || selectedBillForDetail.active_payment_request?.amount_inr || 0)} Received
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      Customer payment recognized and confirmed instantly via Razorpay UPI!
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-emerald-200 text-left text-xs space-y-2 shadow-2xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Razorpay Payment ID:</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {recognitionOutcome.paymentId}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Remaining Bill Balance:</span>
                      <span className="font-extrabold text-emerald-700">
                        {formatINR(recognitionOutcome.newOutstanding ?? 0)}
                      </span>
                    </div>
                    {recognitionOutcome.timestamp && (
                      <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1 border-t border-slate-100">
                        <span>Recognized at:</span>
                        <span>{recognitionOutcome.timestamp}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRecognitionOutcome({ type: null });
                      loadInitialData();
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    Done / View Settled Bill
                  </button>
                </div>
              ) : recognitionOutcome.type === "failed" ? (
                /* Real-Time Recognition Outcome: FAILED */
                <div className="bg-rose-50 rounded-2xl p-6 border-2 border-rose-300 text-center space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 ring-8 ring-rose-50">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 uppercase tracking-wider">
                      ✕ Payment Failed or Cancelled
                    </span>
                    <h3 className="text-xl font-black text-slate-900 mt-2">
                      Transaction Unsuccessful
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      {recognitionOutcome.reason || "Customer declined UPI PIN, transaction timed out, or bank declined."}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-rose-200 text-left text-xs space-y-1 text-slate-600 shadow-2xs">
                    <p className="font-semibold text-slate-700">Ledger Protection Status:</p>
                    <p className="text-[11px] text-slate-500">
                      Outstanding balance remains strictly protected and unchanged.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecognitionOutcome({ type: null })}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecognitionOutcome({ type: null });
                        if (selectedBillForDetail.active_payment_request) {
                          handleRegenerateRequest(selectedBillForDetail.active_payment_request.id);
                        }
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      Regenerate QR
                    </button>
                  </div>
                </div>
              ) : selectedBillForDetail.active_payment_request &&
                (countdownSeconds <= 0 || selectedBillForDetail.active_payment_request.status === "expired") ? (
                /* 5-MINUTE PAYMENT WINDOW EXPIRED CARD */
                <div className="bg-amber-50 rounded-2xl p-6 border-2 border-amber-300 text-center space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700 ring-8 ring-amber-50">
                    <Clock className="w-9 h-9" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 uppercase tracking-wider">
                      🔒 5-Minute Window Expired
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mt-2">
                      Payment Session Timed Out
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      For customer security, UPI QR codes automatically expire after 5 minutes. The bill balance of {formatINR(selectedBillForDetail.outstanding_amount)} remains completely protected.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => handleOpenQrInNewWindow(selectedBillForDetail)}
                      disabled={isRegenerating}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-kosha-deep hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>Generate &amp; Open QR in New Window Clearly</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRegenerateRequest(selectedBillForDetail.active_payment_request!.id)}
                      disabled={isRegenerating}
                      className="w-full py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                      <span>Regenerate Here (Fresh 5-Min Window)</span>
                    </button>
                  </div>
                </div>
              ) : selectedBillForDetail.active_payment_request &&
              selectedBillForDetail.status !== "paid" ? (
                /* Dynamic Razorpay QR Card with Active 5-Minute Countdown & Real-Time Listening */
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col items-center text-center space-y-3.5">
                  {/* Live Recognition Listening Radar Banner with 5-Minute Timer */}
                  <div className="w-full flex items-center justify-between px-3 py-2 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-700">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                      </span>
                      <span>Real-Time Sync</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                          countdownSeconds < 60
                            ? "bg-rose-100 text-rose-700 animate-pulse border border-rose-200"
                            : countdownSeconds < 120
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                        title="5-minute payment security window"
                      >
                        ⏳ {formatTimer(countdownSeconds)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualCheckStatus}
                      disabled={isCheckingStatus}
                      className="inline-flex items-center gap-1 font-bold text-[11px] text-blue-800 hover:text-blue-950 underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isCheckingStatus ? "animate-spin" : ""}`} />
                      <span>{isCheckingStatus ? "Checking..." : "Verify Now"}</span>
                    </button>
                  </div>

                  {/* 5-Minute Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden -mt-1">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        countdownSeconds < 60 ? "bg-rose-500" : countdownSeconds < 120 ? "bg-amber-500" : "bg-blue-600"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, (countdownSeconds / 300) * 100))}%` }}
                    />
                  </div>

                  <div className="p-2.5 bg-white rounded-2xl shadow-xs border border-slate-200">
                    {selectedBillForDetail.active_payment_request.qr_image_url ? (
                      <img
                        src={selectedBillForDetail.active_payment_request.qr_image_url}
                        alt="Razorpay Dynamic UPI QR"
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-slate-400">
                        <QrCode className="w-12 h-12" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-base font-black text-slate-900">
                      Amount: {formatINR(selectedBillForDetail.active_payment_request.amount_inr)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customer scans via Phone Camera or Google Lens to pay with GPay, PhonePe, Paytm, or Cards
                    </p>
                  </div>

                  {/* Actions: Standalone Window, Copy UPI Link & Hosted Link */}
                  <div className="w-full pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenQrInNewWindow(selectedBillForDetail)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-kosha-deep hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>Open QR in New Window Clearly</span>
                    </button>
                  </div>

                  <div className="w-full flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyUpiLink(
                          selectedBillForDetail.active_payment_request?.upi_qr_payload
                        )
                      }
                      className="flex-1 py-1.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Link Copied" : "Copy UPI Link"}</span>
                    </button>

                    {selectedBillForDetail.active_payment_request.short_url && (
                      <a
                        href={selectedBillForDetail.active_payment_request.short_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-3 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Checkout</span>
                      </a>
                    )}
                  </div>

                  {/* Request status / Regenerate button */}
                  <div className="w-full pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleRegenerateRequest(
                          selectedBillForDetail.active_payment_request!.id
                        )
                      }
                      disabled={isRegenerating}
                      className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                      <span>Regenerate Payment Request</span>
                    </button>
                  </div>

                  {/* Quick Recognition Simulation Pills */}
                  <div className="w-full pt-2 border-t border-slate-200/70 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Recognition Verification &amp; Testing
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSimulateRecognition("success")}
                        disabled={isCheckingStatus}
                        className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        <span>⚡ Test: Success</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateRecognition("failed")}
                        disabled={isCheckingStatus}
                        className="py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold text-[11px] transition-colors flex items-center justify-center gap-1"
                      >
                        <span>✕ Test: Failed</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedBillForDetail.status === "paid" ? (
                <div className="bg-emerald-50 rounded-2xl p-6 text-center border border-emerald-200 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-extrabold text-sm text-emerald-900">Bill Settled in Full</h4>
                  <p className="text-xs text-emerald-700">
                    All outstanding dues have been verified and settled.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h4 className="font-bold text-xs text-slate-800">No Active Payment Request</h4>
                  <p className="text-[11px] text-slate-400">
                    Click below to generate a fresh Razorpay UPI request for the remaining balance.
                  </p>
                  <div className="flex flex-col gap-2 w-full pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenQrInNewWindow(selectedBillForDetail)}
                      disabled={isRegenerating}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Generate &amp; Open QR in New Window</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const req = await apiClient.createRazorpayPaymentRequest({
                          bill_id: selectedBillForDetail.bill_id || selectedBillForDetail.id || "",
                          partial_amount: selectedBillForDetail.outstanding_amount,
                        });
                        const updated = {
                          ...selectedBillForDetail,
                          active_payment_request: req,
                        };
                        setSelectedBillForDetail(updated);
                        setBills((prev) =>
                          prev.map((b) =>
                            (b.bill_id || b.id) === (updated.bill_id || updated.id) ? updated : b
                          )
                        );
                      }}
                      className="w-full py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs"
                    >
                      Generate QR Here
                    </button>
                  </div>
                </div>
              )}

              {/* Verified Payment History Table */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Verified Payment History ({selectedBillForDetail.verified_payments.length})
                </h4>

                {selectedBillForDetail.verified_payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No verified Razorpay payments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedBillForDetail.verified_payments.map((vp) => (
                      <div
                        key={vp.id}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 font-mono text-[11px]">
                            {vp.razorpay_payment_id}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(vp.verified_at).toLocaleString()} · {vp.payment_method.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-700">
                            +{formatINR(vp.amount_inr)}
                          </span>
                          <div className="text-[9px] text-emerald-600 font-semibold uppercase">
                            {vp.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 text-center text-slate-400 space-y-2">
              <CreditCard className="w-10 h-10 mx-auto text-slate-300" />
              <h4 className="font-bold text-sm text-slate-700">Select a bill to view QR & history</h4>
              <p className="text-xs text-slate-400">
                Click any customer bill on the left to inspect its live payment request, QR code, and verified settlement ledger.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE BILL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-lg text-kosha-navy">Create Customer Bill</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Register bill & generate Razorpay UPI request
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 my-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBill} className="space-y-4 pt-3">
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Order / Goods Description
                </label>
                <input
                  type="text"
                  value={billDescription}
                  onChange={(e) => setBillDescription(e.target.value)}
                  placeholder="e.g. Industrial fasteners, monthly hardware..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Total Amount & Initial Payment Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Total Bill Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="2500.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Down-payment (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialManualPaid}
                    onChange={(e) => setInitialManualPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Agreed Repayment Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agreed Repayment Date
                </label>
                <input
                  type="date"
                  value={agreedRepaymentDate}
                  onChange={(e) => setAgreedRepaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Auto-generate Razorpay Request Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="genReq"
                  checked={generatePaymentReq}
                  onChange={(e) => setGeneratePaymentReq(e.target.checked)}
                  className="rounded text-kosha-blue focus:ring-blue-500"
                />
                <label htmlFor="genReq" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Automatically generate Razorpay UPI QR code for remaining balance
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white font-bold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating Bill..." : "Create Bill & Generate QR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
