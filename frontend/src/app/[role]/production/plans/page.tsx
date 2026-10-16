"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  FileText, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ProductionPlansPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  // --- DATA FETCHING ---
  const { data: listData, isLoading } = useQuery({
    queryKey: ["production-plan-list", status, page],
    queryFn: async () => {
      const res = await api.get("/crm/production/plans", {
        params: { status, page, limit: 10 }
      });
      return res.data;
    }
  });

  const plans = listData?.plans || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / 10) || 1;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      {/* Header */}
      <PageHeader
        title="Production Plans"
        subtitle={`Active Plans: ${totalCount} Scheduled Batches`}
        icon={<FileText className="w-5 h-5 text-[#0878F9]" />}
      />

      {/* Filters */}
      <div className="flex-none flex gap-4 items-center bg-[#F4F9FF] border border-[#D8E8FA] p-4 rounded-3xl">
        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PLANNED">Planned</option>
          <option value="RELEASED">Released</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Main Grid */}
      <div className="flex-1 glass-panel rounded-[2.5rem] border border-[#D8E8FA] overflow-hidden flex flex-col bg-[#F4F9FF]">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
          ) : plans.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="p-6">Plan Number</th>
                  <th className="p-6">Requirement</th>
                  <th className="p-6">Planned Quantity</th>
                  <th className="p-6">Planned Start Date</th>
                  <th className="p-6">Completion Target</th>
                  <th className="p-6">Supervisor</th>
                  <th className="p-6">Priority</th>
                  <th className="p-6">Status</th>
                  <th className="p-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-sm text-[#0B2148]">
                {plans.map((p: any) => (
                  <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 font-mono font-bold text-[#0B2148] text-xs">{p.planNumber}</td>
                    <td className="p-6 font-mono text-xs">{p.productionRequirement?.requirementNumber}</td>
                    <td className="p-6 font-mono font-bold text-[#0B2148]">{p.plannedQuantity}</td>
                    <td className="p-6 text-xs text-[#526B91] font-medium">
                      {new Date(p.plannedStartDate).toLocaleDateString()}
                    </td>
                    <td className="p-6 text-xs text-[#526B91] font-medium">
                      {new Date(p.plannedCompletionDate).toLocaleDateString()}
                    </td>
                    <td className="p-6 text-xs text-[#0B2148] font-semibold">{p.supervisor?.name}</td>
                    <td className="p-6">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        p.priority === "URGENT" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        "bg-slate-500/20 text-[#0B2148] border border-slate-500/30"
                      }`}>
                        {p.priority}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === "COMPLETED" || p.status === "CLOSED" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                        p.status === "RELEASED" ? "bg-teal-500/15 text-teal-400 border border-teal-500/20" :
                        "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-6">
                      <a 
                        href={`/${roleSlug}/production/plans/${p.id}`} 
                        className="flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                      >
                        Details
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-[#526B91]">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-base font-semibold">No Production Plans Found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex-none p-6 border-t border-[#D8E8FA] flex items-center justify-between">
          <p className="text-xs text-[#526B91] font-bold">
            Showing Page {page} of {totalPages} ({totalCount} Total Plans)
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-[#0B2148] disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-[#0B2148] disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
