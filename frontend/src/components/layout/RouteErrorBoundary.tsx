import React from "react";
import { useRouteError, useNavigate, Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "An unexpected error occurred in this view.";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full border border-white/90 shadow-glass-lg text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-black text-slate-900">Application Notice</h2>
          <p className="text-xs text-slate-500 mt-1">
            We encountered a temporary interface issue. Your data and session are safe.
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-700 max-h-36 overflow-y-auto">
          {errorMessage}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>

          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            Go Back
          </button>

          <Link
            to="/customer/dashboard"
            className="px-4 py-2.5 rounded-xl bg-kosha-blue hover:bg-kosha-deep text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
