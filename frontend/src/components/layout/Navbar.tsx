import React, { useEffect, useState } from "react";
import { Building2, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../lib/api";

export const Navbar: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let mounted = true;
    apiClient
      .getHealth()
      .then((res) => {
        if (mounted) {
          setApiStatus(res.status === "healthy" ? "online" : "offline");
        }
      })
      .catch(() => {
        if (mounted) {
          setApiStatus("offline");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      {/* Current Enterprise Badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800">
              Apex Precision Components Pvt Ltd
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium border border-slate-200">
              Small Enterprise • Auto Ancillary
            </span>
          </div>
          <p className="text-[11px] text-slate-500">UDYAM-MH-01-0000000 • INR Ledger</p>
        </div>
      </div>

      {/* Backend Live Indicator & Meta */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-slate-200 bg-slate-50">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600">Backend API:</span>
          {apiStatus === "online" ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Connected
            </span>
          ) : apiStatus === "checking" ? (
            <span className="text-slate-500">Checking...</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Disconnected
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
