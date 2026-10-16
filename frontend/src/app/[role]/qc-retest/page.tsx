"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { 
  RefreshCw, 
  Zap, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  History, 
  ArrowRight,
  Activity, 
  Check,
  TrendingUp,
  Sliders,
  Sparkles,
  Thermometer,
  ShieldAlert,
  Wrench,
  Clock,
  Gauge
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useFormattedSerial } from "@/hooks/useFormattedSerial";
import { evaluateQcCell, calculateGrade } from "@/lib/qcRules";
import { PageHeader } from "@/components/ui/PageHeader";

interface Cell {
  serialNumber: string;
  batchNumber: string | null;
  voltage: number;
  category: string;
  cycles: number;
  ahValue: number | null;
  irValue: number | null;
  grade: string | null;
  status: string;
  retestCount: number;
  lastRetestAt: string | null;
  machineId: string | null;
  machineCalibrationDate: string | null;
  machineOperator: string | null;
  ambientTemperature: number | null;
  cellTemperature: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  prevStatus: string | null;
  newStatus: string | null;
  metadata: any;
  timestamp: string;
}

interface QCThresholds {
  id: string;
  ahMin: number;
  ahMax: number;
  irMin: number;
  irMax: number;
  retestIrMargin: number;
  retestAhMargin: number;
  hardFailIr: number;
  hardFailAh: number;
  version?: string;
  name?: string;
  isModelBased?: boolean;
}

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

export default function QCRetestPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const currentRole = (params?.role as string) || "qc";
  const userRoles = (session?.user as any)?.roles || [];
  const isAllowed = userRoles.some((r: string) => ["QC", "ADMIN", "SUPERADMIN"].includes(r));

  const { formatSerial } = useFormattedSerial();
  const [cells, setCells] = useState<Cell[]>([]);
  const [thresholds, setThresholds] = useState<QCThresholds | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [cellHistory, setCellHistory] = useState<AuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Retest & Telemetry fields
  const [ahInput, setAhInput] = useState("");
  const [irInput, setIrInput] = useState("");
  const [machineId, setMachineId] = useState("MAC-004");
  const [machineOperator, setMachineOperator] = useState("Sunita Patel");
  const [calibrationDate, setCalibrationDate] = useState(new Date().toISOString().split("T")[0]);
  const [ambientTemp, setAmbientTemp] = useState("25.2");
  const [cellTemp, setCellTemp] = useState("27.8");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load cells in RETEST_REQUIRED status
  const fetchRetestQueue = async () => {
    if (!isAllowed) return;
    setLoading(true);
    try {
      const res = await api.get("/cells", {
        params: { status: "RETEST_REQUIRED", limit: 100 }
      });
      setCells(res.data.cells || []);
    } catch (error) {
      toast.error("Failed to load QC retest queue");
    } finally {
      setLoading(false);
    }
  };

  // Load QC Thresholds
  const fetchThresholds = async () => {
    try {
      const res = await api.get("/testing/qc-thresholds");
      setThresholds(res.data);
    } catch (error) {
      toast.error("Failed to load QC thresholds");
    }
  };

  // Fetch cell detail and history on selection
  const handleSelectCell = async (cell: Cell) => {
    setSelectedCell(cell);
    setAhInput(cell.ahValue ? cell.ahValue.toString() : "");
    setIrInput(cell.irValue ? cell.irValue.toString() : "");
    setMachineId(cell.machineId || "MAC-004");
    setMachineOperator(cell.machineOperator || "Sunita Patel");
    setCalibrationDate(cell.machineCalibrationDate ? cell.machineCalibrationDate.split("T")[0] : new Date().toISOString().split("T")[0]);
    setAmbientTemp(cell.ambientTemperature ? cell.ambientTemperature.toString() : "25.2");
    setCellTemp(cell.cellTemperature ? cell.cellTemperature.toString() : "27.8");
    setCellHistory([]);
    setLoadingHistory(true);
    
    try {
      const res = await api.get(`/cells/${cell.serialNumber}`);
      setCellHistory(res.data.history || []);
    } catch (error) {
      toast.error("Failed to fetch cell history logs");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRetestQueue();
    fetchThresholds();
  }, []);

  const parsedAh = parseFloat(ahInput);
  const parsedIr = parseFloat(irInput);
  const liveGrade = !isNaN(parsedAh) && !isNaN(parsedIr) ? calculateGrade(parsedAh, parsedIr) : "Pending";
  const liveQcStatus: "PASS" | "FAIL" | "RETEST" | "HOLD" = (!isNaN(parsedAh) && !isNaN(parsedIr) && thresholds)
    ? evaluateQcCell(parsedAh, parsedIr, {
        ahMin: thresholds.ahMin,
        ahMax: thresholds.ahMax,
        irMin: thresholds.irMin ?? 5.0,
        irMax: thresholds.irMax ?? 60.0,
        retestAhMargin: thresholds.retestAhMargin ?? 0.1,
        retestIrMargin: thresholds.retestIrMargin ?? 2.0,
        hardFailAh: thresholds.hardFailAh ?? 3.0,
        hardFailIr: thresholds.hardFailIr ?? 70.0,
      })
    : "HOLD";

  // Live impossible value warnings
  const isAhImpossible = ahInput !== "" && (parsedAh < 0 || parsedAh > 10);
  const isIrImpossible = irInput !== "" && (parsedIr < 1 || parsedIr > 200);
  const hasImpossibleValues = isAhImpossible || isIrImpossible;

  // Compute Supervisor Escalation Risk warnings
  const retestAttempt = selectedCell ? selectedCell.retestCount : 0;
  const willEscalateToHold = retestAttempt === 1 && liveQcStatus === "RETEST";
  const willAutoReject = retestAttempt >= 2 && liveQcStatus === "RETEST";

  // Apply retest values
  const handleApplyRetest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell) return;
    if (isNaN(parsedAh) || isNaN(parsedIr)) {
      toast.error("Please enter valid AH and IR metrics.");
      return;
    }

    if (hasImpossibleValues) {
      toast.error("Cannot submit physically impossible sensor values. Please check readings!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = [{
        cellSerial: selectedCell.serialNumber,
        machineSerial: selectedCell.serialNumber,
        ahValue: parsedAh,
        irValue: parsedIr,
        grade: liveGrade !== "Pending" ? liveGrade : "C",
        qcPrediction: liveQcStatus,
        sourceFile: "MANUAL_QC_RETEST",
        machineId,
        machineCalibrationDate: new Date(calibrationDate).toISOString(),
        machineOperator,
        ambientTemperature: parseFloat(ambientTemp) || 25.0,
        cellTemperature: parseFloat(cellTemp) || 28.0
      }];

      const res = await api.post("/testing/apply", payload);
      
      const summary = res.data;
      if (summary.passed > 0) {
        toast.success(`Cell ${formatSerial(selectedCell.serialNumber)} successfully APPROVED (PASS).`);
      } else if (summary.rejected > 0) {
        toast.error(`Cell ${formatSerial(selectedCell.serialNumber)} successfully REJECTED (FAIL).`);
      } else if (summary.retest > 0) {
        toast.warning(`Cell ${formatSerial(selectedCell.serialNumber)} returned to RETEST queue.`);
      } else if (summary.hold > 0) {
        toast.warning(`Cell ${formatSerial(selectedCell.serialNumber)} placed on HOLD for Supervisor Review.`);
      } else {
        toast.info(`Cell status updated successfully.`);
      }

      // Reset state and reload
      setSelectedCell(null);
      setAhInput("");
      setIrInput("");
      fetchRetestQueue();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to submit retest results");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter cells based on search query
  const filteredCells = cells.filter(cell => 
    cell.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cell.batchNumber && cell.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authStatus === "loading") {
    return (
      <div className="p-20 text-center text-[#526B91] text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Verifying permissions...</span>
      </div>
    );
  }

  if (authStatus === "authenticated" && !isAllowed) {
    return (
      <div className="p-8 max-w-xl mx-auto my-16 text-center glass-panel rounded-3xl border border-[#D8E8FA] space-y-4 bg-white shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#0B2148]">Access Restricted: QC Only</h2>
        <p className="text-xs text-[#526B91] max-w-md mx-auto">
          QC Retest is exclusively accessible to Quality Control (QC) Inspectors and Administrators. Test Engineers perform initial testing in the Testing Station.
        </p>
        <button
          onClick={() => router.push(`/${currentRole}`)}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/80 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-110px)] flex flex-col gap-4">
      {/* Upper Status / Header bar */}
      <PageHeader
        title="QC Retest Engine"
        subtitle="Hardened manufacturing manual validation and telemetry tracking portal"
        icon={<RefreshCw className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {thresholds && (
              <div className="bg-white px-3 py-1.5 rounded-xl border border-[#D8E8FA] flex items-center gap-4 shadow-xs">
                <div>
                  <p className="text-[9px] text-[#526B91] font-bold uppercase tracking-wider">Standard</p>
                  <p className="text-xs font-semibold text-[#0B2148] truncate max-w-[100px]">
                    {thresholds.isModelBased ? thresholds.name : "v1.0"}
                  </p>
                </div>
                <div className="w-px h-5 bg-[#D8E8FA]" />
                <div>
                  <p className="text-[9px] text-[#526B91] font-bold uppercase tracking-wider">AH Range</p>
                  <p className="text-xs font-mono font-bold text-[#166534]">
                    {thresholds.ahMin} - {thresholds.ahMax}
                  </p>
                </div>
                <div className="w-px h-5 bg-[#D8E8FA]" />
                <div>
                  <p className="text-[9px] text-[#526B91] font-bold uppercase tracking-wider">IR Max</p>
                  <p className="text-xs font-mono font-bold text-red-500">
                    {thresholds.irMax} mΩ
                  </p>
                </div>
              </div>
            )}

          </div>
        }
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Retest Queue List (Column Span 4) */}
        <div className="lg:col-span-4 glass-panel rounded-2xl border border-[#D8E8FA] overflow-hidden flex flex-col bg-white">
          <div className="p-3.5 border-b border-[#D8E8FA] flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#526B91] flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Pending Queue ({filteredCells.length})
            </h3>
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search SN..."
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none transition-all uppercase placeholder:text-[#526B91]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E8F1FC]">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : filteredCells.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#526B91] gap-2">
                <Check className="w-8 h-8 text-emerald-500/30 bg-emerald-500/5 p-1 rounded-full border border-emerald-500/10" />
                <p className="text-xs font-bold uppercase tracking-wider">Queue Cleared</p>
                <p className="text-[10px] max-w-[200px]">No battery cells require re-testing at this moment.</p>
              </div>
            ) : (
              filteredCells.map((cell) => {
                const isSelected = selectedCell?.serialNumber === cell.serialNumber;
                return (
                  <button
                    key={cell.serialNumber}
                    onClick={() => handleSelectCell(cell)}
                    className={`w-full p-4 text-left flex items-center justify-between gap-4 transition-all ${
                      isSelected 
                        ? 'bg-accent/10 border-l-4 border-accent text-white' 
                        : 'hover:bg-white/[0.01] text-[#526B91] hover:text-[#0B2148]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative ${
                        isSelected ? 'bg-accent/20 text-accent' : 'bg-[#F4F9FF] text-[#526B91]'
                      }`}>
                        <Zap className="w-4 h-4" />
                        {cell.retestCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black font-black text-[8px] px-1 rounded-full border border-[#020617]">
                            {cell.retestCount}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-[#0B2148] uppercase">{formatSerial(cell.serialNumber)}</p>
                        <p className="text-[9px] uppercase tracking-wider text-[#526B91] mt-0.5">
                          {cell.category} • Batch: {cell.batchNumber || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-mono font-semibold text-[#0B2148]">
                          {cell.ahValue ? `${cell.ahValue} AH` : '—'}
                        </p>
                        <p className="text-[9px] font-mono text-[#526B91] mt-0.5">
                          {cell.irValue ? `${cell.irValue} mΩ` : '—'}
                        </p>
                      </div>
                      <ArrowRight className={`w-3.5 h-3.5 text-[#526B91] transition-transform ${isSelected ? 'translate-x-1 text-accent' : ''}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
 
        {/* Right Column: Retest Workspace & Form (Column Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">
          <AnimatePresence mode="wait">
            {!selectedCell ? (
              /* State A: No cell selected */
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 glass-panel rounded-[2rem] border border-[#D8E8FA] flex flex-col items-center justify-center p-8 text-center bg-white/[0.01]"
              >
                <div className="w-16 h-16 bg-[#F4F9FF] rounded-3xl flex items-center justify-center text-[#526B91] mb-4 shadow-lg">
                  <Sliders className="w-8 h-8 text-[#526B91]" />
                </div>
                <h3 className="text-base font-display font-bold text-[#0B2148] mb-2">Retest Workspace</h3>
                <p className="text-xs text-[#526B91] max-w-sm">
                  Select a battery cell from the left queue to verify telemetry, history logs, impossible value alerts, and to run manual validation.
                </p>
              </motion.div>
            ) : (
              /* State B: Cell Selected */
              <motion.div 
                key="workspace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto pr-1 custom-scrollbar"
              >
                {/* 1. Selected Cell Quick Details & Retest Form */}
                <div className="glass-panel p-6 rounded-[2rem] border border-[#D8E8FA] bg-white/[0.01] flex flex-col gap-6">
                  
                  {/* Workspace Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#D8E8FA]">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[9px] font-bold uppercase tracking-wider">
                          Retest Attempt {selectedCell.retestCount}
                        </span>
                        <h2 className="text-lg font-mono font-bold text-[#0B2148] mt-1.5 uppercase">
                          {formatSerial(selectedCell.serialNumber)}
                        </h2>
                      </div>
                      
                      {/* Batch Stability Rating */}
                      <div className="bg-[#F4F9FF] px-3 py-1.5 rounded-xl border border-[#D8E8FA] flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <div>
                          <p className="text-[7px] text-[#526B91] font-bold uppercase">Batch Index</p>
                          <p className="text-[10px] text-[#0B2148] font-mono font-bold">{selectedCell.batchNumber || "UNASSIGNED"}</p>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setSelectedCell(null)}
                      className="text-xs font-bold uppercase tracking-widest text-[#526B91] hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Manual Retest Form */}
                  <form onSubmit={handleApplyRetest} className="space-y-6">
                    
                    {/* Telemetry log inputs */}
                    <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-4">
                      <div className="flex items-center gap-2 border-b border-[#D8E8FA] pb-2">
                        <Wrench className="w-4 h-4 text-accent" />
                        <h4 className="text-[10px] font-bold text-[#0B2148] uppercase tracking-widest">Calibration & Telemetry Log</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-[#526B91] uppercase">Machine ID</label>
                          <input 
                            value={machineId}
                            onChange={(e) => setMachineId(e.target.value)}
                            required
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-[#526B91] uppercase">Operator Signature</label>
                          <input 
                            value={machineOperator}
                            onChange={(e) => setMachineOperator(e.target.value)}
                            required
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-[#526B91] uppercase">Last Calibrated</label>
                          <input 
                            type="date"
                            value={calibrationDate}
                            onChange={(e) => setCalibrationDate(e.target.value)}
                            required
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-[#526B91] uppercase">Ambient Temp (°C)</label>
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.1"
                              value={ambientTemp}
                              onChange={(e) => setAmbientTemp(e.target.value)}
                              required
                              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-accent"
                            />
                            <Thermometer className="w-3.5 h-3.5 text-[#526B91] absolute right-2 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <label className="text-[8px] font-bold text-[#526B91] uppercase">Cell Temp (°C)</label>
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.1"
                              value={cellTemp}
                              onChange={(e) => setCellTemp(e.target.value)}
                              required
                              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-accent"
                            />
                            <Thermometer className="w-3.5 h-3.5 text-[#526B91] absolute right-2 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sensor Readings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* AH Input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">
                            Capacity (AH)
                          </label>
                          {isAhImpossible && (
                            <span className="text-[8px] bg-red-500/20 text-red-400 font-bold border border-red-500/30 px-1.5 py-0.5 rounded animate-pulse">
                              IMPOSSIBLE READING
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={ahInput}
                            onChange={(e) => setAhInput(e.target.value)}
                            placeholder="e.g. 3.28"
                            required
                            disabled={isSubmitting}
                            className={`w-full bg-[#F4F9FF] border rounded-xl py-3 px-4 text-sm font-mono text-white focus:bg-accent/5 focus:ring-1 focus:ring-accent outline-none transition-all ${
                              isAhImpossible ? 'border-red-500 focus:border-red-500' : 'border-[#D8E8FA] focus:border-accent'
                            }`}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#526B91]">
                            AH
                          </span>
                        </div>
                        {isAhImpossible && (
                          <p className="text-[9px] text-red-400 leading-tight">
                            Warning: Lithium capacity is outside realistic industrial battery boundaries (0.0 to 10.0 AH). Please recheck multimeter calibration!
                          </p>
                        )}
                      </div>

                      {/* IR Input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">
                            Internal Resistance (IR)
                          </label>
                          {isIrImpossible && (
                            <span className="text-[8px] bg-red-500/20 text-red-400 font-bold border border-red-500/30 px-1.5 py-0.5 rounded animate-pulse">
                              IMPOSSIBLE READING
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={irInput}
                            onChange={(e) => setIrInput(e.target.value)}
                            placeholder="e.g. 24.5"
                            required
                            disabled={isSubmitting}
                            className={`w-full bg-[#F4F9FF] border rounded-xl py-3 px-4 text-sm font-mono text-white focus:bg-accent/5 focus:ring-1 focus:ring-accent outline-none transition-all ${
                              isIrImpossible ? 'border-red-500 focus:border-red-500' : 'border-[#D8E8FA] focus:border-accent'
                            }`}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#526B91]">
                            mΩ
                          </span>
                        </div>
                        {isIrImpossible && (
                          <p className="text-[9px] text-red-400 leading-tight">
                            Warning: Internal resistance is outside realistic industrial thresholds (1.0 to 200.0 mΩ). Please clean the test probe tip before re-pressing!
                          </p>
                        )}
                      </div>

                    </div>

                    {/* Supervisor Escalation Warnings */}
                    <AnimatePresence>
                      {(willEscalateToHold || willAutoReject) && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          {willEscalateToHold ? (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-start gap-3">
                              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 animate-bounce" />
                              <div>
                                <p className="text-xs font-bold uppercase">Supervisor Review Escalation Warning</p>
                                <p className="text-[10px] leading-relaxed mt-1">
                                  This cell has been tested once. Submitting a second borderline RETEST value will automatically escalate this cell to a <span className="font-bold">HOLD</span> status, transferring it to the Supervisor Auditing Queue for manual override authorization.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-start gap-3">
                              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
                              <div>
                                <p className="text-xs font-bold uppercase">Critical Auto-Reject Escalation Warning</p>
                                <p className="text-[10px] leading-relaxed mt-1">
                                  This cell has already been re-tested twice. Submitting another RETEST/Borderline or FAIL outcome will trigger <span className="font-bold">Automatic Rejection</span>. The cell will be marked as <span className="font-bold">REJECTED</span> and automatically routed to Scrap Management.
                                </p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Real-time Dynamic Feedback UI */}
                    <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-wrap items-center justify-between gap-4">
                      
                      <div className="flex items-center gap-6">
                        {/* Live Grade Preview */}
                        <div>
                          <p className="text-[8px] text-[#526B91] font-bold uppercase tracking-wider">Dynamic Grade</p>
                          <p className="text-sm font-bold text-[#0B2148] mt-0.5">
                            {liveGrade !== "Pending" ? (
                              <span className="px-2 py-0.5 bg-accent/20 text-accent rounded text-xs font-black">
                                {liveGrade}
                              </span>
                            ) : (
                              <span className="text-[#526B91]">Enter Values</span>
                            )}
                          </p>
                        </div>
                        
                        <div className="w-px h-8 bg-[#EAF5FF]" />

                        {/* Live Status Preview */}
                        <div>
                          <p className="text-[8px] text-[#526B91] font-bold uppercase tracking-wider">QC Prediction</p>
                          <div className="mt-0.5">
                            {isNaN(parsedAh) || isNaN(parsedIr) ? (
                              <span className="text-xs text-[#526B91] font-semibold flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#526B91] animate-pulse" />
                                Awaiting metrics
                              </span>
                            ) : liveQcStatus === "PASS" ? (
                              <span className="inline-flex items-center gap-1 text-[#166534] font-black text-xs uppercase tracking-wider">
                                <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                                QC PASS
                              </span>
                            ) : liveQcStatus === "FAIL" ? (
                              <span className="inline-flex items-center gap-1 text-red-400 font-black text-xs uppercase tracking-wider">
                                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                QC FAIL
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-500 font-black text-xs uppercase tracking-wider">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                QC RETEST
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || isNaN(parsedAh) || isNaN(parsedIr) || hasImpossibleValues}
                        className="px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:pointer-events-none text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Apply & Save QC Result
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 2. Audit & History Logs Panel */}
                <div className="flex-1 glass-panel p-6 rounded-[2rem] border border-[#D8E8FA] bg-white/[0.01] overflow-hidden flex flex-col min-h-0">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#526B91] mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-[#526B91]" />
                    Historical Logs & Audits
                  </h3>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {loadingHistory ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[#526B91]" />
                      </div>
                    ) : cellHistory.length === 0 ? (
                      <p className="text-xs text-[#526B91] text-center py-8">No previous log edits found for this cell.</p>
                    ) : (
                      <div className="relative pl-6 border-l border-[#D8E8FA] space-y-6">
                        {cellHistory.map((log) => {
                          const isQcFail = log.action.includes("qc_result_fail");
                          const isQcRetest = log.action.includes("qc_result_retest");
                          const isQcPass = log.action.includes("qc_result_pass");
                          
                          return (
                            <div key={log.id} className="relative">
                              {/* Audit Circle badge */}
                              <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border-2 border-[#121214] flex items-center justify-center ${
                                isQcPass ? 'bg-emerald-500' : isQcFail ? 'bg-red-500' : isQcRetest ? 'bg-amber-500' : 'bg-[#EAF5FF]'
                              }`} />

                              <div>
                                <div className="flex items-center justify-between gap-4">
                                  <p className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                                    {log.action.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-[10px] text-[#526B91] font-mono">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                
                                <p className="text-[10px] text-[#526B91] mt-1">
                                  Status transition: <span className="font-mono text-[#526B91]">{log.prevStatus || 'NONE'}</span> → <span className="font-mono text-[#0B2148] font-bold">{log.newStatus}</span>
                                </p>
                                
                                {log.metadata && typeof log.metadata === 'object' && (
                                  <div className="mt-2 p-3 rounded-xl bg-white/[0.01] border border-[#D8E8FA] grid grid-cols-2 gap-2 text-[9px] font-mono">
                                    {log.metadata.ah !== undefined && (
                                      <p className="text-[#526B91]">Tested AH: <span className="text-[#0B2148]">{log.metadata.ah} AH</span></p>
                                    )}
                                    {log.metadata.ir !== undefined && (
                                      <p className="text-[#526B91]">Tested IR: <span className="text-[#0B2148]">{log.metadata.ir} mΩ</span></p>
                                    )}
                                    {log.metadata.retestCount !== undefined && (
                                      <p className="text-[#526B91]">Retest Count: <span className="text-amber-400 font-bold">{log.metadata.retestCount}</span></p>
                                    )}
                                    {log.metadata.machineOperator && (
                                      <p className="text-[#526B91]">Operator: <span className="text-[#0B2148]">{log.metadata.machineOperator}</span></p>
                                    )}
                                    {log.metadata.ambientTemperature !== undefined && (
                                      <p className="text-[#526B91]">Ambient Temp: <span className="text-[#0B2148]">{log.metadata.ambientTemperature} °C</span></p>
                                    )}
                                    {log.metadata.cellTemperature !== undefined && (
                                      <p className="text-[#526B91]">Cell Temp: <span className="text-[#0B2148]">{log.metadata.cellTemperature} °C</span></p>
                                    )}
                                    {log.metadata.failureReason && (
                                      <p className="text-red-400 col-span-full">Reason: {log.metadata.failureReason}</p>
                                    )}
                                    {log.metadata.sourceFile && (
                                      <p className="text-[#526B91] col-span-full truncate">Source: {log.metadata.sourceFile}</p>
                                    )}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
