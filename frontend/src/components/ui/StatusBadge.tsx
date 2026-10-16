import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  PauseCircle, 
  HelpCircle,
  Activity,
  PackageCheck,
  ShieldCheck
} from "lucide-react";

export type StatusVariant = "success" | "info" | "warning" | "danger" | "neutral" | "hold";

interface StatusConfig {
  label: string;
  variant: StatusVariant;
  icon?: React.ComponentType<{ className?: string }>;
}

const statusMap: Record<string, StatusConfig> = {
  // Common
  ACTIVE: { label: "Active", variant: "success", icon: CheckCircle2 },
  INACTIVE: { label: "Inactive", variant: "neutral" },
  DRAFT: { label: "Draft", variant: "neutral" },
  CLOSED: { label: "Closed", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "danger", icon: XCircle },
  
  // Test Results
  PASSED: { label: "Passed", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "Failed", variant: "danger", icon: XCircle },
  PASS: { label: "Pass", variant: "success", icon: CheckCircle2 },
  FAIL: { label: "Fail", variant: "danger", icon: XCircle },

  // Cell Statuses
  RAW: { label: "Raw", variant: "neutral" },
  CELL_TESTED: { label: "Tested", variant: "success", icon: CheckCircle2 },
  RETEST_REQUIRED: { label: "Retest Required", variant: "warning", icon: Clock },
  REJECTED: { label: "Rejected", variant: "danger", icon: XCircle },
  HOLD: { label: "Hold", variant: "hold", icon: PauseCircle },
  UNMATCHED: { label: "Unmatched", variant: "warning", icon: AlertTriangle },

  // Pax Statuses
  PAX_ASSEMBLED: { label: "Assembled", variant: "info", icon: Activity },
  READY_FOR_PAX_TEST: { label: "Ready for Test", variant: "warning", icon: Clock },
  PAX_TESTED: { label: "Tested", variant: "success", icon: CheckCircle2 },
  READY_FOR_PACKING: { label: "Ready for Packing", variant: "info", icon: Clock },
  PACKED: { label: "Packed", variant: "success", icon: PackageCheck },
  READY_FOR_SALE: { label: "Ready for Sale", variant: "success", icon: CheckCircle2 },
  UNDER_REPAIR: { label: "Under Repair", variant: "warning", icon: AlertTriangle },
  SOLD_TO_VENDOR: { label: "Sold (Vendor)", variant: "neutral" },
  SOLD_TO_CUSTOMER: { label: "Sold (Customer)", variant: "neutral" },
  SCRAPPED: { label: "Scrapped", variant: "danger", icon: XCircle },

  // Production & Work Orders
  PLANNED: { label: "Planned", variant: "neutral" },
  SCHEDULED: { label: "Scheduled", variant: "info", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "info", icon: Activity },
  PAUSED: { label: "Paused", variant: "hold", icon: PauseCircle },
  COMPLETED: { label: "Completed", variant: "success", icon: CheckCircle2 },

  // Quotation & Sales
  SUBMITTED: { label: "Submitted", variant: "info" },
  PENDING_APPROVAL: { label: "Pending Approval", variant: "warning", icon: Clock },
  APPROVED: { label: "Approved", variant: "success", icon: CheckCircle2 },
  CONVERTED_TO_ORDER: { label: "Converted to Order", variant: "success", icon: CheckCircle2 },
  EXPIRED: { label: "Expired", variant: "neutral" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  FINANCIAL_CLEARANCE_PENDING: { label: "Clearance Pending", variant: "warning", icon: Clock },
  FINANCIALLY_CLEARED: { label: "Cleared", variant: "success", icon: ShieldCheck },
  READY_FOR_DISPATCH: { label: "Ready for Dispatch", variant: "info", icon: PackageCheck },
  DISPATCHED: { label: "Dispatched", variant: "success", icon: CheckCircle2 },
  DELIVERED: { label: "Delivered", variant: "success", icon: CheckCircle2 },

  // Procurement
  ORDERED: { label: "Ordered", variant: "info" },
  PARTIALLY_RECEIVED: { label: "Partially Received", variant: "warning", icon: Clock },
  RECEIVED: { label: "Received", variant: "success", icon: CheckCircle2 },

  // Finance & Invoicing
  PENDING: { label: "Pending", variant: "warning", icon: Clock },
  PARTIAL: { label: "Partial", variant: "warning" },
  PAID: { label: "Paid", variant: "success", icon: CheckCircle2 },
  OVERDUE: { label: "Overdue", variant: "danger", icon: AlertTriangle },

  // Service & RMA
  DIAGNOSIS_PENDING: { label: "Diagnosis Pending", variant: "warning", icon: Clock },
  DIAGNOSIS_COMPLETED: { label: "Diagnosed", variant: "info" },
  ESTIMATE_GENERATED: { label: "Estimate Generated", variant: "info" },
  WAITING_FOR_CUSTOMER_APPROVAL: { label: "Waiting Approval", variant: "warning", icon: Clock },
  MATERIAL_REQUESTED: { label: "Material Requested", variant: "warning" },
  MATERIAL_APPROVED: { label: "Material Approved", variant: "info" },
  MATERIAL_ISSUED: { label: "Material Issued", variant: "info" },
  REPAIR_IN_PROGRESS: { label: "Repairing", variant: "info", icon: Activity },
  REPAIR_COMPLETED: { label: "Repair Completed", variant: "success", icon: CheckCircle2 },
  QC_PENDING: { label: "QC Pending", variant: "warning", icon: Clock },
  QC_IN_PROGRESS: { label: "QC In Progress", variant: "info", icon: Activity },
  TEST_FAILED: { label: "Test Failed", variant: "danger", icon: XCircle },
  READY_FOR_DELIVERY: { label: "Ready for Delivery", variant: "info", icon: PackageCheck },
  PAYMENT_PENDING: { label: "Payment Pending", variant: "warning", icon: Clock },
  ON_HOLD: { label: "On Hold", variant: "hold", icon: PauseCircle },
  REOPENED: { label: "Reopened", variant: "warning", icon: AlertTriangle },
  SCRAP_RECOMMENDED: { label: "Scrap Recommended", variant: "danger", icon: AlertTriangle }
};

interface StatusBadgeProps {
  status?: string | null;
  customLabel?: string;
  variant?: StatusVariant;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  customLabel,
  variant,
  size = "sm",
  showIcon = true,
  className
}: StatusBadgeProps) {
  if (!status && !customLabel) return null;

  const normalizedKey = (status || "").toUpperCase().trim();
  const config = statusMap[normalizedKey] || {
    label: customLabel || status?.replace(/_/g, " ") || "Unknown",
    variant: variant || "neutral",
    icon: HelpCircle
  };

  const finalVariant = variant || config.variant;
  const label = customLabel || config.label;
  const IconComponent = config.icon;

  const variantStyles: Record<StatusVariant, string> = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    hold: "bg-orange-50 text-orange-800 border-orange-200"
  };

  const iconVariantColors: Record<StatusVariant, string> = {
    success: "text-emerald-600",
    info: "text-blue-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
    neutral: "text-[#526B91]",
    hold: "text-orange-600"
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4"
  };

  return (
    <span
      className={twMerge(
        "inline-flex items-center font-semibold rounded-md border tracking-tight shrink-0 select-none",
        variantStyles[finalVariant],
        sizeStyles[size],
        className
      )}
    >
      {showIcon && IconComponent && (
        <IconComponent className={clsx(iconSizes[size], iconVariantColors[finalVariant])} />
      )}
      <span>{label}</span>
    </span>
  );
}
