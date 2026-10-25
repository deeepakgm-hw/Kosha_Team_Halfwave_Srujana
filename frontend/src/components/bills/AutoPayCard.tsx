import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  PauseCircle,
  PlayCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  Info,
  History,
} from "lucide-react";
import {
  AutopayMandate,
  AutopayMandateDetail,
  MandateStatus,
} from "../../types/autopay";
import { apiClient, formatApiError } from "../../lib/api";
import { formatINR } from "../../lib/utils";

interface AutoPayCardProps {
  billId: string;
  billReference?: string | null;
  shopName?: string;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount: number;
  agreedRepaymentDate?: string | null;
  customerId?: string;
  businessId?: string;
  isBusinessOwner?: boolean;
  onMandateUpdated?: (mandate: AutopayMandate) => void;
}

export const AutoPayCard: React.FC<AutoPayCardProps> = ({
  billId,
  billReference,
  shopName = "Merchant Shop",
  totalAmount = 0,
  paidAmount = 0,
  outstandingAmount,
  agreedRepaymentDate,
  customerId = "cust_rahul_01",
  businessId,
  isBusinessOwner = false,
  onMandateUpdated,
}) => {
  const [mandateDetail, setMandateDetail] = useState<AutopayMandateDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Setup form states
  const [explicitConsent, setExplicitConsent] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);
  const [showAttempts, setShowAttempts] = useState<boolean>(true);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);

  // Load existing mandate for this bill
  const fetchMandate = useCallback(async () => {
    if (!billId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.getAutopayMandateByBill(
        billId,
        isBusinessOwner ? undefined : customerId,
        isBusinessOwner ? businessId : undefined
      );
      setMandateDetail(res);
      if (res?.mandate && onMandateUpdated) {
        onMandateUpdated(res.mandate);
      }
    } catch (err) {
      console.error("Error fetching AutoPay mandate:", err);
    } finally {
      setIsLoading(false);
    }
  }, [billId, customerId, businessId, isBusinessOwner, onMandateUpdated]);

  useEffect(() => {
    fetchMandate();
  }, [fetchMandate]);

  const mandate = mandateDetail?.mandate;

  // Handle mandate creation via Razorpay UPI AutoPay
  const handleInitiateAutoPay = async () => {
    if (!explicitConsent || !termsAccepted) {
      setErrorMsg("Please grant explicit consent and accept the AutoPay mandate terms.");
      return;
    }
    if (outstandingAmount <= 0) {
      setErrorMsg("This bill has already been fully settled. AutoPay cannot be registered.");
      return;
    }

    setIsSettingUp(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const setupResp = await apiClient.setupAutopayMandate(
        {
          bill_id: billId,
          explicit_consent: explicitConsent,
          terms_accepted: termsAccepted,
          terms_version: "v1.0-2026",
          mandate_type: "upi_autopay",
        },
        customerId
      );

      // Check provider capabilities
      if (setupResp.provider_capability === "account_activation_required") {
        setSuccessMsg(
          "AutoPay mandate created in pending authorization state. Bank recurring activation for this merchant account is in progress."
        );
        await fetchMandate();
        return;
      }

      // If Razorpay Order ID was created and Razorpay Checkout SDK is available
      const win = window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } };
      if (setupResp.razorpay_order_id && win.Razorpay && setupResp.razorpay_key_id) {
        const options = {
          key: setupResp.razorpay_key_id,
          order_id: setupResp.razorpay_order_id,
          customer_id: setupResp.razorpay_customer_id,
          name: shopName,
          description: `UPI AutoPay Mandate — Bill ${billReference || billId.slice(-8)}`,
          recurring: 1,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              setIsSettingUp(true);
              const verifiedMandate = await apiClient.verifyAutopayMandate(
                {
                  mandate_id: setupResp.mandate_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
                customerId
              );
              setSuccessMsg("AutoPay mandate verified and successfully activated!");
              if (onMandateUpdated) onMandateUpdated(verifiedMandate);
              await fetchMandate();
            } catch (vErr) {
              setErrorMsg(formatApiError(vErr));
            } finally {
              setIsSettingUp(false);
            }
          },
          prefill: {
            name: setupResp.customer_id,
          },
          theme: {
            color: "#059669", // Emerald 600
          },
          modal: {
            ondismiss: () => {
              setIsSettingUp(false);
              fetchMandate();
            },
          },
        };

        const rzp = new win.Razorpay(options);
        rzp.open();
      } else {
        // Registered in KOSHA pending authorization
        setSuccessMsg("AutoPay mandate registered in pending authorization state.");
        await fetchMandate();
      }
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsSettingUp(false);
    }
  };

  // Pause mandate
  const handlePauseMandate = async () => {
    if (!mandate) return;
    setIsUpdatingStatus(true);
    setErrorMsg(null);
    try {
      const updated = await apiClient.pauseAutopayMandate(
        mandate.id,
        isBusinessOwner ? undefined : customerId,
        isBusinessOwner ? businessId : undefined
      );
      setSuccessMsg("AutoPay mandate paused. Automatic collection attempts are suspended.");
      if (onMandateUpdated) onMandateUpdated(updated);
      await fetchMandate();
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Resume mandate
  const handleResumeMandate = async () => {
    if (!mandate) return;
    setIsUpdatingStatus(true);
    setErrorMsg(null);
    try {
      const updated = await apiClient.resumeAutopayMandate(
        mandate.id,
        isBusinessOwner ? undefined : customerId,
        isBusinessOwner ? businessId : undefined
      );
      setSuccessMsg("AutoPay mandate resumed and active.");
      if (onMandateUpdated) onMandateUpdated(updated);
      await fetchMandate();
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Revoke mandate
  const handleRevokeMandate = async () => {
    if (!mandate) return;
    const confirmRevoke = window.confirm(
      "Are you sure you want to revoke this AutoPay mandate? Once revoked, it cannot be reactivated and all automatic collection attempts will be permanently stopped."
    );
    if (!confirmRevoke) return;

    setIsUpdatingStatus(true);
    setErrorMsg(null);
    try {
      const updated = await apiClient.revokeAutopayMandate(mandate.id, customerId);
      setSuccessMsg("AutoPay mandate has been permanently revoked.");
      if (onMandateUpdated) onMandateUpdated(updated);
      await fetchMandate();
    } catch (err) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: MandateStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active &amp; Protected</span>
          </span>
        );
      case "pending_authorization":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Pending Authorization</span>
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 border border-blue-500/30">
            <PauseCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Paused</span>
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-700 border border-slate-500/30">
            <XCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>Revoked</span>
          </span>
        );
      case "cancelled":
      case "expired":
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span className="capitalize">{status}</span>
          </span>
        );
      default:
        return null;
    }
  };

  const formattedDeadline = agreedRepaymentDate
    ? new Date(agreedRepaymentDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Agreed deadline";

  return (
    <div className="relative rounded-2xl backdrop-blur-md bg-white/70 border border-slate-200/80 shadow-xs p-5 transition-all duration-200 hover:shadow-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                UPI AutoPay Mandate
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Razorpay Recurring
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Optional automated settlement for remaining credit after the due date
            </p>
          </div>
        </div>

        {mandate && (
          <div className="flex items-center gap-2">
            {getStatusBadge(mandate.status)}
            <button
              onClick={fetchMandate}
              disabled={isLoading}
              title="Refresh Mandate Status"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="mt-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Financial Context & Disclosure Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs">
        <div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Merchant
          </span>
          <span className="font-semibold text-slate-800 truncate block">{shopName}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Original Bill
          </span>
          <span className="font-semibold text-slate-800 block">{formatINR(totalAmount)}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Already Paid
          </span>
          <span className="font-semibold text-emerald-700 block">{formatINR(paidAmount)}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
            Remaining Due
          </span>
          <span className="font-bold text-slate-900 block font-mono">
            {formatINR(outstandingAmount)}
          </span>
        </div>
      </div>

      {/* Case 1: Active Mandate State */}
      {mandate && mandate.status === "active" && (
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Mandate Authorized &amp; Active
              </span>
              <span className="font-mono text-[11px] text-emerald-700 font-bold">
                Limit: Up to {formatINR(mandate.max_amount)}
              </span>
            </div>
            <p className="text-emerald-900/80 leading-relaxed">
              {mandate.collection_condition}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-emerald-800/80 pt-1 border-t border-emerald-200/60 font-mono">
              <span>Mandate ID: {mandate.id}</span>
              <span>•</span>
              <span>Deadline: {formattedDeadline}</span>
              {mandate.razorpay_auth_reference && (
                <>
                  <span>•</span>
                  <span>Auth Ref: {mandate.razorpay_auth_reference}</span>
                </>
              )}
            </div>
          </div>

          {/* Customer / Merchant Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePauseMandate}
                disabled={isUpdatingStatus}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <PauseCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Pause Mandate</span>
              </button>

              {!isBusinessOwner && (
                <button
                  onClick={handleRevokeMandate}
                  disabled={isUpdatingStatus}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Revoke Mandate</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Manual payment remains available anytime.</span>
            </div>
          </div>
        </div>
      )}

      {/* Case 2: Paused Mandate State */}
      {mandate && mandate.status === "paused" && (
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-950 flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4 text-blue-600" />
                Mandate Temporarily Paused
              </span>
              <span className="font-mono text-[11px] text-blue-700 font-bold">
                Limit: Up to {formatINR(mandate.max_amount)}
              </span>
            </div>
            <p className="text-blue-900/80 leading-relaxed">
              Automatic collections are currently suspended. No debit will be attempted after the repayment deadline while paused.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleResumeMandate}
                disabled={isUpdatingStatus}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Resume Mandate</span>
              </button>

              {!isBusinessOwner && (
                <button
                  onClick={handleRevokeMandate}
                  disabled={isUpdatingStatus}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Revoke Mandate</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              You can resume or settle the remaining balance manually.
            </div>
          </div>
        </div>
      )}

      {/* Case 3: Revoked / Cancelled Mandate State */}
      {mandate && (mandate.status === "revoked" || mandate.status === "cancelled") && (
        <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-slate-500" />
              AutoPay Authorization Revoked
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-mono">Permanent</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            This mandate has been permanently revoked. No automatic collection attempts will ever be initiated. The remaining balance of {formatINR(outstandingAmount)} must be paid manually.
          </p>
        </div>
      )}

      {/* Case 4: No Mandate Yet (Setup Flow) */}
      {(!mandate || mandate.status === "pending_authorization" || mandate.status === "failed") && (
        <div className="space-y-4 pt-1">
          {mandate?.status === "pending_authorization" && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-spin" />
              <div>
                <span className="font-bold block">Authorization Pending with Payment Provider</span>
                <span className="text-[11px] text-amber-800">
                  {mandate.failure_reason ||
                    "Mandate order registered. Complete UPI authorization to activate automatic protection."}
                </span>
              </div>
            </div>
          )}

          {outstandingAmount <= 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-50 text-slate-600 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>This bill has no outstanding dues. AutoPay is not required.</span>
            </div>
          ) : (
            <>
              {/* Terms & Consent Disclosures */}
              <div className="space-y-2.5 rounded-xl bg-emerald-50/40 border border-emerald-200/50 p-4 text-xs">
                <div className="flex items-center gap-2 text-emerald-950 font-bold">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>How KOSHA AutoPay Works</span>
                </div>
                <ul className="space-y-1.5 text-slate-600 list-disc list-inside text-[11px] leading-relaxed">
                  <li>
                    <strong>Authorization Limit:</strong> Up to {formatINR(outstandingAmount)} (variable, exact remaining balance only).
                  </li>
                  <li>
                    <strong>Collection Rule:</strong> Automatic collection is attempted <em>strictly after</em> the agreed deadline ({formattedDeadline}) if and only if the balance remains unpaid.
                  </li>
                  <li>
                    <strong>Manual Payment:</strong> You can pay manually in full or partial amounts anytime before or after the deadline.
                  </li>
                  <li>
                    <strong>Cancellation &amp; Control:</strong> You can pause or permanently revoke this mandate directly from your dashboard at any time without fees.
                  </li>
                </ul>
              </div>

              {/* Explicit Consent Checkboxes (Never preselected) */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={explicitConsent}
                    onChange={(e) => setExplicitConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>
                    I explicitly authorize KOSHA to set up a supported Razorpay recurring payment mandate for up to{" "}
                    <strong>{formatINR(outstandingAmount)}</strong> for this bill.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>
                    I accept the{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsModal(true);
                      }}
                      className="text-emerald-700 hover:text-emerald-800 underline font-semibold"
                    >
                      KOSHA AutoPay Mandate Terms (v1.0-2026)
                    </button>{" "}
                    and agree that collection will only be attempted after {formattedDeadline} if unpaid.
                  </span>
                </label>
              </div>

              {/* CTA Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleInitiateAutoPay}
                  disabled={!explicitConsent || !termsAccepted || isSettingUp || outstandingAmount <= 0}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#0070E0] to-[#003087] hover:from-[#005bb5] hover:to-[#001C64] shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {isSettingUp
                      ? "Initiating Mandate..."
                      : `Authorize AutoPay via UPI (Max ${formatINR(outstandingAmount)})`}
                  </span>
                </button>

                <span className="text-[11px] text-slate-400 text-center sm:text-right">
                  UPI AutoPay • NPCI Compliant • 256-bit Encrypted
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Automatic Collection Activity */}
      {mandateDetail?.attempts && mandateDetail.attempts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200/60">
          <button
            onClick={() => setShowAttempts(!showAttempts)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Collection Engine Activity ({mandateDetail.attempts.length}{" "}
                {mandateDetail.attempts.length === 1 ? "attempt" : "attempts"})
              </span>
            </span>
            {showAttempts ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showAttempts && (
            <div className="mt-2.5 space-y-2.5">
              {mandateDetail.attempts.map((att) => {
                const isSuccess = att.status === "succeeded";
                const isAwaitingNotice = att.status === "awaiting_notification";
                const isRecon = att.status === "reconciliation_required";
                const isPending = att.status === "pending";
                const isFailed = att.status === "failed";

                return (
                  <div
                    key={att.id}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                      isSuccess
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                        : isAwaitingNotice
                        ? "bg-amber-50/70 border-amber-200 text-amber-950"
                        : isRecon
                        ? "bg-purple-50/70 border-purple-200 text-purple-950"
                        : isPending
                        ? "bg-sky-50/70 border-sky-200 text-sky-950"
                        : isFailed
                        ? "bg-rose-50/70 border-rose-200 text-rose-950"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {isAwaitingNotice && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                        {isRecon && <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />}
                        {isPending && <RefreshCw className="w-4 h-4 text-sky-600 shrink-0 animate-spin" />}
                        {isFailed && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                        <span>
                          {isSuccess
                            ? `Collection Succeeded: ${formatINR(att.amount)}`
                            : isAwaitingNotice
                            ? `Pre-Debit Notice Recorded (${formatINR(att.amount)})`
                            : isRecon
                            ? "Reconciliation Required"
                            : isPending
                            ? "Collection In Progress"
                            : isFailed
                            ? `Collection Attempt ${att.attempt_number} Failed`
                            : `Attempt ${att.attempt_number}: ${att.status}`}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold bg-white/80 border border-current">
                        {att.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="text-[11px] opacity-90 leading-relaxed space-y-0.5">
                      {isSuccess && (
                        <p>
                          AutoPay debited {formatINR(att.amount)} from customer mandate. Applied to bill ledger.
                          {att.razorpay_payment_id && ` Payment Ref: ${att.razorpay_payment_id}`}
                        </p>
                      )}
                      {isAwaitingNotice && (
                        <p>
                          Mandatory 24-hour pre-debit notice sent to customer on{" "}
                          {att.notification_timestamp
                            ? new Date(att.notification_timestamp).toLocaleString()
                            : "today"}
                          . Collection will be executed once waiting period elapses.
                        </p>
                      )}
                      {isRecon && (
                        <p>
                          Gateway timed out during debit request. Marked as reconciliation required to prevent duplicate debit.
                        </p>
                      )}
                      {isFailed && (
                        <div>
                          <p className="text-rose-800">
                            {att.failure_reason || "Provider reported collection failure."}
                          </p>
                          {att.next_retry_at && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Next automatic retry scheduled after: {new Date(att.next_retry_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Audit Log Accordion */}
      {mandateDetail?.audit_logs && mandateDetail.audit_logs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200/60">
          <button
            onClick={() => setShowAuditLogs(!showAuditLogs)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Mandate Audit History ({mandateDetail.audit_logs.length} entries)</span>
            </span>
            {showAuditLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAuditLogs && (
            <div className="mt-2.5 space-y-2 text-[11px] max-h-48 overflow-y-auto pr-1">
              {mandateDetail.audit_logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-slate-800 font-mono capitalize">
                      {log.action.replace("_", " ")}
                    </span>
                    <p className="text-slate-500 text-[10px] mt-0.5">{log.notes || "Event recorded."}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>KOSHA AutoPay Mandate Terms (v1.0-2026)</span>
              </h4>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-3 leading-relaxed text-slate-600">
              <p>
                <strong>1. Scope of Authorization:</strong> By authorizing this mandate, you permit KOSHA and its payment processing partner (Razorpay) to initiate automatic collection of any verified unpaid balance on this specific bill.
              </p>
              <p>
                <strong>2. Maximum Authorized Amount:</strong> The collection shall not exceed the remaining outstanding balance at the time of debit, capped at maximum {formatINR(outstandingAmount)}.
              </p>
              <p>
                <strong>3. Pre-Debit Condition:</strong> Automatic collection will strictly only be initiated after the agreed repayment deadline ({formattedDeadline}) if the bill remains unsettled.
              </p>
              <p>
                <strong>4. Right of Cancellation:</strong> You maintain the unconditional right to pause or revoke this mandate directly from your KOSHA customer portal at any time prior to collection without penalty.
              </p>
              <p>
                <strong>5. Manual Payment Guarantee:</strong> Setting up AutoPay does not restrict you from making manual UPI or cash repayments. Any manual payment received automatically reduces the authorized debit amount.
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close &amp; Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
