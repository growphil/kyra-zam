import React from "react";
import Link from "next/link";
import { ShieldAlert, Home } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface AccessDeniedProps {
  requiredRole?: string;
  userRole?: string;
  className?: string;
}

export default function AccessDenied({
  requiredRole,
  userRole,
  className
}: AccessDeniedProps) {
  return (
    <div className={twMerge("surface-card p-8 sm:p-12 rounded-xl border border-amber-200 bg-amber-50/40 text-center max-w-lg mx-auto my-8 space-y-4 text-[#0B2148]", className)}>
      <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-mono font-bold text-amber-800 uppercase tracking-wider">
          Access Restricted (403)
        </span>
        <h2 className="text-xl font-bold text-amber-950">
          Insufficient Role Permissions
        </h2>
        <p className="text-xs sm:text-sm text-[#526B91]">
          You do not have the required authorization to view or execute operations in this module.
        </p>
        {requiredRole && (
          <p className="text-[11px] text-[#64748B] pt-1">
            Required Role: <strong className="text-[#0B2148]">{requiredRole}</strong>
            {userRole && <span> · Current: <strong className="text-amber-800">{userRole}</strong></span>}
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-amber-200/60">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
