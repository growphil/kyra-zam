"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { 
  FlaskConical, 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Package, 
  Zap, 
  QrCode, 
  ArrowRight, 
  X, 
  History, 
  ShieldCheck, 
  BarChart3, 
  ExternalLink, 
  ChevronRight, 
  Info,
  Check,
  Layers,
  Battery,
  BatteryCharging,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Tag
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useFormattedSerial } from "@/hooks/useFormattedSerial";

export default function PaxTestingPage() {
  const { formatSerial } = useFormattedSerial();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"AWAITING" | "TESTED">("AWAITING");
  const [selectedPaxSerial, setSelectedPaxSerial] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testDisposition, setTestDisposition] = useState<"PAX_TESTED" | "UNDER_REPAIR">("PAX_TESTED");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const getReportUrl = (url?: string | null) => {
    return getMediaUrl(url) || "#";
  };

  // --- DATA FETCHING ---
  const { data: paxData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pax-testing-list", activeTab],
    queryFn: async () => {
      const status = activeTab === "AWAITING"
        ? "READY_FOR_PAX_TEST,PAX_ASSEMBLED"
        : "PAX_TESTED,UNDER_REPAIR";
      return (await api.get("/pax", { params: { status } })).data;
    },
    refetchInterval: 10000 // 10s live poll
  });

  const packs = paxData?.packs || [];

  const filteredPacks = useMemo(() => {
    if (!search.trim()) return packs;
    const q = search.trim().toLowerCase();
    return packs.filter((p: any) => 
      p.paxSerial.toLowerCase().includes(q) ||
      (p.paxType?.name && p.paxType.name.toLowerCase().includes(q)) ||
      (p.paxType?.configuration && p.paxType.configuration.toLowerCase().includes(q)) ||
      (p.workOrder?.workOrderNumber && p.workOrder.workOrderNumber.toLowerCase().includes(q))
    );
  }, [packs, search]);

  const selectedPax = packs.find((p: any) => p.paxSerial === selectedPaxSerial);

  // Auto-select first pack if none selected and packs exist
  useEffect(() => {
    if (packs.length > 0 && !selectedPaxSerial) {
      setSelectedPaxSerial(packs[0].paxSerial);
    }
  }, [packs, selectedPaxSerial]);

  // --- MUTATIONS ---
  const uploadMutation = useMutation({
    mutationFn: ({ serial, file, status }: { serial: string; file: File; status: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("status", status);
      return api.post(`/pax/${serial}/test-result`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pax-testing-list"] });
      queryClient.invalidateQueries({ queryKey: ["quality-dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["all-pax-register"] });
      queryClient.invalidateQueries({ queryKey: ["all-pax"] });

      if (variables.status === "PAX_TESTED") {
        toast.success(`Pack ${variables.serial} Tested & Passed!`, {
          description: "Industrial test report attached. Pack moved to Final QC Inspection queue."
        });
      } else {
        toast.warning(`Pack ${variables.serial} Routed to Rework / Repair!`, {
          description: "Test report logged with non-conformance flag."
        });
      }

      setSelectedFile(null);
      setSelectedPaxSerial(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Report submission failed");
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmitTest = () => {
    if (!selectedPaxSerial) {
      toast.error("Please select a battery pack to test");
      return;
    }
    if (!selectedFile) {
      toast.error("Please select or upload a physical test report file (.csv, .xlsx, .pdf, .txt)");
      return;
    }

    uploadMutation.mutate({
      serial: selectedPaxSerial,
      file: selectedFile,
      status: testDisposition
    });
  };

  const calculateStats = (pax: any) => {
    if (!pax || !pax.cells || pax.cells.length === 0) {
      return { ah: 0, ir: 0, ahSpread: 0, irSpread: 0, grade: "A" };
    }
    const ahValues = pax.cells.map((c: any) => c.cell?.ahValue || 100.0);
    const irValues = pax.cells.map((c: any) => c.cell?.irValue || 0.3);
    const grades = pax.cells.map((c: any) => c.cell?.grade || "A+");
    return {
      ah: ahValues.reduce((a: number, b: number) => a + b, 0) / ahValues.length,
      ir: irValues.reduce((a: number, b: number) => a + b, 0) / irValues.length,
      ahSpread: Math.max(...ahValues) - Math.min(...ahValues),
      irSpread: Math.max(...irValues) - Math.min(...irValues),
      grade: grades[0] || "A+"
    };
  };

  return (
    <div className="min-h-screen flex flex-col space-y-4 max-w-[1720px] mx-auto pb-10 text-[#0B2148] font-sans">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex-none p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#0878F9]/10 border border-[#D8E8FA] rounded-xl flex items-center justify-center text-[#0878F9] shadow-2xs">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-display font-bold text-[#0B2148] tracking-tight">
                PAX Pack Testing Station
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0878F9] animate-pulse" />
                Physical Testing Stage
              </span>
            </div>
            <p className="text-xs text-[#526B91] mt-0.5 font-medium">
              Validate assembled battery packs, attach test report documents, and route verified packs to <strong className="text-[#0B2148]">Final QC</strong>.
            </p>
          </div>
        </div>

        {/* Right Search & KPI */}
        <div className="flex items-center gap-3">
          <div className="text-right pr-4 border-r border-[#D8E8FA] hidden sm:block">
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Awaiting Testing</p>
            <p className="text-sm font-mono font-bold text-[#0878F9]">{packs.length} Packs in Queue</p>
          </div>

          <div className="relative w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial, model name, WO..."
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] focus:border-[#0878F9] focus:bg-white rounded-xl py-2 pl-10 pr-8 text-xs text-[#0B2148] placeholder:text-[#526B91]/70 focus:outline-none transition-all shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-[#0B2148] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN MAIN WORKSPACE ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        
        {/* ── LEFT COLUMN: Packs Queue Browser (7 Cols) ──────────────────────── */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs flex-1 flex flex-col space-y-4 min-h-[550px]">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA] gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("AWAITING");
                    setSelectedPaxSerial(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "AWAITING"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148]"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Awaiting Test ({activeTab === "AWAITING" ? filteredPacks.length : "..."})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("TESTED");
                    setSelectedPaxSerial(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "TESTED"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148]"
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Tested & Reports ({activeTab === "TESTED" ? filteredPacks.length : "..."})</span>
                </button>
              </div>

              <button 
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-[10px] font-bold text-[#526B91] hover:text-[#0878F9] px-2.5 py-1 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RotateCcw className={`w-3 h-3 ${isFetching ? "animate-spin text-[#0878F9]" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Packs Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar max-h-[640px]">
              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-[#526B91] space-y-2">
                  <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
                  <p className="text-xs font-bold text-[#0B2148]">Loading assembled packs queue...</p>
                </div>
              ) : filteredPacks.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-[#F4F9FF] rounded-2xl border border-dashed border-[#D8E8FA] text-[#526B91] space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-[#0B2148]">All Packs Tested</p>
                  <p className="text-[11px] max-w-sm text-[#526B91]">
                    {search ? `No packs matching "${search}" in testing queue.` : "No battery packs are currently waiting in the testing queue. Create a pack on the PAX Assembly Line."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <AnimatePresence mode="popLayout">
                    {filteredPacks.map((pax: any) => {
                      const stats = calculateStats(pax);
                      const isSelected = selectedPaxSerial === pax.paxSerial;
                      const productName = pax.paxType?.name || "Battery Pack Model";
                      const topology = pax.paxType?.configuration || `${pax.cells?.length || 0}S1P`;
                      const chemistry = pax.paxType?.cellChemistry || "LFP";

                      return (
                        <motion.div
                          layout
                          key={pax.paxSerial}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => {
                            setSelectedPaxSerial(pax.paxSerial);
                            setSelectedFile(null);
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                            isSelected
                              ? "bg-[#EAF5FF]/80 border-[#0878F9] shadow-sm ring-2 ring-[#0878F9]/20"
                              : "bg-white hover:bg-[#F4F9FF]/80 border-[#D8E8FA] hover:border-[#0878F9]/50 shadow-2xs"
                          }`}
                        >
                          <div className="space-y-2.5">
                            {/* Top row: Icon, Serial, Status */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                                  isSelected ? "bg-[#0878F9] text-white shadow-2xs" : "bg-[#F4F9FF] text-[#0878F9] border border-[#D8E8FA]"
                                }`}>
                                  <Package className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-mono text-xs font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors truncate">
                                    {pax.paxSerial}
                                  </h4>
                                  <span className="text-[10px] text-[#526B91] font-mono block">
                                    {pax.cells?.length || 0} Cells Bound
                                  </span>
                                </div>
                              </div>

                              {pax.status === "PAX_TESTED" ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0">
                                  Test Passed
                                </span>
                              ) : pax.status === "UNDER_REPAIR" ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-50 text-rose-800 border border-rose-300 shrink-0">
                                  Under Repair
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                                  Ready for Test
                                </span>
                              )}
                            </div>

                            {/* ── PROMINENT PRODUCT MODEL CHIP ────────────────────── */}
                            <div className="p-2.5 rounded-xl bg-white border border-[#D8E8FA] space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] uppercase font-bold tracking-wider text-[#526B91] flex items-center gap-1">
                                  <Battery className="w-3 h-3 text-[#0878F9]" />
                                  <span>Product Model:</span>
                                </span>
                                <span className="text-[10px] font-mono text-[#0878F9] font-bold">
                                  {topology} • {chemistry}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-[#0B2148] truncate">
                                {productName}
                              </div>
                            </div>

                            {/* Work order / date badge */}
                            <div className="flex items-center justify-between text-[10px] text-[#526B91] font-mono px-0.5">
                              <span>WO: <strong className="text-[#0B2148]">{pax.workOrder?.workOrderNumber || "Direct Assembly"}</strong></span>
                              <span>Assy: {new Date(pax.assembledAt).toLocaleDateString()}</span>
                            </div>

                            {/* Measured stats chips */}
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-[#D8E8FA]/70">
                              <div className="bg-[#F4F9FF] p-2 rounded-xl border border-[#D8E8FA] text-center">
                                <span className="text-[8px] font-sans font-bold text-[#526B91] uppercase block">Avg Capacity</span>
                                <span className="text-[#166534] font-bold">{stats.ah.toFixed(2)} AH</span>
                              </div>
                              <div className="bg-[#F4F9FF] p-2 rounded-xl border border-[#D8E8FA] text-center">
                                <span className="text-[8px] font-sans font-bold text-[#526B91] uppercase block">Avg IR</span>
                                <span className="text-[#0878F9] font-bold">{stats.ir.toFixed(2)} mΩ</span>
                              </div>
                            </div>

                            {/* Attached Report Pill */}
                            {pax.testReportUrl && (
                              <div className="pt-1 border-t border-[#D8E8FA]/70 flex items-center justify-between text-[10px]">
                                <span className="font-mono text-emerald-700 flex items-center gap-1 font-semibold">
                                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Stored Report</span>
                                </span>
                                <a
                                  href={getReportUrl(pax.testReportUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] font-bold text-[#0878F9] hover:underline flex items-center gap-1 bg-[#EAF5FF] px-2 py-0.5 rounded-md border border-[#D8E8FA]"
                                >
                                  <span>Open Report</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2 border-t border-[#D8E8FA]/70 flex items-center justify-between text-[10px]">
                            <span className="text-[#526B91] font-mono">Grade {stats.grade}</span>
                            <span className={`font-bold flex items-center gap-1 ${
                              isSelected ? "text-[#0878F9] font-extrabold" : "text-[#526B91] group-hover:text-[#0878F9]"
                            }`}>
                              Select Pack <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Technical Validation & Report Upload (5 Cols) ─────── */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs flex-1 flex flex-col space-y-4 min-h-[550px]">
            
            {!selectedPax ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#526B91] space-y-3">
                <History className="w-10 h-10 text-[#526B91] mx-auto" />
                <h4 className="text-sm font-bold text-[#0B2148] uppercase tracking-wide">Select a Pack from Queue</h4>
                <p className="text-xs max-w-xs text-[#526B91]">
                  Pick an assembled battery pack on the left to review telemetry and upload the test verification report.
                </p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col">
                
                {/* Header info */}
                <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#0878F9]" />
                    <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Pack Verification Cockpit</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#0878F9] bg-[#EAF5FF] px-2.5 py-0.5 rounded-lg border border-[#0878F9]/30">
                    {selectedPax.paxSerial}
                  </span>
                </div>

                {/* ── PROMINENT ACTIVE PRODUCT MODEL BANNER ── */}
                <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1">
                        <Battery className="w-3 h-3 text-[#0878F9]" />
                        <span>Active Product Model:</span>
                      </span>
                      <h3 className="text-base font-bold text-[#0B2148]">
                        {selectedPax.paxType?.name || "Battery Pack Model"}
                      </h3>
                      <p className="text-xs font-mono text-[#0878F9] font-bold">
                        {selectedPax.paxType?.configuration || `${selectedPax.cells?.length || 0}S1P`} • {selectedPax.paxType?.cellChemistry || "LFP"} • {selectedPax.paxType?.nominalVoltage || 48}V
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider block">Production WO</span>
                      <span className="text-xs font-mono font-bold text-[#0B2148] bg-white px-2 py-0.5 rounded-md border border-[#D8E8FA] inline-block mt-0.5">
                        {selectedPax.workOrder?.workOrderNumber || "Direct Build"}
                      </span>
                    </div>
                  </div>

                  {/* Cell series breakdown chips */}
                  <div className="pt-2 border-t border-[#D8E8FA]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-[#526B91] uppercase">
                        Slotted Series Cells ({selectedPax.cells?.length || 0}):
                      </span>
                      <span className="text-[10px] font-mono text-[#166534] font-bold">
                        Grade {calculateStats(selectedPax).grade} (Safe Δ)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[115px] overflow-y-auto pr-1 custom-scrollbar">
                      {selectedPax.cells?.map((pc: any, i: number) => (
                        <div key={i} className="p-1.5 bg-white border border-[#D8E8FA] rounded-lg flex items-center justify-between text-[10px] font-mono">
                          <span className="text-[#0878F9] font-bold">P{pc.position || i + 1}</span>
                          <span className="text-[#0B2148] font-bold truncate max-w-[90px]">{formatSerial(pc.cellSerial)}</span>
                          <span className="text-[#526B91]">{pc.cell?.ahValue ? `${pc.cell.ahValue.toFixed(1)}Ah` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── ATTACHED TEST REPORT BANNER ── */}
                {selectedPax.testReportUrl && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-950">Machine Test Report Uploaded & Stored</p>
                        <p className="text-[10px] text-emerald-700 font-mono truncate max-w-[240px]">
                          {selectedPax.testReportUrl}
                        </p>
                      </div>
                    </div>
                    <a
                      href={getReportUrl(selectedPax.testReportUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors"
                    >
                      <span>Open Report</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Physical Test Report Upload Dropzone */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0878F9]" />
                    Attach Machine Test Report
                  </label>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-2 ${
                      selectedFile 
                        ? "bg-emerald-50 border-emerald-400 text-emerald-900" 
                        : "bg-[#F4F9FF] hover:bg-[#EAF5FF] border-[#D8E8FA] hover:border-[#0878F9] text-[#526B91]"
                    }`}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.pdf,.txt,.png,.jpg"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-900">{selectedFile.name}</p>
                          <p className="text-[10px] text-emerald-600 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB • Ready for Attachment</p>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Change File
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-xl bg-[#0878F9]/10 text-[#0878F9] flex items-center justify-center mx-auto">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#0B2148]">Click or Drag & Drop Test Report File</p>
                          <p className="text-[10px] text-[#526B91]">Supports .CSV, .XLSX, .PDF, .TXT (Machine Telemetry Export)</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Test Disposition Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                    Testing Disposition & Route
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTestDisposition("PAX_TESTED")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        testDisposition === "PAX_TESTED"
                          ? "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-2xs"
                          : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Pass Test
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Route to Final QC
                        </span>
                      </div>
                      <p className="text-[10px] text-[#526B91]">Pack passes all physical load/IR tests</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTestDisposition("UNDER_REPAIR")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        testDisposition === "UNDER_REPAIR"
                          ? "bg-rose-50 border-rose-400 text-rose-900 shadow-2xs"
                          : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          Rework Needed
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                          Send to Repair
                        </span>
                      </div>
                      <p className="text-[10px] text-[#526B91]">Non-conformance detected during testing</p>
                    </button>
                  </div>
                </div>

                {/* Final Submission CTA */}
                <div className="pt-2">
                  <button
                    disabled={!selectedFile || uploadMutation.isPending}
                    onClick={handleSubmitTest}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Uploading & Routing Pack...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>Complete Test & Submit to Final QC</span>
                      </>
                    )}
                  </button>
                  {!selectedFile && (
                    <p className="text-[10px] text-center text-[#526B91] mt-1.5">
                      Attach test report document above to authorize testing completion
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
