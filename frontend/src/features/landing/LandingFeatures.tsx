import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  QrCode,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Zap,
  Building2,
} from "lucide-react";

export const LandingFeatures: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-24 sm:space-y-32 py-16 sm:py-24 overflow-hidden">
      {/* FEATURE 1: Counter QR Credit Checkout */}
      <section id="shop-credit" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Text Column (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>In-Store Counter QR Checkout</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-kosha-navy tracking-tight leading-tight">
              A checkout that converts shoppers into loyal repeat buyers.
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Don’t lose sales when regular customers are short on cash. KOSHA lets in-store shoppers scan your shop’s dynamic QR code, pay whatever they have right now via UPI, and lock in an agreed repayment date for the rest.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Instant 10-Second Counter Scan</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Customers don’t need to download bulky apps. They scan your shop QR code, verify your store name, and enter transaction details.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Flexible Partial Down-Payments</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Accept ₹500 today via cash/UPI and schedule ₹1,500 next week. Both you and the customer get an instant verified digital ledger.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Polite Automated Reminders</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Eliminate awkward recovery calls. Friendly in-app and SMS reminders keep customer relationships warm while recovering funds on time.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/customer/dashboard")}
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 group"
              >
                <span>Experience Customer Member Portal</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Visual Showcase (6 cols) */}
          <div className="lg:col-span-6 relative">
            {/* Background image card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-slate-100 group">
              <img
                src="/images/checkout-counter.jpg"
                alt="Modern retail counter checkout"
                className="w-full h-[380px] sm:h-[450px] object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />

              {/* Floating Live Transaction Badge */}
              <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl border border-white/80">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Sri Lakshmi Provisions</div>
                      <div className="text-[11px] text-slate-500">Counter QR Payment Confirmed</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Active Ledger
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-medium">Total Bill</div>
                    <div className="text-xs sm:text-sm font-black text-slate-800">₹3,400</div>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-xl">
                    <div className="text-[10px] text-emerald-600 font-medium">Paid Today</div>
                    <div className="text-xs sm:text-sm font-black text-emerald-700">₹1,000</div>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-xl">
                    <div className="text-[10px] text-amber-600 font-medium">Due 18 Nov</div>
                    <div className="text-xs sm:text-sm font-black text-amber-700">₹2,400</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2: 90-Day Predictive Cash Runway */}
      <section id="predictive-runway" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Visual Showcase (6 cols) - Left on Desktop */}
          <div className="lg:col-span-6 relative order-2 lg:order-1">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-slate-100 group">
              <img
                src="/images/business-finance.jpg"
                alt="Business financial analytics and forecasting"
                className="w-full h-[380px] sm:h-[450px] object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

              {/* Floating Predictive Runway Alert Card */}
              <div className="absolute bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-700/80">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">90-Day Cash Trajectory</div>
                      <div className="text-[11px] text-slate-400">Safety Buffer: ₹50,000 threshold</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Dip in Wk 4
                  </span>
                </div>

                <div className="pt-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Projected Lowest Balance</span>
                    <span className="font-mono font-bold text-rose-400">₹42,000 (breaches buffer)</span>
                  </div>
                  <div className="bg-blue-950/70 p-2.5 rounded-xl border border-blue-800/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-slate-300">Action Plan: Discount Metro Corp invoice (+₹45,000)</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Solves Crunch
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Column (6 cols) - Right on Desktop */}
          <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue border border-blue-200">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Predictive Treasury Engine</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-kosha-navy tracking-tight leading-tight">
              Know your treasury before it runs dry.
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Most small businesses fail not from lack of sales, but from running out of cash. KOSHA maps your payroll, supplier bills, customer receivables, and loan EMIs into a 90-day forward simulation so you can steer clear of liquidity traps.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-kosha-blue shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Safety Buffer Warnings 3 Weeks Early</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Get alerted weeks before your bank balance breaches your operating safety threshold, giving you ample time to take action.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-kosha-blue shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">What-If Shock Simulator</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Instantly simulate shocks: "What if my largest buyer delays by 30 days?" or "What if revenue drops 15%?"
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-kosha-blue shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Ranked Strategic Action Playbook</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    KOSHA ranks remediation options by financial cost and relationship impact, providing ready-to-use email/letter templates.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/load")}
                className="inline-flex items-center gap-2 text-sm font-bold text-kosha-blue hover:text-kosha-deep group"
              >
                <span>Launch Business Treasury Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 3: MSMED Act 2006 Late-Payment Protection */}
      <section id="msmed-protection" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Text Column (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Statutory Legal Protection</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-kosha-navy tracking-tight leading-tight">
              Statutory MSMED Act 2006 late-payment protection built in.
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Indian law strictly mandates that large buyers must pay MSME suppliers within 45 days. If they delay, Section 16 mandates monthly compounding interest at 3x the RBI bank rate (19.5% p.a.). KOSHA handles every calculation automatically.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Automatic Section 16 Compounding Interest</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Accurate monthly compounding interest calculations at 3x RBI Bank Rate (currently 19.5% p.a.) generated with audit-ready proof.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Section 43B(h) Tax Disallowance Notice</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Under Indian Income Tax Section 43B(h), unpaid MSME invoices cannot be claimed as tax deductions by buyers. We generate compliance letters.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">One-Click MSME Samadhaan Filing Export</h4>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Export structured application packets with transaction logs ready for the government MSME Samadhaan dispute portal.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Link */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/receivables")}
                className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:text-indigo-800 group"
              >
                <span>View Receivables & Penal Tracker</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Visual Showcase (6 cols) */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-slate-100 group">
              <img
                src="/images/merchant-owner.jpg"
                alt="Confident Indian MSME entrepreneur"
                className="w-full h-[380px] sm:h-[450px] object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

              {/* Floating MSMED Certificate Card */}
              <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl border border-white/80">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Apex Precision Engg vs Mega Corp</div>
                      <div className="text-[11px] text-slate-500">Statutory Notice · MSMED Act 2006</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                    62 Days Overdue
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <div className="text-[10px] text-slate-500 font-medium">Principal Overdue</div>
                    <div className="text-sm font-black text-slate-900">₹2,40,000</div>
                    <div className="text-[10px] text-slate-400">Section 15 (Max 45 days)</div>
                  </div>
                  <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
                    <div className="text-[10px] text-indigo-700 font-medium">Sec 16 Penal Interest</div>
                    <div className="text-sm font-black text-indigo-900">+₹7,948</div>
                    <div className="text-[10px] text-indigo-600 font-semibold">19.5% p.a. (3x RBI rate)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
