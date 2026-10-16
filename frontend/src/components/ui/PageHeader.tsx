import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { twMerge } from "tailwind-merge";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[] | React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  description,
  icon,
  breadcrumbs,
  actions,
  badge,
  className
}: PageHeaderProps) {
  const effectiveSubtitle = subtitle || description;

  return (
    <div className={twMerge("flex flex-col gap-1.5 pb-3.5 mb-4 border-b border-[#D8E8FA]", className)}>
      {breadcrumbs && (
        Array.isArray(breadcrumbs) ? (
          breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#526B91] mb-0.5">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={item.label + index}>
                    {index > 0 && <ChevronRight className="w-3 h-3 text-[#94A3B8] shrink-0" />}
                    {item.href && !isLast ? (
                      <Link
                        href={item.href}
                        className="hover:text-[#0878F9] transition-colors font-medium truncate max-w-[200px]"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className={twMerge("truncate max-w-[240px]", isLast ? "text-[#0B2148] font-semibold" : "font-medium")}>
                        {item.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )
        ) : (
          <div className="mb-0.5">{breadcrumbs}</div>
        )
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center border border-[#D8E8FA] shrink-0 shadow-xs">
              {icon}
            </div>
          )}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B2148] truncate">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {effectiveSubtitle && (
              typeof effectiveSubtitle === "string" ? (
                <p className="text-xs sm:text-sm text-[#526B91] max-w-3xl leading-snug">
                  {effectiveSubtitle}
                </p>
              ) : (
                effectiveSubtitle
              )
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
