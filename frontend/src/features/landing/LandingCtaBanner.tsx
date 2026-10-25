import React from "react";
import { useNavigate } from "react-router-dom";
import { Store, User, ArrowRight, Sparkles } from "lucide-react";

export const LandingCtaBanner: React.FC = () => {
  const navigate = useNavigate();

  const handleOpenBusiness = () => {
    navigate("/login?role=business");
  };

  const handleOpenCustomer = () => {
    navigate("/login?role=customer");
  };

  return (
    <section className="bg-[#001C64] text-white py-16 sm:py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white/10 text-[#FFC439] border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC439]" />
            <span>Enterprise-Grade Cash-Flow Intelligence</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Take control of your cash flow and checkout experience today.
          </h2>

          <p className="text-base sm:text-lg text-slate-200 font-normal max-w-2xl mx-auto">
            Experience how KOSHA protects your business from cash dry-ups and simplifies customer credit without messy paperwork.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleOpenBusiness}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] font-black text-base shadow-paypal transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer"
            >
              <Store className="w-5 h-5 text-[#001C64]" />
              <span>Business Login (Start Free)</span>
              <ArrowRight className="w-4 h-4 ml-1 text-[#001C64]" />
            </button>

            <button
              type="button"
              onClick={handleOpenCustomer}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-transparent hover:bg-white/10 text-white border-2 border-white font-bold text-base transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer"
            >
              <User className="w-5 h-5 text-white" />
              <span>Member Login (Customer Portal)</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 pt-2">
            No credit card required · Instant cloud setup · Real-time UPI &amp; bank reconciliation
          </p>
        </div>
      </div>
    </section>
  );
};
