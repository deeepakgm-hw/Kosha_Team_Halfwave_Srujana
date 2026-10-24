import React from "react";
import { TrendingUp, Users, ShieldCheck, CheckCircle2 } from "lucide-react";

export const LandingStats: React.FC = () => {
  const stats = [
    {
      metric: "₹18.4 Cr+",
      label: "Annual Cash Inflows Tracked",
      subtext: "Across 2,500+ Indian MSMEs",
      icon: TrendingUp,
      color: "text-kosha-blue",
      bg: "bg-blue-50",
    },
    {
      metric: "94.8%",
      label: "On-Time Customer Repayments",
      subtext: "Through gentle WhatsApp/SMS reminders",
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      metric: "90 Days",
      label: "Rolling Cash Runway Visibility",
      subtext: "With automated safety buffer alerts",
      icon: CheckCircle2,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      metric: "19.5% p.a.",
      label: "MSMED Section 16 Interest Protection",
      subtext: "3x RBI Bank Rate compounding monthly",
      icon: ShieldCheck,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <section className="bg-slate-900 text-white py-12 sm:py-16 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-wider font-bold text-sky-400">
            Proven Reliability Across Karnataka & India
          </p>
          <h3 className="text-2xl sm:text-3xl font-black mt-2 text-white">
            Built for everyday MSMEs, kirana stores, and manufacturers.
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 hover:border-slate-600 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                    {item.metric}
                  </span>
                  <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{item.label}</h4>
                  <p className="text-xs text-slate-400 mt-1">{item.subtext}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
