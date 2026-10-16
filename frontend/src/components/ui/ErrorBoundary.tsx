"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  resetAction?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public resetError = () => {
    if (this.props.resetAction) {
      this.props.resetAction();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="surface-card p-6 sm:p-8 rounded-xl border border-rose-200 bg-rose-50/50 my-4 text-[#0B2148]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="text-base font-bold text-rose-900">
                {this.props.fallbackTitle || "An unexpected error occurred in this section"}
              </h3>
              <p className="text-xs sm:text-sm text-[#526B91]">
                {this.props.fallbackMessage || this.state.error?.message || "The operational view encountered a rendering issue. You can retry loading this component without reloading the whole application."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-rose-200/60">
            <button
              onClick={this.resetError}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Component</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148] text-xs font-semibold transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-[#526B91]" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
