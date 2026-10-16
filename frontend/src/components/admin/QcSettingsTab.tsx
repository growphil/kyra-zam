"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShieldCheck, 
  Save, 
  Loader2, 
  Zap, 
  CheckCircle2, 
  Sliders, 
  Hash, 
  AlertCircle, 
  Eye, 
  ArrowRight, 
  Gauge 
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface QcSettingsTabProps {
  onNavigateToPax?: () => void;
}

export default function QcSettingsTab({ onNavigateToPax }: QcSettingsTabProps) {
  const queryClient = useQueryClient();

  // --- QC THRESHOLDS QUERY ---
  const { data: thresholds, isLoading: loadingThresholds } = useQuery({
    queryKey: ["admin-thresholds"],
    queryFn: async () => (await api.get("/admin/qc-thresholds")).data
  });

  const updateThresholdsMutation = useMutation({
    mutationFn: (data: any) => api.put("/admin/qc-thresholds", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-thresholds"] });
      toast.success("Global QC safety bands updated successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update thresholds");
    }
  });

  // --- PAX TYPES QUERY ---
  const { data: paxTypes, isLoading: loadingPaxTypes } = useQuery({
    queryKey: ["admin-pax-types"],
    queryFn: async () => (await api.get("/admin/pax-types")).data
  });

  // Form state for live visual preview
  const [ahMinInput, setAhMinInput] = useState<number>(3.0);
  const [ahMaxInput, setAhMaxInput] = useState<number>(3.6);
  const [irMinInput, setIrMinInput] = useState<number>(5.0);
  const [irMaxInput, setIrMaxInput] = useState<number>(60.0);
  const [serialDisplayLengthInput, setSerialDisplayLengthInput] = useState<string>("");

  useEffect(() => {
    if (thresholds) {
      setAhMinInput(thresholds.ahMin ?? 3.0);
      setAhMaxInput(thresholds.ahMax ?? 3.6);
      setIrMinInput(thresholds.irMin ?? 5.0);
      setIrMaxInput(thresholds.irMax ?? 60.0);
      setSerialDisplayLengthInput(thresholds.serialDisplayLength ? String(thresholds.serialDisplayLength) : "");
    }
  }, [thresholds]);

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ahMin = ahMinInput;
    const ahMax = ahMaxInput;
    const irMin = irMinInput;
    const irMax = irMaxInput;
    const serialDisplayLength = serialDisplayLengthInput ? parseInt(serialDisplayLengthInput, 10) : null;

    if (isNaN(ahMin) || isNaN(ahMax) || ahMin <= 0 || ahMax <= 0) {
      toast.error("AH Min and AH Max must be positive numbers.");
      return;
    }
    if (ahMin > ahMax) {
      toast.error("AH Minimum cannot exceed AH Maximum.");
      return;
    }
    if (isNaN(irMin) || isNaN(irMax) || irMin <= 0 || irMax <= 0) {
      toast.error("IR Min and IR Max must be positive numbers.");
      return;
    }
    if (irMin > irMax) {
      toast.error("IR Minimum cannot exceed IR Maximum.");
      return;
    }

    updateThresholdsMutation.mutate({
      ahMin,
      ahMax,
      irMin,
      irMax,
      serialDisplayLength,
    });
  };

  const activeModel = paxTypes?.find((p: any) => p.isProductionActive);

  // Live Serial Mask Calculation
  const sampleSerial = "KYRA-BAT-2026-0000000042";
  const parsedLen = serialDisplayLengthInput ? parseInt(serialDisplayLengthInput, 10) : 0;
  const formattedSample = (parsedLen > 0 && parsedLen < sampleSerial.length)
    ? `...${sampleSerial.slice(-parsedLen)}`
    : sampleSerial;

  return (
    <div className="space-y-6">
      {/* Current Active QC Source Banner (Clean Light Blue Surface) */}
      <div className="p-5 rounded-2xl border border-[#BFDBFE] bg-[#EAF5FF] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 bg-[#0878F9]/15 text-[#0878F9] border border-[#0878F9]/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B2148]">Live Production QC Engine:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                activeModel 
                  ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" 
                  : "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
              }`}>
                <span className={`w-2 h-2 rounded-full ${activeModel ? "bg-[#166534]" : "bg-[#1D4ED8]"} animate-pulse`} />
                {activeModel ? `PAX MODEL: ${activeModel.name}` : "GLOBAL FALLBACK STANDARDS"}
              </span>
            </div>
            <p className="text-xs text-[#526B91] mt-1 font-medium">
              {activeModel 
                ? `All testing stations are screening cells under ${activeModel.name} parameters (AH: ${activeModel.ahMin} - ${activeModel.ahMax}, IR: ${activeModel.irMin} - ${activeModel.irMax} mΩ).`
                : `No active model selected. Testing stations apply the global fallback safety bands below.`
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Global Safety Bands Configuration */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#D8E8FA] relative overflow-hidden space-y-6 shadow-sm"
        >
          <div className="flex items-center gap-3.5 pb-5 border-b border-[#D8E8FA]">
            <div className="w-11 h-11 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0B2148]">Global Safety Bands</h3>
              <p className="text-xs font-semibold text-[#526B91] uppercase tracking-wider mt-0.5">Master Fallback Screening Criteria</p>
            </div>
          </div>

          {loadingThresholds ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#526B91]">
              <Loader2 className="w-8 h-8 animate-spin text-[#0878F9]" />
              <p className="text-xs font-semibold">Loading standards...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-5">
              {/* Visual Tolerance Preview Spectrum */}
              <div className="p-4 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#526B91]">
                  <span className="flex items-center gap-1.5 text-[#0B2148]">
                    <Gauge className="w-4 h-4 text-[#0878F9]" />
                    Live Tolerance Band Spectrum
                  </span>
                  <span className="text-[#166534] font-mono font-bold bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#BBF7D0]">
                    Nominal: {ahMinInput} - {ahMaxInput} Ah | {irMinInput} - {irMaxInput} mΩ
                  </span>
                </div>
                
                {/* Visual Capacity Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-[#526B91]">
                    <span>Capacity (AH)</span>
                    <span className="text-[#0B2148] font-bold">{ahMinInput} Ah → {ahMaxInput} Ah</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#FEE2E2] rounded-full overflow-hidden flex p-0.5 border border-[#FECACA]">
                    <div className="h-full bg-[#FDE68A] rounded-l-full" style={{ width: "15%" }} title="Lower Retest" />
                    <div className="h-full bg-[#166534] mx-auto rounded-xs" style={{ width: "70%" }} title="Pass Band" />
                    <div className="h-full bg-[#FDE68A] rounded-r-full" style={{ width: "15%" }} title="Upper Retest" />
                  </div>
                </div>

                {/* Visual IR Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-[#526B91]">
                    <span>Internal Resistance (mΩ)</span>
                    <span className="text-[#0878F9] font-bold">{irMinInput} mΩ → {irMaxInput} mΩ</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#FEE2E2] rounded-full overflow-hidden flex p-0.5 border border-[#FECACA]">
                    <div className="h-full bg-[#BFDBFE] rounded-l-full" style={{ width: "10%" }} title="Lower Bound" />
                    <div className="h-full bg-[#166534] mx-auto rounded-xs" style={{ width: "75%" }} title="Pass Band" />
                    <div className="h-full bg-[#FDE68A] rounded-r-full" style={{ width: "15%" }} title="Upper Retest" />
                  </div>
                </div>
              </div>

              {/* Form Input Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5 ml-0.5">
                    <Sliders className="w-3.5 h-3.5 text-[#0878F9]" />
                    Min Capacity (AH)
                  </label>
                  <input 
                    name="ahMin" 
                    value={ahMinInput} 
                    onChange={(e) => setAhMinInput(parseFloat(e.target.value) || 0)}
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    required 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-[#0B2148] font-mono text-sm placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5 ml-0.5">
                    <Sliders className="w-3.5 h-3.5 text-[#0878F9]" />
                    Max Capacity (AH)
                  </label>
                  <input 
                    name="ahMax" 
                    value={ahMaxInput} 
                    onChange={(e) => setAhMaxInput(parseFloat(e.target.value) || 0)}
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    required 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-[#0B2148] font-mono text-sm placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5 ml-0.5">
                    <Sliders className="w-3.5 h-3.5 text-[#166534]" />
                    Min IR Resistance (mΩ)
                  </label>
                  <input 
                    name="irMin" 
                    value={irMinInput} 
                    onChange={(e) => setIrMinInput(parseFloat(e.target.value) || 0)}
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    required 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-[#0B2148] font-mono text-sm placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5 ml-0.5">
                    <Sliders className="w-3.5 h-3.5 text-[#166534]" />
                    Max IR Resistance (mΩ)
                  </label>
                  <input 
                    name="irMax" 
                    value={irMaxInput} 
                    onChange={(e) => setIrMaxInput(parseFloat(e.target.value) || 0)}
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    required 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-[#0B2148] font-mono text-sm placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all" 
                  />
                </div>

                {/* Serial Barcode Masking with Live Preview */}
                <div className="sm:col-span-2 space-y-2.5 pt-3 border-t border-[#E8F1FC]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5 ml-0.5">
                      <Hash className="w-3.5 h-3.5 text-[#0878F9]" />
                      Serial Suffix Display Length
                    </label>
                    <span className="text-xs font-mono font-bold text-[#0878F9]">
                      {serialDisplayLengthInput ? `${serialDisplayLengthInput} Characters` : "Full Barcode"}
                    </span>
                  </div>

                  <input 
                    name="serialDisplayLength" 
                    value={serialDisplayLengthInput} 
                    onChange={(e) => setSerialDisplayLengthInput(e.target.value)}
                    type="number" 
                    min="1"
                    max="50"
                    placeholder="e.g. 10 (Leave blank to display complete serial)" 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-[#0B2148] font-mono text-sm placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all" 
                  />

                  {/* Live Barcode Mask Preview */}
                  <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl flex items-center justify-between gap-4 text-xs font-mono">
                    <span className="text-[#526B91] flex items-center gap-1.5 font-sans font-semibold">
                      <Eye className="w-3.5 h-3.5 text-[#526B91]" />
                      Table Display Preview:
                    </span>
                    <span className="text-[#0878F9] bg-[#EAF5FF] px-2.5 py-1 rounded-md border border-[#BFDBFE] font-bold">
                      {formattedSample}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8F1FC] flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs text-[#526B91] flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 text-[#D97706] flex-shrink-0" />
                  Parameters update instantly across all testing queues.
                </span>
                <button 
                  type="submit"
                  disabled={updateThresholdsMutation.isPending}
                  className="flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 px-6 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  {updateThresholdsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Safety Bands
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Active Production Model Selector */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#D8E8FA] space-y-5 shadow-sm"
        >
          <div className="flex items-center justify-between pb-5 border-b border-[#D8E8FA]">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-[#DCFCE7] border border-[#BBF7D0] rounded-xl flex items-center justify-center text-[#166534]">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0B2148]">Active Production Model</h3>
                <p className="text-xs font-semibold text-[#526B91] uppercase tracking-wider mt-0.5">Live Model Activation</p>
              </div>
            </div>

            {onNavigateToPax && (
              <button
                type="button"
                onClick={onNavigateToPax}
                className="text-xs text-[#0878F9] hover:text-[#0667DB] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Manage Models</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-[#526B91] leading-relaxed">
              Select the battery pack model currently on the assembly line. The testing station and auto-packing engine adapt dynamically to the model thresholds.
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Global Fallback Standard Option */}
              <button 
                type="button"
                onClick={() => api.post("/admin/pax-types/clear-production").then(() => {
                  queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
                  queryClient.invalidateQueries({ queryKey: ["admin-thresholds"] });
                  toast.success("Active model cleared. Using global fallback safety bands.");
                })}
                className={`w-full p-4 rounded-xl border transition-all text-left group flex items-center justify-between cursor-pointer ${
                  !activeModel 
                    ? "bg-[#EAF5FF] border-[#0878F9] ring-1 ring-[#0878F9]/30 shadow-sm" 
                    : "bg-white border-[#D8E8FA] hover:border-[#0878F9]/40 hover:bg-[#F4F9FF]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold transition-colors ${!activeModel ? "text-[#0878F9]" : "text-[#0B2148] group-hover:text-[#0878F9]"}`}>
                      Global Fallback Standard
                    </p>
                    {!activeModel && (
                      <span className="px-2 py-0.5 bg-[#DBEAFE] border border-[#BFDBFE] rounded text-[10px] font-mono text-[#1D4ED8] font-bold uppercase">
                        Live Standard
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#526B91] mt-1 font-mono">
                    AH: {thresholds?.ahMin ?? "3.0"} - {thresholds?.ahMax ?? "3.6"} • Max IR: {thresholds?.irMax ?? "60.0"} mΩ
                  </p>
                </div>
                {!activeModel && <CheckCircle2 className="w-5 h-5 text-[#0878F9] flex-shrink-0 ml-3" />}
              </button>

              {/* PAX Models */}
              {loadingPaxTypes ? (
                <div className="py-8 flex items-center justify-center text-[#526B91]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0878F9]" />
                </div>
              ) : (
                paxTypes?.map((type: any, idx: number) => (
                  <button 
                    type="button"
                    key={type.id}
                    onClick={() => api.post(`/admin/pax-types/${type.id}/set-production`).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-thresholds"] });
                      toast.success(`Active production set to: ${type.name}`);
                    })}
                    className={`w-full p-4 rounded-xl border transition-all text-left group flex items-center justify-between cursor-pointer ${
                      type.isProductionActive 
                        ? "bg-[#EAF5FF] border-[#0878F9] ring-1 ring-[#0878F9]/30 shadow-sm" 
                        : "bg-white border-[#D8E8FA] hover:border-[#0878F9]/40 hover:bg-[#F4F9FF]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-blue-100 text-[#0878F9] font-mono font-bold text-[10px] flex items-center justify-center border border-blue-200 shrink-0">
                          #{idx + 1}
                        </span>
                        <p className={`text-sm font-bold transition-colors ${type.isProductionActive ? "text-[#0878F9]" : "text-[#0B2148] group-hover:text-[#0878F9]"}`}>
                          {type.name}
                        </p>
                        {type.isProductionActive && (
                          <span className="px-2 py-0.5 bg-[#DCFCE7] border border-[#BBF7D0] rounded text-[10px] font-mono text-[#166534] font-bold uppercase">
                            Live Model
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-[#526B91] mt-1">
                        {type.cellCount} Cells • {type.ahMin}-{type.ahMax} Ah • Max IR: {type.irMax} mΩ
                      </p>
                    </div>
                    {type.isProductionActive && <CheckCircle2 className="w-5 h-5 text-[#0878F9] flex-shrink-0 ml-3" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
