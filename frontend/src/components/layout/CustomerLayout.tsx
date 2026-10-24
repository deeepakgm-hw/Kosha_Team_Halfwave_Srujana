import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Receipt,
  QrCode,
  Clock,
  User,
  Store,
} from "lucide-react";
import { KoshaLogo } from "../ui/KoshaLogo";
import { useLanguage } from "../../context/LanguageContext";

export const CustomerLayout: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-gradient-to-br from-slate-50 via-sky-50/30 to-emerald-50/20 text-slate-800 pb-20 sm:pb-8">
      {/* Ambient background glow orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-emerald-200/30 blur-[100px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-sky-200/40 blur-[120px] pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand & Member Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/customer/dashboard")}
              className="flex items-center gap-2 focus:outline-none"
              aria-label="KOSHA Customer Home"
            >
              <KoshaLogo size="sm" showWordmark={true} />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Rahul Sharma (Demo)</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <NavLink
              to="/customer/dashboard"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-kosha-blue text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-kosha-navy hover:bg-slate-100/60"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/customer/dues"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-kosha-blue text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-kosha-navy hover:bg-slate-100/60"
                }`
              }
            >
              My Dues
            </NavLink>
            <NavLink
              to="/customer/pay"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-kosha-blue text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-kosha-navy hover:bg-slate-100/60"
                }`
              }
            >
              Scan & Pay
            </NavLink>
            <NavLink
              to="/customer/activity"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? "bg-kosha-blue text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-kosha-navy hover:bg-slate-100/60"
                }`
              }
            >
              Activity
            </NavLink>
          </nav>

          {/* Right Action Switchers */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center p-0.5 rounded-full bg-slate-100/80 border border-slate-200/80 text-[11px] font-semibold">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  language === "EN"
                    ? "bg-kosha-blue text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  language === "HI"
                    ? "bg-kosha-blue text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                हि
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-2 py-0.5 rounded-full transition-all ${
                  language === "KN"
                    ? "bg-kosha-blue text-white font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ಕ
              </button>
            </div>

            {/* Switch to Business Dashboard */}
            <button
              onClick={() => navigate("/load")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs hover:border-slate-300 transition-all"
              title="Switch to Business Treasury Dashboard"
            >
              <Store className="w-3.5 h-3.5 text-kosha-blue" />
              <span>Business View</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3 py-2 shadow-lg flex items-center justify-around">
        <NavLink
          to="/customer/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
              isActive ? "text-kosha-blue font-bold" : "text-slate-500 hover:text-slate-800"
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/customer/dues"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
              isActive ? "text-kosha-blue font-bold" : "text-slate-500 hover:text-slate-800"
            }`
          }
        >
          <Receipt className="w-5 h-5" />
          <span>My Dues</span>
        </NavLink>

        {/* Highlighted Center Scan & Pay Button */}
        <NavLink
          to="/customer/pay"
          className="flex flex-col items-center -mt-5"
          aria-label="Scan QR or Enter Shop Code"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 ring-4 ring-white transition-all">
            <QrCode className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-emerald-800 mt-1">Scan & Pay</span>
        </NavLink>

        <NavLink
          to="/customer/activity"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
              isActive ? "text-kosha-blue font-bold" : "text-slate-500 hover:text-slate-800"
            }`
          }
        >
          <Clock className="w-5 h-5" />
          <span>Activity</span>
        </NavLink>

        <NavLink
          to="/customer/profile"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
              isActive ? "text-kosha-blue font-bold" : "text-slate-500 hover:text-slate-800"
            }`
          }
        >
          <User className="w-5 h-5" />
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
};
