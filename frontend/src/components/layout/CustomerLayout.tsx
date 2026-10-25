import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Receipt,
  QrCode,
  Clock,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { KoshaLogo } from "../ui/KoshaLogo";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

export const CustomerLayout: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login?role=customer");
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-[#F5F7FA] text-[#0C0C0D] pb-20 sm:pb-8 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E1E7EC] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand & Authenticated Member Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/customer/dashboard")}
              className="flex items-center gap-2 focus:outline-none cursor-pointer"
              aria-label="KOSHA Customer Home"
            >
              <KoshaLogo size="sm" showWordmark={true} />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50/80 text-[#003087] border border-blue-200/80 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0070E0]" />
              <span>{user?.full_name || user?.email || "Customer"}</span>
              <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded-full bg-[#0070E0] text-white">
                Verified
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold p-1 bg-[#F5F7FA] rounded-full border border-[#E1E7EC]">
            <NavLink
              to="/customer/dashboard"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full transition-all ${
                  isActive
                    ? "bg-[#0070E0] text-white shadow-xs font-bold"
                    : "text-[#545D68] hover:text-[#001C64] hover:bg-white"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/customer/dues"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full transition-all ${
                  isActive
                    ? "bg-[#0070E0] text-white shadow-xs font-bold"
                    : "text-[#545D68] hover:text-[#001C64] hover:bg-white"
                }`
              }
            >
              My Dues
            </NavLink>
            <NavLink
              to="/customer/pay"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full transition-all ${
                  isActive
                    ? "bg-[#0070E0] text-white shadow-xs font-bold"
                    : "text-[#545D68] hover:text-[#001C64] hover:bg-white"
                }`
              }
            >
              Scan & Pay
            </NavLink>
            <NavLink
              to="/customer/activity"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full transition-all ${
                  isActive
                    ? "bg-[#0070E0] text-white shadow-xs font-bold"
                    : "text-[#545D68] hover:text-[#001C64] hover:bg-white"
                }`
              }
            >
              Activity
            </NavLink>
          </nav>

          {/* Right Action Switchers & Logout */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center p-0.5 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] text-[11px] font-semibold">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  language === "EN"
                    ? "bg-[#003087] text-white font-bold"
                    : "text-[#545D68] hover:text-[#001C64]"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  language === "HI"
                    ? "bg-[#003087] text-white font-bold"
                    : "text-[#545D68] hover:text-[#001C64]"
                }`}
              >
                हि
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  language === "KN"
                    ? "bg-[#003087] text-white font-bold"
                    : "text-[#545D68] hover:text-[#001C64]"
                }`}
              >
                ಕ
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E1E7EC] px-3 py-2 shadow-lg flex items-center justify-around">
        <NavLink
          to="/customer/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-3 rounded-full text-[11px] font-bold ${
              isActive ? "text-[#0070E0]" : "text-[#545D68]"
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/customer/dues"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-3 rounded-full text-[11px] font-bold ${
              isActive ? "text-[#0070E0]" : "text-[#545D68]"
            }`
          }
        >
          <Receipt className="w-5 h-5" />
          <span>Dues</span>
        </NavLink>
        <NavLink
          to="/customer/pay"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-3 rounded-full text-[11px] font-bold ${
              isActive ? "text-[#0070E0]" : "text-[#545D68]"
            }`
          }
        >
          <QrCode className="w-5 h-5" />
          <span>Pay</span>
        </NavLink>
        <NavLink
          to="/customer/activity"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-3 rounded-full text-[11px] font-bold ${
              isActive ? "text-[#0070E0]" : "text-[#545D68]"
            }`
          }
        >
          <Clock className="w-5 h-5" />
          <span>Activity</span>
        </NavLink>
      </nav>
    </div>
  );
};
