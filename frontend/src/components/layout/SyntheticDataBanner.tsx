import React from "react";
import { Info } from "lucide-react";

export const SyntheticDataBanner: React.FC = () => {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-center gap-2">
      <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
      <span>
        <strong>DEMO ENVIRONMENT:</strong> All financial records, customer profiles, and treasury balances are <strong>synthetic</strong> for demonstration purposes.
      </span>
    </div>
  );
};
