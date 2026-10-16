"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  PackageCheck, 
  QrCode, 
  Printer, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Boxes,
  Zap,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function AssemblyVerificationPage() {
  const [selectedPaxSerial, setSelectedPaxSerial] = useState<string>("");
  const [selectedBomId, setSelectedBomId] = useState<string>("");
  const [showQr, setShowQr] = useState(false);
  const [lastGeneratedQr, setLastGeneratedQr] = useState<string>("");
  const queryClient = useQueryClient();

  // --- DATA FETCHING ---
  const { data: assembledPacks, isLoading: loadingPacks } = useQuery({
    queryKey: ["pax-assembled"],
    queryFn: async () => {
      const res = await api.get("/pax", { params: { status: "PAX_ASSEMBLED" } });
      return res.data.packs;
    }
  });

  const { data: boms } = useQuery({
    queryKey: ["boms"],
    queryFn: async () => (await api.get("/admin/boms")).data
  });

  const labelMutation = useMutation({
    mutationFn: (data: { serial: string; bomId: string }) => 
      api.post(`/pax/${data.serial}/label`, { bomId: data.bomId }),
    onSuccess: (res) => {
      toast.success("BOM Assigned & Label Generated");
      setLastGeneratedQr(res.data.qrUrl);
      setShowQr(true);
      queryClient.invalidateQueries({ queryKey: ["pax-assembled"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Labeling failed")
  });

  const selectedPax = assembledPacks?.find((p: any) => p.paxSerial === selectedPaxSerial);

  const handlePrint = () => {
    window.print();
    toast.info("Sending 2 copies to system printer...");
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between p-8 glass-panel rounded-[2.5rem] border border-[#D8E8FA] relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <Boxes className="w-8 h-8 text-accent" />
            Assembly Verification & Labeling
          </h1>
          <p className="text-[#526B91] mt-2">Assign Bill of Materials and generate industrial tracking labels for assembled packs.</p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: PAX Selection List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6 rounded-[2rem] border border-[#D8E8FA] min-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">1. Select Assembled Pack</label>
              <span className="text-[10px] font-mono text-accent">{assembledPacks?.length || 0} Pending</span>
            </div>

            <div className="flex-1 overflow-auto space-y-3 pr-2 custom-scrollbar">
              {loadingPacks ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
              ) : assembledPacks?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-10">
                   <PackageCheck className="w-12 h-12 mb-4 text-[#526B91]" />
                   <p className="text-sm font-bold text-[#526B91] uppercase">No packs pending verification</p>
                </div>
              ) : (
                assembledPacks.map((pax: any) => (
                  <button
                    key={pax.paxSerial}
                    onClick={() => {
                      setSelectedPaxSerial(pax.paxSerial);
                      setShowQr(false);
                    }}
                    className={`w-full p-4 rounded-2xl border transition-all text-left group relative overflow-hidden ${
                      selectedPaxSerial === pax.paxSerial 
                      ? "bg-accent/10 border-accent text-white" 
                      : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:border-[#D8E8FA]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold">{pax.paxSerial}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${selectedPaxSerial === pax.paxSerial ? "translate-x-1 text-accent" : "text-slate-700"}`} />
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">{pax.paxType.name}</span>
                       <span className="text-slate-800">•</span>
                       <span className="text-[10px] font-mono text-[#526B91]">{pax.cells.length} Cells</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Verification & QR */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {!selectedPaxSerial ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[600px] glass-panel rounded-[3rem] border border-dashed border-[#D8E8FA] flex flex-col items-center justify-center text-center p-20"
              >
                <div className="w-20 h-20 bg-[#F4F9FF] rounded-[2.5rem] flex items-center justify-center mb-8 text-slate-800">
                  <ArrowRight className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-bold text-[#0B2148] mb-4">Initialize Verification</h3>
                <p className="text-[#526B91] max-w-sm mx-auto leading-relaxed">Select a physically assembled battery pack from the list to assign components and generate QR tracking labels.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="verification-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full"
              >
                {/* Step 2: BOM Selection */}
                <div className="glass-panel p-8 rounded-[3rem] border border-[#D8E8FA] space-y-8">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
                         <FileText className="w-5 h-5" />
                      </div>
                      <div>
                         <h3 className="text-lg font-bold text-[#0B2148]">BOM Assignment</h3>
                         <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Step 2: Component Linkage</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1">Select Active BOM Profile</label>
                      <div className="grid grid-cols-1 gap-3">
                         {boms?.map((bom: any) => (
                           <button
                             key={bom.id}
                             onClick={() => setSelectedBomId(bom.id)}
                             className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden group ${
                               selectedBomId === bom.id 
                               ? "bg-emerald-500/10 border-emerald-500/50 text-white" 
                               : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:border-[#D8E8FA]"
                             }`}
                           >
                             <div className="flex items-center justify-between mb-1">
                               <span className="font-bold text-sm">{bom.name}</span>
                               {selectedBomId === bom.id && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                             </div>
                             <p className="text-[10px] text-[#526B91] line-clamp-1">{bom.description || "Standard assembly components"}</p>
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="pt-8 border-t border-[#D8E8FA] space-y-4">
                      <div className="p-4 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA] space-y-3">
                         <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-[#526B91]">Selected Pack</span>
                            <span className="text-[#0B2148] font-mono">{selectedPaxSerial}</span>
                         </div>
                         <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-[#526B91]">Target Grade</span>
                            <span className="text-accent">GRADE {selectedPax?.paxType.allowedGrades[0]}</span>
                         </div>
                      </div>

                      <button 
                        disabled={!selectedBomId || labelMutation.isPending || showQr}
                        onClick={() => labelMutation.mutate({ serial: selectedPaxSerial, bomId: selectedBomId })}
                        className="w-full h-16 bg-accent hover:bg-accent/90 disabled:opacity-20 text-white rounded-2xl font-bold transition-all shadow-xl shadow-accent/20 flex flex-col items-center justify-center gap-1 uppercase tracking-widest text-[10px]"
                      >
                        {labelMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <QrCode className="w-5 h-5" />
                            <span>{showQr ? "Label Generated" : "Generate Industrial Label"}</span>
                          </>
                        )}
                      </button>
                   </div>
                </div>

                {/* Step 3: QR Label Preview */}
                <div className="glass-panel p-8 rounded-[3rem] border border-[#D8E8FA] flex flex-col items-center justify-center text-center relative overflow-hidden group">
                   {!showQr ? (
                     <div className="space-y-6 opacity-30 group-hover:opacity-50 transition-opacity">
                        <QrCode className="w-24 h-24 mx-auto text-slate-700" />
                        <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">QR Preview Awaiting Data</p>
                     </div>
                   ) : (
                     <motion.div 
                       initial={{ scale: 0.8, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       className="space-y-8"
                     >
                        <div className="bg-white p-6 rounded-[2rem] shadow-2xl shadow-accent/20">
                           <img src={lastGeneratedQr} alt="PAX QR" className="w-48 h-48" />
                        </div>
                        
                        <div className="space-y-2">
                           <h4 className="text-xl font-display font-bold text-[#0B2148]">Label Ready</h4>
                           <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Ready to PAX Test</p>
                        </div>

                        <div className="flex flex-col gap-3 w-full max-w-[200px] mx-auto">
                           <button 
                             onClick={handlePrint}
                             className="flex items-center justify-center gap-2 bg-[#EAF5FF] hover:bg-white/20 text-white py-3 rounded-xl border border-[#D8E8FA] text-[10px] font-bold uppercase tracking-widest transition-all"
                           >
                             <Printer className="w-4 h-4" />
                             Print 2 Copies
                           </button>
                           
                           <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span className="text-[8px] font-bold uppercase text-left leading-tight">Pack status updated to READY_FOR_PAX_TEST</span>
                           </div>
                        </div>
                     </motion.div>
                   )}
                   
                   {/* Decorative Scanning line for QR area */}
                   {showQr && <div className="scan-line top-0" />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Printing Styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .glass-panel img { visibility: visible; position: absolute; left: 0; top: 0; width: 4cm; height: 4cm; }
          .print-label-copy-2 { visibility: visible; position: absolute; left: 5cm; top: 0; width: 4cm; height: 4cm; }
        }
      `}</style>
    </div>
  );
}
