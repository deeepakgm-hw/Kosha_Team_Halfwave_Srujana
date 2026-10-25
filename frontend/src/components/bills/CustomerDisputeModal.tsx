import React, { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { formatINR } from "../../lib/utils";

interface CustomerDisputeModalProps {
  billId: string;
  billReference: string;
  shopName: string;
  outstandingAmount: number;
  customerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DISPUTE_TYPES = [
  { id: "incorrect_amount", label: "Incorrect Bill Amount / Missing Discount", desc: "The recorded bill total does not match your counter purchase or invoice." },
  { id: "payment_missing", label: "Payment Missing from Ledger", desc: "You already paid via cash or UPI, but the bill is still showing as unpaid." },
  { id: "failed_payment_charged", label: "Charged but Payment Marked Failed", desc: "Funds were debited from your bank account, but KOSHA shows payment failed." },
  { id: "incorrect_deadline", label: "Incorrect Repayment Deadline", desc: "The agreed repayment date differs from what was promised at checkout." },
  { id: "unauthorized_collection", label: "Disputed AutoPay Collection", desc: "An unexpected or premature automatic debit was scheduled or attempted." },
  { id: "other", label: "Other Inaccuracy or Ledger Discrepancy", desc: "Any other record inaccuracy needing merchant review." },
];

export const CustomerDisputeModal: React.FC<CustomerDisputeModalProps> = ({
  billId,
  billReference,
  shopName,
  outstandingAmount,
  customerId,
  onClose,
  onSuccess,
}) => {
  const [disputeType, setDisputeType] = useState<string>("incorrect_amount");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 5) {
      setError("Please provide a detailed explanation (minimum 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.raiseDispute(
        {
          bill_id: billId,
          dispute_type: disputeType,
          description: description.trim(),
        },
        customerId
      );

      setSuccessMessage(res.message || "Dispute registered. Automatic collections have been paused.");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Flag Bill Discrepancy</h3>
              <p className="text-xs text-slate-500">Bill {billReference} · {shopName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successMessage ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Dispute Registered</h4>
            <p className="text-sm text-slate-600">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Bill Summary */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Current Outstanding</span>
                <span className="text-base font-black text-slate-900">{formatINR(outstandingAmount)}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Protection</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5" /> AutoPay Freezes
                </span>
              </div>
            </div>

            {/* Invariant Alert */}
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-slate-600 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#0070E0] shrink-0 mt-0.5" />
              <span>
                Raising a dispute prevents negative TrustScore penalties and pauses any automatic collection attempt until your merchant reviews and corrects the record.
              </span>
            </div>

            {/* Dispute Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Discrepancy
              </label>
              <select
                value={disputeType}
                onChange={(e) => setDisputeType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0070E0]/30 focus:border-[#0070E0]"
              >
                {DISPUTE_TYPES.map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {DISPUTE_TYPES.find((dt) => dt.id === disputeType)?.desc}
              </p>
            </div>

            {/* Description Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Explanation & Evidence Details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what occurred (e.g. Paid ₹500 in cash at counter on 24th Oct, or invoice applied 10% wholesale discount)..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0070E0]/30 focus:border-[#0070E0]"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
