import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface ErrorBannerProps {
  title?: string;
  error?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({
  title = "Operation Failed",
  error,
  onRetry,
  onDismiss,
  className
}: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className={twMerge("p-4 rounded-xl border border-rose-200 bg-rose-50 text-[#0B2148] flex items-start justify-between gap-3 shadow-xs", className)}>
      <div className="flex items-start gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-xs font-bold text-rose-900">{title}</h4>
          <p className="text-xs text-rose-800 break-words">{error}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded-md hover:bg-rose-200/50 text-rose-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface ConflictBannerProps {
  message?: string;
  onReload: () => void;
  className?: string;
}

export function MutationConflictBanner({
  message = "This record was updated by another workstation. Please reload the latest state before saving changes.",
  onReload,
  className
}: ConflictBannerProps) {
  return (
    <div className={twMerge("p-4 rounded-xl border border-amber-300 bg-amber-50 text-[#0B2148] flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
        <span className="text-xs font-semibold text-amber-950">{message}</span>
      </div>
      <button
        onClick={onReload}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs shrink-0 cursor-pointer"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Reload Record</span>
      </button>
    </div>
  );
}
