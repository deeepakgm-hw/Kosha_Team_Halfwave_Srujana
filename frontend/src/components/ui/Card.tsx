import React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden",
        className
      )}
      {...props}
    >
      {header && (
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800 text-sm">
          {header}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
};
