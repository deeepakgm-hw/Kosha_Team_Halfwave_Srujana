import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  QrCode,
  CreditCard,
  Receipt,
  Clock,
  ArrowDownLeft,
  ShieldCheck,
  TrendingUp,
  CalendarDays,
  SlidersHorizontal,
  FileText,
  UploadCloud,
  LogOut,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";
import { KoshaLogo } from "../ui/KoshaLogo";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

interface UnifiedSidebarProps {
  onCloseMobile?: () => void;
}

export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({ onCloseMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isBusinessOwner = user?.role === "business_owner";

  const handleSignOut = async () => {
    await logout();
    sessionStorage.clear();
    navigate(isBusinessOwner ? "/login?role=business" : "/login?role=customer");
    if (onCloseMobile) onCloseMobile();
  };

  // Section 1: PAYMENTS (Level 1 - Core UPI & Payment Features)
  const paymentNavItems = isBusinessOwner
    ? [
        {
          name: "Payment Overview",
          path: "/overview",
          aliases: ["/", "/payments-overview"],
          icon: LayoutDashboard,
          badge: "Live",
        },
        {
          name: "Receive Money",
          path: "/payments",
          aliases: ["/upi-payments", "/razorpay"],
          icon: ArrowDownLeft,
          badge: "UPI QR",
        },
        {
          name: "My Business QR",
          path: "/shop-credit?tab=qr",
          aliases: [],
          icon: QrCode,
        },
        {
          name: "Bills & Invoices",
          path: "/payments?tab=bills",
          aliases: [],
          icon: Receipt,
        },
        {
          name: "Transactions",
          path: "/shop-credit?tab=transactions",
          aliases: [],
          icon: Clock,
        },
      ]
    : [
        {
          name: "Payment Home",
          path: "/customer/dashboard",
          aliases: ["/customer"],
          icon: LayoutDashboard,
        },
        {
          name: "Scan & Pay",
          path: "/customer/pay",
          aliases: [],
          icon: QrCode,
          badge: "Instant",
        },
        {
          name: "Pay Bills",
          path: "/customer/dues",
          aliases: [],
          icon: Receipt,
        },
        {
          name: "Payment History",
          path: "/customer/activity",
          aliases: [],
          icon: Clock,
        },
      ];

  // Section 2: CREDIT & AUTOPAY (Level 2 - Credit & Repayment Features)
  const creditNavItems = isBusinessOwner
    ? [
        {
          name: "Customer Credit & Dues",
          path: "/shop-credit",
          aliases: ["/shopkeeper", "/shopkeeper-credit"],
          icon: CreditCard,
        },
        {
          name: "AutoPay & Smart Dues",
          path: "/shop-credit?tab=autopay_smart_dues",
          aliases: [],
          icon: ShieldCheck,
          badge: "NPCI",
        },
        {
          name: "Customer Disputes",
          path: "/shop-credit?tab=disputes",
          aliases: [],
          icon: AlertCircle,
        },
        {
          name: "Repayment Ledger",
          path: "/shop-credit?tab=credit_ledger",
          aliases: [],
          icon: Receipt,
        },
      ]
    : [
        {
          name: "My Outstanding Dues",
          path: "/customer/dues",
          aliases: ["/customer/repayments"],
          icon: CreditCard,
        },
        {
          name: "AutoPay Mandates",
          path: "/customer/dues?tab=autopay",
          aliases: [],
          icon: ShieldCheck,
          badge: "Smart",
        },
        {
          name: "KOSHA TrustScore",
          path: "/customer/trustscore",
          aliases: [],
          icon: ShieldCheck,
          badge: "Score",
        },
      ];

  // Section 3: FINANCIAL TOOLS (Level 3 - Business Analytics & Forecasting)
  const financialToolsNavItems = isBusinessOwner
    ? [
        {
          name: "Cash Flow Forecast",
          path: "/understand-cash-flow",
          aliases: ["/forecast", "/know"],
          icon: TrendingUp,
          desc: "90-Day Simulation",
        },
        {
          name: "MSMED Receivables",
          path: "/receivables",
          aliases: [],
          icon: FileText,
          desc: "Sec 15-16 Late Interest",
        },
        {
          name: "Cash Calendar",
          path: "/calendar",
          aliases: ["/cash-calendar"],
          icon: CalendarDays,
          desc: "42-Day Outflow Schedule",
        },
        {
          name: "Scenarios & Plan",
          path: "/test-scenarios",
          aliases: ["/scenarios", "/simulate", "/action-plan", "/plan"],
          icon: SlidersHorizontal,
          desc: "Corrective Actions",
        },
        {
          name: "Import Financial Data",
          path: "/load",
          aliases: [],
          icon: UploadCloud,
          desc: "Bank & CSV Ledger",
        },
        {
          name: "Model Confidence",
          path: "/reliability",
          aliases: ["/trust", "/forecast-reliability"],
          icon: ShieldCheck,
          desc: "Backtesting Trust",
        },
      ]
    : [];

  const isItemActive = (itemPath: string, aliases: string[] = []) => {
    const current = location.pathname;
    const currentSearch = location.search;
    
    // Check path with query params if specified
    if (itemPath.includes("?")) {
      return `${current}${currentSearch}` === itemPath;
    }
    
    if (current === itemPath) return true;
    return aliases.some((alias) => current === alias || current.startsWith(alias + "/"));
  };

  return (
    <aside className="w-68 bg-white border-r border-slate-200/90 flex flex-col shrink-0 min-h-screen select-none font-sans shadow-xs">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <button
          onClick={() => navigate(isBusinessOwner ? "/overview" : "/customer/dashboard")}
          className="flex items-center gap-2.5 focus:outline-hidden group cursor-pointer text-left"
          aria-label="KOSHA Home"
        >
          <KoshaLogo size="sm" showWordmark={true} />
        </button>
        <span
          className={cn(
            "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wide",
            isBusinessOwner
              ? "bg-[#001C64]/10 text-[#001C64] border-[#001C64]/20"
              : "bg-[#0070E0]/10 text-[#0070E0] border-[#0070E0]/20"
          )}
        >
          {isBusinessOwner ? "Merchant" : "Customer"}
        </span>
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {/* Section 1: PAYMENTS */}
        <div>
          <div className="px-2.5 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Payments
            </span>
            <span className="text-[10px] font-bold text-[#0070E0] bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full">
              UPI-First
            </span>
          </div>
          <nav className="space-y-1">
            {paymentNavItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.path, item.aliases);
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.path);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left",
                    active
                      ? "bg-[#0070E0] text-white shadow-sm shadow-blue-500/25 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-slate-500")} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                        active ? "bg-white/20 text-white" : "bg-blue-50 text-[#0070E0] border border-blue-200"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section 2: CREDIT & AUTOPAY */}
        <div>
          <div className="px-2.5 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Credit &amp; AutoPay
            </span>
          </div>
          <nav className="space-y-1">
            {creditNavItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.path, item.aliases);
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.path);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left",
                    active
                      ? "bg-[#0070E0] text-white shadow-sm shadow-blue-500/25 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-slate-500")} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section 3: FINANCIAL TOOLS (Only for Business Owners) */}
        {isBusinessOwner && financialToolsNavItems.length > 0 && (
          <div>
            <div className="px-2.5 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Treasury &amp; Analytics
              </span>
              <span className="text-[9px] font-semibold text-slate-500">Tier 1</span>
            </div>
            <nav className="space-y-1">
              {financialToolsNavItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.path, item.aliases);
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.path);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left group",
                      active
                        ? "bg-slate-900 text-white shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-blue-400" : "text-slate-400 group-hover:text-slate-700")} />
                      <div className="min-w-0">
                        <span className="block truncate text-xs">{item.name}</span>
                        {item.desc && (
                          <span className={cn("block text-[10px] truncate leading-tight", active ? "text-slate-300" : "text-slate-400")}>
                            {item.desc}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Section 4: ACCOUNT & USER PROFILE FOOTER */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0070E0] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
                {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold text-slate-900 truncate">
                  {user?.full_name || user?.email?.split("@")[0] || "Authenticated"}
                </span>
                <span className="block text-[10px] text-slate-500 truncate font-mono">
                  {user?.phone || user?.email || (isBusinessOwner ? "Merchant Account" : "Customer Account")}
                </span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
