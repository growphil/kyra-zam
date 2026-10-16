"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Battery, 
  Plus, 
  Trash2, 
  Edit, 
  X, 
  Loader2, 
  LayoutGrid, 
  ShieldCheck, 
  BrainCircuit, 
  Settings2, 
  BoxSelect, 
  TrendingUp, 
  Save,
  CheckCircle2,
  Sliders,
  Sparkles,
  Zap,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const ALL_GRADES = ["A+", "A", "B+", "B", "C+", "C"];

export default function PaxConfigTab() {
  const queryClient = useQueryClient();
  const [isPaxModalOpen, setIsPaxModalOpen] = useState(false);
  const [selectedPaxType, setSelectedPaxType] = useState<any>(null);

  // Form local state for interactive grade chips and live cell topology preview
  const [selectedGrades, setSelectedGrades] = useState<string[]>(["A+", "A"]);
  const [modalCellCount, setModalCellCount] = useState<number>(16);

  // --- PAX TYPES QUERY ---
  const { data: paxTypes, isLoading } = useQuery({
    queryKey: ["admin-pax-types"],
    queryFn: async () => (await api.get("/admin/pax-types")).data
  });

  // --- SAVE MUTATION ---
  const savePaxTypeMutation = useMutation({
    mutationFn: (data: any) => {
      if (selectedPaxType) {
        return api.patch(`/admin/pax-types/${selectedPaxType.id}`, data);
      }
      return api.post("/admin/pax-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-thresholds"] });
      toast.success(selectedPaxType ? "PAX configuration updated" : "PAX configuration created");
      setIsPaxModalOpen(false);
      setSelectedPaxType(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save configuration");
    }
  });

  // --- DELETE MUTATION ---
  const deletePaxTypeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/pax-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-thresholds"] });
      toast.success("PAX configuration deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete configuration");
    }
  });

  const handleOpenModal = (paxType: any = null) => {
    setSelectedPaxType(paxType);
    if (paxType) {
      setSelectedGrades(paxType.allowedGrades || ["A+", "A"]);
      setModalCellCount(paxType.cellCount || 16);
    } else {
      setSelectedGrades(["A+", "A"]);
      setModalCellCount(16);
    }
    setIsPaxModalOpen(true);
  };

  const toggleGrade = (grade: string) => {
    if (selectedGrades.includes(grade)) {
      if (selectedGrades.length === 1) {
        toast.error("At least one cell grade must be allowed.");
        return;
      }
      setSelectedGrades(selectedGrades.filter(g => g !== grade));
    } else {
      setSelectedGrades([...selectedGrades, grade]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    savePaxTypeMutation.mutate({
      name: formData.get("name"),
      cellCount: parseInt(formData.get("cellCount") as string, 10),
      ahMin: parseFloat(formData.get("ahMin") as string),
      ahMax: parseFloat(formData.get("ahMax") as string),
      irMin: parseFloat(formData.get("irMin") as string || "5.0"),
      irMax: parseFloat(formData.get("irMax") as string),
      retestIrMargin: parseFloat(formData.get("retestIrMargin") as string || "2.0"),
      retestAhMargin: parseFloat(formData.get("retestAhMargin") as string || "0.1"),
      hardFailIr: parseFloat(formData.get("hardFailIr") as string || "70.0"),
      hardFailAh: parseFloat(formData.get("hardFailAh") as string || "3.0"),
      allowedGrades: selectedGrades,
      maxAhDifference: parseFloat(formData.get("maxAhDifference") as string),
      maxIrDifference: parseFloat(formData.get("maxIrDifference") as string),
      autoPackEnabled: formData.get("autoPackEnabled") === "on",
    });
  };

  return (
    <div className="space-y-8">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Configurations", value: paxTypes?.length || 0, icon: LayoutGrid, color: "text-accent", bg: "bg-accent/10 border-accent/20" },
          { label: "Active Production", value: paxTypes?.filter((p: any) => p.isProductionActive).length || 0, icon: ShieldCheck, color: "text-[#166534]", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Auto-Match Enabled", value: paxTypes?.filter((p: any) => p.autoPackEnabled).length || 0, icon: BrainCircuit, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
          { label: "Avg Cell Count", value: paxTypes?.length ? Math.round(paxTypes.reduce((acc: any, p: any) => acc + p.cellCount, 0) / paxTypes.length) : 0, icon: Battery, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] flex items-center gap-4 hover:border-[#D8E8FA] transition-all shadow-lg"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-display font-bold text-[#0B2148] tracking-tight mt-0.5">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Matching Rules Data Table */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-[2rem] border border-[#D8E8FA] overflow-hidden shadow-2xl"
      >
        <div className="p-6 sm:p-8 border-b border-[#D8E8FA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-[#0B2148]">PAX Model Specifications</h3>
              <p className="text-xs text-[#526B91] mt-0.5">Capacity bands, IR tolerances, delta matching, and cell clustering limits</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => handleOpenModal(null)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New PAX Type
          </button>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#526B91]">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs font-semibold">Loading configurations...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91] w-14 text-center">S.No</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91]">PAX Model</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91]">Cell Count</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91]">Allowed Grades</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91]">Capacity Band (Ah)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91]">IR Limits (mΩ)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91]">Max Delta (Δ)</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#526B91] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC]">
                {paxTypes?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-8 py-16 text-center text-[#526B91] text-sm">
                      No PAX configurations found. Click &quot;New PAX Type&quot; to define your first pack specification.
                    </td>
                  </tr>
                ) : (
                  paxTypes?.map((type: any, idx: number) => (
                    <tr key={type.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="px-4 py-5 text-center font-mono font-bold text-xs text-[#526B91]">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${type.isProductionActive ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" : "bg-slate-700"}`} />
                          <div>
                            <p className="text-sm font-bold text-[#0B2148] group-hover:text-accent transition-colors">{type.name}</p>
                            {type.isProductionActive && (
                              <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">Active Production</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg text-xs font-mono font-bold text-[#0B2148]">
                          {type.cellCount}S Battery
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {type.allowedGrades?.map((g: string) => (
                            <span key={g} className="px-2.5 py-0.5 bg-accent/15 border border-accent/30 rounded-md text-xs font-bold text-accent font-mono">
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-mono text-[#0B2148] font-bold">{type.ahMin} - {type.ahMax} Ah</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-mono text-[#0B2148] font-bold">{type.irMin ?? "5.0"} - {type.irMax} mΩ</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-mono text-[#526B91]">
                          ΔAh: <span className="text-[#166534] font-bold">{type.maxAhDifference ?? "0.05"}</span> | ΔIR: <span className="text-cyan-400 font-bold">{type.maxIrDifference ?? "3.0"}</span>
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => handleOpenModal(type)} 
                            title="Edit configuration"
                            className="p-2 hover:bg-[#EAF5FF] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => { 
                              if (confirm(`Delete configuration "${type.name}"?`)) {
                                deletePaxTypeMutation.mutate(type.id);
                              }
                            }} 
                            title="Delete configuration"
                            className="p-2 hover:bg-[#FEE2E2] rounded-xl text-[#526B91] hover:text-[#991B1B] transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Advanced PAX Config Modal */}
      <AnimatePresence>
        {isPaxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsPaxModalOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="relative w-full max-w-5xl glass-panel bg-white border border-[#D8E8FA] rounded-[2.5rem] shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              <div className="p-6 sm:p-8 border-b border-[#D8E8FA] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/20 border border-accent/30 rounded-2xl flex items-center justify-center text-accent">
                    <Settings2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-[#0B2148]">
                      {selectedPaxType ? "Update PAX Specification" : "Define New PAX Specification"}
                    </h3>
                    <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest mt-0.5">
                      Intelligent Matching Engine Parameters
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsPaxModalOpen(false)} 
                  className="p-2.5 hover:bg-[#EAF5FF] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 sm:p-8 space-y-8 max-h-[72vh] overflow-y-auto custom-scrollbar">
                {/* SECTION 1: PHYSICAL PACK ARCHITECTURE */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#D8E8FA]">
                    <BoxSelect className="w-4 h-4 text-accent" />
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                      1. Physical Pack Architecture
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        PAX Model Identifier / Name
                      </label>
                      <input 
                        name="name" 
                        defaultValue={selectedPaxType?.name} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all font-bold" 
                        placeholder="e.g. 48V 16S 250Ah Commercial Pack" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Cell Count (Series Matrix)
                      </label>
                      <input 
                        name="cellCount" 
                        type="number" 
                        min="1"
                        max="256"
                        value={modalCellCount} 
                        onChange={(e) => setModalCellCount(parseInt(e.target.value, 10) || 1)}
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all font-bold" 
                      />
                    </div>

                    {/* Cell Array Matrix Schematic Preview */}
                    <div className="sm:col-span-2 p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-cyan-400" />
                          Pack Matrix Schematic:
                        </span>
                        <p className="text-xs text-[#526B91] mt-1 font-mono">
                          Topology: <span className="text-[#0B2148] font-bold">{modalCellCount}S 1P</span> ({modalCellCount} physical cells matched per assembled pack)
                        </p>
                      </div>

                      {/* Visual cell dots */}
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {Array.from({ length: Math.min(modalCellCount, 32) }).map((_, idx) => (
                          <div key={idx} className="w-3.5 h-3.5 rounded bg-accent/40 border border-accent/60 flex items-center justify-center text-[8px] font-mono text-white font-bold" title={`Cell #${idx + 1}`}>
                            {idx + 1}
                          </div>
                        ))}
                        {modalCellCount > 32 && (
                          <span className="text-[10px] font-mono text-[#526B91] self-center">+{modalCellCount - 32} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: ELECTRICAL SCREENING BANDS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#D8E8FA]">
                    <Zap className="w-4 h-4 text-[#166534]" />
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                      2. Electrical Screening Parameters
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Capacity Min (Ah)
                      </label>
                      <input 
                        name="ahMin" 
                        type="number" 
                        step="0.01" 
                        defaultValue={selectedPaxType?.ahMin || 3.0} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Capacity Max (Ah)
                      </label>
                      <input 
                        name="ahMax" 
                        type="number" 
                        step="0.01" 
                        defaultValue={selectedPaxType?.ahMax || 3.6} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        IR Min Limit (mΩ)
                      </label>
                      <input 
                        name="irMin" 
                        type="number" 
                        step="0.01" 
                        defaultValue={selectedPaxType?.irMin ?? 5.0} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        IR Max Limit (mΩ)
                      </label>
                      <input 
                        name="irMax" 
                        type="number" 
                        step="0.01" 
                        defaultValue={selectedPaxType?.irMax || 60.0} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Retest AH Margin (Ah)
                      </label>
                      <input 
                        name="retestAhMargin" 
                        type="number" 
                        step="0.01" 
                        defaultValue={selectedPaxType?.retestAhMargin ?? 0.1} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Retest IR Margin (mΩ)
                      </label>
                      <input 
                        name="retestIrMargin" 
                        type="number" 
                        step="0.1" 
                        defaultValue={selectedPaxType?.retestIrMargin ?? 2.0} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Hard Fail AH Limit (Ah)
                      </label>
                      <input 
                        name="hardFailAh" 
                        type="number" 
                        step="0.1" 
                        defaultValue={selectedPaxType?.hardFailAh ?? 2.8} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Hard Fail IR Limit (mΩ)
                      </label>
                      <input 
                        name="hardFailIr" 
                        type="number" 
                        step="0.1" 
                        defaultValue={selectedPaxType?.hardFailIr ?? 70.0} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: MATCHING TOLERANCES & ALLOWED GRADES */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#D8E8FA]">
                    <BrainCircuit className="w-4 h-4 text-cyan-400" />
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                      3. Assembly Delta Tolerances & Grade Selection
                    </label>
                  </div>

                  <div className="space-y-4">
                    {/* Grade Chips */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                        Allowed Cell Quality Grades (Click to toggle)
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                        {ALL_GRADES.map(grade => {
                          const isSelected = selectedGrades.includes(grade);
                          return (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => toggleGrade(grade)}
                              className={`p-3 rounded-xl border text-center transition-all cursor-pointer font-mono font-bold text-sm ${
                                isSelected 
                                  ? "bg-accent/25 border-accent text-accent shadow-md shadow-accent/20" 
                                  : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF]"
                              }`}
                            >
                              {grade}
                              <span className="block text-[10px] uppercase font-sans mt-0.5 opacity-70">
                                {isSelected ? "Allowed" : "Blocked"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                          Max Capacity Difference (ΔAh)
                        </label>
                        <input 
                          name="maxAhDifference" 
                          type="number" 
                          step="0.001" 
                          defaultValue={selectedPaxType?.maxAhDifference ?? 0.05} 
                          required 
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-1">
                          Max IR Difference (ΔIR mΩ)
                        </label>
                        <input 
                          name="maxIrDifference" 
                          type="number" 
                          step="0.1" 
                          defaultValue={selectedPaxType?.maxIrDifference ?? 3.0} 
                          required 
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/30 outline-none transition-all" 
                        />
                      </div>

                      <div className="sm:col-span-2 pt-2">
                        <label className="flex items-center gap-3 p-4 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] cursor-pointer hover:bg-white/[0.05] transition-all">
                          <input 
                            name="autoPackEnabled" 
                            type="checkbox" 
                            defaultChecked={selectedPaxType ? selectedPaxType.autoPackEnabled : true} 
                            className="w-5 h-5 rounded border-[#D8E8FA] bg-[#EAF5FF] text-accent focus:ring-accent" 
                          />
                          <div>
                            <p className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Enable Automated Pack Clustering</p>
                            <p className="text-xs text-[#526B91]">Permit the algorithm to automatically match tested cells into PAX packs based on delta limits.</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-6 border-t border-[#D8E8FA] flex items-center justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsPaxModalOpen(false)} 
                    className="px-6 py-3 rounded-xl border border-[#D8E8FA] text-[#0B2148] hover:text-[#0878F9] hover:bg-[#EAF5FF] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={savePaxTypeMutation.isPending} 
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-8 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
                  >
                    {savePaxTypeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {selectedPaxType ? "Save Changes" : "Create Specification"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
