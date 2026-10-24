import React from "react";
import { cn } from "../../lib/utils";

export interface LoadingSpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = "Loading...",
  size = "md",
  className,
}) => {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center p-6 gap-3", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-slate-200 border-t-emerald-600",
          sizeClasses[size]
        )}
      />
      {label && <p className="text-xs text-slate-500 font-medium">{label}</p>}
    </div>
  );
};
