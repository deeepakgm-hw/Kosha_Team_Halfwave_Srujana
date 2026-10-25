import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, CheckCircle2, FileSpreadsheet, AlertCircle, ArrowRight } from "lucide-react";
import { useBusiness } from "../../context/BusinessContext";
import { useLanguage } from "../../context/LanguageContext";
import { StatementImportModal } from "../statements/StatementImportModal";
import { PersonaType } from "../../types/cashflow";

export const LoadPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    isDemoMode,
    setIsDemoMode,
    selectedPersona,
    setSelectedPersona,
    activeBusinessId,
    createBusiness,
  } = useBusiness();
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const personas: Array<{ id: PersonaType; title: string; description: string; personaCode: string }> = [
    {
      id: "manufacturer",
      title: "Manufacturer with one major buyer",
      description: "Automotive Tier-1 ancillary (Apex Precision Components) with 45-day delayed buyer invoice, factory workforce salaries, and tooling opex.",
      personaCode: "Western Auto · Payroll: ₹1.8L/mo · Opening cash: ₹4.5L",
    },
    {
      id: "trader",
      title: "Seasonal trader",
      description: "Wholesale agricultural & commodity trader (Delta Harvest) with festive demand surges, bulk inventory intake, and retail credit lag.",
      personaCode: "Commodity Hub · Bulk Stock: ₹3.8L · Opening cash: ₹6.2L",
    },
    {
      id: "service",
      title: "Payroll-heavy services firm",
      description: "Digital engineering consulting firm (Zenith Cloud) with strict 1st-of-month engineering salaries and milestone retainer receipts.",
      personaCode: "Cloud Retainers · Fixed Payroll: ₹2.2L/mo · Opening cash: ₹2.8L",
    },
  ];

  const handleSelectPersona = (pId: PersonaType) => {
    setIsDemoMode(true);
    setSelectedPersona(pId);
    setValidationError(null);
  };

  const handleOpenImport = async () => {
    setValidationError(null);
    if (!activeBusinessId && isDemoMode) {
      try {
        const created = await createBusiness({
          legal_name: "Imported Workspace",
          trade_name: "My Enterprise",
          industry: "General Business",
          msme_category: "Small",
        });
        if (created) {
          setIsImportModalOpen(true);
        }
      } catch (err: unknown) {
        setValidationError("Could not initialize upload workspace: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    } else {
      setIsImportModalOpen(true);
    }
  };

  const handleBuildForecast = () => {
    if (!isDemoMode && uploadedCount === 0) {
      setValidationError("Please upload at least one bank statement CSV batch or switch to a sample business before building your forecast.");
      return;
    }
    setValidationError(null);
    navigate("/understand-cash-flow");
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col justify-between py-2">
      {/* Center Main Glass Card */}
      <div className="glass-panel rounded-4xl p-8 sm:p-12 shadow-glass-lg relative overflow-hidden">
        {/* Card Header */}
        <div className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-kosha-blue mb-3">
            Step 1 · {t("step1")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-kosha-navy tracking-tight">
            {t("loadHeading")}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2 font-medium">
            {t("loadSubtitle")}
          </p>
        </div>

        {validationError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* 2 Side-by-Side Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Sample Business */}
          <div
            onClick={() => handleSelectPersona(selectedPersona)}
            className={`rounded-3xl p-6 sm:p-7 transition-all cursor-pointer flex flex-col justify-between ${
              isDemoMode
                ? "bg-white/95 border-2 border-kosha-blue shadow-glass-sm ring-4 ring-blue-100/50"
                : "bg-white/60 border border-white hover:bg-white/80"
            }`}
          >
            <div>
              <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-kosha-blue mb-4">
                Industry Benchmark Template
              </div>
              <h2 className="text-xl font-bold text-kosha-navy">Industry Template</h2>
              <p className="text-xs text-slate-500 mt-1">Pre-configured synthetic data with reconciled cash ledgers.</p>

              {/* Persona Radios */}
              <div className="mt-6 space-y-3.5">
                {personas.map((p) => {
                  const isChecked = isDemoMode && selectedPersona === p.id;
                  return (
                    <label
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPersona(p.id);
                      }}
                      className={`flex flex-col gap-1 p-3 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-blue-50/70 border-kosha-blue shadow-xs"
                          : "bg-white/50 border-slate-200/70 hover:bg-white/90"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? "border-kosha-blue bg-kosha-blue"
                              : "border-slate-300"
                          }`}
                        >
                          {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-bold text-kosha-navy">{p.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 pl-7 leading-relaxed">
                        {p.description}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono pl-7 mt-0.5">
                        {p.personaCode}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Synthetic data demo persona ready (No file setup needed)</span>
            </div>
          </div>

          {/* Card 2: Upload CSV Files */}
          <div
            className={`rounded-3xl p-6 sm:p-7 transition-all flex flex-col justify-between ${
              !isDemoMode
                ? "bg-white/95 border-2 border-kosha-blue shadow-glass-sm ring-4 ring-blue-100/50"
                : "bg-white/60 border border-white hover:bg-white/80"
            }`}
          >
            <div>
              <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-4">
                Your own data
              </div>
              <h2 className="text-xl font-bold text-kosha-navy">Upload CSV files</h2>
              <p className="text-xs text-slate-500 mt-1">Bank statements, customer invoices, and vendor bills.</p>

              {/* Dashed Dropzone */}
              <div
                onClick={handleOpenImport}
                className="mt-6 border-2 border-dashed border-blue-300 hover:border-kosha-blue rounded-2xl p-6 text-center cursor-pointer bg-blue-50/30 hover:bg-blue-50/60 transition-colors group"
              >
                <UploadCloud className="w-8 h-8 text-kosha-blue mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <p className="text-sm font-bold text-kosha-navy">Drop CSV files here</p>
                <p className="text-xs text-slate-500 mt-1">
                  bank_statement.csv · invoices.csv · bills.csv
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-kosha-blue" />
                  <span>Validates columns, amounts, dates & duplicate rows</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-50/80 rounded-2xl text-[11px] text-slate-500 leading-relaxed border border-slate-200/60">
                <span className="font-semibold text-slate-700">Row-Level Validation:</span> Every row is parsed and verified for correct dates and monetary amounts. Invalid rows are isolated with actionable error messages without corrupting ledger state.
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleOpenImport}
                className="w-full py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-sm font-bold text-kosha-navy shadow-xs transition-colors"
              >
                {uploadedCount > 0 ? `Uploaded (${uploadedCount} batches)` : "Choose CSV file to import"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-slate-400 text-center mt-8">
          Records are stored in your private local SQLite database instance during this session.
        </p>
      </div>

      {/* Bottom Bar: Back & Next */}
      <div className="flex items-center justify-between mt-6 px-2">
        <button
          onClick={() => navigate("/welcome")}
          className="px-6 py-2.5 rounded-full bg-white/80 hover:bg-white text-sm font-bold text-kosha-navy border border-white/80 shadow-xs transition-colors"
        >
          Back
        </button>

        <button
          onClick={handleBuildForecast}
          className="px-8 py-3 rounded-full bg-kosha-blue hover:bg-kosha-deep text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span>{t("buildMyForecast")}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* CSV Import Modal */}
      {isImportModalOpen && activeBusinessId && (
        <StatementImportModal
          businessId={activeBusinessId}
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setUploadedCount((prev) => prev + 1);
            setIsDemoMode(false);
          }}
        />
      )}
    </div>
  );
};
