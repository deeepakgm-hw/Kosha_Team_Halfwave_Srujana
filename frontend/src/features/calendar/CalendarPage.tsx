import React from "react";
import { CalendarDays } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export const CalendarPage: React.FC = () => {
  const commitments = [
    {
      date: "07 Nov 2026",
      title: "Monthly Factory Staff Payroll",
      category: "Payroll",
      amount: 180000,
      priority: "CRITICAL",
      statutoryRule: "Contractual salary disbursement deadline.",
    },
    {
      date: "07 Nov 2026",
      title: "TDS Monthly Deposit (Section 194C / 194J)",
      category: "Tax Obligation",
      amount: 22500,
      priority: "HIGH",
      statutoryRule: "Due by 7th of succeeding month. Delayed interest @ 1.5%/month.",
    },
    {
      date: "15 Nov 2026",
      title: "PF & ESI Statutory Remittance",
      category: "Labor Compliance",
      amount: 34000,
      priority: "HIGH",
      statutoryRule: "EPF and ESIC statutory deposit deadline.",
    },
    {
      date: "20 Nov 2026",
      title: "GSTR-3B Return & Tax Liability Settlement",
      category: "GST Obligation",
      amount: 54000,
      priority: "CRITICAL",
      statutoryRule: "Monthly GSTR-3B tax payment. Delay incurs 18% p.a. interest.",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Calendar — Tax & Cash Commitments</h1>
            <Badge variant="warning">Synthetic Schedule</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Consolidated timeline of scheduled payroll, non-negotiable tax cliffs, and vendor dues.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {commitments.map((item, idx) => (
          <Card key={idx} className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 flex flex-col items-center justify-center min-w-16">
                  <CalendarDays className="w-4 h-4 mb-1 text-slate-500" />
                  <span className="text-xs font-semibold text-center">{item.date}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-900">{item.title}</h3>
                    <Badge variant={item.priority === "CRITICAL" ? "danger" : "warning"}>
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.statutoryRule}</p>
                </div>
              </div>

              <div className="text-right md:min-w-36">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Committed Amount</div>
                <div className="text-base font-bold text-rose-700">₹ {item.amount.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
