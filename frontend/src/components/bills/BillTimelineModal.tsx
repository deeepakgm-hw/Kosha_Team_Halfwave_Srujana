import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Info,
} from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { BillTimelineResponse } from "../../types/autopay";
import { formatINR } from "../../lib/utils";

interface BillTimelineModalProps {
  billId: string;
  onClose: () => void;
  customerId?: string;
  businessId?: string;
}

export const BillTimelineModal: React.FC<BillTimelineModalProps> = ({
  billId,
  onClose,
  customerId,
  businessId,
}) => {
  const [timeline, setTimeline] = useState<BillTimelineResponse | null>(null);
  const [filter, setFilter] = useState<"all" | "financial" | "governance">("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.getBillTimeline(billId, customerId, businessId);
        setTimeline(res);
      } catch (err: unknown) {
        setError(formatApiError(err));
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimeline();
  }, [billId, customerId, businessId]);

  const filteredEvents = (timeline?.events || []).filter((e) => {
    if (filter === "financial") return e.category === "confirmed_financial";
    if (filter === "governance") return e.category === "governance" || e.category === "non_final_state";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-emerald-50/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                Audited Timeline
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">
                {timeline?.bill_reference || billId}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
              Transaction &amp; AutoPay Lifecycle
            </h3>
            <p className="text-xs text-slate-500">
              {timeline?.shop_name} • Customer: {timeline?.customer_name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Financial Summary Strip */}
        {timeline && (
          <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50/70 border-b border-slate-100 text-xs">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Bill</span>
              <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                {formatINR(timeline.purchase_amount)}
              </span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Remaining Due</span>
              <span className="text-sm font-black text-rose-600 font-mono mt-0.5 block">
                {formatINR(timeline.outstanding_amount)}
              </span>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Mandate Protection</span>
              <span className="text-xs font-bold text-emerald-700 capitalize mt-0.5 block">
                {timeline.mandate_status ? timeline.mandate_status.replace("_", " ") : "None"}
              </span>
            </div>
          </div>
        )}

        {/* Filter Chips */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-xs">
          {[
            { id: "all", label: `All Events (${timeline?.events.length || 0})` },
            {
              id: "financial",
              label: `Confirmed Payments (${
                timeline?.events.filter((e) => e.category === "confirmed_financial").length || 0
              })`,
            },
            {
              id: "governance",
              label: `Mandate & Audit (${
                timeline?.events.filter((e) => e.category !== "confirmed_financial").length || 0
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full font-bold transition-all ${
                filter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeline Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-600" />
              <p className="text-xs font-bold">Assembling auditable bill timeline...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <p className="font-bold">Error loading timeline</p>
              <p className="mt-0.5">{error}</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Info className="w-6 h-6 mx-auto mb-1.5 opacity-60" />
              <p>No lifecycle events found in this view.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {filteredEvents.map((evt, idx) => {
                const isConfirmedFinancial = evt.category === "confirmed_financial";
                const isNonFinal = evt.category === "non_final_state";
                const isFailed = evt.event_type.includes("failed");

                return (
                  <div key={evt.id || idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all bg-white ${
                        isConfirmedFinancial
                          ? "border-emerald-600 text-emerald-600"
                          : isFailed
                          ? "border-rose-500 text-rose-500"
                          : isNonFinal
                          ? "border-amber-500 text-amber-500"
                          : "border-blue-600 text-blue-600"
                      }`}
                    >
                      {isConfirmedFinancial ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : isFailed ? (
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                      ) : isNonFinal ? (
                        <Clock className="w-3 h-3 text-amber-500" />
                      ) : (
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                      )}
                    </div>

                    {/* Event Card */}
                    <div
                      className={`p-3.5 rounded-2xl border text-xs transition-all ${
                        isConfirmedFinancial
                          ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300"
                          : isFailed
                          ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
                          : isNonFinal
                          ? "bg-amber-50/40 border-amber-200 hover:border-amber-300"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{evt.title}</span>
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              isConfirmedFinancial
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : isNonFinal
                                ? "bg-amber-100 text-amber-900 border-amber-200"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }`}
                          >
                            {isConfirmedFinancial
                              ? "Confirmed Financial"
                              : isNonFinal
                              ? "Non-Final State"
                              : "Governance / Audit"}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>

                      <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 mt-2 text-[10px] text-slate-500 font-mono flex-wrap gap-2">
                        {evt.amount_inr !== undefined && evt.amount_inr !== null && (
                          <span className="font-bold text-slate-900">
                            Amount: {formatINR(evt.amount_inr)}
                          </span>
                        )}
                        {evt.provider_reference && (
                          <span>Ref: {evt.provider_reference}</span>
                        )}
                        <span className="capitalize">Event: {evt.event_type.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            Authoritative event trail maintained in integer paise • Zero simulated entries
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-2xs"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
};
