"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ClipboardList, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Building2,
  Calendar,
  Box
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ProductionRequirementsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  // Search, Filter & Pagination State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // --- DATA FETCHING ---
  const { data: listData, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["production-requirement-list", search, status, priority, page, limit],
    queryFn: async () => {
      const res = await api.get("/crm/production/requirements", {
        params: { search, status, priority, page, limit }
      });
      return res.data;
    }
  });

  const reqs = listData?.requirements || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Quick KPI aggregations from current page / overall context
  const pendingCount = reqs.filter((r: any) => r.status === "PENDING" || r.status === "MATERIAL_CHECK").length;
  const inProdCount = reqs.filter((r: any) => r.status === "IN_PRODUCTION" || r.status === "READY" || r.status === "PLANNED").length;
  const completedCount = reqs.filter((r: any) => r.status === "COMPLETED" || r.status === "CLOSED").length;
  const urgentCount = reqs.filter((r: any) => r.priority === "URGENT" || r.priority === "HIGH").length;

  const isFilterActive = Boolean(search || status || priority);

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setPage(1);
  };

  const startRange = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      if (start === 1) end = maxVisible;
      else if (end === totalPages) start = totalPages - maxVisible + 1;
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const getAvatarInitials = (name: string) => {
    if (!name) return "CU";
    return name
      .split(" ")
      .map(p => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-3.5 max-w-[1700px] mx-auto overflow-hidden pb-4 text-[#0B2148]">
      
      {/* 1. Header Section */}
      <div className="flex-none flex items-center justify-between py-1 border-b border-[#D8E8FA]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B2148] flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-accent" />
            Production Requirements
            <span className="text-xs font-semibold text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] px-2.5 py-0.5 rounded-full font-mono">
              {totalCount} Total Listed
            </span>
          </h1>
          <p className="text-xs text-[#526B91] mt-0.5">
            Manufacturing demands converted from sales orders, scheduled batches & material allocation queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] hover:text-[#0878F9] hover:bg-[#EAF5FF] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Requirements"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#526B91] ${isRefetching ? "animate-spin text-accent" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href={`/${roleSlug}/production`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 shadow-sm border border-[#D8E8FA] transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Production Hub</span>
          </Link>
        </div>
      </div>

      {/* 2. Executive KPI Metrics Ribbon */}
      <div className="flex-none grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 px-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-xs">
        
        {/* KPI 1: Total Demand */}
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1.5">
            <Box className="w-3 h-3 text-accent" />
            Demand Pipeline
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-base font-bold text-[#0B2148] font-mono">{totalCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Requirements logged</span>
          </div>
        </div>

        {/* KPI 2: Active In Production / Ready */}
        <div className="flex flex-col justify-center border-l border-[#D8E8FA] pl-4">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#166534]" />
            Active / Ready
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-base font-bold text-[#166534] font-mono">{inProdCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">In execution flow</span>
          </div>
        </div>

        {/* KPI 3: Pending Material Checks */}
        <div className="flex flex-col justify-center border-l border-[#D8E8FA] pl-4">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-400" />
            Pending Check
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-base font-bold text-amber-400 font-mono">{pendingCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Awaiting evaluation</span>
          </div>
        </div>

        {/* KPI 4: High Priority */}
        <div className="flex flex-col justify-center border-l border-[#D8E8FA] pl-4">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-red-400" />
            Urgent / High
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-base font-bold text-red-400 font-mono">{urgentCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Priority expedite</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex-none flex flex-wrap gap-2 items-center py-1">
        
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search by Requirement #, Product, Customer or Sales Order..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-accent/60 transition-colors"
          />
        </div>

        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Status: All Statuses</option>
          <option value="PENDING">Pending Check</option>
          <option value="MATERIAL_CHECK">Material Checking</option>
          <option value="READY">Ready for Production</option>
          <option value="PLANNED">Planned</option>
          <option value="IN_PRODUCTION">In Production</option>
          <option value="COMPLETED">Completed</option>
          <option value="CLOSED">Closed</option>
          <option value="MATERIAL_SHORTAGE">Material Shortage</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select 
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Priority: All</option>
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        {isFilterActive && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* 4. Elegant Main Data Table Container */}
      <div className="flex-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl overflow-hidden flex flex-col shadow-xl">
        
        <div className="flex-1 overflow-auto">
          {isLoading || isRefetching ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 py-16">
              <Loader2 className="w-7 h-7 text-accent animate-spin" />
              <span className="text-xs text-[#526B91] font-medium">Loading requirements stream...</span>
            </div>
          ) : reqs.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-white/[0.015] sticky top-0 z-10 backdrop-blur-md">
                  <th className="py-3 px-4 font-bold">Requirement #</th>
                  <th className="py-3 px-4 font-bold">Sales Order</th>
                  <th className="py-3 px-4 font-bold">Customer</th>
                  <th className="py-3 px-4 font-bold">Specification / Product</th>
                  <th className="py-3 px-4 font-bold text-center">Target Qty</th>
                  <th className="py-3 px-4 font-bold">Target Delivery</th>
                  <th className="py-3 px-4 font-bold">Priority</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {reqs.map((req: any) => {
                  const productName = req.salesOrderItem?.description || req.productRef || "Standard Battery Pack Unit";
                  const plansCount = req.plans?.length || 0;

                  return (
                    <tr 
                      key={req.id} 
                      className="hover:bg-[#F4F9FF] transition-colors group cursor-default"
                    >
                      {/* 1. Requirement ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                          <span className="font-mono font-bold text-[#0B2148] text-xs group-hover:text-accent transition-colors">
                            {req.requirementNumber}
                          </span>
                        </div>
                      </td>

                      {/* 2. Sales Order */}
                      <td className="py-3 px-4 font-mono text-xs">
                        {req.salesOrder?.salesOrderNumber ? (
                          <span className="text-[#0B2148] bg-[#F4F9FF] border border-[#D8E8FA] px-2 py-0.5 rounded font-mono text-[11px]">
                            {req.salesOrder.salesOrderNumber}
                          </span>
                        ) : (
                          <span className="text-[#526B91]">-</span>
                        )}
                      </td>

                      {/* 3. Customer */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-center text-[9px] font-bold text-[#0B2148]">
                            {getAvatarInitials(req.customer?.name)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#0B2148]">
                              {req.customer?.name || "Unassigned Customer"}
                            </span>
                            {req.customer?.email && (
                              <span className="text-[10px] text-[#526B91] truncate max-w-[160px]">
                                {req.customer.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Product Ref / Specification */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#0B2148] line-clamp-1 max-w-[280px]">
                            {productName}
                          </span>
                          {plansCount > 0 && (
                            <span className="text-[10px] text-[#166534]/80 font-mono mt-0.5">
                              ✓ {plansCount} Plan{plansCount > 1 ? "s" : ""} Linked
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Target Quantity */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-[#0B2148] bg-[#F4F9FF] border border-[#D8E8FA] px-2.5 py-1 rounded-md text-xs inline-block">
                          {req.requiredQuantity} <span className="text-[10px] font-normal text-[#526B91]">units</span>
                        </span>
                      </td>

                      {/* 6. Required Delivery Date */}
                      <td className="py-3 px-4 text-[#0B2148]">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-[#526B91] shrink-0" />
                          <span>
                            {req.requiredDeliveryDate 
                              ? new Date(req.requiredDeliveryDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                })
                              : "-"}
                          </span>
                        </div>
                      </td>

                      {/* 7. Priority Pill */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          req.priority === "URGENT" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          req.priority === "HIGH" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                          req.priority === "NORMAL" ? "bg-slate-500/10 text-[#0B2148] border-slate-500/20" :
                          "bg-slate-500/5 text-[#526B91] border-[#D8E8FA]"
                        }`}>
                          {req.priority}
                        </span>
                      </td>

                      {/* 8. Status Pill */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                          req.status === "COMPLETED" || req.status === "CLOSED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          req.status === "IN_PRODUCTION" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          req.status === "READY" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" :
                          req.status === "MATERIAL_SHORTAGE" || req.status === "CANCELLED" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          req.status === "PLANNED" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            req.status === "COMPLETED" ? "bg-emerald-400" :
                            req.status === "IN_PRODUCTION" ? "bg-blue-400" :
                            req.status === "READY" ? "bg-teal-400" :
                            "bg-amber-400"
                          }`} />
                          {req.status}
                        </span>
                      </td>

                      {/* 9. Actions Column */}
                      <td className="py-3 px-4 text-right">
                        <Link 
                          href={`/${roleSlug}/production/requirements/${req.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent/20 border border-accent/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        >
                          <span>Manage</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-16 text-[#526B91]">
              <ClipboardList className="w-10 h-10 mb-2 opacity-30 text-[#526B91]" />
              <p className="font-semibold text-[#0B2148]">No Production Requirements Found</p>
              <p className="text-xs mt-0.5 text-[#526B91]">Try adjusting your search query or status filter.</p>
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#0B2148] text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Pagination Area */}
        <div className="flex-none py-2.5 px-4 border-t border-[#D8E8FA] flex items-center justify-between bg-white/[0.01]">
          
          {/* Left: Range count */}
          <div className="text-xs text-[#526B91] font-medium">
            Showing <span className="font-semibold text-[#0B2148]">{startRange}–{endRange}</span> of <span className="font-semibold text-[#0B2148]">{totalCount}</span> requirements
          </div>

          {/* Right: page list selectors & limit */}
          <div className="flex items-center gap-5">
            
            {/* Rows Per Page */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Per page:</span>
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
              </select>
            </div>

            {/* Pagination Range Numbers */}
            <div className="flex items-center gap-1">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 text-[#526B91] hover:text-white disabled:opacity-30 disabled:hover:text-[#526B91] transition-colors text-xs font-semibold cursor-pointer"
              >
                Prev
              </button>

              {getPageNumbers().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                    page === p
                      ? "bg-accent/20 text-accent font-extrabold border border-accent/30"
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
