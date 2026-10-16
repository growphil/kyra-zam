"use client";

import { useState, useMemo } from "react";
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
  RefreshCw,
  AlertCircle,
  X,
  PlusCircle,
  Play,
  RotateCcw,
  Check,
  Layers,
  ArrowRight,
  ShieldCheck,
  Activity,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function ReworkCockpitPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPaxSerial, setSelectedPaxSerial] = useState<string | null>(null);

  // Cell Swap Modal State
  const [swappingCellPosition, setSwappingCellPosition] = useState<number | null>(null);
  const [oldCellSerial, setOldCellSerial] = useState("");
  const [newCellSerial, setNewCellSerial] = useState("");
  const [newCellInput, setNewCellInput] = useState("");
  const [scannedCellDetails, setScannedCellDetails] = useState<any | null>(null);
  const [scanError, setScanError] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [oldCellDisposition, setOldCellDisposition] = useState<"REJECTED" | "CELL_TESTED">("REJECTED");

  // Reroute Modal State
  const [reroutingPax, setReroutingPax] = useState<any | null>(null);
  const [rerouteNotes, setRerouteNotes] = useState("");

  // Query: Packs in UNDER_REPAIR status
  const { data: paxData, isLoading: isPacksLoading, refetch: refetchList } = useQuery({
    queryKey: ["pax-repair-list"],
    queryFn: async () => (await api.get("/pax", { params: { status: "UNDER_REPAIR" } })).data,
    refetchInterval: 10000
  });

  const rawPacks = paxData?.packs || [];
  const filteredPacks = useMemo(() => {
    if (!search.trim()) return rawPacks;
    const q = search.trim().toLowerCase();
    return rawPacks.filter((p: any) => 
      p.paxSerial.toLowerCase().includes(q) ||
      (p.paxType?.name && p.paxType.name.toLowerCase().includes(q)) ||
      (p.workOrder?.workOrderNumber && p.workOrder.workOrderNumber.toLowerCase().includes(q))
    );
  }, [rawPacks, search]);

  // Query: Details of selected pack (includes cells and defects)
  const { data: selectedPax, isLoading: isPaxDetailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ["pax-detail", selectedPaxSerial],
    queryFn: async () => {
      if (!selectedPaxSerial) return null;
      const res = await api.get(`/pax/${encodeURIComponent(selectedPaxSerial)}`);
      return res.data;
    },
    enabled: !!selectedPaxSerial
  });

  // Query: Open Defects on selected pack
  const { data: defects = [] } = useQuery({
    queryKey: ["pax-defects", selectedPaxSerial],
    queryFn: async () => {
      if (!selectedPaxSerial) return [];
      try {
        const res = await api.get("/crm/quality/defects", { params: { status: "OPEN" } });
        return (res.data || []).filter((d: any) => d.paxSerial === selectedPaxSerial);
      } catch {
        return [];
      }
    },
    enabled: !!selectedPaxSerial
  });

  // Cell candidate verification
  const scanCellMutation = useMutation({
    mutationFn: async (serial: string) => {
      const clean = serial.trim();
      const res = await api.get(`/cells/${encodeURIComponent(clean)}`);
      const cell = res.data?.cell;
      if (!cell) throw new Error("Cell not found in inventory.");
      if (cell.status !== "CELL_TESTED") {
        throw new Error(`Cell status is ${cell.status}, expected CELL_TESTED.`);
      }
      if (cell.paxCell && cell.paxCell.paxSerial !== selectedPaxSerial) {
        throw new Error(`Cell is already assigned to pack ${cell.paxCell.pax?.paxSerial || cell.paxCell.paxSerial}.`);
      }
      return cell;
    },
    onSuccess: (cell) => {
      setScannedCellDetails(cell);
      setNewCellSerial(cell.serialNumber);
      setScanError("");
      toast.success(`Cell ${cell.serialNumber} verified and available!`);
    },
    onError: (err: any) => {
      setScannedCellDetails(null);
      setNewCellSerial("");
      const msg = err.response?.data?.error || err.message || "Failed to retrieve cell.";
      setScanError(msg);
      toast.error(msg);
    }
  });

  // Mutation: Execute Cell Swap
  const cellSwapMutation = useMutation({
    mutationFn: async (payload: any) => {
      return (await api.post("/repair/cell-swap", payload)).data;
    },
    onSuccess: () => {
      toast.success("Cell swap completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["pax-detail", selectedPaxSerial] });
      queryClient.invalidateQueries({ queryKey: ["pax-defects", selectedPaxSerial] });
      queryClient.invalidateQueries({ queryKey: ["pax-repair-list"] });
      closeSwapModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Cell swap failed.");
    }
  });

  // Mutation: Log Repair & Complete
  const completeRepairMutation = useMutation({
    mutationFn: async (payload: any) => {
      return (await api.post("/repair", payload)).data;
    },
    onSuccess: () => {
      toast.success("Rework completed! Pack returned to PAX_ASSEMBLED for re-testing.");
      queryClient.invalidateQueries({ queryKey: ["pax-repair-list"] });
      queryClient.invalidateQueries({ queryKey: ["pax-testing-list"] });
      setSelectedPaxSerial(null);
      setReroutingPax(null);
      setRerouteNotes("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to reroute pack.");
    }
  });

  const handleScanCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCellInput.trim()) return;
    scanCellMutation.mutate(newCellInput.trim());
  };

  const closeSwapModal = () => {
    setSwappingCellPosition(null);
    setOldCellSerial("");
    setNewCellSerial("");
    setNewCellInput("");
    setScannedCellDetails(null);
    setScanError("");
    setDiagnosisNotes("");
  };

  const executeCellSwap = () => {
    if (!selectedPaxSerial || !oldCellSerial || !newCellSerial || !diagnosisNotes) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const activeDefect = defects.find((d: any) => d.paxSerial === selectedPaxSerial);

    cellSwapMutation.mutate({
      paxSerial: selectedPaxSerial,
      oldCellSerial,
      newCellSerial,
      defectId: activeDefect?.id || null,
      diagnosisNotes,
      oldCellDisposition,
      fixType: "cell_swap"
    });
  };

  // Perform Client-side validation checks
  const getCompatibilityReport = () => {
    if (!scannedCellDetails || !selectedPax) return null;

    const cellList = selectedPax.cells || selectedPax.paxCells || [];
    const otherCells = cellList
      .filter((pc: any) => pc.cellSerial !== oldCellSerial)
      .map((pc: any) => pc.cell)
      .filter(Boolean);

    const replacementList = [...otherCells, scannedCellDetails];
    const paxType = selectedPax.paxType || {};

    // A. Grades Check
    const grades = replacementList.map(c => c.grade).filter(Boolean);
    const uniqueGrades = Array.from(new Set(grades));
    const allowedGrades = paxType.allowedGrades || ["A", "B", "C"];
    const gradeOk = uniqueGrades.length === 1 && allowedGrades.includes(grades[0]);

    // B. Batches Check
    const batches = replacementList.map(c => c.batchNumber).filter(Boolean);
    const uniqueBatches = Array.from(new Set(batches));
    const batchOk = uniqueBatches.length <= 1;

    // C. AH Delta Check
    const ahValues = replacementList.map(c => c.ahValue).filter(v => v !== null && v !== undefined);
    let ahDelta = 0;
    let ahOk = true;
    const maxAh = paxType.maxAhDifference ?? 0.5;
    if (ahValues.length > 0) {
      ahDelta = Math.max(...ahValues) - Math.min(...ahValues);
      ahOk = ahDelta <= maxAh;
    }

    // D. IR Delta Check
    const irValues = replacementList.map(c => c.irValue).filter(v => v !== null && v !== undefined);
    let irDelta = 0;
    let irOk = true;
    const maxIr = paxType.maxIrDifference ?? 2.0;
    if (irValues.length > 0) {
      irDelta = Math.max(...irValues) - Math.min(...irValues);
      irOk = irDelta <= maxIr;
    }

    return {
      gradeOk,
      uniqueGrades,
      allowedGrades,
      batchOk,
      uniqueBatches,
      ahOk,
      ahDelta,
      maxAh,
      irOk,
      irDelta,
      maxIr,
      allPassed: gradeOk && batchOk && ahOk && irOk
    };
  };

  const compat = getCompatibilityReport();
  const currentPackCells = selectedPax?.cells || selectedPax?.paxCells || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              Factory Rework Cockpit
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                {rawPacks.length} Pending
              </span>
            </h1>
            <p className="text-xs text-[#526B91] mt-0.5">
              Manage cell replacements, genealogy tracking, and complete QA rework loops for failed battery packs.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            refetchList();
            if (selectedPaxSerial) refetchDetail();
          }}
          className="self-start sm:self-auto px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#526B91]" />
          Refresh List
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Queue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by PAX serial or model..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono" 
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#526B91] px-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Awaiting Rework Queue</span>
              <span className="font-mono">{filteredPacks.length} pack{filteredPacks.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {isPacksLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 animate-pulse h-20" />
              ))
            ) : filteredPacks.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-800">No Packs in Rework</p>
                <p className="text-[11px] text-[#526B91]">All failed battery packs have been resolved and returned to testing.</p>
              </div>
            ) : (
              filteredPacks.map((pax: any) => {
                const isSelected = selectedPaxSerial === pax.paxSerial;
                return (
                  <div 
                    key={pax.paxSerial}
                    onClick={() => setSelectedPaxSerial(pax.paxSerial)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                      isSelected 
                        ? "bg-blue-50/70 border-blue-400 shadow-xs ring-2 ring-blue-500/20" 
                        : "bg-white hover:bg-slate-50 border-slate-200 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {pax.paxSerial}
                        </h4>
                        <p className="text-[11px] text-[#526B91] font-medium mt-0.5">
                          {pax.paxType?.name || "Battery Pack"} • {pax.paxType?.cellCount || 0} Cells
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-[10px] font-bold uppercase">
                        Under Repair
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-[#526B91] font-mono">
                      <span>WO: <strong className="text-slate-700">{pax.workOrder?.workOrderNumber || "WO-GENERAL"}</strong></span>
                      <span className={`font-semibold flex items-center gap-1 ${isSelected ? "text-blue-600 font-bold" : "text-[#526B91]"}`}>
                        Inspect <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Rework Cockpit Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {isPaxDetailLoading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[420px] text-[#526B91] space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium">Loading Pack Rework Workspace...</p>
            </div>
          ) : selectedPax ? (
            <div className="space-y-6">
              {/* Pack info header card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-mono font-bold text-slate-900">{selectedPax.paxSerial}</h2>
                      <span className="px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold uppercase">
                        UNDER REPAIR
                      </span>
                    </div>
                    <p className="text-xs text-[#526B91] font-medium mt-1">
                      {selectedPax.paxType?.name} • Delta Tolerances: ≤{selectedPax.paxType?.maxAhDifference} AH / ≤{selectedPax.paxType?.maxIrDifference} mΩ
                    </p>
                  </div>

                  <button 
                    onClick={() => setReroutingPax(selectedPax)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Complete Rework & Reroute
                  </button>
                </div>

                {/* Metadata details row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-[#526B91] block">Work Order</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedPax.workOrder?.workOrderNumber || "WO-GENERAL"}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-[#526B91] block">Assembled Date</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedPax.assembledAt ? new Date(selectedPax.assembledAt).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-[#526B91] block">Cell Count</span>
                    <span className="font-mono font-semibold text-slate-800">{currentPackCells.length} / {selectedPax.paxType?.cellCount || 0}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-[#526B91] block">Target Grade</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {(selectedPax.paxType?.allowedGrades || []).join(", ") || "A, B"}
                    </span>
                  </div>
                </div>

                {/* Open Defect logs */}
                {defects.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      Active Defect Non-Conformances ({defects.length})
                    </div>
                    <div className="space-y-1.5">
                      {defects.map((def: any) => (
                        <div key={def.id} className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-red-100 flex items-start justify-between gap-3">
                          <div>
                            <span className="font-mono text-red-600 font-bold mr-2">{def.defectNumber || "DEFECT"}</span>
                            <span>{def.description}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold uppercase shrink-0">
                            {def.category || "QUALITY"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cell Mapping grid */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pack Cell Placement Genealogy
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#526B91] font-medium">
                    Hover on any slotted cell to initiate swap replacement
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {Array.from({ length: selectedPax.paxType?.cellCount || currentPackCells.length || 1 }).map((_, index) => {
                    const pos = index + 1;
                    const paxCell = currentPackCells.find((pc: any) => pc.position === pos);
                    const cell = paxCell?.cell;

                    return (
                      <div 
                        key={pos}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between min-h-[140px] relative transition-all group ${
                          cell 
                            ? "bg-slate-50/70 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40" 
                            : "bg-slate-50/30 border-dashed border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="w-6 h-6 bg-white border border-slate-200 rounded-md flex items-center justify-center text-xs font-mono font-bold text-slate-700 shadow-2xs">
                            {pos}
                          </span>
                          {cell && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-mono font-bold">
                              Grade {cell.grade || "RAW"}
                            </span>
                          )}
                        </div>

                        {cell ? (
                          <div className="mt-3 space-y-1">
                            <p className="font-mono text-xs font-bold text-slate-900 truncate" title={cell.serialNumber}>
                              {cell.serialNumber}
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-[#526B91] font-mono font-medium">
                              <div>{cell.ahValue ? Number(cell.ahValue).toFixed(2) : "0.00"} AH</div>
                              <div className="text-blue-600 font-semibold">{cell.irValue ? Number(cell.irValue).toFixed(1) : "0.0"} mΩ</div>
                            </div>
                            <p className="text-[10px] text-[#526B91] font-mono truncate">Batch: {cell.batchNumber || "N/A"}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#526B91] font-medium py-4 text-center">Unassigned</p>
                        )}

                        {cell && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                            <button 
                              onClick={() => {
                                setSwappingCellPosition(pos);
                                setOldCellSerial(cell.serialNumber);
                              }}
                              className="w-full py-1.5 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 hover:border-blue-600 text-[10px] font-bold uppercase rounded-lg tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <Wrench className="w-3 h-3" /> Swap Cell
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-center space-y-3 shadow-sm min-h-[420px] flex flex-col items-center justify-center">
              <Package className="w-12 h-12 text-[#0B2148]" />
              <h3 className="text-base font-bold text-slate-800">Rework Workspace Idle</h3>
              <p className="text-xs text-[#526B91] max-w-sm">
                Select a pending repair pack from the queue on the left to review cell parameters and execute verified cell swaps.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CELL SWAP MODAL */}
      <AnimatePresence>
        {swappingCellPosition !== null && (
          <div className="fixed inset-0 bg-white backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Swap Cell — Position {swappingCellPosition}
                </h3>
                <button 
                  onClick={closeSwapModal} 
                  className="text-[#526B91] hover:text-[#526B91] transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider block">
                    Current / Faulty Cell Serial
                  </label>
                  <p className="font-mono text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 mt-1">
                    {oldCellSerial}
                  </p>
                </div>

                <form onSubmit={handleScanCell} className="space-y-1.5">
                  <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider block">
                    Scan / Input Replacement Cell
                  </label>
                  <div className="flex gap-2">
                    <input 
                      value={newCellInput}
                      onChange={e => setNewCellInput(e.target.value)}
                      placeholder="e.g. CELL-179144368..." 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono" 
                    />
                    <button 
                      type="submit"
                      disabled={scanCellMutation.isPending || !newCellInput.trim()}
                      className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      {scanCellMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                  {scanError && <p className="text-[11px] text-red-600 mt-1 font-medium">{scanError}</p>}
                </form>

                {/* Compatibility Checks report */}
                {scannedCellDetails && compat && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-600" />
                        Delta Safety & Grade Verification
                      </h4>
                      <span className="font-mono text-[10px] font-semibold text-[#526B91]">{scannedCellDetails.serialNumber}</span>
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#526B91]">Grade Grouping:</span>
                        <span className={`font-bold ${compat.gradeOk ? "text-emerald-600" : "text-red-600"}`}>
                          {compat.gradeOk ? `PASS (${compat.uniqueGrades[0]})` : `FAIL (Mixed: ${compat.uniqueGrades.join(", ")})`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[#526B91]">Production Batch Match:</span>
                        <span className={`font-bold ${compat.batchOk ? "text-emerald-600" : "text-red-600"}`}>
                          {compat.batchOk ? "PASS" : "FAIL (Mixed Batches)"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[#526B91]">Capacity Delta (ΔAH):</span>
                        <span className={`font-bold ${compat.ahOk ? "text-emerald-600" : "text-red-600"}`}>
                          {compat.ahDelta.toFixed(3)} AH (Max {compat.maxAh})
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[#526B91]">Resistance Delta (ΔIR):</span>
                        <span className={`font-bold ${compat.irOk ? "text-emerald-600" : "text-red-600"}`}>
                          {compat.irDelta.toFixed(1)} mΩ (Max {compat.maxIr})
                        </span>
                      </div>
                    </div>

                    {!compat.allPassed && (
                      <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex gap-2 items-start mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                        <div>Replacement cell exceeds delta variation or grade limits. Swapping is blocked.</div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider block">
                    Diagnosis & Rework Notes *
                  </label>
                  <textarea 
                    value={diagnosisNotes}
                    onChange={e => setDiagnosisNotes(e.target.value)}
                    placeholder="Provide root-cause diagnosis and reason for cell replacement..."
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-1 resize-none font-sans"
                  />
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-700 font-bold uppercase">Old Cell Disposition</span>
                  <select 
                    value={oldCellDisposition}
                    onChange={e => setOldCellDisposition(e.target.value as any)}
                    className="bg-white border border-slate-200 text-xs text-slate-800 rounded-lg px-2.5 py-1 outline-none font-semibold focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="REJECTED">Scrap (REJECTED)</option>
                    <option value="CELL_TESTED">Reclaim (CELL_TESTED)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button 
                  onClick={closeSwapModal}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeCellSwap}
                  disabled={cellSwapMutation.isPending || !compat?.allPassed || !diagnosisNotes.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {cellSwapMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Commit Swap"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REROUTE COMPLETE MODAL */}
      <AnimatePresence>
        {reroutingPax && (
          <div className="fixed inset-0 bg-white backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-600" />
                  Reroute Pack to Testing
                </h3>
                <button 
                  onClick={() => setReroutingPax(null)} 
                  className="text-[#526B91] hover:text-[#526B91] transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-[#526B91] leading-relaxed">
                  This will log the technical rework completion and transition the pack <span className="font-mono text-slate-900 font-bold">{reroutingPax.paxSerial}</span> status back to <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">PAX_ASSEMBLED</span>, returning it to the Test Engineer queue for retesting.
                </p>

                <div>
                  <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider block">
                    Rework Summary & Notes *
                  </label>
                  <textarea 
                    value={rerouteNotes}
                    onChange={e => setRerouteNotes(e.target.value)}
                    placeholder="Describe rework corrections completed on this pack..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-1 resize-none font-sans"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button 
                  onClick={() => setReroutingPax(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const activeDefect = defects.find((d: any) => d.paxSerial === reroutingPax.paxSerial);
                    completeRepairMutation.mutate({
                      paxSerial: reroutingPax.paxSerial,
                      fixType: "cell_swap",
                      diagnosisNotes: rerouteNotes || "Completed cell replacements and rework fixes.",
                      defectId: activeDefect?.id || null
                    });
                  }}
                  disabled={completeRepairMutation.isPending || !rerouteNotes.trim()}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {completeRepairMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Complete Rework"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
