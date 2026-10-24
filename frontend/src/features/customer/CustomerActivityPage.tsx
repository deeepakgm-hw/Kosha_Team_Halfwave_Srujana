import React, { useState, useEffect } from "react";
import { Clock, CheckCircle2, ShoppingBag, RefreshCw, AlertTriangle, Calendar } from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { ActivityEvent } from "../../types/customer";
import { formatINR } from "../../lib/utils";

export const CustomerActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCustomerActivity("cust_rahul_01", 50);
      setActivities(res);
    } catch (err: unknown) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-kosha-navy tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-kosha-blue" />
            <span>Activity & Audit Trail</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Immutable log of purchases, payment receipts, and repayment commitments.
          </p>
        </div>

        <button
          onClick={fetchActivity}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 hover:bg-white text-slate-600 border border-slate-200 shadow-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-white/90 shadow-glass-sm">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-kosha-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : activities.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-12">No activity events recorded yet.</p>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {activities.map((act) => {
              const isRepayment = act.event_type.includes("repayment") || act.event_type.includes("payment");

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${
                      isRepayment ? "bg-emerald-600 text-white" : "bg-kosha-blue text-white"
                    }`}
                  >
                    {isRepayment ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <ShoppingBag className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 transition-all space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">{act.title}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {new Date(act.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{act.description}</p>

                    {act.amount !== undefined && act.amount !== null && (
                      <div className="pt-1 flex items-center justify-end">
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {formatINR(act.amount)}
                        </span>
                      </div>
                    )}
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
