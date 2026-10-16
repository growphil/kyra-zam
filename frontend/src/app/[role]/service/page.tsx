"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Shield, 
  Wrench, 
  ClipboardList, 
  Loader2, 
  ArrowUpRight,
  TrendingUp,
  Inbox,
  AlertTriangle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";

export default function ServiceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  // --- DATA FETCHING ---
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["service-dashboard-stats"],
    queryFn: async () => (await api.get("/crm/warranty/dashboard")).data
  });

  const stats = dashboardData?.stats || {};

  return (
    <div className="space-y-4 max-w-[1700px] pb-8">
      {/* Header */}
      <PageHeader
        title="After-Sales & Warranty"
        subtitle="Warranty Claims, Eligibility Auditing, and Repaired Battery Tracking"
        icon={<Wrench className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => router.push(`/${roleSlug}/service/warranties`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] text-white font-bold text-xs hover:bg-[#0667DB] transition-all cursor-pointer shadow-xs"
            >
              <Shield className="w-4 h-4" />
              Warranty Registry
            </button>
            <button 
              onClick={() => router.push(`/${roleSlug}/inventory/service`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#0B2148] font-bold text-xs hover:border-[#0878F9]/30 transition-all cursor-pointer shadow-xs"
            >
              <ClipboardList className="w-4 h-4 text-[#0878F9]" />
              Service Intake Workspace
            </button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Active Warranties", value: stats.activeCount || 0, desc: "Delivered products with active contracts" },
          { label: "Expired Warranties", value: stats.expiredCount || 0, desc: "Out-of-warranty customer batteries" },
          { label: "Repairs In Progress", value: stats.srvProgress || 0, desc: "Batteries undergoing diagnostic/technician fix" }
        ].map(stat => (
          <div key={stat.label} className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-2">
            <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
            <h4 className="text-3xl font-display font-bold text-[#0B2148]">
              {isLoading ? <Loader2 className="w-6 h-6 text-accent animate-spin" /> : stat.value}
            </h4>
            <p className="text-xs text-[#526B91]">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* Overview information info alert */}
      <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
        <h3 className="text-lg font-display font-bold text-[#0B2148]">Quick Reference Guideline</h3>
        <p className="text-xs text-[#526B91] leading-relaxed">
          Warranty contracts are activated upon successful courier delivery (based on completed Proof of Delivery dates).
          When intake technicians receive defective battery packs under the <strong>Service Intake Workspace</strong>, 
          they scan or enter original serial identifiers to evaluate coverage bounds automatically.
        </p>
      </div>

    </div>
  );
}
