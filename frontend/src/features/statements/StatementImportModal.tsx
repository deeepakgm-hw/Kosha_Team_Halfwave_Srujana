import React, { useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, X, Download, Info } from "lucide-react";
import { apiClient, formatApiError } from "../../lib/api";
import { CsvImportResult } from "../../types/cashflow";
import { formatINR } from "../../lib/utils";

interface StatementImportModalProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const StatementImportModal: React.FC<StatementImportModalProps> = ({
  businessId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [openingBalance, setOpeningBalance] = useState<string>("");
  const [openingDate, setOpeningDate] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV statement file to import.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      let parsedOpening: number | undefined = undefined;
      const cleanOpening = openingBalance.trim().replace(/,/g, "");
      if (cleanOpening !== "") {
        const num = parseFloat(cleanOpening);
        if (isNaN(num)) {
          setError("Please enter a valid numeric opening balance (e.g. 234554).");
          setIsUploading(false);
          return;
        }
        parsedOpening = num;
      }

      const cleanDate = openingDate.trim() !== "" ? openingDate.trim() : undefined;

      const res = await apiClient.importStatementCsv(
        businessId,
        file,
        undefined,
        "standard",
        parsedOpening,
        cleanDate
      );
      setResult(res);
      onSuccess();
    } catch (err: unknown) {
      const msg = formatApiError(err);
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadRejectedCsv = () => {
    if (!result || result.rejected_details.length === 0) return;
    const header = "Row Number,Error Reason,Raw Content\n";
    const rows = result.rejected_details
      .map(
        (r) =>
          `"${r.row_number}","${r.error.replace(/"/g, '""')}","${r.raw_content.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rejected_rows_${result.batch_id || "import"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-base text-slate-900">Import Bank Statement (CSV)</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        {!result ? (
          <form onSubmit={handleUpload} className="mt-4 space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800">Supported Formats & Auto-Detection:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                <li>
                  Canonical columns: <code>transaction_date</code>, <code>description</code>,{" "}
                  <code>amount</code> (or separate <code>credit</code>/<code>debit</code>),{" "}
                  <code>external_reference</code>.
                </li>
                <li>
                  Supports UTF-8, Latin-1, CP1252 encodings; comma, semicolon, tab delimiters.
                </li>
                <li>Signed amounts: Positive = Inflow (Credit), Negative = Outflow (Debit).</li>
                <li>Duplicate prevention: Identical files or previously imported rows are skipped.</li>
              </ul>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Select CSV Statement File *</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="w-full border border-slate-300 rounded-lg p-2 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {file && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Account Opening Balance (₹) (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 500000"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400">
                  Provide if statement does not specify opening balance
                </span>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Opening Balance Date (Optional)
                </label>
                <input
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !file}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Parsing & Reconciling...</span>
                  </>
                ) : (
                  <span>Import & Reconcile</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Result Summary */
          <div className="mt-4 space-y-4 text-xs">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Statement Successfully Imported</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Import Batch ID: <span className="font-mono">{result.batch_id}</span>
                </p>
              </div>
            </div>

            {/* Reconciliation KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[10px] uppercase font-bold">Total Rows</div>
                <div className="text-base font-bold text-slate-900 mt-1">{result.total_rows}</div>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <div className="text-emerald-700 text-[10px] uppercase font-bold">Accepted</div>
                <div className="text-base font-bold text-emerald-700 mt-1">
                  {result.accepted_rows}
                </div>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <div className="text-amber-700 text-[10px] uppercase font-bold">Duplicates Skipped</div>
                <div className="text-base font-bold text-amber-700 mt-1">
                  {result.duplicate_rows}
                </div>
                {(result.exact_file_duplicates !== undefined || result.previously_imported_duplicates !== undefined) && (
                  <div className="text-[9px] text-amber-600 font-medium mt-0.5">
                    {result.exact_file_duplicates || 0} in-file · {result.previously_imported_duplicates || 0} existing
                  </div>
                )}
              </div>
              <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                <div className="text-rose-700 text-[10px] uppercase font-bold">Rejected</div>
                <div className="text-base font-bold text-rose-700 mt-1">
                  {result.rejected_rows}
                </div>
              </div>
            </div>

            {/* Potential repeated transactions review alert if present */}
            {result.potential_duplicates_review !== undefined && result.potential_duplicates_review > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Legitimate Repetition Notice:</span>{" "}
                  {result.potential_duplicates_review} repeated transaction(s) occurred on the same date with identical amount and description without external reference. They have been preserved as distinct entries in the ledger.
                </div>
              </div>
            )}

            {/* Movement reconciliation */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-semibold text-slate-800 border-b border-slate-200 pb-1">
                Statement Reconciliation Ledger
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Total Settled Inflows (Credits):</span>
                <span className="font-mono font-bold">
                  +{formatINR(result.reconciliation.total_credits)}
                </span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>Total Settled Outflows (Debits):</span>
                <span className="font-mono font-bold">
                  -{formatINR(result.reconciliation.total_debits)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Net Cash Movement:</span>
                <span className="font-mono">
                  {result.reconciliation.net_movement >= 0 ? "+" : ""}
                  {formatINR(result.reconciliation.net_movement)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                {result.reconciliation.verification_notes}
              </p>
            </div>

            {/* Rejected details if any */}
            {result.rejected_details.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-800 text-[11px]">
                    Rejected Row Details ({result.rejected_details.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadRejectedCsv}
                    className="text-[11px] text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1 underline"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Invalid Rows (CSV)</span>
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto border border-rose-200 rounded-lg divide-y divide-rose-100 text-[11px] bg-rose-50/50">
                  {result.rejected_details.map((rej) => (
                    <div key={rej.row_number} className="p-2">
                      <span className="font-bold text-rose-900">Row {rej.row_number}:</span>{" "}
                      <span className="text-rose-700">{rej.error}</span>
                      <div className="font-mono text-slate-500 text-[10px] truncate mt-0.5">
                        Raw: {rej.raw_content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
              >
                Close & View Forecast
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
