import React from "react";
import { useNavigate } from "react-router-dom";
import { Store, User, ArrowRight, Sparkles } from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";

export const LandingCtaBanner: React.FC = () => {
  const navigate = useNavigate();
  const { setIsDemoMode, setSelectedPersona } = useBusiness();

  const handleOpenBusiness = () => {
    setIsDemoMode(true);
    setSelectedPersona("manufacturer");
    navigate("/load");
  };

  const handleOpenCustomer = () => {
    navigate("/customer/dashboard");
  };

  return (
    <section className="bg-gradient-to-r from-kosha-navy via-slate-900 to-indigo-950 text-white py-16 sm:py-20 relative overflow-hidden">
      {/* Decorative ambient background accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-white/10 text-sky-300 border border-white/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready for Srujana Tech Fest 2026 Evaluation</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Take control of your cash flow and checkout experience today.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 font-normal max-w-2xl mx-auto">
            Experience how KOSHA protects your business from cash dry-ups and simplifies customer credit without messy paperwork.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleOpenBusiness}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-kosha-blue hover:bg-blue-600 text-white font-bold text-base shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <Store className="w-5 h-5" />
              <span>Business Login (Start Free)</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              type="button"
              onClick={handleOpenCustomer}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-base backdrop-blur-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <User className="w-5 h-5 text-emerald-400" />
              <span>Member Login (Customer Portal)</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 pt-2">
            No credit card required · Instant access to preloaded MSME demo data
          </p>
        </div>
      </div>
    </section>
  );
};
