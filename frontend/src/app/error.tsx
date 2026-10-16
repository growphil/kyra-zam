"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F4F9FF] text-[#0B2148] flex items-center justify-center p-4">
      <div className="surface-card max-w-lg w-full p-6 sm:p-8 rounded-2xl shadow-xl border border-[#D8E8FA] text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2148]">
            System Operational Interruption
          </h1>
          <p className="text-xs sm:text-sm text-[#526B91]">
            An unexpected runtime error occurred. Your session and backend data remain secure.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-[#64748B] pt-1">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-[#D8E8FA]">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload View</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148] text-xs font-semibold transition-colors"
          >
            <Home className="w-4 h-4 text-[#526B91]" />
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
