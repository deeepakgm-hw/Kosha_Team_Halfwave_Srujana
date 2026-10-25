import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  User,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { HeroDeviceMockups } from "./HeroDeviceMockups";
import { useBusiness } from "../../context/BusinessContext";

export const LandingHero: React.FC = () => {
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
    <section className="relative overflow-hidden pt-12 sm:pt-16 pb-12 sm:pb-20 bg-[#F5F7FA] border-b border-[#E1E7EC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[#001C64] border border-[#E1E7EC] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[#545D68] font-medium">India MSME Checkout &amp; Treasury</span>
            <span className="text-slate-300">|</span>
            <span className="text-[#0070E0] font-semibold">Srujana Tech Fest 2026</span>
          </div>
        </div>

        {/* Hero Headline & Subhead */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#001C64] tracking-tight leading-[1.08]">
            Turn more shoppers into buyers. <br />
            <span className="text-[#0070E0]">
              Keep your treasury from running dry.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[#545D68] font-normal max-w-3xl mx-auto leading-relaxed">
            Deliver instant QR counter credit with flexible split down-payments for in-store shoppers, while our AI forecast predicts your 90-day cash runway with zero surprises.
          </p>

          {/* Dual CTAs (Business Login & Member Login) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
            {/* Primary CTA: Business Login */}
            <button
              type="button"
              onClick={handleOpenBusiness}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#FFC439] hover:bg-[#F6B623] text-[#001C64] font-black text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <Store className="w-5 h-5 text-[#001C64]" />
              <span>Business Login — Start Free Forecast</span>
              <ArrowRight className="w-4 h-4 ml-1 text-[#001C64]" />
            </button>

            {/* Secondary CTA: Member Login */}
            <button
              type="button"
              onClick={handleOpenCustomer}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-[#0070E0]/5 text-[#0070E0] border-2 border-[#0070E0] font-bold text-base shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <User className="w-5 h-5 text-[#0070E0]" />
              <span>Member Login — View Dues &amp; Pay</span>
            </button>
          </div>

          {/* Trust Guarantees Strip */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-[#545D68] font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No setup fees or hardware required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instant dynamic QR counter activation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> MSMED Act Section 16 penal compliant
            </span>
          </div>
        </div>

        {/* Hero Interactive Device Mockup Visual */}
        <div className="mt-8 sm:mt-12">
          <HeroDeviceMockups />
        </div>
      </div>
    </section>
  );
};
