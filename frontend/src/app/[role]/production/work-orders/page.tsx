"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  CheckCircle2, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function WorkOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  // Search, Filter & Pagination State
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25); // Default to 25 items per page

  // --- DATA FETCHING ---
  const { data: listData, isLoading, isRefetching } = useQuery({
    queryKey: ["production-work-order-list", status, page, limit],
    queryFn: async () => {
      const res = await api.get("/crm/production/work-orders", {
        params: { status, page, limit }
      });
      return res.data;
    }
  });

  const orders = listData?.orders || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const resetFilters = () => {
    setStatus("");
    setPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      if (start === 1) {
        end = maxVisiblePages;
      } else if (end === totalPages) {
        start = totalPages - maxVisiblePages + 1;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const startRange = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalCount);

  // Status metrics from current view page
  const completedCount = orders.filter((o: any) => o.status === "COMPLETED" || o.status === "CLOSED").length;
  const activeCount = orders.filter((o: any) => o.status === "IN_PROGRESS" || o.status === "READY").length;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4 text-[#0B2148]">
      
      {/* 1. Page Header */}
      <div className="flex-none flex items-center justify-between py-2 border-b border-[#D8E8FA]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B2148] flex items-center gap-2">
            Work Orders
            <span className="text-xs font-normal text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] px-2.5 py-0.5 rounded-full">
              {totalCount} total
            </span>
          </h1>
          <p className="text-xs text-[#526B91] mt-0.5">Operations instructions and routing statuses for production units</p>
        </div>
      </div>

      {/* 2. Compact KPI Summary Panel */}
      <div className="flex-none flex flex-wrap gap-8 items-center py-3 px-6 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-xs">
        
        {/* KPI 1: Total */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Total Orders</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-[#0B2148]">{totalCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">In operations queue</span>
          </div>
        </div>
        
        <div className="h-6 w-px bg-[#F4F9FF]" /> {/* Divider */}

        {/* KPI 2: Completed / Closed */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Completed / Closed</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-[#166534]">{completedCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Released items on page</span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#F4F9FF]" /> {/* Divider */}

        {/* KPI 3: In Progress / Ready */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">In Progress</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-accent">{activeCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Active assembly floor</span>
          </div>
        </div>
      </div>

      {/* 3. Search + Filter Toolbar */}
      <div className="flex-none flex flex-wrap gap-2 items-center py-1">
        
        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Status: All</option>
          <option value="CREATED">Created</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="READY">Ready</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="QC_PENDING">QC Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {status && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* 4. Professional Data Table Container */}
      <div className="flex-1 bg-[#F4F9FF]/10 border border-[#D8E8FA] rounded-xl overflow-hidden flex flex-col">
        
        <div className="flex-1 overflow-auto">
          {isLoading || isRefetching ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <span className="text-[11px] text-[#526B91] font-medium">Loading operations queue...</span>
            </div>
          ) : orders.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-semibold text-[#526B91] tracking-wider bg-white/[0.01]">
                  <th className="py-2.5 px-4 font-bold">WO Number</th>
                  <th className="py-2.5 px-4 font-bold">Plan Number</th>
                  <th className="py-2.5 px-4 font-bold">Product Ref</th>
                  <th className="py-2.5 px-4 font-bold">Planned Qty</th>
                  <th className="py-2.5 px-4 font-bold">Completed</th>
                  <th className="py-2.5 px-4 font-bold">Remaining</th>
                  <th className="py-2.5 px-4 font-bold">Supervisor</th>
                  <th className="py-2.5 px-4 font-bold">Due Date</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                  <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {orders.map((wo: any) => {
                  return (
                    <tr key={wo.id} className="hover:bg-white/[0.01] transition-colors group">
                      
                      {/* WO Number */}
                      <td className="py-3 px-4 font-mono font-bold text-xs text-[#0B2148]">
                        {wo.workOrderNumber}
                      </td>

                      {/* Plan Number */}
                      <td className="py-3 px-4 font-mono font-medium text-[#0B2148]">
                        {wo.productionPlan?.planNumber}
                      </td>

                      {/* Product Ref */}
                      <td className="py-3 px-4 font-medium text-[#526B91]">
                        {wo.productRef || "-"}
                      </td>

                      {/* Planned Qty */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">
                        {wo.plannedQuantity}
                      </td>

                      {/* Completed */}
                      <td className="py-3 px-4 font-mono text-[#0B2148]">
                        {wo.completedQuantity}
                      </td>

                      {/* Remaining */}
                      <td className="py-3 px-4 font-mono font-bold text-accent">
                        {wo.remainingQuantity}
                      </td>

                      {/* Supervisor */}
                      <td className="py-3 px-4 font-medium text-[#0B2148]">
                        {wo.supervisor?.name || "Unassigned"}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 text-[#526B91]">
                        {new Date(wo.dueDate).toLocaleDateString()}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                          wo.status === "COMPLETED" || wo.status === "CLOSED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          wo.status === "READY" || wo.status === "IN_PROGRESS" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {wo.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <a 
                          href={`/${roleSlug}/production/work-orders/${wo.id}`} 
                          className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent hover:text-white transition-colors cursor-pointer"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-[#526B91]">
              <CheckCircle2 className="w-10 h-10 mb-2 opacity-30 text-[#526B91]" />
              <p className="font-semibold text-[#0B2148]">No Work Orders Found</p>
              <p className="text-xs mt-0.5 text-[#526B91]">Refine filters or wait for planning unit release.</p>
            </div>
          )}
        </div>

        {/* 5. Pagination Area */}
        <div className="flex-none py-3 px-4 border-t border-[#D8E8FA] flex items-center justify-between bg-white/[0.01]">
          
          {/* Left: Range count */}
          <div className="text-xs text-[#526B91] font-medium">
            Showing <span className="font-semibold text-[#0B2148]">{startRange}–{endRange}</span> of <span className="font-semibold text-[#0B2148]">{totalCount}</span> work orders
          </div>

          {/* Right: page list selectors & limit */}
          <div className="flex items-center gap-6">
            
            {/* Rows Per Page */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#526B91] font-bold uppercase tracking-wider">Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent/60 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Range Numbers */}
            <div className="flex items-center gap-1">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 text-[#526B91] hover:text-white disabled:opacity-30 disabled:hover:text-[#526B91] transition-colors text-xs font-semibold cursor-pointer"
              >
                Previous
              </button>

              {getPageNumbers().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                    page === p
                      ? "bg-accent/20 text-accent font-extrabold"
                      : "text-[#526B91] hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 text-[#526B91] hover:text-white disabled:opacity-30 disabled:hover:text-[#526B91] transition-colors text-xs font-semibold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
