import React from "react";
import { Info, Database, Sparkles } from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";

export const SyntheticDataBanner: React.FC = () => {
  const { isDemoMode, setIsDemoMode, activeBusiness } = useBusiness();

  if (!isDemoMode) {
    return (
      <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-xs text-emerald-900 flex items-center justify-between">
        <div className="flex items-center gap-2 mx-auto">
          <Database className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>
            <strong>PERSISTENT FINANCIAL LEDGER ACTIVE:</strong> Viewing real business records for{" "}
            <strong>{activeBusiness?.legal_name || "Selected Enterprise"}</strong>. Calculations are
            strictly derived from database records.
          </span>
          <button
            onClick={() => setIsDemoMode(true)}
            className="ml-3 underline hover:text-emerald-950 font-semibold cursor-pointer"
          >
            Switch to Demo Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-between">
      <div className="flex items-center gap-2 mx-auto">
        <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>
          <strong className="tracking-wide">DEMO ENVIRONMENT:</strong> All financial records, customer
          profiles, and treasury balances are <strong>synthetic</strong> for demonstration purposes.
        </span>
        <button
          onClick={() => setIsDemoMode(false)}
          className="ml-3 underline hover:text-amber-950 font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          Switch to Real Data Mode
        </button>
      </div>
    </div>
  );
};
