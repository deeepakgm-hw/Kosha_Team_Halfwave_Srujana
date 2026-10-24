import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

export const ReceivablesPage: React.FC = () => {
  const invoices = [
    {
      id: "INV-2026-091",
      customer: "Tier-1 Auto Assemblers Ltd",
      amount: 320000,
      dueDate: "2026-10-15",
      status: "Overdue (9d)",
      msmedViolated: false,
      expectedPayDate: "2026-11-05",
      penalInterest: 0,
    },
    {
      id: "INV-2026-074",
      customer: "Western Engineering Components",
      amount: 195000,
      dueDate: "2026-09-02",
      status: "Overdue (52d)",
      msmedViolated: true,
      expectedPayDate: "2026-11-15",
      penalInterest: 2680,
    },
    {
      id: "INV-2026-102",
      customer: "Bharat Gears Ltd",
      amount: 280000,
      dueDate: "2026-11-04",
      status: "Expected",
      msmedViolated: false,
      expectedPayDate: "2026-11-04",
      penalInterest: 0,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Receivables & MSMED Compliance</h1>
            <Badge variant="warning">Synthetic Ledger</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Accounts receivable tracking, counterparty latency estimation, and MSMED Act 45-day rights.
          </p>
        </div>
      </div>

      {/* MSMED Statutory Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-amber-950">MSMED Act Section 15 & 16 Protection</h4>
          <p className="mt-0.5 leading-relaxed">
            Registered Micro & Small Enterprises are legally entitled to receive payment within 45 days. Buyers failing this timeline are mandated to pay compound penal interest with monthly rests at <strong>3x the RBI Bank Rate</strong>.
          </p>
        </div>
      </div>

      <Card
        header={
          <div className="flex items-center justify-between">
            <span>Outstanding Invoices Ledger</span>
            <span className="text-xs font-normal text-slate-500">3 Invoices Loaded</span>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">MSMED Violation</th>
                <th className="px-4 py-3 text-right">Penal Interest</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">{inv.id}</td>
                  <td className="px-4 py-3 text-slate-800">{inv.customer}</td>
                  <td className="px-4 py-3 text-slate-500">{inv.dueDate}</td>
                  <td className="px-4 py-3 font-semibold text-right text-slate-900">
                    ₹ {inv.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={inv.status.includes("Overdue") ? "warning" : "success"}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {inv.msmedViolated ? (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> &gt; 45 Days Overdue
                      </span>
                    ) : (
                      <span className="text-slate-400">Within terms</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {inv.penalInterest > 0 ? (
                      <span className="text-rose-700 font-semibold">
                        +₹ {inv.penalInterest.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" disabled>
                      Notice Preview
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
