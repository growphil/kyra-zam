"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Truck, 
  Search, 
  Loader2, 
  ArrowUpRight,
  ClipboardList,
  ArrowLeft
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DispatchOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // --- DATA FETCHING ---
  const { data: orders, isLoading } = useQuery({
    queryKey: ["dispatch-orders-list", statusFilter],
    queryFn: async () => {
      const res = await api.get("/crm/dispatch/orders", {
        params: { status: statusFilter || undefined }
      });
      return res.data || [];
    }
  });

  const filtered = orders?.filter((ord: any) => 
    ord.dispatchNumber.toLowerCase().includes(search.toLowerCase()) ||
    ord.salesOrder?.salesOrderNumber.toLowerCase().includes(search.toLowerCase()) ||
    ord.customer?.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      
      {/* Compact Page Header */}
      <PageHeader
        title="Dispatch Order Registry"
        subtitle={`Picking, Packing, and Courier Shipment manifests (${filtered.length} Orders)`}
        icon={<Truck className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => router.push(`/${roleSlug}/dispatch`)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#0B2148] font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#526B91]" />
            Back to Dashboard
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-4 items-center bg-white border border-[#D8E8FA] p-3.5 rounded-xl shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search dispatches (DO, SO, Customer)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg pl-10 pr-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
        >
          <option value="">All Statuses</option>
          <option value="READY_TO_PICK">Ready to Pick</option>
          <option value="PICKED">Picked</option>
          <option value="PACKED">Packed</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="DELIVERY_EXCEPTION">Exception</option>
        </select>
      </div>

      {/* Main Registry Grid */}
      <div className="bg-white rounded-xl border border-[#D8E8FA] overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                <th className="px-4 py-3">DO Number</th>
                <th className="px-4 py-3">Sales Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Planned Date</th>
                <th className="px-4 py-3">Carrier / Tracking</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
              {filtered.map((ord: any) => (
                <tr key={ord.id} className="hover:bg-[#F4F9FF]/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#0B2148] text-xs">{ord.dispatchNumber}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#526B91]">{ord.salesOrder?.salesOrderNumber}</td>
                  <td className="px-4 py-3 font-semibold text-[#0B2148]">{ord.customer?.name}</td>
                  <td className="px-4 py-3 text-[#526B91] font-medium">
                    {new Date(ord.plannedDispatchDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-[#526B91]">
                    {ord.carrier ? `${ord.carrier} (${ord.trackingNumber || "No Tracking"})` : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
                      ord.status === "DELIVERED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
                      ord.status === "IN_TRANSIT" ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]" :
                      ord.status === "PACKED" || ord.status === "PICKED" ? "bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF]" :
                      "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                    }`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => router.push(`/${roleSlug}/dispatch/orders/${ord.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0878F9] hover:underline ml-auto cursor-pointer"
                    >
                      Process DO
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 text-[#526B91]">
            <ClipboardList className="w-10 h-10 mb-3 opacity-40 text-[#526B91]" />
            <p className="text-sm font-semibold text-[#0B2148]">No dispatch orders match criteria</p>
            <p className="text-xs text-[#526B91] mt-0.5">Try clearing your filters or check back later</p>
          </div>
        )}
      </div>
    </div>
  );
}
