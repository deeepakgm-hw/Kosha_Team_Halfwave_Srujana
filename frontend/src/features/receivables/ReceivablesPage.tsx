import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Copy, Check, Scale, ShieldAlert, Download, FileText } from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";
import { apiClient } from "../../lib/api";
import { ReceivablesLawResponse } from "../../types/cashflow";

export const ReceivablesPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeBusinessId } = useBusiness();
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [lawData, setLawData] = useState<ReceivablesLawResponse | null>(null);

  const initialReminder = `Subject: Statutory Notice: Overdue Invoice #112 & MSMED Act Interest Remittance

Dear Accounts Team at Bharat Auto Parts,

We appreciate our ongoing business partnership. This communication serves as a formal follow-up regarding Invoice #112 for ₹1,40,000, which is currently overdue by 38 days past our agreed credit term.

STATUTORY REGULATORY NOTICE:
1. Under Sections 15 & 16 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, delayed settlements beyond the statutory period incur mandatory compound interest at 3x the prevailing Reserve Bank of India (RBI) Bank Rate (currently 19.5% p.a., compounded monthly). Accrued statutory penal interest to date: ₹2,275.
2. Under Section 43B(h) of the Income Tax Act, buyers unable to clear MSME dues within agreed statutory timelines cannot claim expenditure deductions in their tax computation.

To preserve seamless trade terms and avoid formal reporting under the MSME Samadhaan portal, please confirm settlement of ₹1,40,000 to our registered bank account this week.

Kind regards,
Finance & Treasury Department
Apex Precision Components Pvt Ltd (UDYAM-MH-01-0084920)`;

  const [reminderDraft, setReminderDraft] = useState<string>(initialReminder);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getReceivablesLaw(activeBusinessId || "apex_precision_mfg")
      .then((res) => {
        if (isMounted && res) {
          setLawData(res);
          if (res.invoices && res.invoices.length > 0 && res.invoices[0].statutory_reminder_draft) {
            setReminderDraft(res.invoices[0].statutory_reminder_draft);
          }
        }
      })
      .catch(() => {
        // Fallback to default presets
      });

    return () => {
      isMounted = false;
    };
  }, [activeBusinessId]);

  // Derived or default invoices
  const invoices = lawData && lawData.invoices && lawData.invoices.length > 0
    ? lawData.invoices.map((inv) => ({
        invoice: inv.invoice_number,
        customer: inv.customer_name,
        amount: `₹${inv.amount.toLocaleString("en-IN")}`,
        amountNum: inv.amount,
        overdue: inv.overdue_days > 0 ? `${inv.overdue_days} days` : "Current",
        overdueDays: inv.overdue_days,
        legalInterest: inv.accrued_penal_interest > 0 ? `₹${inv.accrued_penal_interest.toLocaleString("en-IN")}` : "Within limit",
        legalInterestNum: inv.accrued_penal_interest,
        isOwed: inv.accrued_penal_interest > 0,
        section43BStatus: inv.section_43b_notes || (inv.overdue_days > 45 ? "Breached (Tax deduction disallowed for buyer)" : "Compliant"),
        reminderDraft: inv.statutory_reminder_draft,
      }))
    : [
        {
          invoice: "#112",
          customer: "Bharat Auto Parts",
          amount: "₹1,40,000",
          amountNum: 140000,
          overdue: "38 days",
          overdueDays: 38,
          legalInterest: "₹2,275",
          legalInterestNum: 2275,
          isOwed: true,
          section43BStatus: "Disallowed if unpaid beyond 45 days",
          reminderDraft: initialReminder,
        },
        {
          invoice: "#121",
          customer: "Kumar Fabricators",
          amount: "₹40,000",
          amountNum: 40000,
          overdue: "65 days",
          overdueDays: 65,
          legalInterest: "₹1,311",
          legalInterestNum: 1311,
          isOwed: true,
          section43BStatus: "Breached (Tax deduction disallowed for buyer)",
          reminderDraft: initialReminder,
        },
        {
          invoice: "#118",
          customer: "Sri Motors",
          amount: "₹60,000",
          amountNum: 60000,
          overdue: "12 days",
          overdueDays: 12,
          legalInterest: "Within limit",
          legalInterestNum: 0,
          isOwed: false,
          section43BStatus: "Compliant (Within agreed 30-day term)",
          reminderDraft: initialReminder,
        },
      ];

  const totalAccruedInterest = lawData?.total_accrued_penal_interest ?? 3586;

  const handleDownloadList = () => {
    const csvRows = [
      ["Invoice", "Customer", "Amount_INR", "Overdue_Days", "Accrued_Penal_Interest", "Section_43B_Status"],
      ...invoices.map((inv) => [
        inv.invoice,
        `"${inv.customer}"`,
        inv.amountNum.toString(),
        inv.overdueDays.toString(),
        inv.legalInterestNum.toString(),
        `"${inv.section43BStatus.replace(/"/g, '""')}"`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "msmed_receivables_penal_interest_ledger.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyReminder = () => {
    navigator.clipboard.writeText(reminderDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };


  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col justify-between py-2">
      {/* 2 Main Glass Cards Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Card: Receivables & MSMED Law */}
        <div className="lg:col-span-8 glass-panel rounded-4xl p-7 sm:p-9 flex flex-col justify-between shadow-glass-lg">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue">
                Supporting Tool
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Receivables · MSMED Statutory Tracking
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-kosha-navy">
              Late payment has a legal price
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 font-medium">
              Under Sections 15 & 16 of the MSMED Act, late payers owe compound interest. Total accrued interest owed to you:{" "}
              <strong className="text-kosha-blue font-extrabold">₹{totalAccruedInterest.toLocaleString("en-IN")}</strong>
            </p>

            {/* Invoices Table */}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 text-xs font-semibold text-slate-400">
                    <th className="pb-3 font-semibold">Invoice</th>
                    <th className="pb-3 font-semibold">Customer</th>
                    <th className="pb-3 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-center">Overdue</th>
                    <th className="pb-3 font-semibold text-right">Legal interest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.invoice} className="hover:bg-white/40 transition-colors">
                      <td className="py-4 font-bold text-kosha-navy">{inv.invoice}</td>
                      <td className="py-4 text-slate-700 font-medium">
                        <div>{inv.customer}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{inv.section43BStatus}</div>
                      </td>
                      <td className="py-4 text-right font-bold text-kosha-navy">{inv.amount}</td>
                      <td className="py-4 text-center text-slate-500 text-xs">{inv.overdue}</td>
                      <td
                        className={`py-4 text-right font-bold ${
                          inv.isOwed ? "text-kosha-blue" : "text-slate-500 text-xs font-normal"
                        }`}
                      >
                        {inv.legalInterest}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons below table */}
          <div className="flex flex-wrap items-center gap-3 mt-8 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowReminderModal(true)}
              className="px-6 py-2.5 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Draft a polite reminder</span>
            </button>
            <button
              onClick={handleDownloadList}
              className="px-6 py-2.5 rounded-full bg-white/90 hover:bg-white border border-slate-200 text-kosha-navy text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download list CSV</span>
            </button>
          </div>
        </div>

        {/* Right Card: What you owe & Section 43B(h) */}
        <div className="lg:col-span-4 glass-panel rounded-4xl p-7 sm:p-8 flex flex-col justify-between shadow-glass-lg">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Section 43B(h) Warning</span>
            </div>
            <h2 className="text-xl font-bold text-kosha-navy mt-1">What you owe suppliers</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Pay registered micro & small suppliers on time to retain your income tax business expenditure deduction.
            </p>

            {/* Amber Highlight Card */}
            <div className="mt-6 bg-[#FEF3C7]/75 border border-[#FDE68A] rounded-2xl p-5 text-amber-950 shadow-xs">
              <div className="text-base font-bold text-amber-950">
                Steel Traders · ₹80,000
              </div>
              <p className="text-xs text-amber-900 mt-1 font-medium">
                Pay by 14 Dec (Statutory 45-day deadline)
              </p>
              <span className="text-[10px] text-amber-800 mt-2 block leading-relaxed">
                Vendor is a registered Small Enterprise. Unpaid bills on 31 March become taxable additions to your net income.
              </span>
            </div>

            {/* Verified Legal Parameters */}
            <div className="mt-6 p-3.5 bg-white/60 rounded-2xl border border-white/80 text-[11px] space-y-1 text-slate-600">
              <div className="font-bold text-kosha-navy flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-kosha-blue" />
                <span>Statutory Parameters (As of Oct 2026):</span>
              </div>
              <div>• RBI Bank Rate: <strong>6.50% p.a.</strong></div>
              <div>• MSMED Penal Rate: <strong>19.50% p.a. (3x rate)</strong></div>
              <div>• Compounding: <strong>Monthly rests</strong></div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-6 leading-relaxed">
            Planning estimate, not formal legal or tax counsel. Calculations use MSMED Section 16 compounding rules and Section 43B(h) window. Please confirm eligibility with a certified CA.
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between mt-6 px-2">
        <span className="text-xs text-slate-400 font-medium">Calculations follow MSMED Act 2006</span>

        <button
          onClick={() => navigate("/understand-cash-flow")}
          className="px-8 py-3 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
        >
          Back to Forecast
        </button>
      </div>

      {/* Polite Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 sm:p-7 rounded-3xl shadow-glass-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-kosha-navy flex items-center gap-2">
                <FileText className="w-4 h-4 text-kosha-blue" />
                <span>Draft Statutory Notice & Polite Reminder</span>
              </h3>
              <button
                onClick={() => setShowReminderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                <span>Customizable Notice Draft</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {reminderDraft.length} chars · {reminderDraft.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                value={reminderDraft}
                onChange={(e) => setReminderDraft(e.target.value)}
                rows={11}
                aria-label="Statutory notice reminder draft"
                className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-kosha-blue/30 shadow-inner resize-y"
              />
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setReminderDraft(initialReminder)}
                  className="text-[11px] text-kosha-blue hover:underline font-semibold"
                >
                  Reset to default template
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-full text-xs font-semibold hover:bg-white"
              >
                Close
              </button>
              <button
                onClick={copyReminder}
                className="px-5 py-2 bg-kosha-blue hover:bg-kosha-deep text-white rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied to Clipboard!" : "Copy to Clipboard"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
