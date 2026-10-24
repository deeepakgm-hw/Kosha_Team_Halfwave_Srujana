import React from "react";
import { Link } from "react-router-dom";
import { KoshaLogo } from "../../components/ui/KoshaLogo";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export const LandingFooter: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <footer className="bg-slate-950 text-slate-400 text-xs pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Main Columns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Col 1: Brand & Tagline (2 cols on md) */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="inline-block">
              <KoshaLogo size="md" showWordmark={true} />
            </Link>
            <p className="text-sm text-slate-400 font-medium max-w-sm leading-relaxed">
              KOSHA — “Know your treasury before it runs dry.” An intelligent financial runway and in-store credit checkout platform built for Indian small businesses.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>MSMED Act 2006 Statutory Compliance Ready</span>
            </div>
          </div>

          {/* Col 2: Solutions */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Solutions</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <a href="#predictive-runway" className="hover:text-white transition-colors">
                  90-Day Cash Runway
                </a>
              </li>
              <li>
                <a href="#shop-credit" className="hover:text-white transition-colors">
                  Counter QR Credit
                </a>
              </li>
              <li>
                <a href="#msmed-protection" className="hover:text-white transition-colors">
                  MSMED Section 16 Engine
                </a>
              </li>
              <li>
                <Link to="/calendar" className="hover:text-white transition-colors">
                  Cash Flow Calendar
                </Link>
              </li>
              <li>
                <Link to="/test-scenarios" className="hover:text-white transition-colors">
                  What-If Shock Simulator
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Portals</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link to="/load" className="hover:text-white transition-colors">
                  Business Owner Dashboard
                </Link>
              </li>
              <li>
                <Link to="/customer/dashboard" className="hover:text-white transition-colors">
                  Customer Member Portal
                </Link>
              </li>
              <li>
                <Link to="/shop-credit" className="hover:text-white transition-colors">
                  Shopkeeper QR Terminal
                </Link>
              </li>
              <li>
                <Link to="/welcome" className="hover:text-white transition-colors">
                  Interactive Demo Mode
                </Link>
              </li>
              <li>
                <Link to="/receivables" className="hover:text-white transition-colors">
                  Receivables Tracker
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Hackathon & Team */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">Team Halfwave</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <span className="text-slate-300 font-medium">Srujana Tech Fest 2026</span>
              </li>
              <li>
                <span>Finance & Fintech Category</span>
              </li>
              <li>
                <span>FastAPI + React 18 Architecture</span>
              </li>
              <li>
                <span>Multi-lingual (EN, HI, KN)</span>
              </li>
              <li>
                <span>Open Source Demo</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-500 leading-relaxed space-y-2">
          <p>
            <strong>Regulatory & Platform Notice:</strong> KOSHA is a financial planning, cash-flow forecasting, and credit management facilitation technology developed by Team Halfwave for Srujana Tech Fest 2026. This platform does not operate as a licensed deposit-taking bank or non-banking financial company (NBFC).
          </p>
          <p>
            Late-payment calculations and penal interest metrics follow statutory provisions under Section 15 and Section 16 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, and Section 43B(h) of the Income Tax Act, 1961.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <span>© 2026 KOSHA · Team Halfwave. All rights reserved.</span>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Language:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-md border border-slate-800">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  language === "EN" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  language === "HI" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  language === "KN" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                ಕನ್ನಡ
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
