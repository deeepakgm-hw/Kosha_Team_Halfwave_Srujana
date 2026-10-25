import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  User,
  X,
  Check,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { CustomerDispute } from "../../types/customer";
import { formatINR } from "../../lib/utils";

interface ShopDisputesSectionProps {
  shopCode: string;
  onDisputeResolved?: () => void;
}

export const ShopDisputesSection: React.FC<ShopDisputesSectionProps> = ({
  shopCode,
  onDisputeResolved,
}) => {
  const [disputes, setDisputes] = useState<CustomerDispute[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution Modal State
  const [selectedDisputeForResolve, setSelectedDisputeForResolve] = useState<CustomerDispute | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>("balance_adjusted");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [adjustedAmount, setAdjustedAmount] = useState<string>("");
  const [extendedDate, setExtendedDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resolveFeedback, setResolveFeedback] = useState<string | null>(null);

  const fetchDisputes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.listShopDisputes(shopCode, statusFilter === "all" ? undefined : statusFilter);
      setDisputes(res);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [shopCode, statusFilter]);

  const openResolveModal = (dispute: CustomerDispute) => {
    setSelectedDisputeForResolve(dispute);
    setResolutionAction("balance_adjusted");
    setResolutionNotes("");
    setAdjustedAmount(dispute.outstanding_amount?.toString() || "");
    setExtendedDate("");
    setResolveFeedback(null);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeForResolve) return;
    if (!resolutionNotes.trim()) {
      alert("Please provide resolution notes explaining the decision.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.resolveDispute(
        selectedDisputeForResolve.id,
        {
          resolution_action: resolutionAction,
          resolution_notes: resolutionNotes.trim(),
          adjusted_amount: adjustedAmount ? parseFloat(adjustedAmount) : undefined,
          extended_date: extendedDate || undefined,
        },
        shopCode
      );

      setResolveFeedback("Dispute resolved successfully. Ledger and TrustScore updated.");
      setTimeout(() => {
        setSelectedDisputeForResolve(null);
        fetchDisputes();
        if (onDisputeResolved) onDisputeResolved();
      }, 1200);
    } catch (err: unknown) {
      alert(`Error resolving dispute: ${formatApiError(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-paypal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Dispute Queue</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {disputes.filter((d) => d.status === "opened").length} Action Required
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
            Customer Disputes &amp; Ledger Inaccuracies
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Review customer-flagged discrepancies, adjust invoice balances, or credit counter payments with an auditable trail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full border border-slate-200 text-xs">
            {["all", "opened", "resolved", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full font-bold capitalize transition-all ${
                  statusFilter === st
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={fetchDisputes}
            disabled={isLoading}
            className="p-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs"
            title="Refresh disputes"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-dashed border-slate-200 text-center space-y-2 shadow-paypal">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Zero open disputes</h3>
          <p className="text-xs text-slate-500">
            {statusFilter === "all"
              ? "All customer records and obligations for this store are reconciled."
              : `No disputes found matching filter '${statusFilter}'.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => {
            const isOpened = d.status === "opened";
            const isResolved = d.status === "resolved";

            return (
              <div
                key={d.id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-paypal space-y-3 ${
                  isOpened ? "border-amber-200 bg-amber-50/20" : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {d.bill_reference}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          isOpened
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : isResolved
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {d.status === "opened" ? "Action Required" : d.status}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Type: <strong className="text-slate-900 capitalize">{d.dispute_type.replace(/_/g, " ")}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 pt-0.5">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {d.customer_name || "Customer"}
                      </span>
                      {d.customer_phone && (
                        <span className="text-slate-400 font-mono">({d.customer_phone})</span>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">
                        Opened on {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Outstanding Balance</span>
                      <span className="text-base font-black text-rose-600 font-mono">
                        {formatINR(d.outstanding_amount ?? 0)}
                      </span>
                    </div>

                    {isOpened && (
                      <button
                        onClick={() => openResolveModal(d)}
                        className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resolve Dispute</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Explanation */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer's Stated Reason</span>
                  <p className="font-medium italic">"{d.description}"</p>
                </div>

                {/* Resolution Audit Trail if Resolved */}
                {d.resolution_notes && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                      Resolution Record ({d.resolution_action?.replace(/_/g, " ")})
                    </span>
                    <p className="font-medium">{d.resolution_notes}</p>
                    {d.resolved_at && (
                      <span className="text-[10px] text-emerald-600 block mt-1">
                        Resolved on {new Date(d.resolved_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Dialog Modal */}
      {selectedDisputeForResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Resolve Customer Dispute</h3>
                <p className="text-xs text-slate-400">Bill {selectedDisputeForResolve.bill_reference} · {selectedDisputeForResolve.customer_name}</p>
              </div>
              <button
                onClick={() => setSelectedDisputeForResolve(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resolveFeedback ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">{resolveFeedback}</h4>
              </div>
            ) : (
              <form onSubmit={handleResolveSubmit} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Action to Apply
                  </label>
                  <select
                    value={resolutionAction}
                    onChange={(e) => setResolutionAction(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-xs"
                  >
                    <option value="balance_adjusted">Adjust Bill Balance (Discount / Price Correction)</option>
                    <option value="payment_credited">Credit Missing Payment (Mark Full/Partial Settlement)</option>
                    <option value="deadline_extended">Extend Repayment Deadline (Grant Grace Period)</option>
                    <option value="dispute_dismissed">Dismiss Dispute (Uphold Original Bill)</option>
                  </select>
                </div>

                {resolutionAction === "balance_adjusted" && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      New Outstanding Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={adjustedAmount}
                      onChange={(e) => setAdjustedAmount(e.target.value)}
                      placeholder="e.g. 2500.00"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-sm"
                      required
                    />
                  </div>
                )}

                {resolutionAction === "deadline_extended" && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      New Agreed Repayment Date
                    </label>
                    <input
                      type="date"
                      value={extendedDate}
                      onChange={(e) => setExtendedDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Documented Rationale &amp; Notes
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    placeholder="Document why this adjustment was made (e.g. Applied 10% wholesale rebate agreed at purchase)..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeForResolve(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? "Applying..." : "Confirm Resolution"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
