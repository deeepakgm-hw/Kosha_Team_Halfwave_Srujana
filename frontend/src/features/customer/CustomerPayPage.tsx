import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { Shop, CreditTransaction } from "../../types/customer";
import { formatINR } from "../../lib/utils";

export const CustomerPayPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialShopCode = searchParams.get("shop") || "KOSHA-LAKSHMI";

  // Step state: 1: Resolve Shop, 2: Enter Purchase, 3: Review & Confirm, 4: Success
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Shop code & resolved shop
  const [shopCodeInput, setShopCodeInput] = useState<string>(initialShopCode);
  const [availableShops, setAvailableShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isResolvingShop, setIsResolvingShop] = useState<boolean>(false);
  const [shopError, setShopError] = useState<string | null>(null);

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

  const handleResolveShop = async (code: string) => {
    if (!code.trim()) {
      setShopError("Please enter a valid shop code.");
      return;
    }

    setIsResolvingShop(true);
    setShopError(null);
    try {
      const shop = await apiClient.getShopByCode(code.trim());
      setSelectedShop(shop);
      setShopCodeInput(shop.shop_code);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
          <div>
            <h2 className="text-lg font-black text-kosha-navy">Step 1: Identify Participating Shop</h2>
            <p className="text-xs text-slate-500 mt-1">
              Scan the merchant's in-store QR code or enter their shop code below.
            </p>
          </div>

          {/* Quick Demo Scan Simulation */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Simulated In-Store QR Scanner</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                Camera / Demo
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              In a retail store, scanning KOSHA QR captures the merchant's secure code. Click any registered shop below to simulate a live QR scan:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {availableShops.map((shop) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => handleResolveShop(shop.shop_code)}
                  className="p-3 bg-white hover:bg-emerald-100/50 rounded-xl border border-emerald-200 text-left transition-all group"
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

          {/* Manual Code Fallback */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Or Enter Shop Code Manually
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
                  placeholder="e.g. KOSHA-LAKSHMI"
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
          </div>

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
                    <span>Verified Merchant</span>
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
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Purchase Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount Paid Now at Counter (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountPaidNow}
                    onChange={(e) => setAmountPaidNow(e.target.value)}
                    required
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Live Remaining Balance Calculation Card */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">Calculated Remaining Due</span>
                <span className="text-xs text-slate-400">
                  {formatINR(parsedPurchase)} - {formatINR(parsedPaid)}
                </span>
              </div>
              <span
                className={`text-xl font-black font-mono ${
                  remainingDue > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {formatINR(remainingDue)}
              </span>
            </div>

            {/* Agreed Repayment Date */}
            {remainingDue > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Agreed Repayment Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={repaymentDate}
                    onChange={(e) => setRepaymentDate(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Date committed to the shopkeeper to clear the remaining balance.
                </span>
              </div>
            )}
          </div>

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <span>Review Summary</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Review & Confirm */}
      {currentStep === 3 && selectedShop && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-lg space-y-6">
          <div>
            <h2 className="text-lg font-black text-kosha-navy">Step 3: Review Credit Commitment</h2>
            <p className="text-xs text-slate-500 mt-1">
              Please verify all transaction amounts and repayment dates before confirming.
            </p>
          </div>

          {/* Breakdown Ledger Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Merchant:</span>
              <span className="font-bold text-slate-900">{selectedShop.shop_name} ({selectedShop.shop_code})</span>
            </div>
            <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Description:</span>
              <span className="font-bold text-slate-900">{description}</span>
            </div>
            <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Total Purchase Amount:</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(parsedPurchase)}</span>
            </div>
            <div className="flex justify-between text-xs pb-2 border-b border-slate-200 text-emerald-700">
              <span className="font-medium">Paid Now at Checkout:</span>
              <span className="font-mono font-bold">-{formatINR(parsedPaid)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 font-bold text-slate-900">
              <span>Remaining Outstanding Balance:</span>
              <span className="font-mono font-black text-rose-600 text-base">
                {formatINR(remainingDue)}
              </span>
            </div>
            {remainingDue > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold">Agreed Repayment Deadline:</span>
                <span className="font-bold">{repaymentDate}</span>
              </div>
            )}
          </div>

          {/* Explicit Credit Disclaimer & Acknowledgement */}
          {remainingDue > 0 && (
            <div className="space-y-3">
              <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
                <ShieldCheck className="w-5 h-5 text-kosha-blue shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-bold">Credit Recording Notice:</span> Recording this transaction registers your mutual agreement with {selectedShop.shop_name} to pay ₹{remainingDue.toFixed(2)} on or before {repaymentDate}. This creates a reminder obligation in KOSHA and is not a bank payment transfer.
                </p>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAcknowledged}
                  onChange={(e) => setIsAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs text-slate-700 font-medium leading-snug">
                  I agree to the repayment terms and confirm recording this shop credit purchase.
                </span>
              </label>
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmTransaction}
              disabled={isSubmitting || (remainingDue > 0 && !isAcknowledged)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Recording in Ledger...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Transaction</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success Screen */}
      {currentStep === 4 && confirmedTxn && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-lg text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
            <FileCheck2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-kosha-navy">Purchase Recorded Successfully</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Your transaction has been committed to the KOSHA audit ledger.
            </p>
          </div>

          {/* Receipt Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-md mx-auto space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Transaction Reference:</span>
              <span className="font-mono font-bold text-slate-900">{confirmedTxn.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Merchant Shop:</span>
              <span className="font-bold text-slate-900">{confirmedTxn.shop_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Purchase:</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(confirmedTxn.purchase_amount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Amount Paid:</span>
              <span className="font-mono font-bold">{formatINR(confirmedTxn.initial_paid_amount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
              <span>Remaining Balance:</span>
              <span className="font-mono text-rose-600 text-sm">
                {formatINR(confirmedTxn.outstanding_amount)}
              </span>
            </div>
            {confirmedTxn.outstanding_amount > 0 && (
              <div className="flex justify-between text-amber-800">
                <span>Agreed Due Date:</span>
                <span className="font-bold">{confirmedTxn.agreed_repayment_date}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
            <button
              onClick={() => navigate("/customer/dues")}
              className="flex-1 py-3 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shadow-md transition-all"
            >
              View in My Dues
            </button>
            <button
              onClick={() => {
                setCurrentStep(1);
                setDescription("Daily Household Supplies & Goods");
                setPurchaseAmount("1000");
                setAmountPaidNow("0");
                setConfirmedTxn(null);
              }}
              className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs transition-all"
            >
              Record Another Purchase
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
