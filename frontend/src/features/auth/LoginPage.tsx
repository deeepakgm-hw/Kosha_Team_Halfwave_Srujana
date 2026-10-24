import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  Store,
  User,
  ShieldCheck,
  TrendingUp,
  Receipt,
  QrCode,
  CalendarCheck,
  CheckCircle2,
} from "lucide-react";
import { KoshaLogo } from "../../components/ui/KoshaLogo";
import { useBusiness } from "../../context/BusinessContext";
import { useLanguage } from "../../context/LanguageContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setIsDemoMode, setSelectedPersona } = useBusiness();
  const { language, setLanguage } = useLanguage();

  const handleOpenBusinessDashboard = () => {
    setIsDemoMode(true);
    setSelectedPersona("manufacturer");
    navigate("/load");
  };

  const handleOpenCustomerDashboard = () => {
    navigate("/customer/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 lg:p-12 relative overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50/30">
      {/* Decorative ambient background accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-kosha-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <KoshaLogo size="md" showWordmark={true} />
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Interactive Demo Mode</span>
          </div>
        </div>

        {/* Right Pane: Language Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-full bg-white/70 border border-white/90 shadow-xs text-xs font-semibold backdrop-blur-md">
            <button
              onClick={() => setLanguage("EN")}
              className={`px-3 py-1 rounded-full transition-all ${
                language === "EN"
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
              aria-label="English language"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("HI")}
              className={`px-3 py-1 rounded-full transition-all ${
                language === "HI"
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
              aria-label="Hindi language (हिन्दी)"
            >
              हि
            </button>
            <button
              onClick={() => setLanguage("KN")}
              className={`px-3 py-1 rounded-full transition-all ${
                language === "KN"
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
              aria-label="Kannada language (ಕನ್ನಡ)"
            >
              ಕ
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="w-full max-w-7xl mx-auto my-auto py-8 sm:py-12 z-10 relative">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-white/80 text-kosha-navy border border-slate-200/60 shadow-xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Srujana Tech Fest 2026 — Finance Hackathon</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-kosha-navy tracking-tight leading-[1.15]">
            Know your treasury <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-kosha-blue via-indigo-600 to-emerald-600">
              before it runs dry.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            One place to understand your business cash flow, manage shop credit, and stay ahead of repayments.
          </p>
        </div>

        {/* Two Prominent Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {/* Card 1: Business Dashboard */}
          <div className="group bg-white/85 hover:bg-white backdrop-blur-xl rounded-3xl p-7 sm:p-9 border border-white/90 shadow-glass-lg hover:shadow-xl hover:border-blue-200/80 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />

            <div className="space-y-5 relative">
              <div className="flex items-center justify-between">
                <div className="w-13 h-13 rounded-2xl bg-blue-50 text-kosha-blue flex items-center justify-center shadow-xs border border-blue-100">
                  <Store className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-kosha-blue bg-blue-50/80 px-3 py-1 rounded-full border border-blue-100">
                  Business Owner
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-kosha-navy group-hover:text-kosha-blue transition-colors">
                  I'm a business owner
                </h2>
                <p className="text-sm sm:text-base text-slate-600 font-medium mt-2 leading-relaxed">
                  Forecast cash flow, understand receivables, and plan your next financial move.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 pt-2 text-xs sm:text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-kosha-blue shrink-0" />
                  <span>90-day rolling predictive cash runway</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>MSMED Act Section 16 penal interest tracking</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Ranked fixes with financial and relationship cost</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={handleOpenBusinessDashboard}
                className="w-full py-4 rounded-2xl bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Open Business Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2.5 font-medium">
                Uses synthetic MSME demo data · 5-step strategic treasury workflow
              </p>
            </div>
          </div>

          {/* Card 2: Customer Dashboard */}
          <div className="group bg-white/85 hover:bg-white backdrop-blur-xl rounded-3xl p-7 sm:p-9 border border-white/90 shadow-glass-lg hover:shadow-xl hover:border-emerald-200/80 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

            <div className="space-y-5 relative">
              <div className="flex items-center justify-between">
                <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs border border-emerald-100">
                  <User className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50/80 px-3 py-1 rounded-full border border-emerald-100">
                  Customer / Member
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-kosha-navy group-hover:text-emerald-700 transition-colors">
                  I'm a customer
                </h2>
                <p className="text-sm sm:text-base text-slate-600 font-medium mt-2 leading-relaxed">
                  Track shop purchases, manage outstanding dues, and never miss a repayment date.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-2.5 pt-2 text-xs sm:text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-2.5">
                  <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Scan participating shop QR or enter shop code</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CalendarCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Agreed repayment commitments & friendly reminders</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>Record demo repayments & track cleared balances</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={handleOpenCustomerDashboard}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Open Customer Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2.5 font-medium">
                Mobile-first member interface · Preloaded as Rahul Sharma
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto pt-6 border-t border-slate-200/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-2 z-10 relative">
        <p>KOSHA — Predictive Cash-Flow Management & Credit Platform</p>
        <p className="text-[11px] text-slate-400">
          Planning aid for small businesses and customers · Srujana Tech Fest 2026
        </p>
      </footer>
    </div>
  );
};
