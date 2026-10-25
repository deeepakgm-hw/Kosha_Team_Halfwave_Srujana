import React from "react";
import { Link } from "react-router-dom";
import { KoshaLogo } from "../../components/ui/KoshaLogo";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export const LandingFooter: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <footer className="bg-white text-[#545D68] text-xs pt-16 pb-12 border-t border-[#E1E7EC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Main Columns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Col 1: Brand & Tagline (2 cols on md) */}
          <div className="col-span-2 space-y-4">
            <Link to="/" className="inline-block">
              <KoshaLogo size="md" showWordmark={true} />
            </Link>
            <p className="text-sm text-[#545D68] font-medium max-w-sm leading-relaxed">
              KOSHA — “Know your treasury before it runs dry.” An intelligent financial runway and in-store credit checkout platform built for Indian small businesses.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#0070E0] font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>MSMED Act 2006 Statutory Compliance Ready</span>
            </div>
          </div>

          {/* Col 2: Solutions */}
          <div className="space-y-3">
            <h4 className="text-[#001C64] font-bold text-xs uppercase tracking-wider">Solutions</h4>
            <ul className="space-y-2 text-[#545D68]">
              <li>
                <a href="#predictive-runway" className="hover:text-[#0070E0] transition-colors">
                  90-Day Cash Runway
                </a>
              </li>
              <li>
                <a href="#shop-credit" className="hover:text-[#0070E0] transition-colors">
                  Counter QR Credit
                </a>
              </li>
              <li>
                <a href="#msmed-protection" className="hover:text-[#0070E0] transition-colors">
                  MSMED Section 16 Engine
                </a>
              </li>
              <li>
                <Link to="/calendar" className="hover:text-[#0070E0] transition-colors">
                  Cash Flow Calendar
                </Link>
              </li>
              <li>
                <Link to="/test-scenarios" className="hover:text-[#0070E0] transition-colors">
                  What-If Shock Simulator
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals */}
          <div className="space-y-3">
            <h4 className="text-[#001C64] font-bold text-xs uppercase tracking-wider">Portals</h4>
            <ul className="space-y-2 text-[#545D68]">
              <li>
                <Link to="/load" className="hover:text-[#0070E0] transition-colors">
                  Merchant Portal
                </Link>
              </li>
              <li>
                <Link to="/customer/dashboard" className="hover:text-[#0070E0] transition-colors">
                  Customer Member Portal
                </Link>
              </li>
              <li>
                <Link to="/shop-credit" className="hover:text-[#0070E0] transition-colors">
                  Shopkeeper QR Terminal
                </Link>
              </li>
              <li>
                <Link to="/payments" className="hover:text-[#0070E0] transition-colors">
                  UPI Payments &amp; Invoicing
                </Link>
              </li>
              <li>
                <Link to="/receivables" className="hover:text-[#0070E0] transition-colors">
                  Receivables Tracker
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Security & Compliance */}
          <div className="space-y-3">
            <h4 className="text-[#001C64] font-bold text-xs uppercase tracking-wider">Security &amp; Trust</h4>
            <ul className="space-y-2 text-[#545D68]">
              <li className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#0070E0]" />
                <span className="text-[#001C64] font-semibold">256-Bit Bank Encryption</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Real-Time Webhook Audit</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Multi-Tenant DB Isolation</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Multi-Lingual (EN, HI, KN)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>High-Availability Cloud SLA</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E1E7EC] text-[11px] text-[#545D68] leading-relaxed space-y-2">
          <p>
            <strong className="text-[#001C64]">Regulatory &amp; Platform Notice:</strong> KOSHA is an enterprise financial treasury, predictive cash-flow intelligence, and customer credit ledger platform for MSMEs. This platform operates as an analytical planning and billing aid and does not engage in unlicenced deposit taking.
          </p>
          <p>
            Late-payment calculations and penal interest metrics follow statutory provisions under Section 15 and Section 16 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, and Section 43B(h) of the Income Tax Act, 1961.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[#E1E7EC] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-[#545D68]">© {new Date().getFullYear()} KOSHA Treasury Technologies. All rights reserved.</span>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[#545D68]">Language:</span>
            <div className="flex items-center gap-1 bg-[#F5F7FA] p-0.5 rounded-full border border-[#E1E7EC]">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                  language === "EN" ? "bg-white text-[#001C64] shadow-xs font-bold" : "text-[#545D68] hover:text-[#0C0C0D]"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                  language === "HI" ? "bg-white text-[#001C64] shadow-xs font-bold" : "text-[#545D68] hover:text-[#0C0C0D]"
                }`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                  language === "KN" ? "bg-white text-[#001C64] shadow-xs font-bold" : "text-[#545D68] hover:text-[#0C0C0D]"
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
