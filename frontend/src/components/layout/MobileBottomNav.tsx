import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  QrCode,
  Receipt,
  Clock,
  User,
  ArrowDownLeft,
  SlidersHorizontal,
  TrendingUp,
  X,
  CalendarDays,
  FileText,
  UploadCloud,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

interface MobileTabItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  isHero?: boolean;
  isAction?: boolean;
}

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isBusinessOwner = user?.role === "business_owner";
  const [showMoreDrawer, setShowMoreDrawer] = useState<boolean>(false);

  const customerTabs: MobileTabItem[] = [
    { name: "Home", path: "/customer/dashboard", icon: Home },
    { name: "Scan & Pay", path: "/customer/pay", icon: QrCode, isHero: true },
    { name: "Dues", path: "/customer/dues", icon: Receipt },
    { name: "Activity", path: "/customer/activity", icon: Clock },
    { name: "Profile", path: "/customer/profile", icon: User },
  ];

  const businessTabs: MobileTabItem[] = [
    { name: "Home", path: "/overview", icon: Home },
    { name: "Receive", path: "/payments", icon: ArrowDownLeft, isHero: true },
    { name: "Business QR", path: "/shop-credit?tab=qr", icon: QrCode },
    { name: "Transactions", path: "/shop-credit?tab=transactions", icon: Clock },
    { name: "Tools", path: "#more", icon: SlidersHorizontal, isAction: true },
  ];

  const tabs = isBusinessOwner ? businessTabs : customerTabs;

  const isTabActive = (itemPath: string) => {
    if (itemPath === "#more") return showMoreDrawer;
    if (itemPath.includes("?")) {
      return `${location.pathname}${location.search}` === itemPath;
    }
    return location.pathname === itemPath;
  };

  const handleSignOut = async () => {
    setShowMoreDrawer(false);
    await logout();
    navigate(isBusinessOwner ? "/login?role=business" : "/login?role=customer");
  };

  return (
    <>
      {/* Fixed Bottom Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab.path);

            if (tab.isHero) {
              return (
                <button
                  key={tab.name}
                  onClick={() => navigate(tab.path)}
                  className="flex flex-col items-center justify-center -mt-5 relative group focus:outline-hidden cursor-pointer"
                  aria-label={tab.name}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 ring-4 ring-white group-active:scale-95 transition-all">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 mt-1">{tab.name}</span>
                </button>
              );
            }

            if (tab.isAction) {
              return (
                <button
                  key={tab.name}
                  onClick={() => setShowMoreDrawer(true)}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors focus:outline-hidden cursor-pointer",
                    active ? "text-emerald-700" : "text-slate-500 hover:text-slate-800"
                  )}
                  aria-label="More Features"
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-semibold tracking-tight">{tab.name}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors focus:outline-hidden cursor-pointer",
                  active ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-800 font-medium"
                )}
                aria-label={tab.name}
              >
                <Icon className={cn("w-5 h-5 mb-0.5", active && "text-emerald-600")} />
                <span className="text-[10px] tracking-tight">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Financial Tools Mobile Drawer (Business Owners) */}
      {showMoreDrawer && isBusinessOwner && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto p-5 space-y-4 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-300 pb-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Financial Tools &amp; Treasury</h3>
                <p className="text-xs text-slate-500">Forecasting, MSMED Law, &amp; Analytics</p>
              </div>
              <button
                onClick={() => setShowMoreDrawer(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  navigate("/understand-cash-flow");
                  setShowMoreDrawer(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all cursor-pointer"
              >
                <TrendingUp className="w-5 h-5 text-emerald-600 mb-1.5" />
                <span className="block text-xs font-bold text-slate-900">Cash Flow Forecast</span>
                <span className="block text-[10px] text-slate-500">90-Day Simulation</span>
              </button>

              <button
                onClick={() => {
                  navigate("/receivables");
                  setShowMoreDrawer(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all cursor-pointer"
              >
                <FileText className="w-5 h-5 text-emerald-600 mb-1.5" />
                <span className="block text-xs font-bold text-slate-900">MSMED Receivables</span>
                <span className="block text-[10px] text-slate-500">Late Interest Law</span>
              </button>

              <button
                onClick={() => {
                  navigate("/calendar");
                  setShowMoreDrawer(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all cursor-pointer"
              >
                <CalendarDays className="w-5 h-5 text-emerald-600 mb-1.5" />
                <span className="block text-xs font-bold text-slate-900">Cash Calendar</span>
                <span className="block text-[10px] text-slate-500">42-Day Outflows</span>
              </button>

              <button
                onClick={() => {
                  navigate("/test-scenarios");
                  setShowMoreDrawer(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-5 h-5 text-emerald-600 mb-1.5" />
                <span className="block text-xs font-bold text-slate-900">Scenarios &amp; Plan</span>
                <span className="block text-[10px] text-slate-500">Action Simulator</span>
              </button>

              <button
                onClick={() => {
                  navigate("/load");
                  setShowMoreDrawer(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all cursor-pointer"
              >
                <UploadCloud className="w-5 h-5 text-emerald-600 mb-1.5" />
                <span className="block text-xs font-bold text-slate-900">Import Data</span>
                <span className="block text-[10px] text-slate-500">CSV &amp; Bank Books</span>
              </button>

              <button
                onClick={() => {
                  navigate("/reliability");
                  setShowMoreDrawer(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-all cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1.5" />
                <span className="block text-xs font-bold text-slate-900">Model Reliability</span>
                <span className="block text-[10px] text-slate-500">Trust Metrics</span>
              </button>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full mt-2 py-3 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out from KOSHA</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
