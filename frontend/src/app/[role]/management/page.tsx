"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Building2, 
  Search, 
  Loader2, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  ShieldCheck,
  ShoppingBag,
  IndianRupee,
  Layers,
  Wrench,
  AlertCircle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function ManagementControlTowerPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [datePreset, setDatePreset] = useState("30d");

  // Determine dates based on preset
  const getDates = () => {
    const end = new Date();
    const start = new Date();
    if (datePreset === "today") {
      start.setHours(0,0,0,0);
    } else if (datePreset === "7d") {
      start.setDate(end.getDate() - 7);
    } else if (datePreset === "30d") {
      start.setDate(end.getDate() - 30);
    } else if (datePreset === "year") {
      start.setMonth(0, 1);
    }
    return { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
  };

  const dates = getDates();

  // --- DATA FETCHING ---
  const { data: ctData, isLoading } = useQuery({
    queryKey: ["reports-control-tower", datePreset],
    queryFn: async () => {
      const res = await api.get("/reports/control-tower", { params: dates });
      return res.data;
    }
  });

  const sales = ctData?.sales || {};
  const production = ctData?.production || {};
  const inventory = ctData?.inventory || {};
  const quality = ctData?.quality || {};
  const dispatch = ctData?.dispatch || {};
  const finance = ctData?.finance || {};
  const service = ctData?.service || {};
  const alerts = ctData?.alerts || [];

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="ERP Control Tower"
        description="Cross-Module Business Intelligence and Operational Executive Analytics"
        icon={<Building2 className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex gap-1 bg-[#F4F9FF] p-1 border border-[#D8E8FA] rounded-xl self-start">
            {[
              { label: "Today", value: "today" },
              { label: "Last 7 Days", value: "7d" },
              { label: "Last 30 Days", value: "30d" },
              { label: "This Year", value: "year" }
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  datePreset === preset.value 
                    ? "bg-[#0878F9] text-white shadow-xs" 
                    : "text-[#526B91] hover:text-[#0878F9] hover:bg-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center p-24 bg-white rounded-2xl border border-[#D8E8FA]">
          <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin" />
        </div>
      ) : (
        <>
          {/* Executive KPI modules cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Sales Dashboard card */}
            <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
              <div className="flex justify-between items-center text-[#526B91] text-xs font-bold uppercase tracking-wider">
                <span>Sales Module</span>
                <div className="w-7 h-7 rounded-lg bg-[#EAF5FF] flex items-center justify-center text-[#0878F9]">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Total Quotes:</span>
                  <span className="text-[#0B2148] font-bold">{sales.totalQuotations || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Conversion Rate:</span>
                  <span className="text-[#0B2148] font-bold">{sales.quotationConversionRate?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#E8F1FC] pt-2">
                  <span className="text-[#526B91] font-semibold">Sales Order Value:</span>
                  <span className="text-[#0878F9] font-bold font-mono">₹ {(sales.totalSalesOrderValue || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Production Dashboard card */}
            <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
              <div className="flex justify-between items-center text-[#526B91] text-xs font-bold uppercase tracking-wider">
                <span>Production Module</span>
                <div className="w-7 h-7 rounded-lg bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED]">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Active Work Orders:</span>
                  <span className="text-[#0B2148] font-bold">{production.activeWorkOrders || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Completion Rate:</span>
                  <span className="text-[#0B2148] font-bold">{production.productionCompletionRate?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#E8F1FC] pt-2">
                  <span className="text-[#526B91] font-semibold">Total Planned:</span>
                  <span className="text-[#7C3AED] font-bold font-mono">{production.plannedProduction || 0} units</span>
                </div>
              </div>
            </div>

            {/* Finance Dashboard card */}
            <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
              <div className="flex justify-between items-center text-[#526B91] text-xs font-bold uppercase tracking-wider">
                <span>Finance Module</span>
                <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] flex items-center justify-center text-[#166534]">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Total Invoiced:</span>
                  <span className="text-[#0B2148] font-bold font-mono">₹ {(finance.totalInvoiced || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Total Collected:</span>
                  <span className="text-[#166534] font-bold font-mono">₹ {(finance.totalCollected || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#E8F1FC] pt-2">
                  <span className="text-[#526B91] font-semibold">Outstanding:</span>
                  <span className="text-[#92400E] font-bold font-mono">₹ {(finance.totalOutstanding || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Service Dashboard card */}
            <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
              <div className="flex justify-between items-center text-[#526B91] text-xs font-bold uppercase tracking-wider">
                <span>Service Module</span>
                <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#92400E]">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Active Warranties:</span>
                  <span className="text-[#0B2148] font-bold">{service.activeWarranties || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#526B91]">Repairs in progress:</span>
                  <span className="text-[#0B2148] font-bold">{service.repairsInProgress || 0}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#E8F1FC] pt-2">
                  <span className="text-[#526B91] font-semibold">Open Tickets:</span>
                  <span className="text-[#92400E] font-bold">{service.openServiceRequests || 0}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Core Analytics Blocks: Alerts & Shortages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Real-time Alerts Panel */}
            <div className="bg-white p-6 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
              <h3 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#DC2626]" />
                Operational Alerts Control
              </h3>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((al: any, idx: number) => {
                    const isCritical = al.severity === "CRITICAL" || al.severity === "HIGH";
                    const isWarn = al.severity === "MEDIUM" || al.severity === "WARN";
                    
                    const cardBg = isCritical 
                      ? "bg-[#FEE2E2] border-[#FECACA]" 
                      : isWarn 
                      ? "bg-[#FEF3C7] border-[#FDE68A]" 
                      : "bg-[#DBEAFE] border-[#BFDBFE]";
                      
                    const badgeBg = isCritical 
                      ? "bg-[#991B1B] text-white" 
                      : isWarn 
                      ? "bg-[#92400E] text-white" 
                      : "bg-[#1D4ED8] text-white";
                      
                    const titleColor = isCritical ? "text-[#991B1B]" : isWarn ? "text-[#92400E]" : "text-[#1D4ED8]";
                    const descColor = isCritical ? "text-[#7F1D1D]" : isWarn ? "text-[#78350F]" : "text-[#1E40AF]";

                    return (
                      <div key={idx} className={`p-4 rounded-xl border ${cardBg} flex items-start gap-3 transition-colors`}>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${badgeBg}`}>
                          {al.severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs font-bold ${titleColor}`}>{al.title}</h4>
                          <p className={`text-[11px] font-medium ${descColor} mt-0.5 leading-relaxed`}>{al.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-[#64748B] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <Inbox className="w-10 h-10 mx-auto mb-2 text-[#94A3B8]" />
                  <p className="text-xs font-semibold text-[#526B91]">No active operational alerts</p>
                </div>
              )}
            </div>

            {/* Inventory Shortages Panel */}
            <div className="bg-white p-6 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
              <h3 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0878F9]" />
                Active Material Shortages
              </h3>
              {inventory.shortages && inventory.shortages.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[#D8E8FA]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F4F9FF] text-[#526B91] font-bold uppercase tracking-wider border-b border-[#D8E8FA] text-[10px]">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Material Name</th>
                        <th className="p-3 text-right">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                      {inventory.shortages.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="p-3 font-mono font-bold text-[#0878F9]">{item.materialCode}</td>
                          <td className="p-3 font-medium text-[#0B2148]">{item.name}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#991B1B]">{item.shortage} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-[#64748B] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-[#166534]/50" />
                  <p className="text-xs font-semibold text-[#526B91]">All materials sufficiently stocked</p>
                </div>
              )}
            </div>

          </div>

          {/* Receivables Aging breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-[#D8E8FA] shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[#0B2148]">Receivables Aging Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {[
                { label: "Current / Unpaid", value: finance.aging?.current || 0, severity: "neutral" },
                { label: "1–30 Days Overdue", value: finance.aging?.age1To30 || 0, severity: "neutral" },
                { label: "31–60 Days Overdue", value: finance.aging?.age31To60 || 0, severity: "warn" },
                { label: "61–90 Days Overdue", value: finance.aging?.age61To90 || 0, severity: "hold" },
                { label: "90+ Days Overdue", value: finance.aging?.age90Plus || 0, severity: "danger" }
              ].map(age => {
                const hasValue = age.value > 0;
                let cardStyle = "bg-[#F4F9FF] border-[#D8E8FA] text-[#0B2148]";
                let labelStyle = "text-[#526B91]";
                let valStyle = "text-[#0B2148]";

                if (hasValue) {
                  if (age.severity === "warn") {
                    cardStyle = "bg-[#FEF3C7] border-[#FDE68A]";
                    labelStyle = "text-[#92400E]";
                    valStyle = "text-[#92400E]";
                  } else if (age.severity === "hold") {
                    cardStyle = "bg-[#FFEDD5] border-[#FED7AA]";
                    labelStyle = "text-[#9A3412]";
                    valStyle = "text-[#9A3412]";
                  } else if (age.severity === "danger") {
                    cardStyle = "bg-[#FEE2E2] border-[#FECACA]";
                    labelStyle = "text-[#991B1B]";
                    valStyle = "text-[#991B1B]";
                  }
                }

                return (
                  <div key={age.label} className={`p-4 rounded-xl border ${cardStyle} text-center transition-all`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${labelStyle}`}>{age.label}</p>
                    <p className={`text-base font-bold font-mono mt-1 ${valStyle}`}>₹ {age.value.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
