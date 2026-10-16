"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { 
  Settings, 
  ShieldCheck, 
  Battery, 
  Truck, 
  Users, 
  ShieldAlert,
  LayoutDashboard,
  ChevronRight,
  Shield,
  Building2,
  Warehouse
} from "lucide-react";

interface AdminHeaderProps {
  title: string;
  description: string;
  icon?: any;
  badgeText?: string;
}

export default function AdminHeader({ 
  title, 
  description, 
  icon: Icon = Settings,
  badgeText = "System Parameter Control"
}: AdminHeaderProps) {
  const pathname = usePathname();
  const params = useParams();
  const roleSlug = (params?.role as string) || "superadmin";

  const adminTabs = [
    { label: "Overview", href: `/${roleSlug}/admin-settings`, icon: LayoutDashboard, exact: true },
    { label: "Factory", href: `/${roleSlug}/admin-settings?tab=factory`, icon: Building2 },
    { label: "Warehouses", href: `/${roleSlug}/admin-settings?tab=warehouses`, icon: Warehouse },
    { label: "QC Limits", href: `/${roleSlug}/admin-settings?tab=qc`, icon: ShieldCheck },
    { label: "Vendors", href: `/${roleSlug}/admin-settings?tab=vendors`, icon: Truck },
    { label: "Personnel", href: `/${roleSlug}/admin-settings?tab=users`, icon: Users },
    { label: "Maintenance", href: `/${roleSlug}/admin-settings?tab=maintenance`, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* 1. Compact Breadcrumb & Access Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#526B91]">
          <Link href={`/${roleSlug}`} className="hover:text-[#0B2148] transition-colors">
            Workspace
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#526B91]" />
          <Link href={`/${roleSlug}/admin-settings`} className="hover:text-[#0B2148] transition-colors">
            Administration
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#526B91]" />
          <span className="text-[#0B2148] font-bold">{title}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 border border-amber-200/80 rounded-full text-amber-700 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
          <Shield className="w-3 h-3 text-amber-600" />
          <span>{badgeText}</span>
        </div>
      </div>

      {/* 2. Compact Hero Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#D8E8FA]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] shadow-2xs flex-shrink-0">
            <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-display font-bold text-[#0B2148] tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-xs text-[#526B91] font-medium tracking-tight">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Segmented Tab Navigation Control — Single View, Every Option with Defined Border, No Scroll */}
      <div className="bg-slate-50/70 p-1 rounded-xl border border-[#D8E8FA] shadow-2xs w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 w-full">
          {adminTabs.map((tab) => {
            const isActive = tab.exact 
              ? pathname === tab.href 
              : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`group relative flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all select-none border shadow-2xs ${
                  isActive 
                    ? "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9] font-bold ring-1 ring-[#0878F9]/20" 
                    : "bg-white text-slate-700 hover:text-[#0878F9] hover:bg-[#F4F9FF] border-[#D8E8FA] hover:border-[#0878F9]/40"
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? "text-[#0878F9]" : "text-[#526B91] group-hover:text-[#0878F9]"}`} />
                <span className="truncate tracking-tight">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
