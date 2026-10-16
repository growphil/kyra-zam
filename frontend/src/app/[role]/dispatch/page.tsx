"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Truck, 
  Search, 
  Loader2, 
  ArrowUpRight, 
  Inbox, 
  ClipboardList 
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DispatchDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  // --- DATA FETCHING ---
  const { data: dashboardData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["dispatch-dashboard-stats"],
    queryFn: async () => (await api.get("/crm/dispatch/dashboard")).data
  });

  const { data: orders, isLoading: isOrdersLoading } = useQuery({
    queryKey: ["dispatch-orders-quick"],
    queryFn: async () => (await api.get("/crm/dispatch/orders")).data || []
  });

  const stats = dashboardData?.stats || {};

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      
      {/* Compact Page Header */}
      <PageHeader
        title="Logistics & Dispatch"
        subtitle="Fulfillment Deliveries Tracking Dashboard"
        icon={<Truck className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => router.push(`/${roleSlug}/dispatch/orders`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            View All Dispatch Orders
          </button>
        }
      />

      {/* KPI Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: "Ready to Pick / Picking", value: (stats.pending || 0) + (stats.picking || 0), text: "text-[#92400E]", bg: "bg-[#FEF3C7]/40" },
          { label: "Awaiting Packing", value: stats.packing || 0, text: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]/40" },
          { label: "Ready / In Transit", value: (stats.readyToDispatch || 0) + (stats.inTransit || 0), text: "text-[#6B21A8]", bg: "bg-[#F3E8FF]/40" },
          { label: "Successfully Delivered", value: stats.delivered || 0, text: "text-[#166534]", bg: "bg-[#DCFCE7]/40" }
        ].map(stat => (
          <div key={stat.label} className="p-3.5 rounded-xl border border-[#D8E8FA] bg-white shadow-2xs">
            <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
            <h4 className={`text-xl font-display font-bold mt-0.5 ${stat.text}`}>{stat.value}</h4>
          </div>
        ))}
      </div>

      {/* List of dispatches */}
      <div className="p-5 rounded-xl border border-[#D8E8FA] bg-white shadow-2xs space-y-4">
        <h3 className="text-sm font-display font-bold text-[#0B2148] uppercase tracking-wider">Active Delivery Workloads</h3>
        {isOrdersLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
          </div>
        ) : orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {orders.map((ord: any) => (
              <div key={ord.id} className="p-3.5 rounded-xl border border-[#D8E8FA] bg-[#F4F9FF]/60 hover:bg-[#F4F9FF] transition-colors flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0B2148] font-mono text-xs">{ord.dispatchNumber}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center ${
                      ord.status === "DELIVERED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
                      ord.status === "IN_TRANSIT" ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]" :
                      "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                    }`}>
                      {ord.status}
                    </span>
                  </div>
                  <p className="text-[#526B91] text-xs mt-1.5 font-medium">SO Ref: <span className="font-mono text-[#0B2148]">{ord.salesOrder?.salesOrderNumber}</span> | Customer: <span className="text-[#0B2148] font-semibold">{ord.customer?.name}</span></p>
                  <p className="text-[#64748B] text-[11px] mt-0.5 truncate max-w-md">Dest: {ord.deliveryAddressSnapshot}</p>
                </div>
                <button 
                  onClick={() => router.push(`/${roleSlug}/dispatch/orders/${ord.id}`)}
                  className="p-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-lg text-[#0B2148] transition-colors cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 text-[#0878F9]" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[#526B91]">
            <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#526B91]" />
            <p className="font-bold text-sm text-[#0B2148]">No active dispatches found</p>
            <p className="text-xs text-[#526B91] mt-0.5">All pending deliveries have been cleared</p>
          </div>
        )}
      </div>
    </div>
  );
}
