import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, ShieldCheck, CreditCard, Banknote, Smartphone } from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { CreditTransaction } from "../../types/customer";
import { formatINR } from "../../lib/utils";

interface RepayModalProps {
  transaction: CreditTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedTxn: CreditTransaction) => void;
}

export const RepayModal: React.FC<RepayModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("demo_upi");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.outstanding_amount.toString());
      setError(null);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const outstanding = transaction.outstanding_amount;

  const handlePreset = (fraction: number) => {
    const val = (outstanding * fraction).toFixed(2);
    setAmount(val);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid repayment amount greater than ₹0.");
      return;
    }

    if (parsedAmount > outstanding) {
      setError(`Repayment amount cannot exceed the outstanding balance of ${formatINR(outstanding)}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await apiClient.recordCustomerRepayment(transaction.id, {
        amount: parsedAmount,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div>
            <h2 className="font-extrabold text-lg text-kosha-navy">Record Repayment</h2>
            <p className="text-xs text-slate-500 font-medium">Clear or reduce your shop credit</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Summary Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 my-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-kosha-blue uppercase tracking-wider block">
                {transaction.shop_name}
              </span>
              <p className="font-bold text-sm text-slate-900 mt-0.5">{transaction.description}</p>
              <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                Ref: {transaction.reference}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 block">Remaining Due</span>
              <span className="text-lg font-black text-rose-600 font-mono">
                {formatINR(outstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* Repayment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Repayment Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                max={outstanding}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-kosha-blue"
                placeholder="Enter amount"
                required
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handlePreset(1)}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                Pay Full ({formatINR(outstanding)})
              </button>
              {outstanding >= 200 && (
                <button
                  type="button"
                  onClick={() => handlePreset(0.5)}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Pay Half ({formatINR(outstanding / 2)})
                </button>
              )}
            </div>
          </div>

          {/* Payment Method Option */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Payment Method (Simulation)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("demo_upi")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  paymentMethod === "demo_upi"
                    ? "bg-blue-50 border-kosha-blue text-kosha-blue font-bold shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[11px]">UPI App</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("demo_cash")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  paymentMethod === "demo_cash"
                    ? "bg-blue-50 border-kosha-blue text-kosha-blue font-bold shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span className="text-[11px]">Cash to Shop</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("demo_netbanking")}
                className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                  paymentMethod === "demo_netbanking"
                    ? "bg-blue-50 border-kosha-blue text-kosha-blue font-bold shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[11px]">Net Banking</span>
              </button>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared via Google Pay / Handed cash"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-kosha-blue"
            />
          </div>

          {/* Explicit Demo Disclaimer */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <span className="font-bold">Sandbox Demonstration:</span> Recording a repayment updates KOSHA's audit ledger and reduces your recorded balance. No real bank accounts or UPI credentials are accessed.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Recording Repayment...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Demo Repayment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
