"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  RefreshCw, 
  Loader2, 
  AlertTriangle,
  History,
  Calendar,
  User,
  ArrowUpRight
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";

export default function StockMovementsPage() {
  
  // --- DATA FETCHING ---
  const { data: movements, isLoading } = useQuery({
    queryKey: ["inventory-stock-movements"],
    queryFn: async () => (await api.get("/inventory/movements")).data
  });

  return (
    <div className="space-y-4 max-w-[1600px] pb-8">
      {/* Header */}
      <PageHeader
        title="Stock Movements Log"
        subtitle="Authoritative Stock Transaction Ledger"
        icon={<History className="w-5 h-5 text-[#0878F9]" />}
      />

      {/* Movements Table */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
          </div>
        ) : movements?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider">
                  <th className="pb-3 px-3">Timestamp</th>
                  <th className="pb-3 px-3">Material SKU / Name</th>
                  <th className="pb-3 px-3">Quantity</th>
                  <th className="pb-3 px-3">Movement Type</th>
                  <th className="pb-3 px-3">Source Channel</th>
                  <th className="pb-3 px-3">Reference ID</th>
                  <th className="pb-3 px-3">Actor Agent</th>
                  <th className="pb-3 px-3">Remarks / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {movements.map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#F4F9FF]/50 transition-colors">
                    <td className="py-3 px-3 text-[#526B91] font-mono">
                      {new Date(m.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#0B2148]">{m.material?.name}</div>
                      <div className="text-[10px] text-[#526B91] font-mono mt-0.5">SKU: {m.material?.sku}</div>
                    </td>
                    <td className={`py-3 px-3 font-mono font-bold ${m.quantity > 0 ? "text-[#166534]" : "text-red-500"}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        m.movementType === "RECEIPT" ? "bg-emerald-500/15 text-emerald-700" :
                        m.movementType === "ISSUE" ? "bg-red-500/15 text-red-700" :
                        m.movementType === "RESERVATION" ? "bg-amber-500/15 text-amber-700" :
                        "bg-slate-500/15 text-[#526B91]"
                      }`}>
                        {m.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#526B91]">{m.source}</td>
                    <td className="py-3 px-3 font-mono text-[#526B91] text-[10px]">{m.referenceId || "-"}</td>
                    <td className="py-3 px-3 text-[#0B2148] font-semibold">{m.user?.name}</td>
                    <td className="py-3 px-3 text-[#526B91] italic">{m.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-[#526B91]">
            <History className="w-10 h-10 mb-3 opacity-40 text-[#526B91]" />
            <p className="text-sm font-semibold text-[#0B2148]">No Stock Movements Logged</p>
          </div>
        )}
      </div>
    </div>
  );
}
