import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { KoshaLogo } from "../ui/KoshaLogo";
import { useAuth } from "../../context/AuthContext";
import { useRealTimeSync } from "../../hooks/useRealTimeSync";

export const PaymentPortalLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const isBusinessOwner = user?.role === "business_owner";

  // Global Real-time Server-Sent Events sync
  const { isRealTime } = useRealTimeSync();

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans antialiased">
      {/* 1. Desktop Unified Sidebar (Visible on md+) */}
      <div className="hidden md:flex shrink-0 sticky top-0 h-screen z-30">
        <UnifiedSidebar />
      </div>

      {/* 2. Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-10">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <UnifiedSidebar onCloseMobile={() => setMobileDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* 3. Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Top Header (Hidden on md+) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate(isBusinessOwner ? "/overview" : "/customer/dashboard")}
              className="focus:outline-hidden text-left"
            >
              <KoshaLogo size="sm" showWordmark={true} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isRealTime && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-200">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-6xl mx-auto w-full pb-24 md:pb-12">
          <Outlet />
        </main>

        {/* 4. Mobile Bottom Navigation (Hidden on md+) */}
        <MobileBottomNav />
      </div>
    </div>
  );
};
