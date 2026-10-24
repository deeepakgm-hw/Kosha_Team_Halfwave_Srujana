import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";

export interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 text-rose-900 flex items-start gap-4">
      <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-rose-950">{title}</h4>
        <p className="text-xs text-rose-800 mt-1">{message}</p>
        {onRetry && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-rose-300 text-rose-900 hover:bg-rose-100 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
