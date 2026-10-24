import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Store, Sparkles, Phone, Mail, ArrowRight, HelpCircle } from "lucide-react";

export const CustomerProfilePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-kosha-navy tracking-tight flex items-center gap-2">
          <User className="w-7 h-7 text-kosha-blue" />
          <span>Customer Profile</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
          Member account settings and simulated identity details.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/90 shadow-glass-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-kosha-blue to-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
            RS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">Rahul Sharma</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Synthetic Demo Member</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Customer Identifier: cust_rahul_01</p>
          </div>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>Registered Phone</span>
            </span>
            <span className="font-mono font-bold text-slate-800">+91 98765 43210</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Email</span>
            </span>
            <span className="font-mono font-bold text-slate-800">rahul.sharma@example.in</span>
          </div>
        </div>

        {/* Switch Experience Option */}
        <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kosha-blue text-white flex items-center justify-center font-bold shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900">Are you a shopkeeper?</p>
              <p className="text-[11px] text-slate-500">Access the full 5-step treasury forecast and cash-flow engine.</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/load")}
            className="px-4 py-2 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>Open Business View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Responsible Finance Disclaimer */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px]">
            KOSHA is a predictive planning aid and mutual shop-credit ledger developed for Srujana Tech Fest 2026. It is not a licensed banking entity or lending institution.
          </p>
        </div>
      </div>
    </div>
  );
};
