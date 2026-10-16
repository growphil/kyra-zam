"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Search, 
  History, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Zap
} from "lucide-react";

function formatDateTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return dateStr;
  }
}

interface InwardBatch {
  id: string;
  inwardNumber: string;
  partNumber: string;
  batchNumber: string;
  quantity: number;
  availableQty: number;
  testedQty: number;
  rejectedQty: number;
  consumedQty: number;
  category: string;
  voltage: number;
  cycles: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  receivedBy: {
    id: string;
    name: string;
    email: string;
  };
  material?: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
  };
}

export default function InwardHistoryTable({ refreshKey }: { refreshKey?: number }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;

  const { data, isLoading } = useQuery<{
    batches: InwardBatch[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["inward-batches-history", page, search, refreshKey],
    queryFn: async () => {
      const res = await api.get("/cells/inward-batches", {
        params: { page, limit, search: search || undefined }
      });
      return res.data;
    },
    refetchInterval: 15000,
  });

  const getStatusBadge = (status: string, available: number, total: number) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Fully Tested
          </span>
        );
      case "IN_TESTING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="w-3 h-3 animate-pulse" /> In Testing ({total - available}/{total})
          </span>
        );
      case "RECEIVED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" /> Received (Pending Test)
          </span>
        );
    }
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-display font-bold text-[#0B2148] flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            Recent Inward Receipts
          </h3>
          <p className="text-xs text-[#526B91] mt-0.5">
            Audit history of all bulk cell batches received into inventory.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search SKU, Batch, Inward #..."
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent transition-all"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#D8E8FA] custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
            <tr>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Date & Time</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Inward #</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Part Number (SKU)</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Batch Number</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider text-right">Received</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider text-right">Available</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider text-right">Tested</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Specs</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Receiver</th>
              <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8F1FC]">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[#526B91]">
                  Loading inward history...
                </td>
              </tr>
            ) : !data?.batches || data.batches.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[#526B91]">
                  No inward batch receipts recorded yet.
                </td>
              </tr>
            ) : (
              data.batches.map((batch) => {
                const formattedDate = formatDateTime(batch.createdAt);
                return (
                  <tr key={batch.id} className="hover:bg-[#F4F9FF] transition-colors group">
                    <td className="px-4 py-3.5 text-[#526B91] whitespace-nowrap font-mono text-[11px]">
                      {formattedDate}
                    </td>
                    <td className="px-4 py-3.5 font-bold font-mono text-accent text-xs">
                      {batch.inwardNumber}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#0B2148] font-mono">
                      {batch.partNumber}
                    </td>
                    <td className="px-4 py-3.5 text-[#0B2148] font-mono text-[11px]">
                      {batch.batchNumber}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#0B2148] text-right">
                      {batch.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#166534] text-right">
                      {batch.availableQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-blue-400 text-right">
                      {batch.testedQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-[#526B91] text-[11px]">
                      {batch.category} • {batch.voltage}V
                    </td>
                    <td className="px-4 py-3.5 text-[#0B2148] text-[11px]">
                      {batch.receivedBy?.name || "System"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(batch.status, batch.availableQty, batch.quantity)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-[#526B91]">
          <div>
            Showing <span className="text-[#0B2148] font-bold">{((page - 1) * limit) + 1}</span> to{" "}
            <span className="text-[#0B2148] font-bold">{Math.min(page * limit, data.total)}</span> of{" "}
            <span className="text-[#0B2148] font-bold">{data.total}</span> inward records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 disabled:opacity-40 disabled:cursor-not-allowed text-[#0B2148] transition-all cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-[#0B2148] font-bold">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="p-2 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
