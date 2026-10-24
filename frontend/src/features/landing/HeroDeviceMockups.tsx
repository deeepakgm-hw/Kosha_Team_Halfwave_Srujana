import React from "react";
import {
  TrendingUp,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  Calendar,
  ArrowUpRight,
  Clock,
  Zap,
} from "lucide-react";

export const HeroDeviceMockups: React.FC = () => {
  return (
    <div className="relative w-full max-w-6xl mx-auto pt-6 pb-12 lg:pb-16 select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-blue-400/20 via-sky-300/20 to-emerald-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Composition Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left / Center: MacBook Laptop Displaying KOSHA 90-Day Treasury Forecast (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Laptop Screen Enclosure */}
          <div className="w-full max-w-xl bg-slate-900 rounded-t-2xl p-2.5 sm:p-3 shadow-2xl border-t border-x border-slate-700/80 ring-1 ring-slate-800">
            {/* Top Bar with webcam dot */}
            <div className="flex items-center justify-between pb-2 px-2 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-slate-800/90 text-[10px] text-slate-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>kosha.app/forecast · 90-Day Runway</span>
              </div>
              <div className="w-8" />
            </div>

            {/* Laptop Screen Content - KOSHA Dashboard Preview */}
            <div className="bg-slate-950 rounded-lg p-3 sm:p-4 text-white overflow-hidden space-y-3">
              {/* Header inside screen */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Apex Precision Engineering (MSME)
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-black text-white">₹2,48,500</span>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> Runway: 90 Days
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">Safety Buffer</div>
                    <div className="text-xs font-mono font-bold text-amber-400">₹50,000 min</div>
                  </div>
                </div>
              </div>

              {/* Trajectory Forecast Chart (SVG) */}
              <div className="relative bg-slate-900/80 rounded-xl p-3 border border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-kosha-blue" />
                    <span>Projected Liquidity Trajectory</span>
                  </span>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                    Dip in Wk 4 (₹42,000)
                  </span>
                </div>

                {/* SVG Line Chart */}
                <svg className="w-full h-28 sm:h-32 overflow-visible" viewBox="0 0 360 100" fill="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Safety Buffer Line (y = 70 corresponds to ₹50k) */}
                  <line x1="0" y1="70" x2="360" y2="70" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="310" y="66" fill="#f59e0b" fontSize="8" fontFamily="monospace">Buffer ₹50k</text>

                  {/* Chart Area Fill */}
                  <path
                    d="M 0 35 Q 40 20, 80 40 T 160 76 T 240 30 T 320 20 T 360 15 L 360 100 L 0 100 Z"
                    fill="url(#chartGradient)"
                  />

                  {/* Chart Main Path */}
                  <path
                    d="M 0 35 Q 40 20, 80 40 T 160 76 T 240 30 T 320 20 T 360 15"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Critical Dip Point */}
                  <circle cx="160" cy="76" r="4" fill="#f43f5e" className="animate-pulse" />
                  <circle cx="160" cy="76" r="8" stroke="#f43f5e" strokeWidth="1" opacity="0.4" />

                  {/* Recovery Point */}
                  <circle cx="360" cy="15" r="4" fill="#10b981" />
                </svg>

                {/* X-axis labels */}
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800">
                  <span>Today</span>
                  <span>Day 15</span>
                  <span className="text-rose-400 font-bold">Day 30 (Buffer Alert)</span>
                  <span>Day 60</span>
                  <span className="text-emerald-400 font-bold">Day 90</span>
                </div>
              </div>

              {/* Action Recommendation Banner */}
              <div className="bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-800/50 rounded-lg p-2 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <span className="text-slate-200 font-semibold">Recommended Fix #1: </span>
                    <span className="text-slate-400">Discount receivable from Metro Corp (+₹45,000)</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
                  Restores Buffer
                </span>
              </div>
            </div>
          </div>

          {/* Laptop Base Stand */}
          <div className="w-[106%] max-w-[620px] h-3 bg-gradient-to-b from-slate-700 to-slate-800 rounded-b-xl shadow-lg relative flex items-center justify-center">
            <div className="w-16 h-1 bg-slate-900 rounded-full" />
          </div>
          <div className="w-[85%] h-1 bg-slate-500/30 rounded-full blur-[2px]" />
        </div>

        {/* Right: Floating Smartphone Displaying KOSHA QR Counter Checkout (5 cols on lg) */}
        <div className="lg:col-span-5 relative flex flex-col items-center">
          {/* Decorative Backing Glow */}
          <div className="absolute -inset-4 bg-emerald-500/15 rounded-3xl blur-2xl pointer-events-none" />

          {/* Smartphone Enclosure */}
          <div className="relative w-72 sm:w-80 bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/60">
            {/* Dynamic Island Notch */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full flex items-center justify-end px-2 z-20">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
            </div>

            {/* Phone Screen */}
            <div className="bg-slate-50 rounded-[2rem] pt-8 pb-5 px-4 text-slate-800 space-y-3.5 overflow-hidden border border-slate-200">
              {/* Store & Header */}
              <div className="text-center pt-2">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>KOSHA Counter Checkout</span>
                </div>
                <h4 className="text-sm font-black text-kosha-navy mt-1">Sri Lakshmi Provisions</h4>
                <p className="text-[11px] text-slate-500">Shop ID: KSH-BLR-042</p>
              </div>

              {/* Amount Breakdown Card */}
              <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Bill Total</span>
                  <span className="text-base font-black text-slate-900">₹2,450.00</span>
                </div>

                <div className="flex justify-between items-center text-xs text-emerald-700 font-medium pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Paying Now (UPI)</span>
                  </span>
                  <span className="font-bold">-₹500.00</span>
                </div>

                <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200/80 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                      Store Credit Balance
                    </div>
                    <div className="text-[11px] text-amber-900 font-semibold flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      <span>Due: 15 Nov 2026</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-900">₹1,950.00</span>
                </div>
              </div>

              {/* Repayment Agreement Badge */}
              <div className="bg-slate-100/90 rounded-xl p-2.5 text-[10px] text-slate-600 flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Customer <strong className="text-slate-800">Rahul Sharma</strong> agreed to pay ₹1,950 by 15 Nov. Automatic SMS/WhatsApp reminder scheduled.
                </span>
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Transaction Verified & Saved</span>
                </button>
              </div>
            </div>
          </div>

          {/* Floating Badge 1: Instant QR scan */}
          <div className="hidden sm:flex absolute -left-6 bottom-8 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200/80 items-center gap-3 z-30 animate-bounce duration-1000">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-kosha-blue flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Instant Counter QR</div>
              <div className="text-[10px] text-slate-500">Scan & pay split in 10s</div>
            </div>
          </div>

          {/* Floating Badge 2: MSMED Compliance */}
          <div className="hidden sm:flex absolute -right-6 top-8 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200/80 items-center gap-3 z-30">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">MSMED Sec 16 Ready</div>
              <div className="text-[10px] text-slate-500">3x RBI penal interest protection</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
