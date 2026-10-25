import React, { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle2, ShoppingBag, RefreshCw, AlertTriangle, Calendar } from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { ActivityEvent } from "../../types/customer";
import { formatINR } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";

export const CustomerActivityPage: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    const custId = user?.customer_id;
    if (!custId) {
      setActivities([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCustomerActivity(custId, 50);
      setActivities(res);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [user?.customer_id]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#001C64] tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#0070E0]" />
            <span>Activity &amp; Audit Trail</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#545D68] font-medium mt-0.5">
            Immutable log of purchases, payment receipts, and repayment commitments.
          </p>
        </div>

        <button
          onClick={fetchActivity}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white hover:bg-[#F5F7FA] text-[#001C64] border border-[#E1E7EC] shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0070E0]" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E1E7EC] shadow-paypal">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-[#0070E0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-[#545D68]">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-[#001C64]">No transactions recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Your purchases, payments, and settlements will appear here chronologically once bills are generated.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E1E7EC]">
            {activities.map((act) => {
              const isPayment =
                act.event_type === "partial_payment" || act.event_type === "repayment_completed";

              return (
                <div key={act.id} className="relative flex items-start gap-4">
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-2xs ${
                      isPayment ? "bg-emerald-600 text-white" : "bg-[#0070E0] text-white"
                    }`}
                  >
                    {isPayment ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <ShoppingBag className="w-3 h-3" />
                    )}
                  </div>

                  <div className="flex-1 bg-[#F5F7FA] rounded-xl p-3.5 border border-[#E1E7EC]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#001C64]">{act.title}</span>
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(act.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1">{act.description}</p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E1E7EC]/60 text-xs">
                      <span className="font-mono text-slate-500">{act.transaction_id || act.id}</span>
                      <span
                        className={`font-mono font-bold ${
                          isPayment ? "text-emerald-700" : "text-[#001C64]"
                        }`}
                      >
                        {isPayment ? "-" : "+"}
                        {formatINR(act.amount ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
