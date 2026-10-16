import React from "react";
import { PackageOpen } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  title = "No records found",
  description = "There are no items to display at this time.",
  icon: Icon = PackageOpen,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={twMerge("flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-[#D8E8FA]", className)}>
      <div className="w-12 h-12 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-[#0B2148] mb-1">{title}</h3>
      <p className="text-sm text-[#526B91] max-w-md mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
