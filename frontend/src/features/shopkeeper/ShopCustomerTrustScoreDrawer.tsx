import React, { useState, useEffect } from "react";
import {
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { BusinessCustomerTrustProfile } from "../../types/customer";
import { formatINR } from "../../lib/utils";

interface ShopCustomerTrustScoreDrawerProps {
  shopCode: string;
  customerId: string;
  onClose: () => void;
}

export const ShopCustomerTrustScoreDrawer: React.FC<ShopCustomerTrustScoreDrawerProps> = ({
  shopCode,
  customerId,
  onClose,
}) => {
  const [profile, setProfile] = useState<BusinessCustomerTrustProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.getBusinessCustomerTrustProfile(shopCode, customerId);
        setProfile(res);
      } catch (err: unknown) {
        setError(formatApiError(err));
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [shopCode, customerId]);

  const getTierColor = (cat: string) => {
    switch (cat) {
      case "excellent":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "good":
        return "bg-blue-100 text-[#003087] border-blue-300";
      case "fair":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "needs_attention":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Customer Reliability Profile</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  TrustScore
                </span>
              </div>
              <p className="text-xs text-blue-200">
                {profile?.customer_name || "Customer"} · Scoped to {profile?.merchant_specific?.shop_name || "Your Store"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center space-y-2">
              <RefreshCw className="w-8 h-8 text-[#0070E0] animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Computing reliability profile...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          ) : profile ? (
            <>
              {/* TrustScore Strip */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    KOSHA TrustScore
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {profile.has_sufficient_history && profile.trust_score !== null
                        ? profile.trust_score
                        : "NEW"}
                    </span>
                    {profile.trust_score !== null && (
                      <span className="text-xs font-bold text-slate-400">/ 100</span>
                    )}
                  </div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border mt-1 ${getTierColor(profile.score_category)}`}>
                    {profile.score_category.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Overall On-Time Settlement
                  </span>
                  <span className="text-xl font-black text-emerald-700 block">
                    {profile.overall_on_time_ratio_pct}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Across verified store credits
                  </span>
                </div>
              </div>

              {/* Data Privacy Shield Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  <strong>Strict Privacy Guard:</strong> You can see this customer's overall reliability rating, but details of transactions with other merchants are strictly isolated to protect commercial privacy.
                </span>
              </div>

              {/* This Merchant's Specific Stats */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                  Obligations with Your Store Only
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed</span>
                    <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                      {formatINR(profile.merchant_specific.total_billed_inr)}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Outstanding</span>
                    <span className="text-sm font-black text-rose-600 font-mono mt-0.5 block">
                      {formatINR(profile.merchant_specific.current_outstanding_inr)}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Overdue</span>
                    <span className="text-sm font-black text-amber-700 font-mono mt-0.5 block">
                      {formatINR(profile.merchant_specific.current_overdue_inr)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bills List for this Merchant */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Store Purchase History ({profile.merchant_specific.bills.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {profile.merchant_specific.settled_bills_count} settled · {profile.merchant_specific.active_bills_count} active
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {profile.merchant_specific.bills.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No purchases recorded at this store yet.</p>
                  ) : (
                    profile.merchant_specific.bills.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{b.reference}</span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                b.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : b.status === "overdue"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                            {b.description} · Due: {b.agreed_repayment_date}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-slate-900 block">
                            {formatINR(b.outstanding_amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            of {formatINR(b.purchase_amount)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-400">KOSHA Internal TrustScore Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
