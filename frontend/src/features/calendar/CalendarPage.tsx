import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, AlertCircle, Info, Filter } from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";
import { apiClient } from "../../lib/api";
import { CalendarResponse } from "../../types/cashflow";

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusinessId } = useBusiness();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);

  // Scheduled outflows across next 42-day (6-week) window
  const defaultPayments = [
    { date: "7 Nov", title: "TDS deposit (Section 194C / 194J)", category: "Statutory", amount: "₹0.3L", amountNum: 30000, notes: "Monthly withholding tax deposit due by 7th." },
    { date: "10 Nov", title: "Raw Material Ingot Delivery (Hindalco)", category: "Supplier payments", amount: "₹1.4L", amountNum: 140000, notes: "Agreed 30-day supplier credit settlement." },
    { date: "15 Nov", title: "PF contribution (EPFO)", category: "Statutory", amount: "₹0.4L", amountNum: 40000, notes: "Provident fund monthly remittance due by 15th." },
    { date: "15 Nov", title: "ESI contribution", category: "Statutory", amount: "₹0.1L", amountNum: 10000, notes: "Employee state insurance statutory dues." },
    { date: "20 Nov", title: "GST GSTR-3B monthly filing", category: "Statutory", amount: "₹0.9L", amountNum: 90000, notes: "Monthly outward supply GST cash ledger settlement." },
    { date: "25 Nov", title: "Industrial Packaging Material", category: "Supplier payments", amount: "₹0.45L", amountNum: 45000, notes: "Corrugated box vendor fortnightly batch." },
    { date: "1 Dec", title: "Workforce payroll (Salaries)", category: "Payroll", amount: "₹3.2L", amountNum: 320000, notes: "Direct bank transfer to workforce accounts." },
    { date: "5 Dec", title: "Machinery Term Loan EMI", category: "Loan repayments", amount: "₹0.6L", amountNum: 60000, notes: "Auto-debit from primary current account." },
    { date: "10 Dec", title: "Factory Shed Lease Rent", category: "Other recurring expenses", amount: "₹0.65L", amountNum: 65000, notes: "Monthly MIDC industrial shed lease." },
    { date: "12 Dec", title: "State Electricity Board (MSEDCL)", category: "Other recurring expenses", amount: "₹0.35L", amountNum: 35000, notes: "High-tension 3-phase factory power billing." },
    { date: "15 Dec", title: "Advance income tax installment", category: "Statutory", amount: "₹1.2L", amountNum: 120000, notes: "Q3 advance tax (75% cumulative threshold)." },
  ];

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getCalendarOutflows(activeBusinessId || "apex_precision_mfg", 42)
      .then((res) => {
        if (isMounted && res && res.scheduled_payments && res.scheduled_payments.length > 0) {
          setCalendarData(res);
        }
      })
      .catch(() => {
        // Fallback to default presets
      });

    return () => {
      isMounted = false;
    };
  }, [activeBusinessId]);

  const scheduledPayments = calendarData?.scheduled_payments
    ? calendarData.scheduled_payments.map((p) => ({
        date: p.formatted_date || p.date,
        title: p.title,
        category: p.category,
        amount: p.amount,
        amountNum: p.amount_num,
        notes: p.notes,
      }))
    : defaultPayments;

  const categories = [
    "All",
    "Statutory",
    "Payroll",
    "Loan repayments",
    "Supplier payments",
    "Other recurring expenses",
  ];

  const filteredPayments =
    selectedCategory === "All"
      ? scheduledPayments
      : scheduledPayments.filter((p) => p.category === selectedCategory);

  const totalStatutory = calendarData?.category_totals?.["Statutory"]
    ?? scheduledPayments
      .filter((p) => p.category === "Statutory")
      .reduce((sum, p) => sum + p.amountNum, 0);


  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col justify-between py-2">
      {/* 2 Main Glass Cards Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Card: Scheduled Outflows */}
        <div className="lg:col-span-8 glass-panel rounded-4xl p-7 sm:p-9 flex flex-col justify-between shadow-glass-lg">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue">
                Supporting Tool
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Cash calendar · Committed Disbursements
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-kosha-navy">
              Upcoming cash outflows
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Every committed disbursement across the upcoming 42-day (6-week) window is scheduled into your cash forecast without duplicate debit counting.
            </p>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-kosha-blue text-white shadow-xs"
                      : "bg-white/60 hover:bg-white text-slate-600 border border-slate-200/60"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Schedule List */}
            <div className="mt-6 divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-1">
              {filteredPayments.map((item, idx) => (
                <div
                  key={idx}
                  className="py-3.5 flex items-center justify-between text-sm hover:bg-white/40 px-2 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="w-18 sm:w-20 text-center py-1 rounded-full text-xs font-bold bg-blue-50/80 text-kosha-blue shrink-0">
                      {item.date}
                    </span>
                    <div>
                      <span className="font-bold text-kosha-navy block text-xs sm:text-sm">{item.title}</span>
                      <span className="text-[10px] text-slate-400 hidden sm:block">{item.notes}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-8 shrink-0">
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                      {item.category}
                    </span>
                    <span className="font-extrabold text-kosha-navy min-w-[60px] text-right">
                      {item.amount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Anti-Duplication Guard: Past settled bank debits are never re-projected from recurring calendar templates.</span>
          </div>
        </div>

        {/* Right Card: Fixed by law summary */}
        <div className="lg:col-span-4 glass-panel rounded-4xl p-7 sm:p-8 flex flex-col justify-between shadow-glass-lg">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Statutory Mandates</span>
            </div>
            <div className="text-4xl sm:text-5xl font-black text-kosha-navy mt-3 tracking-tight">
              ₹{(totalStatutory / 100000).toFixed(1)}L
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-4 leading-relaxed font-medium">
              Fixed by law (GST, TDS, PF, ESI, Advance Tax). Added to your forecast automatically, so none of these arrive as an unexpected liquidity shock.
            </p>

            <div className="mt-6 p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-2xl space-y-1.5 text-[11px] text-amber-900">
              <div className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Statutory Schedule Compliance</span>
              </div>
              <p className="leading-relaxed">
                TDS: 7th · PF/ESI: 15th · GST GSTR-3B: 20th · Advance Tax: 15 Dec. Dates follow standard Indian tax calendars.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-8 leading-relaxed">
            Due dates and limits are configurable estimates with the date they were checked. Please confirm with your Chartered Accountant.
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between mt-6 px-2">
        <span className="text-xs text-slate-400 font-medium">Outflows modeled into 90-day simulation</span>

        <button
          onClick={() => navigate("/understand-cash-flow")}
          className="px-8 py-3 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
          Back to Forecast
        </button>
      </div>
    </div>
  );
};
