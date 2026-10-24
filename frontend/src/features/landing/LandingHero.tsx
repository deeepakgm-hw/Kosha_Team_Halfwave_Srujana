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
    <section className="relative overflow-hidden pt-10 sm:pt-16 pb-12 sm:pb-20 bg-gradient-to-b from-white via-sky-50/30 to-slate-50 border-b border-slate-200/60">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-white text-kosha-navy border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-500 font-medium">India MSME Checkout & Treasury</span>
            <span className="text-slate-300">|</span>
            <span className="text-kosha-blue font-semibold">Srujana Tech Fest 2026</span>
          </div>
        </div>

        {/* Hero Headline & Subhead */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-kosha-navy tracking-tight leading-[1.08]">
            Turn more shoppers into buyers. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-kosha-blue via-indigo-600 to-emerald-600">
              Keep your treasury from running dry.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 font-normal max-w-3xl mx-auto leading-relaxed">
            Deliver instant QR counter credit with flexible split down-payments for in-store shoppers, while our AI forecast predicts your 90-day cash runway with zero surprises.
          </p>

          {/* Dual CTAs (Business Login & Member Login) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
            {/* Primary CTA: Business Login */}
            <button
              type="button"
              onClick={handleOpenBusiness}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-kosha-blue via-blue-600 to-kosha-deep hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <Store className="w-5 h-5" />
              <span>Business Login — Start Free Forecast</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            {/* Secondary CTA: Member Login */}
            <button
              type="button"
              onClick={handleOpenCustomer}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white hover:bg-slate-50 text-emerald-800 border-2 border-emerald-500/40 hover:border-emerald-600 font-bold text-base shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
            >
              <User className="w-5 h-5 text-emerald-600" />
              <span>Member Login — View Dues & Pay</span>
            </button>
          </div>

          {/* Trust Guarantees Strip */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No setup fees or hardware required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant dynamic QR counter activation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> MSMED Act Section 16 penal compliant
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
