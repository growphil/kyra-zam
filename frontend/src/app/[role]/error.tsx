"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RoleWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Role Workspace error:", error);
  }, [error]);

  return (
    <div className="surface-card p-8 sm:p-12 rounded-xl border border-rose-200 bg-rose-50/40 text-center max-w-2xl mx-auto my-8 space-y-4 text-[#0B2148]">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
        <AlertTriangle className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-rose-950">
          Module Failed to Load
        </h2>
        <p className="text-xs sm:text-sm text-[#526B91] max-w-md mx-auto">
          {error.message || "An error occurred while loading this workspace module. The database and backend are unaffected."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-rose-200/60">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Module</span>
        </button>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148] text-xs font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#526B91]" />
          <span>Go Back</span>
        </button>
      </div>
    </div>
  );
}
