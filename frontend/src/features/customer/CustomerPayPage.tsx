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
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/90 shadow-glass-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-kosha-navy">Shop Credit & Purchase</h1>
            <p className="text-xs text-slate-500 font-medium">Record in-store credit and agreed due date</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className={`px-2.5 py-1 rounded-lg ${currentStep >= 1 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
            1. Shop
          </span>
          <span className={`px-2.5 py-1 rounded-lg ${currentStep >= 2 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
            2. Details
          </span>
          <span className={`px-2.5 py-1 rounded-lg ${currentStep >= 3 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
            3. Confirm
          </span>
        </div>
      </div>

      {/* STEP 1: Identify Shop */}
      {currentStep === 1 && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-kosha-navy">Step 1: Identify Participating Shop</h2>
              <p className="text-xs text-slate-500 mt-1">
                Scan the merchant's in-store QR code or enter their shop code below.
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setEntryMode("scan");
                  setScannerError(null);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  entryMode === "scan" ? "bg-white text-kosha-navy shadow-xs font-black" : "text-slate-600"
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
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  entryMode === "manual" ? "bg-white text-kosha-navy shadow-xs font-black" : "text-slate-600"
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
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    <span>In-Store QR Scanner</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    Camera Local
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  KOSHA uses your device camera locally to read the merchant's QR code. No image is transmitted or stored externally.
                </p>

                {/* Viewport for html5-qrcode */}
                <div className="mt-3 flex flex-col items-center">
                  <div className="relative w-full max-w-sm h-[280px] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-emerald-500/30">
                    {/* Dedicated DOM container strictly for html5-qrcode - React NEVER manages children here */}
                    <div id="qr-camera-viewport" className="w-full h-full" />

                    {/* React-managed Idle Overlay - purely absolute sibling, never a child of #qr-camera-viewport */}
                    {!isScanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-2 text-slate-300 bg-slate-900/95 pointer-events-none z-10">
                        <Camera className="w-10 h-10 mx-auto text-emerald-400" />
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
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Camera Scanner</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCameraScanner}
                        className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
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
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
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
                      className="p-3 bg-white hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-300 text-left transition-all group shadow-xs"
                    >
                      <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-900">
                        {shop.shop_name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold block mt-0.5">
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm uppercase font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolveShop(shopCodeInput)}
                    disabled={isResolvingShop}
                    className="px-5 py-2.5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isResolvingShop ? "Verifying..." : "Verify Shop"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter the unique code displayed on the shopkeeper's counter QR stand.
                </p>
              </div>

              {/* Verified Merchant Chips */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Select Merchant:
                </span>
                <div className="flex flex-wrap gap-2">
                  {availableShops.map((shop) => (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => handleResolveShop(shop.shop_code)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100/60 border border-slate-200 text-xs font-bold text-slate-700 transition-colors"
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
        <form onSubmit={handleProceedToReview} className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-lg space-y-6">
          {/* Resolved Shop Header */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">{selectedShop.shop_name}</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified Store</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Code: <strong className="font-mono text-emerald-700">{selectedShop.shop_code}</strong> · {selectedShop.category}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Paid at checkout counter</span>
              </div>
            </div>

            {/* Calculated Remaining Balance Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Remaining Credit Balance
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-kosha-navy">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400">Quick:</span>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(7)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(14)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    +14 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickDays(30)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
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

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <span>Review Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Review & Confirm */}
      {currentStep === 3 && selectedShop && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-lg space-y-6">
          <div>
            <h2 className="text-lg font-black text-kosha-navy">Step 3: Review & Confirm Commitment</h2>
            <p className="text-xs text-slate-500 mt-1">
              Verify purchase terms before recording in the shared merchant ledger.
            </p>
          </div>

          {/* Itemized Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Merchant Shop</span>
              <span className="font-bold text-slate-900">{selectedShop.shop_name} ({selectedShop.shop_code})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Description</span>
              <span className="font-bold text-slate-900">{description}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Total Purchase Amount</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(parsedPurchase)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Paid at Checkout</span>
              <span className="font-mono font-bold text-emerald-700">{formatINR(parsedPaid)}</span>
            </div>
            <div className="flex justify-between items-center pt-2.5 border-t border-slate-200">
              <span className="font-bold text-slate-900">Remaining Due to Shop</span>
              <span className="font-mono text-base font-black text-kosha-navy">{formatINR(remainingDue)}</span>
            </div>
            {remainingDue > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Agreed Repayment Date</span>
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
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
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

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              Back to Details
            </button>
            <button
              type="button"
              onClick={handleConfirmTransaction}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recording...</span>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>Confirm & Save Purchase</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success Receipt */}
      {currentStep === 4 && confirmedTxn && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-lg text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-kosha-navy">Transaction Recorded!</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Your purchase and repayment commitment are synchronized with the merchant ledger.
            </p>
          </div>

          {/* Receipt View */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-2.5 text-xs max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-400">Reference:</span>
              <span className="font-mono font-bold text-kosha-blue">{confirmedTxn.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Store:</span>
              <span className="font-bold text-slate-800">{confirmedTxn.shop_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Purchase:</span>
              <span className="font-mono font-bold text-slate-800">{formatINR(confirmedTxn.purchase_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Paid Now:</span>
              <span className="font-mono font-bold text-emerald-700">{formatINR(confirmedTxn.initial_paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
              <span className="text-slate-700">Remaining Balance Due:</span>
              <span className="font-mono text-sm text-kosha-navy">{formatINR(confirmedTxn.outstanding_amount)}</span>
            </div>
            {confirmedTxn.outstanding_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Agreed Repayment Date:</span>
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
              className="py-3 px-5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
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
              className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
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
