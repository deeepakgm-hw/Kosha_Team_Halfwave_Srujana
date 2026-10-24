import React from "react";
import { NavLink } from "react-router-dom";
import {
  TrendingUp,
  LineChart,
  SlidersHorizontal,
  Zap,
  Receipt,
  CalendarDays,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  name: string;
  sublabel: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    name: "Know",
    sublabel: "Treasury Overview",
    path: "/",
    icon: TrendingUp,
  },
  {
    name: "Forecast",
    sublabel: "90-Day Simulation",
    path: "/forecast",
    icon: LineChart,
  },
  {
    name: "Decide",
    sublabel: "Scenario Simulator",
    path: "/scenarios",
    icon: SlidersHorizontal,
  },
  {
    name: "Act",
    sublabel: "Corrective Actions",
    path: "/actions",
    icon: Zap,
  },
  {
    name: "Receivables",
    sublabel: "Invoices & MSMED",
    path: "/receivables",
    icon: Receipt,
  },
  {
    name: "Calendar",
    sublabel: "Tax & Cash Dues",
    path: "/calendar",
    icon: CalendarDays,
  },
  {
    name: "Trust",
    sublabel: "Forecast Validation",
    path: "/trust",
    icon: ShieldCheck,
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-white leading-none">KOSHA</h1>
            <p className="text-[11px] text-slate-400 mt-1 leading-tight">Predictive Cash Treasury</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Treasury
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <div className="flex flex-col">
                <span className="leading-tight">{item.name}</span>
                <span className="text-[11px] text-slate-400 font-normal leading-tight">
                  {item.sublabel}
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Tagline */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/40">
        <p className="italic font-light text-slate-400 text-center">
          "Know your treasury before it runs dry."
        </p>
        <div className="mt-2 text-center text-[10px] text-slate-500">
          Srujana Tech Fest 2026 • Phase 1
        </div>
      </div>
    </aside>
  );
};
