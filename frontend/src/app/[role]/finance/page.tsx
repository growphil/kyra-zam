"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  IndianRupee, 
  Search, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  FileText,
  User,
  ArrowUpRight,
  TrendingUp,
  Inbox,
  ClipboardList
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export default function FinanceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  // --- DATA FETCHING ---
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["finance-dashboard-stats"],
    queryFn: async () => (await api.get("/crm/finance/dashboard")).data
  });

  const { data: invoices } = useQuery({
    queryKey: ["finance-invoices-quick"],
    queryFn: async () => (await api.get("/crm/finance/invoices")).data || []
  });

  const stats = dashboardData?.stats || {};

  return (
    <div className="space-y-4 max-w-[1700px] pb-8">
      {/* Header */}
      <PageHeader
        title="Finance Workspace"
        subtitle="Sales Invoices, Tax Accounting, and Customer Receivables"
        icon={<IndianRupee className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => router.push(`/${roleSlug}/finance/invoices`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <ClipboardList className="w-4 h-4" />
            View Invoices Registry
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Invoiced Revenue", value: stats.totalInvoiced || 0, color: "text-blue-400" },
          { label: "Total Collections (Paid)", value: stats.totalCollected || 0, color: "text-[#166534]" },
          { label: "Outstanding Receivables", value: stats.totalOutstanding || 0, color: "text-amber-400" },
          { label: "Overdue Accounts Count", value: stats.overdueCount || 0, color: "text-red-400" }
        ].map(stat => (
          <div key={stat.label} className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white">
            <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
            <h4 className="text-xl font-display font-bold mt-1 text-[#0B2148]">
              {typeof stat.value === "number" && stat.label !== "Overdue Accounts Count" ? `₹ ${stat.value.toLocaleString()}` : stat.value}
            </h4>
          </div>
        ))}
      </div>

      {/* List of outstanding invoices */}
      <div className="glass-panel p-6 rounded-[2.5rem] border border-[#D8E8FA] bg-white space-y-4">
        <h3 className="text-lg font-display font-bold text-[#0B2148]">Outstanding Invoices</h3>
        {isLoading ? (
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
        ) : invoices && invoices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoices.filter((i: any) => i.status !== "PAID" && i.status !== "VOID").map((inv: any) => (
              <div key={inv.id} className="p-5 rounded-2xl border border-[#D8E8FA] bg-white/[0.01] flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0B2148] font-mono text-sm">{inv.invoiceNumber}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      inv.status === "ISSUED" ? "bg-blue-500/15 text-blue-400" :
                      inv.status === "PARTIALLY_PAID" ? "bg-amber-500/15 text-amber-400" :
                      "bg-slate-500/15 text-[#0B2148]"
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-[#526B91] mt-2">Customer: {inv.customer?.name} | SO Ref: {inv.salesOrder?.salesOrderNumber}</p>
                  <p className="text-[#526B91] text-[10px] mt-0.5">Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <p className="text-[#526B91] text-[9px] uppercase font-bold">Outstanding</p>
                    <p className="text-sm font-bold text-[#0B2148] font-mono">₹ {parseFloat(inv.outstandingAmount).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => router.push(`/${roleSlug}/finance/invoices/${inv.id}`)}
                    className="p-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#0B2148]"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[#526B91]">
            <Inbox className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-bold">No outstanding invoices</p>
          </div>
        )}
      </div>
    </div>
  );
}
