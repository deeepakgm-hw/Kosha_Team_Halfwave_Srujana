import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  User,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Receipt,
  QrCode,
  CalendarCheck,
  CheckCircle2,
  Sparkles,
  Smartphone,
  BarChart3,
} from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";

export const LandingPersonaSelector: React.FC = () => {
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
    <section id="how-it-works" className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue border border-blue-200 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Two Portals, One Connected Platform</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-kosha-navy tracking-tight">
            Choose your login experience
          </h2>

          <p className="text-base sm:text-lg text-slate-600 mt-3">
            Whether you run a manufacturing plant or shop at your neighborhood store, KOSHA provides purpose-built tools for complete financial peace of mind.
          </p>
        </div>

        {/* Two High-Impact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1: Business Dashboard */}
          <div className="group bg-white rounded-3xl p-8 sm:p-10 border-2 border-slate-200/80 hover:border-kosha-blue shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />

            <div className="space-y-6 relative">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-kosha-blue flex items-center justify-center border border-blue-100 shadow-xs">
                  <Store className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-kosha-blue bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Business Owner
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-kosha-navy group-hover:text-kosha-blue transition-colors">
                  Business Owner & Merchant
                </h3>
                <p className="text-sm sm:text-base text-slate-600 font-medium mt-2 leading-relaxed">
                  Predict runway, manage customer credit, and recover corporate receivables with statutory backing.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-3 pt-2 text-sm text-slate-700 font-medium">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4.5 h-4.5 text-kosha-blue shrink-0" />
                  <span>90-day predictive rolling cash runway</span>
                </div>
                <div className="flex items-center gap-3">
                  <QrCode className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Shop QR code generator for in-store credit</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                  <span>MSMED Section 16 penal interest tracking</span>
                </div>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span>Ranked action plan with financial impact analysis</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={handleOpenBusiness}
                className="w-full py-4 rounded-2xl bg-kosha-blue hover:bg-kosha-deep text-white text-base font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Launch Business Login</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-xs text-slate-400 text-center mt-2.5 font-medium">
                Includes sample MSME manufacturing & retail demo data
              </p>
            </div>
          </div>

          {/* Card 2: Customer / Member Dashboard */}
          <div className="group bg-white rounded-3xl p-8 sm:p-10 border-2 border-slate-200/80 hover:border-emerald-600 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

            <div className="space-y-6 relative">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-xs">
                  <User className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Customer / Member
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-kosha-navy group-hover:text-emerald-700 transition-colors">
                  Customer & Shopper Member
                </h3>
                <p className="text-sm sm:text-base text-slate-600 font-medium mt-2 leading-relaxed">
                  Scan store QR codes, track shop purchases made on credit, and manage upcoming repayment commitments.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-3 pt-2 text-sm text-slate-700 font-medium">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>Scan participating shop QR or enter shop code</span>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarCheck className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span>Agreed repayment commitments & polite reminders</span>
                </div>
                <div className="flex items-center gap-3">
                  <Receipt className="w-4.5 h-4.5 text-teal-600 shrink-0" />
                  <span>Track cleared balances & digital transaction receipts</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                  <span>Zero hidden interest or predatory penalty fees</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={handleOpenCustomer}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Launch Member Login</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-xs text-slate-400 text-center mt-2.5 font-medium">
                Mobile-optimized · Preloaded as customer Rahul Sharma
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
