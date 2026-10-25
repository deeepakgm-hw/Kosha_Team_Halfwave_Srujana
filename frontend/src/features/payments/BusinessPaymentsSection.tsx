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
  FileText,
  Trash2,
  UserPlus,
  Smartphone,
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
import { DigitalBillModal } from "../../components/bills/DigitalBillModal";

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
  const [isNewCustomer, setIsNewCustomer] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>("");
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>("");
  const [billDescription, setBillDescription] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<"cash" | "razorpay_upi" | "none">("razorpay_upi");
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>("0");
  const [agreedRepaymentDate, setAgreedRepaymentDate] = useState<string>("");
  const [generatePaymentReq] = useState<boolean>(true);
  const [billNotes, setBillNotes] = useState<string>("");
  const [lineItems, setLineItems] = useState<
    Array<{ item_name: string; quantity: number; unit_price: number; line_total: number }>
  >([]);
  const [showLineItemsBuilder, setShowLineItemsBuilder] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Digital Bill Modal State
  const [digitalBillModalBill, setDigitalBillModalBill] = useState<BillPaymentHistory | null>(null);

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


  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { item_name: "", quantity: 1, unit_price: 0, line_total: 0 },
    ]);
  };

  const handleUpdateLineItem = (
    index: number,
    field: "item_name" | "quantity" | "unit_price",
    value: string | number
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      item.line_total = qty * price;
      updated[index] = item;

      // Auto update total amount
      const sumTotal = updated.reduce((acc, curr) => acc + curr.line_total, 0);
      if (sumTotal > 0) {
        setTotalAmount(sumTotal.toFixed(2));
      }
      return updated;
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0) {
        const sumTotal = updated.reduce((acc, curr) => acc + curr.line_total, 0);
        setTotalAmount(sumTotal.toFixed(2));
      }
      return updated;
    });
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTotal = parseFloat(totalAmount);
    let parsedInitial = parseFloat(initialPaymentAmount) || 0;
    if (initialPaymentMethod === "none") {
      parsedInitial = 0;
    }

    if (!isNewCustomer && !selectedCustomerId) {
      setFormError("Please select an existing customer or register a new one.");
      return;
    }
    if (isNewCustomer) {
      if (!newCustomerName.trim()) {
        setFormError("Please enter customer's full name.");
        return;
      }
      if (!newCustomerPhone.trim()) {
        setFormError("Please enter customer's phone number.");
        return;
      }
    }

    const effectiveDesc =
      billDescription.trim() ||
      (lineItems.length > 0
        ? lineItems
            .map((i) => i.item_name.trim())
            .filter(Boolean)
            .join(", ")
        : "Store Purchase Bill");

    if (!effectiveDesc) {
      setFormError("Please enter an order/goods description or add line items.");
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setFormError("Total bill amount must be greater than ₹0.");
      return;
    }
    if (parsedInitial > parsedTotal) {
      setFormError("Initial payment cannot exceed total bill amount.");
      return;
    }
    if (!agreedRepaymentDate) {
      setFormError("Please select an agreed repayment date.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const validLineItems = lineItems
        .filter((item) => item.item_name.trim().length > 0)
        .map((item) => ({
          name: item.item_name.trim(),
          item_name: item.item_name.trim(),
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
          line_total: (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
        }));

      const created = await apiClient.createShopkeeperBill(
        {
          customer_id: isNewCustomer ? undefined : selectedCustomerId,
          new_customer: isNewCustomer
            ? {
                display_name: newCustomerName.trim(),
                phone: newCustomerPhone.trim(),
                email: newCustomerEmail.trim() || undefined,
              }
            : undefined,
          description: effectiveDesc,
          total_amount: parsedTotal,
          initial_payment_amount: parsedInitial,
          initial_payment_method: initialPaymentMethod,
          line_items: validLineItems.length > 0 ? validLineItems : undefined,
          notes: billNotes.trim() || undefined,
          agreed_repayment_date: agreedRepaymentDate,
          generate_payment_request: initialPaymentMethod === "razorpay_upi" || generatePaymentReq,
        },
        selectedShop
      );

      // Refresh customers list & financial summary
      apiClient.listShopkeeperCustomers().then(setCustomers).catch(() => {});
      apiClient.getShopkeeperFinancialSummary(selectedShop).then(setFinancialSummary).catch(() => {});

      // Add to list and select for display
      setBills([created, ...bills]);
      setSelectedBillForDetail(created);
      setShowCreateModal(false);

      // If UPI QR requested, immediately pop the DigitalBillModal with the 5-min timer
      if (initialPaymentMethod === "razorpay_upi" || created.active_payment_request) {
        setDigitalBillModalBill(created);
      }

      // Reset form
      setBillDescription("");
      setTotalAmount("");
      setInitialPaymentAmount("0");
      setInitialPaymentMethod("razorpay_upi");
      setLineItems([]);
      setShowLineItemsBuilder(false);
      setBillNotes("");
      setIsNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
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
      background: #F5F7FA;
      color: #0C0C0D;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: #ffffff;
      color: #0C0C0D;
      border: 1px solid #E1E7EC;
      border-radius: 24px;
      width: 100%;
      max-width: 460px;
      box-shadow: 0 4px 24px 0 rgba(0, 28, 100, 0.08);
      padding: 28px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .top-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 9999px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #0070E0;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .merchant {
      font-size: 13px;
      font-weight: 700;
      color: #545D68;
      margin-top: 8px;
    }
    .bill-title {
      font-size: 18px;
      font-weight: 800;
      color: #001C64;
      margin-top: 2px;
    }
    .amount-box {
      margin: 14px 0 12px;
      background: #F5F7FA;
      border: 1.5px solid #E1E7EC;
      border-radius: 18px;
      padding: 12px 16px;
    }
    .amount-label {
      font-size: 11px;
      font-weight: 700;
      color: #545D68;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 900;
      color: #001C64;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.02em;
    }
    .qr-container {
      background: #ffffff;
      border: 2px solid #E1E7EC;
      border-radius: 20px;
      padding: 14px;
      display: inline-block;
      margin: 8px auto 14px;
      box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.04);
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
      background: #E1E7EC;
      border-radius: 9999px;
      height: 6px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .timer-bar {
      height: 100%;
      background: #0070E0;
      transition: width 1s linear, background-color 0.3s;
    }
    .timer-text {
      font-size: 12px;
      font-weight: 700;
      color: #545D68;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 14px;
    }
    .timer-badge {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 9999px;
      background: #dbeafe;
      color: #003087;
    }
    .upi-apps {
      font-size: 11px;
      color: #545D68;
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
      padding: 10px 16px;
      border-radius: 9999px;
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
      background: #FFC439;
      color: #001C64;
    }
    .btn-primary:hover {
      background: #F6B623;
    }
    .btn-secondary {
      background: #ffffff;
      color: #0070E0;
      border: 1.5px solid #0070E0;
    }
    .btn-secondary:hover {
      background: #F5F7FA;
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
      <div className="bg-white border border-[#E1E7EC] rounded-2xl p-6 sm:p-7 shadow-paypal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0070E0]/10 text-[#0070E0] border border-[#0070E0]/20 inline-flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Razorpay UPI Engine</span>
              </span>
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                !razorpayConfig?.is_configured
                  ? "bg-slate-100 text-slate-700 border-[#E1E7EC]"
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
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-Time SSE</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#001C64] tracking-tight">
              Customer UPI Billing &amp; Payment Requests
            </h1>
            <p className="text-sm text-[#545D68] font-medium mt-0.5">
              Create customer bills, generate dynamic Razorpay UPI QR codes, and track verified settlements.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white font-bold text-xs shadow-paypal hover:shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Customer Bill</span>
          </button>
        </div>
      </div>

      {/* Executive Financial Dues & Audit KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Active Remaining Dues */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
              Remaining Customer Dues
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {financialSummary?.active_bills_count ?? 0} Active {(financialSummary?.active_bills_count ?? 0) === 1 ? "Bill" : "Bills"}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 font-mono tracking-tight">
              {formatINR(financialSummary?.remaining_customer_dues ?? 0)}
            </div>
            <p className="text-[11px] text-[#545D68] font-medium mt-0.5">
              Across all customers &amp; credit commitments
            </p>
          </div>
        </div>

        {/* Card 2: Razorpay Online Verified Collections */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
              Razorpay Online Verified
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>UPI Verified</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight">
              {formatINR(financialSummary?.razorpay_verified_collections ?? 0)}
            </div>
            <p className="text-[11px] text-[#545D68] font-medium mt-0.5">
              Direct bank settlements via UPI QR &amp; links
            </p>
          </div>
        </div>

        {/* Card 3: Counter Cash Downpayments */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
              Counter Cash Paid
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F5F7FA] text-slate-700 border border-[#E1E7EC]">
              Cash Receipts
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tracking-tight">
              {formatINR(financialSummary?.counter_cash_paid ?? 0)}
            </div>
            <p className="text-[11px] text-[#545D68] font-medium mt-0.5">
              Initial downpayments &amp; counter settlements
            </p>
          </div>
        </div>

        {/* Card 4: Total Billed Value & Settlement Rate */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E7EC] shadow-paypal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider">
              Total Billed Volume
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              {financialSummary?.settled_bills_count ?? 0} Settled
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#001C64] font-mono tracking-tight">
              {formatINR(financialSummary?.total_billed_volume ?? 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#545D68] font-medium">
              <span>Settlement Rate:</span>
              <strong className="text-slate-800 font-bold">
                {financialSummary?.settlement_rate_percentage ?? 0}% Settled
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Authoritative Single Source of Truth Invariant Strip */}
      <div className="bg-white rounded-2xl px-5 py-3.5 border border-[#E1E7EC] shadow-paypal flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-[#001C64]">Financial Invariant:</span>
          <span className="font-mono text-[#545D68]">
            {formatINR(financialSummary?.total_billed_volume ?? 0)} Billed = {formatINR(financialSummary?.remaining_customer_dues ?? 0)} Due + {formatINR(financialSummary?.counter_cash_paid ?? 0)} Cash + {formatINR(financialSummary?.razorpay_verified_collections ?? 0)} Razorpay
          </span>
        </div>
        <span className={`px-3 py-1 rounded-full font-bold text-[11px] border ${
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
          <div className="bg-white rounded-2xl p-3.5 border border-[#E1E7EC] shadow-paypal flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#545D68] absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadInitialData()}
                placeholder="Search bills, customer..."
                className="w-full pl-9 pr-3 py-1.5 rounded-full border border-[#E1E7EC] text-xs text-slate-800 bg-[#F5F7FA] focus:outline-hidden focus:ring-2 focus:ring-[#0070E0]"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {["all", "outstanding", "paid", "overdue"].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    apiClient
                      .listShopkeeperBills(selectedShop, st, searchQuery)
                      .then((res) => setBills(res));
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    statusFilter === st
                      ? "bg-[#0070E0] text-white shadow-xs font-bold"
                      : "bg-[#F5F7FA] text-[#545D68] hover:bg-[#E1E7EC]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Bills List */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-[#E1E7EC]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0070E0]" />
              <span className="text-xs font-semibold text-[#545D68]">Loading verified customer bills...</span>
            </div>
          ) : bills.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-[#E1E7EC] space-y-2">
              <Receipt className="w-10 h-10 mx-auto text-slate-300" />
              <h4 className="font-bold text-sm text-slate-800">No bills found</h4>
              <p className="text-xs text-[#545D68] max-w-sm mx-auto">
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
                    className={`group bg-white rounded-2xl p-5 border transition-all cursor-pointer shadow-paypal hover:shadow-md ${
                      isSelected
                        ? "border-[#0070E0] ring-2 ring-[#0070E0]/20"
                        : "border-[#E1E7EC] hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#001C64] font-mono">
                            {bill.bill_number}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${badge.bg}`}
                          >
                            <BadgeIcon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-1">{bill.description}</h4>
                        <p className="text-xs text-[#545D68] font-medium">
                          Customer: <strong className="text-slate-800">{bill.customer_name}</strong>
                          {bill.customer_phone ? ` (${bill.customer_phone})` : ""}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-[#545D68] font-medium">Outstanding</div>
                        <div className="text-base sm:text-lg font-black text-[#001C64]">
                          {formatINR(bill.outstanding_amount)}
                        </div>
                        <div className="text-[11px] text-[#545D68]">Total: {formatINR(bill.total_amount)}</div>
                      </div>
                    </div>

                    {/* Breakdown strip */}
                    <div className="mt-3 pt-3 border-t border-[#E1E7EC] flex items-center justify-between text-[11px] text-[#545D68] font-medium flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span>
                          Cash:{" "}
                          <strong className="text-slate-800">
                            {formatINR(bill.initial_paid_amount ?? (bill as any).initial_manual_paid ?? 0)}
                          </strong>
                        </span>
                        <span>
                          UPI:{" "}
                          <strong className="text-emerald-700">
                            {formatINR(bill.total_verified_payments ?? (bill as any).verified_razorpay_paid ?? 0)}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDigitalBillModalBill(bill);
                          }}
                          className="px-3 py-1 rounded-full bg-[#0070E0]/10 hover:bg-[#0070E0]/20 text-[#0070E0] text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                          title="View Full Digital Bill & Invoice"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Digital Bill</span>
                        </button>
                        <span className="text-[#0070E0] group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
                          QR &amp; History <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
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
            <div className="bg-white rounded-2xl p-6 border border-[#E1E7EC] shadow-paypal space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E1E7EC]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0070E0] block">
                    Active Payment Request
                  </span>
                  <h3 className="text-base font-black text-[#001C64] mt-0.5">
                    {selectedBillForDetail.bill_number}
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    getStatusBadge(selectedBillForDetail.status).bg
                  }`}
                >
                  {getStatusBadge(selectedBillForDetail.status).label}
                </span>
              </div>

              {/* Full Digital Bill & Actions Action Button */}
              <button
                type="button"
                onClick={() => setDigitalBillModalBill(selectedBillForDetail)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#001C64] to-[#003087] hover:from-[#001449] hover:to-[#002466] text-white font-bold text-xs shadow-paypal flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <FileText className="w-4 h-4 text-[#FFC439]" />
                <span>View Full Digital Bill &amp; Print / Actions</span>
              </button>

              {/* Authoritative Financial Reconciliation Box */}
              <div className="bg-[#F5F7FA] rounded-2xl p-4 border border-[#E1E7EC] space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-[#545D68] text-[10px] uppercase tracking-wider">
                  <span>Ledger Reconciliation</span>
                  <span>Financial Invariant</span>
                </div>
                <div className="flex justify-between items-center text-[#545D68]">
                  <span>Total Billed Amount:</span>
                  <span className="font-mono font-bold text-[#001C64]">{formatINR(selectedBillForDetail.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center text-[#545D68]">
                  <span>(-) Counter Cash Downpayment:</span>
                  <span className="font-mono font-bold text-slate-700">
                    - {formatINR(selectedBillForDetail.initial_paid_amount ?? (selectedBillForDetail as any).initial_manual_paid ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#545D68]">
                  <span>(-) Razorpay Verified Collections:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    - {formatINR(selectedBillForDetail.total_verified_payments ?? (selectedBillForDetail as any).verified_razorpay_paid ?? 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E1E7EC] flex justify-between items-center font-bold">
                  <span className="text-[#001C64]">(=) Exact Remaining Due:</span>
                  <span className={`font-mono text-base ${selectedBillForDetail.outstanding_amount === 0 ? "text-emerald-600" : "text-rose-600 font-extrabold"}`}>
                    {formatINR(selectedBillForDetail.outstanding_amount)}
                  </span>
                </div>
              </div>

              {/* Itemized Line Items Breakdown */}
              {selectedBillForDetail.line_items && selectedBillForDetail.line_items.length > 0 && (
                <div className="bg-[#F5F7FA] rounded-2xl p-4 border border-[#E1E7EC] space-y-2 text-xs">
                  <div className="font-bold text-[#545D68] text-[10px] uppercase tracking-wider flex items-center justify-between">
                    <span>Itemized Bill Line Items</span>
                    <span className="text-[#0070E0]">{selectedBillForDetail.line_items.length} item(s)</span>
                  </div>
                  <div className="divide-y divide-[#E1E7EC]">
                    {selectedBillForDetail.line_items.map((item, idx) => (
                      <div key={idx} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-[#001C64] block">{item.name || item.item_name || "Line Item"}</span>
                          <span className="text-[11px] text-[#545D68]">
                            Qty: {item.quantity} × {formatINR(item.unit_price)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#001C64]">
                          {formatINR(item.line_total ?? item.total ?? (item.quantity * item.unit_price))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      className="w-full py-3 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white font-bold text-xs shadow-paypal transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>Generate &amp; Open QR in New Window Clearly</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRegenerateRequest(selectedBillForDetail.active_payment_request!.id)}
                      disabled={isRegenerating}
                      className="w-full py-2 rounded-full bg-white border border-[#E1E7EC] hover:bg-[#F5F7FA] text-slate-700 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                      <span>Regenerate Here (Fresh 5-Min Window)</span>
                    </button>
                  </div>
                </div>
              ) : selectedBillForDetail.active_payment_request &&
              selectedBillForDetail.status !== "paid" ? (
                /* Dynamic Razorpay QR Card with Active 5-Minute Countdown & Real-Time Listening */
                <div className="bg-[#F5F7FA] rounded-2xl p-5 border border-[#E1E7EC] flex flex-col items-center text-center space-y-3.5">
                  {/* Live Recognition Listening Radar Banner with 5-Minute Timer */}
                  <div className="w-full flex items-center justify-between px-3.5 py-2 bg-[#0070E0]/10 border border-[#0070E0]/20 rounded-full text-xs text-[#0070E0]">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0070E0]"></span>
                      </span>
                      <span>Real-Time Sync</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                          countdownSeconds < 60
                            ? "bg-rose-100 text-rose-700 animate-pulse border border-rose-200"
                            : countdownSeconds < 120
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-blue-100 text-[#003087] border border-blue-200"
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
                      className="inline-flex items-center gap-1 font-bold text-[11px] text-[#0070E0] hover:text-[#001C64] underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isCheckingStatus ? "animate-spin" : ""}`} />
                      <span>{isCheckingStatus ? "Checking..." : "Verify Now"}</span>
                    </button>
                  </div>

                  {/* 5-Minute Progress Bar */}
                  <div className="w-full bg-[#E1E7EC] rounded-full h-1.5 overflow-hidden -mt-1">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        countdownSeconds < 60 ? "bg-rose-500" : countdownSeconds < 120 ? "bg-amber-500" : "bg-[#0070E0]"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, (countdownSeconds / 300) * 100))}%` }}
                    />
                  </div>

                  <div className="p-3 bg-white rounded-2xl shadow-paypal border border-[#E1E7EC]">
                    {selectedBillForDetail.active_payment_request.qr_image_url ? (
                      <img
                        src={selectedBillForDetail.active_payment_request.qr_image_url}
                        alt="Razorpay Dynamic UPI QR"
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-[#F5F7FA] rounded-xl flex items-center justify-center text-slate-400">
                        <QrCode className="w-12 h-12" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-base font-black text-[#001C64]">
                      Amount: {formatINR(selectedBillForDetail.active_payment_request.amount_inr)}
                    </div>
                    <p className="text-xs text-[#545D68] mt-0.5">
                      Customer scans via Phone Camera or Google Lens to pay with GPay, PhonePe, Paytm, or Cards
                    </p>
                  </div>

                  {/* Direct UPI App Intent Trigger on Mobile / Desktop */}
                  {selectedBillForDetail.active_payment_request?.upi_qr_payload && (
                    <div className="w-full pt-1">
                      <a
                        href={selectedBillForDetail.active_payment_request.upi_qr_payload}
                        className="w-full py-2.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] font-black text-xs flex items-center justify-center gap-2 shadow-paypal transition-all active:scale-[0.98]"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>⚡ Pay via UPI App (GPay / PhonePe / Paytm)</span>
                      </a>
                    </div>
                  )}

                  {/* Actions: Standalone Window, Copy UPI Link & Hosted Link */}
                  <div className="w-full pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenQrInNewWindow(selectedBillForDetail)}
                      className="w-full py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-paypal transition-all active:scale-[0.98]"
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
                      className="flex-1 py-2 px-3 rounded-full bg-white border border-[#E1E7EC] hover:bg-[#F5F7FA] text-[#001C64] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#0070E0]" />}
                      <span>{copiedLink ? "Link Copied" : "Copy UPI Link"}</span>
                    </button>

                    {selectedBillForDetail.active_payment_request.short_url && (
                      <a
                        href={selectedBillForDetail.active_payment_request.short_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-paypal"
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
                      className="w-full py-2 rounded-full bg-white border border-[#E1E7EC] hover:bg-[#F5F7FA] text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-7 border border-[#E1E7EC] my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E1E7EC]">
              <div>
                <h3 className="font-extrabold text-lg text-[#001C64]">Create Customer Bill &amp; Payment Request</h3>
                <p className="text-xs text-[#545D68] font-medium">
                  Register genuine store bill, configure customer credit terms, and generate dynamic UPI QR.
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
              {/* Customer Selector / New Customer Mode */}
              <div className="bg-[#F5F7FA] p-3.5 rounded-xl border border-[#E1E7EC] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#001C64] uppercase tracking-wider">
                    Customer Account
                  </span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-full border border-[#E1E7EC] text-xs">
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(false)}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${
                        !isNewCustomer
                          ? "bg-[#0070E0] text-white shadow-2xs"
                          : "text-[#545D68] hover:text-[#001C64]"
                      }`}
                    >
                      Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomer(true)}
                      className={`px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                        isNewCustomer
                          ? "bg-[#0070E0] text-white shadow-2xs"
                          : "text-[#545D68] hover:text-[#001C64]"
                      }`}
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Register New</span>
                    </button>
                  </div>
                </div>

                {!isNewCustomer ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Customer</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3 py-2 rounded-xl border border-[#E1E7EC] text-xs text-slate-800 bg-white focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 rounded-xl border border-[#E1E7EC] text-xs text-slate-800 bg-white focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Email (Optional)</label>
                      <input
                        type="email"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="ramesh@example.com"
                        className="w-full px-3 py-2 rounded-xl border border-[#E1E7EC] text-xs text-slate-800 bg-white focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Order / Bill Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bill Summary / Goods Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={billDescription}
                  onChange={(e) => setBillDescription(e.target.value)}
                  placeholder="e.g. 50mm Brass valves, monthly hardware supplies..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs text-slate-800 bg-[#F5F7FA] focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                />
              </div>

              {/* Line Items Builder Section */}
              <div className="bg-[#F5F7FA] p-3.5 rounded-xl border border-[#E1E7EC] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#001C64]">
                      Itemized Line Items (Optional)
                    </span>
                    <span className="text-[11px] text-[#545D68] ml-2 font-medium">
                      {lineItems.length} item{lineItems.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLineItemsBuilder(true);
                      handleAddLineItem();
                    }}
                    className="text-xs font-bold text-[#0070E0] hover:text-[#003087] flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Line Item</span>
                  </button>
                </div>

                {(showLineItemsBuilder || lineItems.length > 0) && (
                  <div className="space-y-2 pt-1">
                    {lineItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-[#E1E7EC]">
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => handleUpdateLineItem(index, "item_name", e.target.value)}
                          placeholder="Item Name (e.g. 10mm Steel Rod)"
                          className="flex-3 px-2.5 py-1.5 rounded-lg border border-[#E1E7EC] text-xs text-slate-800"
                        />
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateLineItem(index, "quantity", Number(e.target.value))}
                          placeholder="Qty"
                          className="w-16 px-2.5 py-1.5 rounded-lg border border-[#E1E7EC] text-xs text-slate-800 text-center"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price || ""}
                          onChange={(e) => handleUpdateLineItem(index, "unit_price", Number(e.target.value))}
                          placeholder="Unit ₹"
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-[#E1E7EC] text-xs text-slate-800 text-right"
                        />
                        <span className="w-24 text-right font-mono font-bold text-xs text-[#001C64]">
                          {formatINR(item.line_total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(index)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Amount & Repayment Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Total Bill Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="2500.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs font-bold text-slate-800 bg-[#F5F7FA] focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Agreed Repayment Due Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={agreedRepaymentDate}
                    onChange={(e) => setAgreedRepaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs text-slate-800 bg-[#F5F7FA] focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* "Amount Customer Is Paying Now" Section */}
              <div className="bg-white p-4 rounded-xl border-2 border-[#0070E0]/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#001C64] uppercase tracking-wider">
                    Amount Customer Is Paying Now
                  </span>
                  <div className="flex items-center gap-1 bg-[#F5F7FA] p-0.5 rounded-full border border-[#E1E7EC] text-xs">
                    <button
                      type="button"
                      onClick={() => setInitialPaymentMethod("razorpay_upi")}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${
                        initialPaymentMethod === "razorpay_upi"
                          ? "bg-[#0070E0] text-white shadow-2xs"
                          : "text-[#545D68] hover:text-[#001C64]"
                      }`}
                    >
                      Razorpay UPI QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setInitialPaymentMethod("cash")}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${
                        initialPaymentMethod === "cash"
                          ? "bg-slate-800 text-white shadow-2xs"
                          : "text-[#545D68] hover:text-[#001C64]"
                      }`}
                    >
                      Cash at Counter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInitialPaymentMethod("none");
                        setInitialPaymentAmount("0");
                      }}
                      className={`px-3 py-1 rounded-full font-bold transition-all ${
                        initialPaymentMethod === "none"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "text-[#545D68] hover:text-[#001C64]"
                      }`}
                    >
                      Pay Later (100% Credit)
                    </button>
                  </div>
                </div>

                {initialPaymentMethod !== "none" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={initialPaymentAmount}
                          onChange={(e) => setInitialPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs font-black text-slate-800 bg-[#F5F7FA] focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setInitialPaymentAmount(totalAmount || "0")}
                        className="px-3 py-2 rounded-xl bg-blue-50 text-[#0070E0] text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        Full (₹{totalAmount || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const half = ((parseFloat(totalAmount) || 0) / 2).toFixed(2);
                          setInitialPaymentAmount(half);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialPaymentAmount("0")}
                        className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold hover:bg-slate-200 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-[11px] text-[#545D68]">
                      {initialPaymentMethod === "razorpay_upi"
                        ? "A dynamic 5-minute Razorpay UPI QR code will be generated immediately for the customer to scan and pay."
                        : "Counter cash collected in hand will be recorded as a verified repayment immediately."}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                    100% of this purchase (₹{totalAmount || 0}) will be added to the customer&apos;s shop credit balance, due on {agreedRepaymentDate || "agreed date"}.
                  </p>
                )}

                {/* Dynamic Calculation Summary Strip */}
                <div className="pt-2 border-t border-[#E1E7EC] flex items-center justify-between text-xs font-medium text-[#545D68]">
                  <span>Total: <strong>{formatINR(parseFloat(totalAmount) || 0)}</strong></span>
                  <span>Paying Now: <strong>- {formatINR(parseFloat(initialPaymentAmount) || 0)}</strong></span>
                  <span className="font-bold text-[#001C64]">
                    Remaining Credit Due:{" "}
                    <strong className="text-rose-600 font-mono text-sm">
                      {formatINR(Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(initialPaymentAmount) || 0)))}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Invoice Notes (Optional)
                </label>
                <input
                  type="text"
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="e.g. Customer promised settlement by end of month"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs text-slate-800 bg-[#F5F7FA] focus:ring-2 focus:ring-[#0070E0] focus:outline-hidden"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#E1E7EC] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-full bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 font-bold text-xs border border-[#E1E7EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white font-bold text-xs shadow-paypal disabled:opacity-50 flex items-center gap-1.5 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Bill...</span>
                    </>
                  ) : initialPaymentMethod === "razorpay_upi" ? (
                    <>
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Create Bill &amp; Show UPI QR</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Create Customer Bill</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL BILL MODAL */}
      {digitalBillModalBill && (
        <DigitalBillModal
          bill={digitalBillModalBill}
          onClose={() => setDigitalBillModalBill(null)}
          isBusinessOwner={true}
          onRefresh={() => {
            loadInitialData();
          }}
        />
      )}
    </div>
  );
};
