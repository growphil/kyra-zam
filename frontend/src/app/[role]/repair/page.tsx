"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Wrench, 
  Search, 
  CheckCircle2, 
  Loader2,
  Package,
  Zap,
  AlertTriangle,
  History,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RepairPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: paxData, isLoading } = useQuery({
    queryKey: ["pax-repair-list", search],
    queryFn: async () => (await api.get("/pax", { params: { status: "UNDER_REPAIR" } })).data
  });

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      <PageHeader
        title="Repair & Maintenance"
        subtitle="Track and manage battery packs identified with technical faults during testing"
        icon={<Wrench className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by PAX serial..." 
              className="w-full bg-white border border-[#D8E8FA] rounded-xl py-1.5 pl-9 pr-3 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none shadow-xs placeholder:text-[#526B91]" 
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-panel h-64 rounded-3xl animate-pulse bg-[#F4F9FF]" />
          ))
        ) : paxData?.packs?.map((pax: any) => (
          <motion.div 
            key={pax.paxSerial}
            layout
            className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] hover:border-accent/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 bg-[#F4F9FF] rounded-2xl flex items-center justify-center text-[#526B91] group-hover:text-accent transition-colors">
                <Package className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[9px] font-bold uppercase">
                Under Repair
              </span>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-mono font-bold text-[#0B2148]">{pax.paxSerial}</h4>
              <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-widest">{pax.paxType.name} • {pax.paxType.cellCount} Cells</p>
            </div>

            <div className="pt-6 border-t border-[#D8E8FA] space-y-3">
              <div className="flex items-center gap-2 p-3 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] text-[10px] text-[#526B91] font-bold uppercase">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Awaiting Technical Fix
              </div>
              <button className="w-full py-3 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-[#D8E8FA] flex items-center justify-center gap-2">
                Update Status
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {paxData?.packs?.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center p-32 text-center">
          <div className="w-16 h-16 bg-[#F4F9FF] rounded-full flex items-center justify-center mb-6 text-slate-800">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-display font-bold text-[#0B2148] mb-2">No Repairs Pending</h3>
          <p className="text-sm text-[#526B91]">All battery packs are either in production or ready for sale.</p>
        </div>
      )}
    </div>
  );
}
