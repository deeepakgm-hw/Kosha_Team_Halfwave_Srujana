import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, UploadCloud, ShieldCheck, TrendingUp, CheckCircle } from "lucide-react";
import { KoshaLogo } from "../../components/ui/KoshaLogo";
import { useBusiness } from "../../context/BusinessContext";
import { useLanguage } from "../../context/LanguageContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setIsDemoMode, setSelectedPersona } = useBusiness();
  const { language, setLanguage, t } = useLanguage();

  const handleSampleDemo = () => {
    setIsDemoMode(true);
    setSelectedPersona("manufacturer");
    navigate("/load");
  };

  const handleUploadData = () => {
    setIsDemoMode(false);
    navigate("/load");
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden">
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
        <KoshaLogo size="md" showWordmark={true} />

        {/* Language Switcher */}
        <div className="flex items-center p-0.5 rounded-full bg-white/50 border border-white/70 shadow-xs text-xs font-semibold">
          <button
            onClick={() => setLanguage("EN")}
            className={`px-2.5 py-1 rounded-full transition-all ${
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
            className={`px-2.5 py-1 rounded-full transition-all ${
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
            className={`px-2.5 py-1 rounded-full transition-all ${
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

      {/* Main Split Welcome View */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center my-auto py-8">
        {/* Left Hero Section */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-white/60 text-kosha-navy border border-white/80 shadow-xs">
            Predictive Cash-Flow Early Warning
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-kosha-navy tracking-tight leading-[1.1]">
            {language === "EN" ? (
              <>
                Know your treasury <br />
                before it runs dry.
              </>
            ) : (
              t("tagline")
            )}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-xl font-medium leading-relaxed">
            See when cash may run short over the next 90 days, simulate financial disruptions, and compare corrective actions tailored for small businesses.
          </p>

          {/* 5 Workflow Stages */}
          <div className="pt-2">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block mb-2.5">
              {t("workflowTitle")}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-xl">
              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-white/90 shadow-xs text-left">
                <span className="text-[10px] font-semibold text-slate-400 block">Step 1</span>
                <span className="text-xs font-extrabold text-kosha-navy block mt-0.5">{t("step1")}</span>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-white/90 shadow-xs text-left">
                <span className="text-[10px] font-semibold text-slate-400 block">Step 2</span>
                <span className="text-xs font-extrabold text-kosha-navy block mt-0.5">{t("step2")}</span>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-white/90 shadow-xs text-left">
                <span className="text-[10px] font-semibold text-slate-400 block">Step 3</span>
                <span className="text-xs font-extrabold text-kosha-navy block mt-0.5">{t("step3")}</span>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-white/90 shadow-xs text-left">
                <span className="text-[10px] font-semibold text-slate-400 block">Step 4</span>
                <span className="text-xs font-extrabold text-kosha-navy block mt-0.5">{t("step4")}</span>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-3 border border-white/90 shadow-xs text-left col-span-2 sm:col-span-1">
                <span className="text-[10px] font-semibold text-slate-400 block">Step 5</span>
                <span className="text-xs font-extrabold text-kosha-navy block mt-0.5">{t("step5")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Direct Entry Points */}
        <div className="lg:col-span-5">
          <div className="glass-panel rounded-4xl p-8 sm:p-10 shadow-glass-lg max-w-md mx-auto space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Hackathon Demo Sandbox</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-kosha-navy">Get started</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                No credentials required. Choose an entry path below.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-3 py-2 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>90-day rolling cash shortfall risk detection</span>
              </div>
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-kosha-blue shrink-0" />
                <span>What-if scenario stress-testing with live recalculation</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>MSMED Act Section 16 late payment interest intelligence</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleSampleDemo}
                className="w-full py-4 rounded-2xl bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <span>{t("trySampleBusiness")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={handleUploadData}
                className="w-full py-3.5 rounded-2xl bg-white/90 hover:bg-white border border-slate-200 text-kosha-navy text-sm font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4 text-kosha-blue" />
                <span>{t("uploadBusinessData")}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Notice: Sample businesses use synthetic MSME enterprise datasets for demonstration.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div />
    </div>
  );
};
