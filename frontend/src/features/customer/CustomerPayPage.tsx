import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  QrCode,
  Store,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  FileCheck2,
  Camera,
  StopCircle,
  Keyboard,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { apiClient, formatApiError } from "../../lib/api";
import { Shop, CreditTransaction } from "../../types/customer";
import { formatINR } from "../../lib/utils";

export const CustomerPayPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialShopCode = searchParams.get("shop") || "";

  // Step state: 1: Resolve Shop, 2: Enter Purchase, 3: Review & Confirm, 4: Success
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [entryMode, setEntryMode] = useState<"scan" | "manual">("scan");

  // Step 1: Shop code & resolved shop
  const [shopCodeInput, setShopCodeInput] = useState<string>(initialShopCode || "KOSHA-LAKSHMI");
  const [availableShops, setAvailableShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isResolvingShop, setIsResolvingShop] = useState<boolean>(false);
  const [shopError, setShopError] = useState<string | null>(null);

  // Camera QR Scanner State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Step 2: Purchase details
  const [description, setDescription] = useState<string>("Daily Household Supplies & Goods");
  const [purchaseAmount, setPurchaseAmount] = useState<string>("1200");
  const [amountPaidNow, setAmountPaidNow] = useState<string>("400");
  const [repaymentDate, setRepaymentDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });

  // Step 3: Review acknowledgement
  const [isAcknowledged, setIsAcknowledged] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 4: Confirmed transaction
  const [confirmedTxn, setConfirmedTxn] = useState<CreditTransaction | null>(null);

  // Load participating shops list
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const shops = await apiClient.listShops();
        setAvailableShops(shops);
        if (initialShopCode) {
          handleResolveShop(initialShopCode);
        }
      } catch (err: unknown) {
        console.error(err);
      }
    };
    fetchShops();
  }, []);

  // Cleanup camera scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => {
              try {
                scanner.clear();
              } catch {
                // ignore
              }
            })
            .catch(() => {});
        } else {
          try {
            scanner.clear();
          } catch {
            // ignore
          }
        }
      }
    };
  }, []);

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        try {
          scanner.clear();
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn("Camera cleanup warning:", err);
      } finally {
        setIsScanning(false);
      }
    } else {
      setIsScanning(false);
    }
  };

  const parseQrPayload = (payload: string): string => {
    const clean = payload.trim();
    // Handle kosha://shop/{code}
    if (clean.startsWith("kosha://shop/")) {
      return clean.replace("kosha://shop/", "").split("?")[0].trim();
    }
    // Handle kosha://pay?shop={code}
    if (clean.includes("shop=")) {
      try {
        const urlPart = clean.startsWith("http") ? clean : `https://kosha.app/${clean.replace("kosha://", "")}`;
        const parsedUrl = new URL(urlPart);
        const shopParam = parsedUrl.searchParams.get("shop");
        if (shopParam) return shopParam.trim();
      } catch {
        // Fallback simple regex
        const match = clean.match(/shop=([^&]+)/);
        if (match) return match[1].trim();
      }
    }
    return clean;
  };

  const startCameraScanner = async () => {
    setScannerError(null);
    setShopError(null);

    // Stop existing instance if any
    await stopCameraScanner();

    // Verify viewport container is present in the DOM
    const viewport = document.getElementById("qr-camera-viewport");
    if (!viewport) {
      setScannerError("Camera container is initializing. Please try again.");
      return;
    }

    try {
      const html5Qr = new Html5Qrcode("qr-camera-viewport");
      scannerRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        async (decodedText: string) => {
          // Detected QR
          const extractedCode = parseQrPayload(decodedText);
          await stopCameraScanner();
          handleResolveShop(extractedCode);
        },
        () => {
          // Frame scan error - ignore frame by frame noise
        }
      );
      // Only mark scanning once stream has actually started
      setIsScanning(true);
    } catch (err: unknown) {
      setIsScanning(false);
      scannerRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowederror")) {
        setScannerError("Camera permission was denied. Please allow camera permissions in your browser or enter the shop code manually.");
      } else if (msg.toLowerCase().includes("notfounderror") || msg.toLowerCase().includes("device")) {
        setScannerError("No functional camera device found. Please enter the shop code manually below.");
      } else {
        setScannerError(`Unable to start camera scanner: ${msg}. You can enter the shop code manually.`);
      }
    }
  };

  const handleResolveShop = async (code: string) => {
    const clean = parseQrPayload(code);
    if (!clean) {
      setShopError("Please enter or scan a valid shop code.");
      return;
    }

    setIsResolvingShop(true);
    setShopError(null);
    try {
      const shop = await apiClient.getShopByCode(clean);
      if (shop.status === "inactive") {
        setShopError(`Shop "${shop.shop_name}" is currently inactive and cannot accept credit purchases.`);
        setSelectedShop(null);
        return;
      }
      setSelectedShop(shop);
      setShopCodeInput(shop.shop_code);
      await stopCameraScanner();
      setCurrentStep(2); // Auto advance to purchase entry
    } catch (err: unknown) {
      setSelectedShop(null);
      setShopError(formatApiError(err));
    } finally {
      setIsResolvingShop(false);
    }
  };

  // Calculations for Step 2
  const parsedPurchase = parseFloat(purchaseAmount) || 0;
  const parsedPaid = parseFloat(amountPaidNow) || 0;
  const remainingDue = Math.max(0, parsedPurchase - parsedPaid);

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (parsedPurchase <= 0) {
      setSubmitError("Purchase amount must be greater than ₹0.");
      return;
    }

    if (parsedPaid < 0) {
      setSubmitError("Amount paid now cannot be negative.");
      return;
    }

    if (parsedPaid > parsedPurchase) {
      setSubmitError(`Amount paid now (${formatINR(parsedPaid)}) cannot exceed total purchase (${formatINR(parsedPurchase)}).`);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (remainingDue > 0 && repaymentDate < todayStr) {
      setSubmitError("Repayment date cannot be in the past.");
      return;
    }

    setCurrentStep(3);
  };

  const handleConfirmTransaction = async () => {
    if (!selectedShop) return;
    if (remainingDue > 0 && !isAcknowledged) {
      setSubmitError("Please confirm your acknowledgement of the repayment commitment.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await apiClient.createCreditTransaction({
        shop_code: selectedShop.shop_code,
        description: description.trim(),
        purchase_amount: parsedPurchase,
        amount_paid_now: parsedPaid,
        agreed_repayment_date: repaymentDate,
      });

      setConfirmedTxn(created);
      setCurrentStep(4);
    } catch (err: unknown) {
      setSubmitError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetQuickDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setRepaymentDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Stepper Header */}
      <div className="bg-white rounded-2xl p-5 border border-[#E1E7EC] shadow-paypal flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0070E0]/10 text-[#0070E0] flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#001C64]">Shop Credit &amp; Purchase</h1>
            <p className="text-xs text-[#545D68] font-medium">Record in-store credit and agreed due date</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className={`px-3 py-1 rounded-full ${currentStep >= 1 ? "bg-[#0070E0] text-white font-bold" : "bg-[#F5F7FA] text-slate-400"}`}>
            1. Shop
          </span>
          <span className={`px-3 py-1 rounded-full ${currentStep >= 2 ? "bg-[#0070E0] text-white font-bold" : "bg-[#F5F7FA] text-slate-400"}`}>
            2. Details
          </span>
          <span className={`px-3 py-1 rounded-full ${currentStep >= 3 ? "bg-[#0070E0] text-white font-bold" : "bg-[#F5F7FA] text-slate-400"}`}>
            3. Confirm
          </span>
        </div>
      </div>

      {/* STEP 1: Identify Shop */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E1E7EC] shadow-paypal space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#001C64]">Step 1: Identify Participating Shop</h2>
              <p className="text-xs text-[#545D68] mt-1">
                Scan the merchant's in-store QR code or enter their shop code below.
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex p-0.5 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setEntryMode("scan");
                  setScannerError(null);
                }}
                className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                  entryMode === "scan" ? "bg-white text-[#001C64] shadow-xs font-black" : "text-[#545D68]"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera Scanner</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await stopCameraScanner();
                  setEntryMode("manual");
                }}
                className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                  entryMode === "manual" ? "bg-white text-[#001C64] shadow-xs font-black" : "text-[#545D68]"
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Shop Code</span>
              </button>
            </div>
          </div>

          {/* Mode A: Real Camera QR Scanner */}
          {entryMode === "scan" && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F5F7FA] border border-[#E1E7EC] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#001C64] flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#0070E0]" />
                    <span>In-Store QR Scanner</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0070E0] bg-[#0070E0]/10 px-2.5 py-0.5 rounded-full">
                    Camera Local
                  </span>
                </div>
                <p className="text-[11px] text-[#545D68] leading-relaxed">
                  KOSHA uses your device camera locally to read the merchant's QR code. No image is transmitted or stored externally.
                </p>

                {/* Viewport for html5-qrcode */}
                <div className="mt-3 flex flex-col items-center">
                  <div className="relative w-full max-w-sm h-[280px] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-[#E1E7EC]">
                    {/* Dedicated DOM container strictly for html5-qrcode - React NEVER manages children here */}
                    <div id="qr-camera-viewport" className="w-full h-full" />

                    {/* React-managed Idle Overlay - purely absolute sibling, never a child of #qr-camera-viewport */}
                    {!isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-2 text-slate-300 bg-slate-900/95 pointer-events-none z-10">
                        <Camera className="w-10 h-10 mx-auto text-[#0070E0]" />
                        <p className="text-xs font-semibold">Camera is idle.</p>
                        <p className="text-[11px] text-slate-400 text-center">Click below to activate camera and scan merchant QR code.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3 w-full max-w-sm">
                    {!isScanning ? (
                      <button
                        type="button"
                        onClick={startCameraScanner}
                        className="w-full py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-paypal transition-all flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Camera Scanner</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCameraScanner}
                        className="w-full py-2.5 rounded-full bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <StopCircle className="w-4 h-4 text-rose-400" />
                        <span>Stop Camera</span>
                      </button>
                    )}
                  </div>
                </div>

                {scannerError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{scannerError}</span>
                  </div>
                )}
              </div>

              {/* Verified Store Shortcuts */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider block">
                  Or One-Click Test with Participating Merchants:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {availableShops.map((shop) => (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={async () => {
                        await stopCameraScanner();
                        handleResolveShop(shop.shop_code);
                      }}
                      className="p-3 bg-white hover:bg-[#F5F7FA] rounded-2xl border border-[#E1E7EC] hover:border-[#0070E0] text-left transition-all group shadow-paypal"
                    >
                      <span className="font-bold text-xs text-slate-900 block group-hover:text-[#0070E0]">
                        {shop.shop_name}
                      </span>
                      <span className="text-[10px] font-mono text-[#0070E0] font-bold block mt-0.5">
                        {shop.shop_code}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mode B: Manual Code Fallback */}
          {entryMode === "manual" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Enter Merchant Shop Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={shopCodeInput}
                      onChange={(e) => {
                        setShopCodeInput(e.target.value.toUpperCase());
                        setShopError(null);
                      }}
                      placeholder="e.g. KOSHA-APEX / KOSHA-LAKSHMI"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E1E7EC] font-mono text-sm uppercase font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolveShop(shopCodeInput)}
                    disabled={isResolvingShop}
                    className="px-6 py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-paypal transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isResolvingShop ? "Verifying..." : "Verify Shop"}
                  </button>
                </div>
                <p className="text-[11px] text-[#545D68]">
                  Enter the unique code displayed on the shopkeeper's counter QR stand.
                </p>
              </div>

              {/* Verified Merchant Chips */}
              <div className="pt-2 border-t border-[#E1E7EC] space-y-2">
                <span className="text-[11px] font-bold text-[#545D68] uppercase tracking-wider block">
                  Quick Select Merchant:
                </span>
                <div className="flex flex-wrap gap-2">
                  {availableShops.map((shop) => (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => handleResolveShop(shop.shop_code)}
                      className="px-3.5 py-1.5 rounded-full bg-[#F5F7FA] hover:bg-[#E1E7EC] border border-[#E1E7EC] text-xs font-bold text-slate-700 transition-colors"
                    >
                      {shop.shop_name} ({shop.shop_code})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {shopError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{shopError}</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Enter Purchase Details */}
      {currentStep === 2 && selectedShop && (
        <form onSubmit={handleProceedToReview} className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E1E7EC] shadow-paypal space-y-6">
          {/* Resolved Shop Header */}
          <div className="p-4 bg-[#F5F7FA] border border-[#E1E7EC] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0070E0] text-white flex items-center justify-center font-bold">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[#001C64]">{selectedShop.shop_name}</h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified Store</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#545D68] font-medium">
                  Code: <strong className="font-mono text-[#0070E0]">{selectedShop.shop_code}</strong> · {selectedShop.category}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs font-bold text-[#0070E0] hover:underline"
            >
              Change
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Purchase Description / Item Details *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Monthly Grocery & Supplies"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E7EC] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Purchase Value (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#E1E7EC] font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Paid Immediately (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={purchaseAmount}
                    value={amountPaidNow}
                    onChange={(e) => setAmountPaidNow(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#E1E7EC] font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                  />
                </div>
                <span className="text-[10px] text-[#545D68] block mt-0.5">Paid at checkout counter</span>
              </div>
            </div>

            {/* Calculated Remaining Balance Card */}
            <div className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E1E7EC] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#545D68] uppercase tracking-wider block">
                  Remaining Credit Balance
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-[#001C64]">
                  {formatINR(remainingDue)}
                </span>
              </div>

              {remainingDue === 0 ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Fully Cleared Now
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  To Repay Later
                </span>
              )}
            </div>

            {/* Repayment Date Field (Only if remaining balance > 0) */}
            {remainingDue > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Agreed Repayment Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={repaymentDate}
                    onChange={(e) => setRepaymentDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E1E7EC] font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0070E0]"
                    required
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#545D68]">Quick:</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(7)}
                    className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 border border-[#E1E7EC]"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(14)}
                    className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 border border-[#E1E7EC]"
                  >
                    +14 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(30)}
                    className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 border border-[#E1E7EC]"
                  >
                    +30 Days
                  </button>
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#E1E7EC]">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-full border border-[#E1E7EC] text-slate-600 text-xs font-bold hover:bg-[#F5F7FA]"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-paypal transition-all flex items-center gap-1.5"
            >
              <span>Review Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Review & Confirm */}
      {currentStep === 3 && selectedShop && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E1E7EC] shadow-paypal space-y-6">
          <div>
            <h2 className="text-lg font-black text-[#001C64]">Step 3: Review &amp; Confirm Commitment</h2>
            <p className="text-xs text-[#545D68] mt-1">
              Verify purchase terms before recording in the shared merchant ledger.
            </p>
          </div>

          {/* Itemized Summary Card */}
          <div className="bg-[#F5F7FA] rounded-2xl p-5 border border-[#E1E7EC] space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2.5 border-b border-[#E1E7EC]">
              <span className="text-[#545D68] font-medium">Merchant Shop</span>
              <span className="font-bold text-slate-900">{selectedShop.shop_name} ({selectedShop.shop_code})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#545D68] font-medium">Description</span>
              <span className="font-bold text-slate-900">{description}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#545D68] font-medium">Total Purchase Amount</span>
              <span className="font-mono font-bold text-[#001C64]">{formatINR(parsedPurchase)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#545D68] font-medium">Paid at Checkout</span>
              <span className="font-mono font-bold text-emerald-700">{formatINR(parsedPaid)}</span>
            </div>
            <div className="flex justify-between items-center pt-2.5 border-t border-[#E1E7EC]">
              <span className="font-bold text-[#001C64]">Remaining Due to Shop</span>
              <span className="font-mono text-base font-black text-[#001C64]">{formatINR(remainingDue)}</span>
            </div>
            {remainingDue > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[#545D68] font-medium">Agreed Repayment Date</span>
                <span className="font-bold text-amber-800">
                  {new Date(repaymentDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Legal Acknowledgement Statement */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Authoritative Credit Commitment Notice</p>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  You are recording this purchase and its agreed outstanding balance. This confirmation records your credit commitment in the shared store ledger. It does not itself transfer external money.
                </p>
              </div>
            </div>

            {remainingDue > 0 && (
              <label className="flex items-center gap-2.5 pt-2 border-t border-amber-200/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAcknowledged}
                  onChange={(e) => setIsAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0070E0] focus:ring-[#0070E0] border-[#E1E7EC]"
                />
                <span className="font-semibold text-xs text-slate-800">
                  I agree to repay the remaining balance of {formatINR(remainingDue)} by the selected date.
                </span>
              </label>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#E1E7EC]">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-full border border-[#E1E7EC] text-slate-600 text-xs font-bold hover:bg-[#F5F7FA]"
            >
              Back to Details
            </button>
            <button
              type="button"
              onClick={handleConfirmTransaction}
              disabled={isSubmitting}
              className="px-7 py-2.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] text-xs font-black shadow-paypal transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recording...</span>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4 text-[#001C64]" />
                  <span>Confirm &amp; Save Purchase</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success Receipt */}
      {currentStep === 4 && confirmedTxn && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E1E7EC] shadow-paypal text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-[#001C64]">Transaction Recorded!</h2>
            <p className="text-xs text-[#545D68] font-medium mt-1">
              Your purchase and repayment commitment are synchronized with the merchant ledger.
            </p>
          </div>

          {/* Receipt View */}
          <div className="bg-[#F5F7FA] rounded-2xl p-5 border border-[#E1E7EC] text-left space-y-2.5 text-xs max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-[#545D68]">Reference:</span>
              <span className="font-mono font-bold text-[#0070E0]">{confirmedTxn.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#545D68]">Store:</span>
              <span className="font-bold text-slate-800">{confirmedTxn.shop_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#545D68]">Total Purchase:</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(confirmedTxn.purchase_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#545D68]">Paid Now:</span>
              <span className="font-mono font-bold text-emerald-700">{formatINR(confirmedTxn.initial_paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E1E7EC] pt-2 font-bold">
              <span className="text-[#001C64]">Remaining Balance Due:</span>
              <span className="font-mono text-sm text-[#001C64]">{formatINR(confirmedTxn.outstanding_amount)}</span>
            </div>
            {confirmedTxn.outstanding_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#545D68]">Agreed Repayment Date:</span>
                <span className="font-bold text-amber-700">
                  {new Date(confirmedTxn.agreed_repayment_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
            <button
              onClick={() => navigate("/customer/dues")}
              className="py-3 px-6 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-paypal transition-all flex items-center justify-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>View in My Dues</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(1);
                setConfirmedTxn(null);
                setIsAcknowledged(false);
              }}
              className="py-3 px-6 rounded-full bg-[#F5F7FA] hover:bg-[#E1E7EC] text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-[#E1E7EC]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Record Another Purchase</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
