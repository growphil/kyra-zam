"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Package,
  Zap,
  ChevronRight,
  ClipboardCheck,
  Ban,
  Download,
  Boxes,
  FileText,
  QrCode,
  X,
  History,
  LayoutGrid,
  BarChart3,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Activity,
  Layers
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useFormattedSerial } from "@/hooks/useFormattedSerial";

export default function SupervisorPage() {
  const { formatSerial } = useFormattedSerial();
  const [activeTab, setActiveTab] = useState<"pax" | "cells">("pax");
  const [search, setSearch] = useState("");
  const [selectedPaxSerial, setSelectedPaxSerial] = useState<string | null>(null);
  const [selectedCellSerial, setSelectedCellSerial] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [editedAh, setEditedAh] = useState<string>("");
  const [editedIr, setEditedIr] = useState<string>("");
  const queryClient = useQueryClient();

  // --- DATA FETCHING ---
  const { data: paxData, isLoading: isLoadingPax } = useQuery({
    queryKey: ["pax-supervisor-list", search],
    queryFn: async () => (await api.get("/pax", { params: { status: "PAX_TESTED" } })).data,
    enabled: activeTab === "pax"
  });

  const { data: cellsData, isLoading: isLoadingCells } = useQuery({
    queryKey: ["hold-cells-list", search],
    queryFn: async () => (await api.get("/cells", { params: { status: "HOLD", limit: 100 } })).data,
    enabled: activeTab === "cells"
  });

  // Cell history logs query
  const { data: cellDetailData, isLoading: isLoadingCellDetail } = useQuery({
    queryKey: ["hold-cell-detail", selectedCellSerial],
    queryFn: async () => {
      if (!selectedCellSerial) return null;
      return (await api.get(`/cells/${selectedCellSerial}`)).data;
    },
    enabled: !!selectedCellSerial
  });

  useEffect(() => {
    if (cellDetailData?.cell) {
      setEditedAh(cellDetailData.cell.ahValue ? cellDetailData.cell.ahValue.toString() : "");
      setEditedIr(cellDetailData.cell.irValue ? cellDetailData.cell.irValue.toString() : "");
    }
  }, [cellDetailData]);

  const selectedPax = paxData?.packs?.find((p: any) => p.paxSerial === selectedPaxSerial);

  const approveMutation = useMutation({
    mutationFn: ({ serial, action, reason }: { serial: string; action: "approve" | "reject"; reason?: string }) => 
      api.post(`/pax/${serial}/approve`, { action, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pax-supervisor-list"] });
      toast.success("Inventory Authorization Successful");
      setSelectedPaxSerial(null);
      setTermsAccepted(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Authorization failed")
  });

  const cellOverrideMutation = useMutation({
    mutationFn: ({ serial, action, reason, ahValue, irValue }: { 
      serial: string; 
      action: "PASS" | "FAIL"; 
      reason: string;
      ahValue?: number;
      irValue?: number;
    }) => 
      api.post(`/cells/${serial}/override`, { action, reason, ahValue, irValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hold-cells-list"] });
      toast.success("Supervisor Cell Override Registered");
      setSelectedCellSerial(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Cell override failed")
  });

  const calculateStats = (pax: any) => {
    if (!pax || !pax.cells) return { ah: 0, ir: 0, ahSpread: 0, irSpread: 0 };
    const ahValues = pax.cells.map((c: any) => c.cell.ahValue);
    const irValues = pax.cells.map((c: any) => c.cell.irValue);
    return {
      ah: ahValues.reduce((a: number, b: number) => a + b, 0) / ahValues.length,
      ir: irValues.reduce((a: number, b: number) => a + b, 0) / irValues.length,
      ahSpread: Math.max(...ahValues) - Math.min(...ahValues),
      irSpread: Math.max(...irValues) - Math.min(...irValues)
    };
  };

  // Filter cells based on search string
  const filteredHoldCells = cellsData?.cells?.filter((cell: any) => 
    cell.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
    (cell.batchNumber && cell.batchNumber.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      {/* Header */}
      <PageHeader
        title="Supervisor Audits"
        subtitle="Final Quality & Compliance Audit Queue"
        icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Tabs */}
            <div className="flex bg-white p-1 rounded-xl border border-[#D8E8FA] shadow-xs">
              <button 
                onClick={() => { setActiveTab("pax"); setSearch(""); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "pax" ? "bg-[#0878F9] text-white shadow-xs" : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Battery Packs ({paxData?.packs?.length || 0})
              </button>
              <button 
                onClick={() => { setActiveTab("cells"); setSearch(""); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "cells" ? "bg-[#0878F9] text-white shadow-xs" : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Hold Cells ({cellsData?.summary?.hold || filteredHoldCells.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Serial Number..." 
                className="w-full bg-white border border-[#D8E8FA] rounded-xl py-1.5 pl-9 pr-3 text-xs font-mono text-[#0B2148] focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] outline-none transition-all placeholder:text-[#526B91] uppercase shadow-xs" 
              />
            </div>
          </div>
        }
      />

      {/* Main List */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
        {activeTab === "pax" ? (
          /* BATTERY PACKS GRID */
          isLoadingPax ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-panel h-32 rounded-3xl animate-pulse bg-[#F4F9FF]" />)}
             </div>
          ) : paxData?.packs?.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center p-20 bg-white/[0.01] rounded-[3rem] border border-dashed border-[#D8E8FA]">
                <ClipboardCheck className="w-16 h-16 text-slate-800 mb-6" />
                <h3 className="text-2xl font-display font-bold text-[#0B2148] mb-2">Audit Queue Empty</h3>
                <p className="text-[#526B91]">All battery packs have been authorized or are currently in testing.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
                <AnimatePresence mode="popLayout">
                  {paxData.packs.map((pax: any) => (
                    <motion.button
                      layout
                      key={pax.paxSerial}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedPaxSerial(pax.paxSerial)}
                      className="group glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition-all text-left relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-6">
                         <div className="w-14 h-14 bg-[#F4F9FF] rounded-2xl flex items-center justify-center text-accent ring-1 ring-white/10 group-hover:bg-accent group-hover:text-white transition-all">
                            <Package className="w-7 h-7" />
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest">Test Passed</span>
                            <p className="text-[10px] font-mono text-[#526B91] mt-2 font-bold uppercase">{new Date(pax.assembledAt).toLocaleDateString()}</p>
                         </div>
                      </div>
                      
                      <div className="space-y-1">
                         <h4 className="text-xl font-mono font-bold text-[#0B2148] tracking-tighter uppercase">{pax.paxSerial}</h4>
                         <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest">{pax.paxType.name}</p>
                      </div>

                      <div className="mt-8 pt-6 border-t border-[#D8E8FA] flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-[#526B91] uppercase">Cells</span>
                               <span className="text-xs font-mono text-[#0B2148]">{pax.cells.length}S</span>
                            </div>
                            <div className="w-px h-6 bg-[#F4F9FF]" />
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-[#526B91] uppercase">Avg AH</span>
                               <span className="text-xs font-mono text-[#0B2148]">{calculateStats(pax).ah.toFixed(2)}</span>
                            </div>
                         </div>
                         <div className="w-10 h-10 bg-[#F4F9FF] rounded-full flex items-center justify-center text-[#526B91] group-hover:bg-emerald-500 group-hover:text-white transition-all">
                            <ArrowRight className="w-5 h-5" />
                         </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
             </div>
          )
        ) : (
          /* BORDERLINE CELLS GRID */
          isLoadingCells ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-panel h-32 rounded-3xl animate-pulse bg-[#F4F9FF]" />)}
             </div>
          ) : filteredHoldCells.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center p-20 bg-white/[0.01] rounded-[3rem] border border-dashed border-[#D8E8FA]">
                <CheckCircle2 className="w-16 h-16 text-emerald-500/30 mb-6 bg-emerald-500/5 p-3 rounded-full border border-emerald-500/20" />
                <h3 className="text-2xl font-display font-bold text-[#0B2148] mb-2">Cell Hold Queue Clear</h3>
                <p className="text-[#526B91]">All borderline readings and retest failures have been cleared.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
                <AnimatePresence mode="popLayout">
                  {filteredHoldCells.map((cell: any) => (
                    <motion.button
                      layout
                      key={cell.serialNumber}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedCellSerial(cell.serialNumber)}
                      className="group glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] hover:border-amber-500/20 hover:bg-amber-500/[0.02] transition-all text-left relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-6">
                         <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 ring-1 ring-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-all">
                            <Zap className="w-7 h-7" />
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">On Hold</span>
                            <p className="text-[10px] font-mono text-[#526B91] mt-2 font-bold uppercase">Attempts: {cell.retestCount}</p>
                         </div>
                      </div>
                      
                      <div className="space-y-1">
                         <h4 className="text-xl font-mono font-bold text-[#0B2148] tracking-tighter uppercase">{formatSerial(cell.serialNumber)}</h4>
                         <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest">Batch: {cell.batchNumber || "N/A"}</p>
                      </div>

                      <div className="mt-8 pt-6 border-t border-[#D8E8FA] flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-[#526B91] uppercase">Capacity</span>
                               <span className="text-xs font-mono text-[#0B2148]">{cell.ahValue ? `${cell.ahValue.toFixed(3)} AH` : "N/A"}</span>
                            </div>
                            <div className="w-px h-6 bg-[#F4F9FF]" />
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-[#526B91] uppercase">Resistance</span>
                               <span className="text-xs font-mono text-[#0B2148]">{cell.irValue ? `${cell.irValue.toFixed(1)} mΩ` : "N/A"}</span>
                            </div>
                         </div>
                         <div className="w-10 h-10 bg-[#F4F9FF] rounded-full flex items-center justify-center text-[#526B91] group-hover:bg-amber-500 group-hover:text-black transition-all">
                            <ArrowRight className="w-5 h-5" />
                         </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
             </div>
          )
        )}
      </div>

      {/* Battery Pack Detail Modal */}
      <AnimatePresence>
        {selectedPax && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10"
          >
             <div className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xl" onClick={() => setSelectedPaxSerial(null)} />
             <motion.div 
               initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
               className="relative w-full max-w-7xl h-full max-h-[90vh] bg-[#020617] rounded-[3rem] border border-[#D8E8FA] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(16,185,129,0.1)]"
             >
                <div className="flex-none flex items-center justify-between p-8 border-b border-[#D8E8FA] bg-emerald-500/[0.02]">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500">
                         <ShieldCheck className="w-8 h-8" />
                      </div>
                      <div>
                         <h2 className="text-3xl font-display font-bold text-[#0B2148] tracking-tight uppercase">{selectedPax.paxSerial}</h2>
                         <p className="text-[#526B91] font-bold uppercase tracking-widest text-[10px] mt-1">{selectedPax.paxType.name} • Full Production Audit</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedPaxSerial(null)} className="w-12 h-12 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 rounded-full flex items-center justify-center text-[#526B91] hover:text-white transition-all">
                     <X className="w-6 h-6" />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                   <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                      <div className="space-y-8">
                         <div className="glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] space-y-6">
                            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-widest flex items-center gap-2">
                               <BarChart3 className="w-4 h-4 text-emerald-500" />
                               Electrical Statistics
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-[#061B3A]/40 p-4 rounded-2xl border border-[#D8E8FA]">
                                  <p className="text-[9px] font-bold text-[#526B91] uppercase mb-1">Average AH</p>
                                  <p className="text-xl font-mono text-[#0B2148] font-bold">{calculateStats(selectedPax).ah.toFixed(3)}</p>
                               </div>
                               <div className="bg-[#061B3A]/40 p-4 rounded-2xl border border-[#D8E8FA]">
                                  <p className="text-[9px] font-bold text-[#526B91] uppercase mb-1">Average IR</p>
                                  <p className="text-xl font-mono text-[#0B2148] font-bold">{calculateStats(selectedPax).ir.toFixed(2)}</p>
                               </div>
                               <div className="bg-[#061B3A]/40 p-4 rounded-2xl border border-[#D8E8FA]">
                                  <p className="text-[9px] font-bold text-[#526B91] uppercase mb-1">AH Variation</p>
                                  <p className="text-xs font-mono text-emerald-500">±{calculateStats(selectedPax).ahSpread.toFixed(3)}</p>
                               </div>
                               <div className="bg-[#061B3A]/40 p-4 rounded-2xl border border-[#D8E8FA]">
                                  <p className="text-[9px] font-bold text-[#526B91] uppercase mb-1">IR Variation</p>
                                  <p className="text-xs font-mono text-emerald-500">±{calculateStats(selectedPax).irSpread.toFixed(1)}</p>
                               </div>
                            </div>
                         </div>

                         <div className="glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] flex flex-col items-center justify-center text-center space-y-6">
                            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-widest w-full text-left">Industrial Tracking Label</h4>
                            {selectedPax.qrUrl ? (
                               <div className="bg-white p-3 rounded-2xl shadow-2xl shadow-emerald-500/20">
                                  <img src={selectedPax.qrUrl} alt="PAX Label" className="w-40 h-40" />
                                </div>
                            ) : <QrCode className="w-20 h-20 text-slate-800" />}
                         </div>
                      </div>

                      <div className="xl:col-span-2 space-y-8">
                         <div className="glass-panel rounded-[2.5rem] border border-[#D8E8FA] overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                               <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-widest flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-emerald-500" />
                                  Intra-Pack Cell Manifest
                                </h4>
                            </div>
                            <div className="flex-1 overflow-auto max-h-[400px] custom-scrollbar">
                               <table className="w-full text-left border-collapse">
                                  <thead>
                                     <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-[#526B91] uppercase border-b border-[#D8E8FA]">Pos</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-[#526B91] uppercase border-b border-[#D8E8FA]">Serial Number</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-[#526B91] uppercase border-b border-[#D8E8FA]">Capacity (AH)</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-[#526B91] uppercase border-b border-[#D8E8FA]">Resistance (mΩ)</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#E8F1FC]">
                                     {selectedPax.cells.map((pc: any, i: number) => (
                                       <tr key={i} className="hover:bg-[#F4F9FF]">
                                          <td className="px-6 py-4 font-mono text-xs text-[#526B91]">#{i + 1}</td>
                                          <td className="px-6 py-4 font-mono text-xs text-[#0B2148] uppercase">{formatSerial(pc.cellSerial)}</td>
                                          <td className="px-6 py-4 font-mono text-xs text-[#166534]">{pc.cell.ahValue.toFixed(3)}</td>
                                          <td className="px-6 py-4 font-mono text-xs text-blue-400">{pc.cell.irValue.toFixed(2)}</td>
                                       </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mt-10">
                      <div className="glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] bg-accent/[0.02]">
                         <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-widest flex items-center gap-2 mb-6">
                            <Boxes className="w-4 h-4 text-accent" />
                            Bill of Materials Breakdown
                         </h4>
                         {selectedPax.bom ? (
                            <div className="grid grid-cols-2 gap-4">
                               {selectedPax.bom.items.map((item: any) => (
                                 <div key={item.id} className="p-4 bg-black/20 rounded-2xl border border-[#D8E8FA] flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-[#526B91] uppercase">{item.material.name}</span>
                                    <span className="text-xs font-mono text-[#0B2148]">x{item.quantity}</span>
                                 </div>
                               ))}
                            </div>
                         ) : <p className="text-xs text-slate-700 italic">No BOM data associated.</p>}
                      </div>

                      <div className="p-8 glass-panel rounded-[2.5rem] border border-[#D8E8FA] bg-emerald-500/[0.01] flex flex-col justify-center gap-8">
                         <label className="flex items-start gap-4 cursor-pointer group">
                            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="h-6 w-6 rounded bg-[#F4F9FF] border border-[#D8E8FA]" />
                            <span className="text-[11px] text-[#526B91] leading-relaxed">
                               I certify that I have reviewed the Master Test Report and BOM. I authorize commercial release of this unit.
                            </span>
                         </label>

                         <div className="flex gap-4">
                            <button 
                              onClick={() => {
                                const reason = prompt("Enter Rejection Reason:");
                                if (reason) approveMutation.mutate({ serial: selectedPax.paxSerial, action: "reject", reason });
                              }}
                              className="flex-1 h-16 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-red-500/20"
                            >
                               Reject unit
                            </button>
                            <button 
                              disabled={!termsAccepted || approveMutation.isPending}
                              onClick={() => approveMutation.mutate({ serial: selectedPax.paxSerial, action: "approve" })}
                              className={`flex-[2] h-16 rounded-2xl font-bold uppercase text-[10px] transition-all flex items-center justify-center gap-3 ${
                                termsAccepted ? "bg-emerald-500 text-white" : "bg-[#F4F9FF] text-[#526B91] cursor-not-allowed"
                              }`}
                            >
                               Authorize & Release to Inventory
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW: Borderline Cell Audit Modal */}
      <AnimatePresence>
        {selectedCellSerial && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10"
          >
             <div className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xl" onClick={() => setSelectedCellSerial(null)} />
             <motion.div 
               initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
               className="relative w-full max-w-5xl h-full max-h-[85vh] bg-[#020617] rounded-[3rem] border border-[#D8E8FA] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(245,158,11,0.1)]"
             >
                {/* Header */}
                <div className="flex-none flex items-center justify-between p-8 border-b border-[#D8E8FA] bg-amber-500/[0.02]">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                         <Zap className="w-8 h-8 animate-pulse" />
                      </div>
                      <div>
                         <h2 className="text-3xl font-display font-bold text-[#0B2148] tracking-tight uppercase">{formatSerial(selectedCellSerial)}</h2>
                         <p className="text-amber-500 font-bold uppercase tracking-widest text-[10px] mt-1">Manual Borderline / Override Decider Queue</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedCellSerial(null)} className="w-12 h-12 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 rounded-full flex items-center justify-center text-[#526B91] hover:text-white transition-all">
                     <X className="w-6 h-6" />
                   </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-10">
                   
                   {/* Left Panel: Metrics & Override action */}
                   <div className="space-y-8">
                     <div className="glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] space-y-6">
                         <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-widest">Tested Cell Telemetry</h4>
                         {isLoadingCellDetail ? (
                           <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                         ) : cellDetailData ? (
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-[#061B3A]/40 p-4 rounded-xl border border-[#D8E8FA] flex flex-col gap-1.5">
                                 <label className="text-[8px] font-bold text-[#526B91] uppercase">Capacity (AH)</label>
                                 <input 
                                   type="number" 
                                   step="0.001" 
                                   value={editedAh} 
                                   onChange={(e) => setEditedAh(e.target.value)} 
                                   className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg p-2 text-sm font-mono text-white font-bold focus:border-amber-500/50 outline-none w-full" 
                                 />
                              </div>
                              <div className="bg-[#061B3A]/40 p-4 rounded-xl border border-[#D8E8FA] flex flex-col gap-1.5">
                                 <label className="text-[8px] font-bold text-[#526B91] uppercase">Resistance (mΩ)</label>
                                 <input 
                                   type="number" 
                                   step="0.1" 
                                   value={editedIr} 
                                   onChange={(e) => setEditedIr(e.target.value)} 
                                   className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg p-2 text-sm font-mono text-white font-bold focus:border-amber-500/50 outline-none w-full" 
                                 />
                              </div>
                              <div className="bg-[#061B3A]/40 p-4 rounded-xl border border-[#D8E8FA]">
                                 <p className="text-[8px] font-bold text-[#526B91] uppercase">Retest Count</p>
                                 <p className="text-sm font-mono text-amber-500 font-bold">{cellDetailData.cell.retestCount}</p>
                              </div>
                              <div className="bg-[#061B3A]/40 p-4 rounded-xl border border-[#D8E8FA]">
                                 <p className="text-[8px] font-bold text-[#526B91] uppercase">Batch Number</p>
                                 <p className="text-sm font-mono text-[#0B2148] font-bold">{cellDetailData.cell.batchNumber || "N/A"}</p>
                              </div>
                              <div className="bg-[#061B3A]/40 p-4 rounded-xl border border-[#D8E8FA] col-span-2 flex items-center justify-between">
                                 <div>
                                   <p className="text-[8px] font-bold text-[#526B91] uppercase">Machine / Operator</p>
                                   <p className="text-xs text-[#0B2148] font-bold">{cellDetailData.cell.machineId || "N/A"} ({cellDetailData.cell.machineOperator || "N/A"})</p>
                                 </div>
                                 <div className="text-right">
                                   <p className="text-[8px] font-bold text-[#526B91] uppercase">Temperatures</p>
                                   <p className="text-[10px] text-[#0B2148] font-mono">Cell: {cellDetailData.cell.cellTemperature}°C / Amb: {cellDetailData.cell.ambientTemperature}°C</p>
                                 </div>
                              </div>
                           </div>
                         ) : null}
                      </div>

                      {/* Action Box */}
                      <div className="p-8 glass-panel rounded-[2.5rem] border border-[#D8E8FA] bg-amber-500/[0.01] space-y-6">
                         <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[#526B91] leading-relaxed">
                              Please inspect the complete audit trail and testing history timeline on the right before signing an override action. Overriding to PASS admits this cell directly to stock compatibility matching. Overriding to FAIL transfers the unit immediately to Scrap.
                            </p>
                         </div>

                         <div className="flex gap-4">
                            <button 
                              onClick={() => {
                                const reason = prompt("Enter Rejection Override Reason:");
                                if (reason) {
                                  cellOverrideMutation.mutate({ 
                                    serial: selectedCellSerial, 
                                    action: "FAIL", 
                                    reason,
                                    ahValue: editedAh ? parseFloat(editedAh) : undefined,
                                    irValue: editedIr ? parseFloat(editedIr) : undefined
                                  });
                                }
                              }}
                              className="flex-1 h-14 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-bold uppercase text-[10px] transition-all border border-red-500/20"
                            >
                               OVERRIDE TO FAIL
                            </button>
                            <button 
                              onClick={() => {
                                const reason = prompt("Enter Approval Override Reason:");
                                if (reason) {
                                  cellOverrideMutation.mutate({ 
                                    serial: selectedCellSerial, 
                                    action: "PASS", 
                                    reason,
                                    ahValue: editedAh ? parseFloat(editedAh) : undefined,
                                    irValue: editedIr ? parseFloat(editedIr) : undefined
                                  });
                                }
                              }}
                              className="flex-1 h-14 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl font-bold uppercase text-[10px] transition-all border border-emerald-500/20"
                            >
                               OVERRIDE TO PASS
                            </button>
                         </div>
                      </div>
                   </div>

                   {/* Right Panel: Audit timeline */}
                   <div className="glass-panel p-8 rounded-[2.5rem] border border-[#D8E8FA] flex flex-col h-[450px] overflow-hidden">
                      <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-widest mb-6 flex items-center gap-2">
                        <History className="w-4 h-4 text-[#526B91]" />
                        Cell Performance Timeline
                      </h4>
                      <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
                         {isLoadingCellDetail ? (
                           <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-[#526B91]" /></div>
                         ) : cellDetailData?.history?.length === 0 ? (
                           <p className="text-xs text-[#526B91] text-center">No prior testing history.</p>
                         ) : (
                           <div className="relative pl-6 border-l border-[#D8E8FA] space-y-6">
                              {cellDetailData?.history?.map((log: any) => {
                                const isQcFail = log.action.includes("qc_result_fail");
                                const isQcRetest = log.action.includes("qc_result_retest");
                                const isQcPass = log.action.includes("qc_result_pass");
                                return (
                                  <div key={log.id} className="relative">
                                    <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border-2 border-[#020617] ${
                                      isQcPass ? "bg-emerald-500" : isQcFail ? "bg-red-500" : isQcRetest ? "bg-amber-500" : "bg-[#EAF5FF]"
                                    }`} />
                                    <div>
                                      <div className="flex items-center justify-between gap-4">
                                        <p className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">{log.action.replace(/_/g, " ")}</p>
                                        <p className="text-[9px] text-[#526B91] font-mono">{new Date(log.timestamp).toLocaleString()}</p>
                                      </div>
                                      <p className="text-[10px] text-[#526B91] mt-1">
                                        Status: <span className="font-mono text-[#526B91]">{log.prevStatus || "NONE"}</span> → <span className="font-mono text-[#0B2148] font-bold">{log.newStatus}</span>
                                      </p>
                                      {log.metadata && typeof log.metadata === "object" && (
                                        <div className="mt-2 p-3 bg-[#061B3A]/40 border border-[#D8E8FA] rounded-xl text-[9px] font-mono grid grid-cols-2 gap-1 text-[#526B91]">
                                          {log.metadata.ah !== undefined && <p>AH: <span className="text-[#0B2148]">{log.metadata.ah} AH</span></p>}
                                          {log.metadata.ir !== undefined && <p>IR: <span className="text-[#0B2148]">{log.metadata.ir} mΩ</span></p>}
                                          {log.metadata.reason && <p className="col-span-2 text-amber-500">Override Reason: {log.metadata.reason}</p>}
                                          {log.metadata.failureReason && <p className="col-span-2 text-red-400 font-bold">Failure: {log.metadata.failureReason}</p>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                           </div>
                         )}
                      </div>
                   </div>

                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
