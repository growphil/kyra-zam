"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Package, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Bookmark
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import PageHeader from "@/components/ui/PageHeader";

export default function FinishedGoodsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // --- DATA FETCHING ---
  const { data: listData, isLoading } = useQuery({
    queryKey: ["quality-finished-goods-list", search, page],
    queryFn: async () => {
      const res = await api.get("/crm/quality/finished-goods", {
        params: { search, page, limit: 10 }
      });
      return res.data;
    }
  });

  const packs = listData?.packs || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / 10) || 1;

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-6">
      {/* Compact Standard Page Header */}
      <PageHeader
        title="Finished Goods Inventory"
        description="Ready-for-sale battery packs buffer and warehouse dispatch staging"
        icon={<Package className="w-5 h-5" />}
        breadcrumbs={[
          { label: "Inventory", href: `/${roleSlug}/inventory` },
          { label: "Finished Goods" }
        ]}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input 
              type="text" 
              placeholder="Search finished packs (Serial)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent"
            />
          </div>
        }
      />

      {/* Main Grid */}
      <div className="bg-white rounded-2xl border border-[#D8E8FA] overflow-hidden shadow-xs flex flex-col">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#526B91]">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-xs font-semibold">Loading finished goods...</p>
            </div>
          ) : packs.length > 0 ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">Pack Serial</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Work Order</th>
                  <th className="px-4 py-3">Assembled At</th>
                  <th className="px-4 py-3">QC Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {packs.map((p: any) => (
                  <tr key={p.paxSerial} className="hover:bg-[#F4F9FF] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B2148] text-xs">{p.paxSerial}</td>
                    <td className="px-4 py-3 text-xs text-[#0B2148] font-semibold">{p.paxType?.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#526B91]">{p.workOrder?.workOrderNumber || "-"}</td>
                    <td className="px-4 py-3 text-xs text-[#526B91] font-medium font-mono">
                      {new Date(p.assembledAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a 
                        href={`/${roleSlug}/pax/all`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0878F9] hover:underline"
                      >
                        Traceability
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-[#526B91]">
              <Package className="w-10 h-10 mb-3 text-[#526B91]/40" />
              <p className="text-sm font-semibold text-[#0B2148]">No Finished Battery Packs Found</p>
              <p className="text-xs text-[#526B91] mt-0.5">Assembled packs passing final QC and packing will appear here.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-[#D8E8FA] flex items-center justify-between text-xs text-[#526B91]">
            <p>
              Showing Page <span className="font-bold text-[#0B2148]">{page}</span> of <span className="font-bold text-[#0B2148]">{totalPages}</span> ({totalCount} Total Finished Packs)
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 bg-white border border-[#D8E8FA] rounded-lg text-[#0B2148] hover:bg-[#EAF5FF] disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-bold text-[#0B2148]">{page} / {totalPages}</span>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 bg-[#0878F9] hover:bg-[#0667DB] rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
