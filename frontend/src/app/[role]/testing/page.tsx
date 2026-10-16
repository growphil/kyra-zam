"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import api from "@/lib/api";
import { useTestingStore } from "@/store/testingStore";
import { evaluateQcCell, calculateGrade, QcConfig } from "@/lib/qcRules";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FlaskConical, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  Zap,
  Barcode,
  Sparkles,
  Check,
  X,
  Sliders,
  Layers,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  FileSpreadsheet,
  Info,
  ExternalLink,
  Filter,
  Inbox
} from "lucide-react";
import { toast } from "sonner";
import ReportUploadZone from "@/components/testing/ReportUploadZone";
import MatchResultsTable from "@/components/testing/MatchResultsTable";
import CellDetailDrawer from "@/components/testing/CellDetailDrawer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function TestingStationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const searchSerialParam = searchParams.get("searchSerial") || "";
  const currentRole = (params?.role as string) || "test-engineer";
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [activeTestingMode, setActiveTestingMode] = useState<"bulk" | "manual">(
    searchSerialParam ? "manual" : "bulk"
  );

  // Store for Bulk Import Mode
  const { 
    results, 
    thresholds, 
    setThresholds, 
    clearResults, 
    isApplying, 
    setIsApplying 
  } = useTestingStore();

  // ── Manual Testing State ───────────────────────────────────────────────────
  const [scannedSerial, setScannedSerial] = useState(searchSerialParam);
  const [ahInput, setAhInput] = useState("");
  const [irInput, setIrInput] = useState("");
  const [voltageInput, setVoltageInput] = useState("3.20");
  const [ambientTemp, setAmbientTemp] = useState("25.0");
  const [cellTemp, setCellTemp] = useState("26.5");
  const [machineId, setMachineId] = useState("MAC-004");

  // Manual Validation Pre-flight check
  const [validatedCellInfo, setValidatedCellInfo] = useState<{
    isValid: boolean;
    normalizedSerial?: string;
    status?: string;
    message?: string;
    cellSku?: string;
    workOrderNumber?: string;
    productRef?: string;
    productionRequirementId?: string | null;
    isAlreadyTested?: boolean;
    existingCell?: any;
  } | null>(null);
  const [isValidatingSerial, setIsValidatingSerial] = useState(false);

  // Last manual validation outcome card
  const [lastValidationResult, setLastValidationResult] = useState<{
    serialNumber: string;
    cellSku: string;
    workOrderNumber: string;
    result: string;
    grade: string | null;
    ahValue: number;
    irValue: number;
    thresholdProfile: string;
  } | null>(null);

  // ── Validated Reports View State ───────────────────────────────────────────
  const [reportViewMode, setReportViewMode] = useState<"single" | "production">("single");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedProductionOrder, setSelectedProductionOrder] = useState<any | null>(null);
  const [selectedCellForDetail, setSelectedCellForDetail] = useState<any | null>(null);

  const scannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with searchSerial parameter if present in query string
  useEffect(() => {
    if (mounted && searchSerialParam) {
      setScannedSerial(searchSerialParam);
      handleScanOrSubmitSerial(searchSerialParam);
      setActiveTestingMode("manual");
    }
  }, [mounted, searchSerialParam]);

  // Autofocus scanner input when in manual mode
  useEffect(() => {
    if (mounted && activeTestingMode === "manual") {
      setTimeout(() => scannerInputRef.current?.focus(), 150);
    }
  }, [mounted, activeTestingMode]);

  // ── QUERIES ────────────────────────────────────────────────────────────────

  // Fetch QC Thresholds
  const { data: qcThresholdsData } = useQuery({
    queryKey: ["qc-thresholds"],
    queryFn: async () => {
      const res = await api.get("/testing/qc-thresholds");
      setThresholds(res.data);
      return res.data;
    },
    enabled: mounted,
  });

  // Fetch Validated Cells Ledger & Production Order Summaries
  const { 
    data: validatedReportsData, 
    isLoading: loadingReports, 
    refetch: refetchReports 
  } = useQuery({
    queryKey: ["testing-validated-cells", searchQuery, statusFilter],
    queryFn: async () => {
      const res = await api.get("/testing/validated-cells", {
        params: {
          search: searchQuery || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          limit: 150
        }
      });
      return res.data;
    },
    enabled: mounted,
    refetchInterval: 6000,
  });

  // Client-Side Predictive QC Rules
  const activeThresholds = qcThresholdsData || thresholds;
  const qcConfig: QcConfig = {
    ahMin: activeThresholds?.ahMin ?? 3.0,
    ahMax: activeThresholds?.ahMax ?? 6.5,
    irMin: activeThresholds?.irMin ?? 5.0,
    irMax: activeThresholds?.irMax ?? 45.0,
    retestAhMargin: (activeThresholds as any)?.retestAhMargin ?? 0.1,
    retestIrMargin: (activeThresholds as any)?.retestIrMargin ?? 2.0,
    hardFailAh: (activeThresholds as any)?.hardFailAh ?? 3.0,
    hardFailIr: (activeThresholds as any)?.hardFailIr ?? 70.0,
  };

  const parsedAh = parseFloat(ahInput);
  const parsedIr = parseFloat(irInput);
  const hasManualValues = !isNaN(parsedAh) && !isNaN(parsedIr) && parsedAh > 0 && parsedIr > 0;
  const manualQcPrediction = hasManualValues ? evaluateQcCell(parsedAh, parsedIr, qcConfig) : null;
  const manualGradePrediction = hasManualValues && manualQcPrediction === "PASS" ? calculateGrade(parsedAh, parsedIr) : null;

  // ── SERIAL SCANNER HANDLER ─────────────────────────────────────────────────
  const handleScanOrSubmitSerial = async (serial: string) => {
    if (!serial.trim()) return;
    setIsValidatingSerial(true);
    setValidatedCellInfo(null);

    try {
      const res = await api.post("/testing/validate-serial", {
        serial: serial.trim()
      });

      setValidatedCellInfo(res.data);
      if (!res.data.isValid) {
        toast.error(res.data.message || "Invalid serial for testing");
      } else {
        toast.success(`✓ Serialized cell ${res.data.normalizedSerial} loaded for testing`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error validating serial");
      setValidatedCellInfo({
        isValid: false,
        message: err.response?.data?.error || "Failed to find serialized cell"
      });
    } finally {
      setIsValidatingSerial(false);
    }
  };

  // ── MANUAL APPLY MUTATION ──────────────────────────────────────────────────
  const manualApplyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/testing/apply", [payload]);
      return res.data;
    },
    onSuccess: (data) => {
      const firstResult = data.perCell?.[0];
      if (firstResult?.result === "error") {
        toast.error(`Validation Error: ${firstResult.failureReason}`);
        return;
      }

      const resultLabel = firstResult?.result === "CELL_TESTED" ? "PASS" : firstResult?.result === "RETEST_REQUIRED" ? "RETEST" : firstResult?.result === "REJECTED" ? "FAIL" : firstResult?.result || "TESTED";

      if (resultLabel === "PASS") {
        toast.success(`✓ Cell ${scannedSerial} PASSED test & moved to QC Pending!`, {
          description: "Quality Control approval is required before this cell can move to PAX Assembly (/assembly-technician/pax/create)."
        });
      } else {
        toast.warning(`Cell ${scannedSerial} recorded with result: ${resultLabel}`);
      }

      setLastValidationResult({
        serialNumber: scannedSerial,
        cellSku: validatedCellInfo?.cellSku || "CELL-LFP-3200",
        workOrderNumber: validatedCellInfo?.workOrderNumber || "WO-GENERAL",
        result: resultLabel,
        grade: manualGradePrediction,
        ahValue: parsedAh,
        irValue: parsedIr,
        thresholdProfile: activeThresholds?.name || "Standard QC Profile"
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["testing-validated-cells"] });
      queryClient.invalidateQueries({ queryKey: ["production-cell-testing-requirements"] });

      // Reset manual fields & refocus scanner for next physical cell
      setScannedSerial("");
      setAhInput("");
      setIrInput("");
      setValidatedCellInfo(null);
      setTimeout(() => scannerInputRef.current?.focus(), 80);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to apply validation result");
    }
  });

  const handleValidateManualCell = () => {
    if (!scannedSerial.trim()) {
      toast.error("Please scan or enter a serialized cell number.");
      scannerInputRef.current?.focus();
      return;
    }
    if (!validatedCellInfo || !validatedCellInfo.isValid) {
      toast.error("Please scan a valid serialized cell first.");
      return;
    }
    if (!hasManualValues) {
      toast.error("Please enter valid Capacity (AH) and Resistance (IR) values.");
      return;
    }

    const payload = {
      cellSerial: validatedCellInfo.normalizedSerial || scannedSerial.trim(),
      voltage: parseFloat(voltageInput) || 3.2,
      ahValue: parsedAh,
      irValue: parsedIr,
      grade: manualGradePrediction,
      qcPrediction: manualQcPrediction,
      machineId: machineId || "MAC-004",
      machineOperator: session?.user?.name || "Test Engineer",
      ambientTemperature: parseFloat(ambientTemp) || null,
      cellTemperature: parseFloat(cellTemp) || null,
      productionRequirementId: validatedCellInfo.productionRequirementId || null,
    };

    manualApplyMutation.mutate(payload);
  };

  // ── BULK APPLY MUTATION ────────────────────────────────────────────────────
  const handleApplyBulkValidation = async () => {
    if (!results.length) return;
    const validMatches = results.filter(r => r.cellSerial && r.cellSerial !== "UNMATCHED");
    if (validMatches.length === 0) {
      toast.error("No matched cells to validate. Please link cells or upload a valid report.");
      return;
    }

    setIsApplying(true);
    try {
      const payload = validMatches.map(r => ({
        cellSerial: r.cellSerial,
        voltage: 3.2,
        ahValue: r.ahValue,
        irValue: r.irValue,
        grade: r.grade,
        qcPrediction: r.qcPrediction,
        machineId: "BULK-REPORT",
        machineOperator: session?.user?.name || "Test Engineer",
        machineSerial: r.machineSerial,
      }));

      const res = await api.post("/testing/apply", payload);
      toast.success(`Successfully applied validation to ${validMatches.length} serialized cells! (${res.data.passed} PASS moved to QC Pending, ${res.data.retest} RETEST, ${res.data.rejected} FAIL)`, {
        description: "Tested cells are now in QC Pending (Gate 1). Once Quality Control approves them, they will move to PAX Assembly (/assembly-technician/pax/create)."
      });
      clearResults();
      queryClient.invalidateQueries({ queryKey: ["testing-validated-cells"] });
      queryClient.invalidateQueries({ queryKey: ["production-cell-testing-requirements"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to apply bulk validation");
    } finally {
      setIsApplying(false);
    }
  };

  if (!mounted) return null;

  const serializedReadyCount = validatedReportsData?.metrics?.serializedReadyCount ?? 0;
  const validatedCells = validatedReportsData?.cells || [];
  const productionOrderSummaries = validatedReportsData?.productionOrderSummaries || [];

  return (
    <div className="space-y-4 pb-12 max-w-7xl mx-auto">
      {/* ── TOP OPERATIONAL HEADER ─────────────────────────────────────────── */}
      <PageHeader
        title="Cell Testing"
        subtitle="Validate serialized cells against configured QC thresholds"
        icon={<FlaskConical className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Metric: Serialized Ready for Testing */}
            <div className="px-3 py-1.5 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center gap-2 text-xs font-mono shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#0878F9] animate-pulse" />
              <span className="text-[#526B91]">Ready for Testing:</span>
              <strong className="text-[#0878F9] font-bold text-xs">{serializedReadyCount}</strong>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-white border border-[#D8E8FA] flex items-center gap-2 text-xs text-[#0B2148] font-medium shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#0878F9]" />
              <span>{activeThresholds?.name || "QC Profile v1.0"}</span>
            </div>

            <button
              onClick={() => refetchReports()}
              className="p-2 bg-white border border-[#D8E8FA] rounded-xl hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer shadow-xs"
              title="Refresh validation data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* ── TESTING MODE SEGMENTED TOGGLE ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-2 sm:p-2.5 rounded-2xl border border-[#D8E8FA] shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] w-full sm:w-auto">
          <button
            type="button"
            id="toggle-bulk-mode"
            onClick={() => setActiveTestingMode("bulk")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTestingMode === "bulk"
                ? "bg-[#0878F9] text-white shadow-sm shadow-blue-500/20"
                : "text-[#526B91] hover:text-[#0B2148] hover:bg-white/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Bulk Report Upload</span>
            {results.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTestingMode === "bulk"
                    ? "bg-white/20 text-white"
                    : "bg-[#0878F9]/10 text-[#0878F9]"
                }`}
              >
                {results.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="toggle-manual-mode"
            onClick={() => setActiveTestingMode("manual")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTestingMode === "manual"
                ? "bg-[#0878F9] text-white shadow-sm shadow-blue-500/20"
                : "text-[#526B91] hover:text-[#0B2148] hover:bg-white/60"
            }`}
          >
            <Barcode className="w-4 h-4 shrink-0" />
            <span>Manual Cell Testing</span>
            {validatedCellInfo?.isValid && (
              <span
                className={`w-2 h-2 rounded-full ${
                  activeTestingMode === "manual" ? "bg-white" : "bg-emerald-500"
                }`}
              />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 px-2 text-xs text-[#526B91]">
          <span className="hidden sm:inline font-medium">Active Mode:</span>
          <span className="font-bold text-[#0B2148] bg-[#F4F9FF] px-3 py-1 rounded-lg border border-[#D8E8FA]">
            {activeTestingMode === "bulk" ? "Automated Batch Import" : "Station Scanner & Meter"}
          </span>
        </div>
      </div>

      {/* ── FULL-WIDTH TESTING WORKSPACE ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTestingMode === "bulk" ? (
          /* ── BULK REPORT UPLOAD (FULL WIDTH) ──────────────────────────────── */
          <motion.div
            key="bulk-mode"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="p-6 rounded-3xl bg-white border border-[#D8E8FA] space-y-6 shadow-xl w-full"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E8FA] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#0878F9] flex items-center justify-center font-bold text-sm">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-display font-bold text-[#0B2148] uppercase tracking-wider">
                    Bulk Machine Report Upload & Validation
                  </h2>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Upload machine-generated CSV, XLSX, or PDF test reports to automatically validate batches of serialized cells.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#526B91] font-mono bg-[#F4F9FF] border border-[#D8E8FA] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0878F9]" />
                  <span>QC Limits: <strong>{thresholds?.name || thresholds?.version || "Standard Profile"}</strong></span>
                </span>
              </div>
            </div>

            {/* Upload Zone */}
            <ReportUploadZone />

            {/* Analysis & Intelligent Matching Results */}
            {results.length > 0 && (
              <div className="space-y-4 pt-2">
                <MatchResultsTable />
              </div>
            )}

            {/* Bulk Actions */}
            {results.length > 0 && (
              <div className="pt-4 border-t border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#526B91]">
                  <span className="font-medium">Valid Matches:</span>
                  <span className="font-bold text-[#0B2148]">
                    {results.filter((r) => r.cellSerial !== "UNMATCHED").length} of {results.length} rows
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={clearResults}
                    disabled={isApplying}
                    className="px-4 py-2.5 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] text-xs font-bold text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer disabled:opacity-50"
                  >
                    Clear Report
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyBulkValidation}
                    disabled={
                      isApplying ||
                      results.filter((r) => r.cellSerial !== "UNMATCHED").length === 0
                    }
                    className="px-6 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isApplying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>
                      Apply Validation ({results.filter((r) => r.cellSerial !== "UNMATCHED").length})
                    </span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ── MANUAL CELL TESTING (FULL WIDTH) ─────────────────────────────── */
          <motion.div
            key="manual-mode"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="p-6 rounded-3xl bg-white border border-[#D8E8FA] space-y-6 shadow-xl w-full"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8E8FA] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h2 className="text-base font-display font-bold text-[#0B2148] uppercase tracking-wider">
                    Manual Single Cell Testing & Inspection
                  </h2>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Scan or enter physical barcode, verify cell identity, record laboratory multimeter readings, and validate QC status.
                  </p>
                </div>
              </div>

              <span className="text-[11px] text-[#526B91] font-mono bg-[#F4F9FF] border border-[#D8E8FA] px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
                <Barcode className="w-3.5 h-3.5 text-[#0878F9]" />
                <span>Station Scanner Ready</span>
              </span>
            </div>

            {/* Field 1: Scanner Barcode Input (Full-Width Hero Section) */}
            <div className="bg-[#F4F9FF] p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#0B2148] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-[#0878F9]" />
                  <span>Scan or Enter Serial Number</span>
                </span>
                <span className="text-[#0878F9] font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#D8E8FA]">
                  Press Enter to Verify
                </span>
              </label>

              <div className="relative flex items-center">
                <Barcode className="absolute left-4 w-5 h-5 text-[#526B91] pointer-events-none" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={scannedSerial}
                  onChange={(e) => setScannedSerial(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleScanOrSubmitSerial(scannedSerial);
                    }
                  }}
                  onBlur={() => {
                    if (scannedSerial.trim()) {
                      handleScanOrSubmitSerial(scannedSerial);
                    }
                  }}
                  placeholder="Scan barcode with handheld reader or type cell serial number (e.g. CELL-18650-001)..."
                  className="w-full bg-white border border-[#D8E8FA] rounded-2xl py-3 pl-12 pr-28 text-sm font-mono text-[#0B2148] placeholder:text-[#64748B] focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/10 outline-none transition-all shadow-xs"
                />

                <button
                  type="button"
                  onClick={() => handleScanOrSubmitSerial(scannedSerial)}
                  disabled={isValidatingSerial || !scannedSerial.trim()}
                  className="absolute right-2 px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
                >
                  {isValidatingSerial ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Validated Cell Context Card (Full Width Grid) */}
            {validatedCellInfo && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl border ${
                  validatedCellInfo.isValid
                    ? "bg-emerald-500/[0.04] border-emerald-500/20"
                    : "bg-rose-500/[0.04] border-rose-500/20"
                }`}
              >
                {validatedCellInfo.isValid ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                          Cell Verified in Inventory
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#166534] font-bold text-[11px] uppercase">
                        {validatedCellInfo.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                      <div className="bg-white/70 p-3 rounded-xl border border-emerald-500/10">
                        <span className="text-[#526B91] block text-[10px] uppercase font-sans">Cell Serial</span>
                        <strong className="text-[#0B2148] text-sm font-bold block mt-0.5">
                          {validatedCellInfo.normalizedSerial}
                        </strong>
                      </div>
                      <div className="bg-white/70 p-3 rounded-xl border border-emerald-500/10">
                        <span className="text-[#526B91] block text-[10px] uppercase font-sans">Cell Part Number</span>
                        <span className="text-[#0878F9] font-bold block mt-0.5">
                          {validatedCellInfo.cellSku || "Standard SKU"}
                        </span>
                      </div>
                      <div className="bg-white/70 p-3 rounded-xl border border-emerald-500/10">
                        <span className="text-[#526B91] block text-[10px] uppercase font-sans">Production Order</span>
                        <span className="text-[#0878F9] font-bold block mt-0.5">
                          {validatedCellInfo.workOrderNumber || "Not Linked"}
                        </span>
                      </div>
                      <div className="bg-white/70 p-3 rounded-xl border border-emerald-500/10">
                        <span className="text-[#526B91] block text-[10px] uppercase font-sans">Testing State</span>
                        <span className="text-emerald-700 font-bold block mt-0.5">
                          Ready for Parameters
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 text-rose-600 text-xs p-1">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">Cell Verification Notice</p>
                      <p className="text-xs text-rose-600/90 mt-1">{validatedCellInfo.message}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Test Value Input Fields (Responsive Full-Width Grid) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#0B2148] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0878F9]" />
                  <span>Physical Test Parameters</span>
                </span>
                <span className="text-[11px] text-[#526B91] font-mono">
                  Standard 4-Wire Impedance & Capacity Test
                </span>
              </div>

              {/* Main Primary Measurements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <label className="text-xs text-[#0B2148] font-bold flex items-center justify-between">
                    <span>Capacity (AH) *</span>
                    <span className="text-[10px] text-[#526B91] font-mono">Ampere-Hours</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={ahInput}
                    onChange={(e) => setAhInput(e.target.value)}
                    placeholder="e.g. 3.25"
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#0B2148] placeholder:text-[#64748B] focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/10 outline-none transition-all"
                  />
                  <p className="text-[10px] text-[#526B91]">Discharge capacity test reading</p>
                </div>

                <div className="space-y-1.5 p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <label className="text-xs text-[#0B2148] font-bold flex items-center justify-between">
                    <span>Resistance (IR mΩ) *</span>
                    <span className="text-[10px] text-[#526B91] font-mono">Internal Resistance</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={irInput}
                    onChange={(e) => setIrInput(e.target.value)}
                    placeholder="e.g. 24.5"
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-[#0B2148] placeholder:text-[#64748B] focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/10 outline-none transition-all"
                  />
                  <p className="text-[10px] text-[#526B91]">AC/DC 1kHz internal impedance</p>
                </div>
              </div>

              {/* Auxiliary machine fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">
                    Voltage (V)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={voltageInput}
                    onChange={(e) => setVoltageInput(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0B2148] focus:border-[#0878F9] focus:bg-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">
                    Ambient Temp (°C)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={ambientTemp}
                    onChange={(e) => setAmbientTemp(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0B2148] focus:border-[#0878F9] focus:bg-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">
                    Machine / Station ID
                  </span>
                  <input
                    type="text"
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0B2148] focus:border-[#0878F9] focus:bg-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Live QC Prediction Banner (Full Width) */}
            {hasManualValues && manualQcPrediction && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0878F9]" />
                  <span className="font-bold text-[#0B2148]">Live Automated QC Prediction:</span>
                  <span className="text-[#526B91]">
                    Evaluated against active profile limits
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                      manualQcPrediction === "PASS"
                        ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                        : manualQcPrediction === "RETEST"
                        ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                        : "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                    }`}
                  >
                    {manualQcPrediction}
                  </span>

                  {manualGradePrediction && (
                    <span className="px-3 py-1 rounded-xl bg-[#EAF5FF] text-[#0878F9] font-bold text-xs border border-[#D8E8FA]">
                      Grade {manualGradePrediction}
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {/* Validate Button & Outcome Footer */}
            <div className="pt-4 border-t border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-4">
              {lastValidationResult ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-mono bg-[#F4F9FF] px-3.5 py-2 rounded-xl border border-[#D8E8FA] w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[#526B91]">Last Recorded:</span>
                    <strong className="text-[#0B2148]">{lastValidationResult.serialNumber}</strong>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lastValidationResult.result === "PASS"
                          ? "bg-emerald-500/20 text-[#166534]"
                          : lastValidationResult.result === "RETEST"
                          ? "bg-amber-500/20 text-amber-800"
                          : "bg-rose-500/20 text-rose-800"
                      }`}
                    >
                      {lastValidationResult.result} {lastValidationResult.grade ? `(${lastValidationResult.grade})` : ""}
                    </span>
                  </div>
                  {lastValidationResult.result === "PASS" && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      QC Pending (Gate 1) → Awaiting QC Approval
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#526B91] italic">
                  Enter cell measurements and verify serial to record result.
                </div>
              )}

              <button
                type="button"
                id="btn-validate-manual-cell"
                onClick={handleValidateManualCell}
                disabled={
                  manualApplyMutation.isPending ||
                  !validatedCellInfo?.isValid ||
                  !hasManualValues
                }
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {manualApplyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recording QC Data...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Validate & Record Cell QC</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VALIDATED CELL REPORTS (DUAL-VIEW OPERATIONAL LEDGER) ────────────── */}
      <div className="space-y-4 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D8E8FA] pb-4">
          <div>
            <h2 className="text-base font-display font-bold text-[#0B2148] uppercase tracking-wider">
              Validated Cell Reports
            </h2>
            <p className="text-xs text-[#526B91] mt-0.5">
              Review and audit validated physical cells by individual unit or grouped by Production Order.
            </p>
          </div>

          {/* Mode Switch: [ SINGLE VIEW ] [ PRODUCTION ORDER VIEW ] */}
          <div className="flex bg-[#F4F9FF] p-1 rounded-2xl border border-[#D8E8FA] w-fit gap-1 shrink-0">
            <button
              onClick={() => {
                setReportViewMode("single");
                setSelectedProductionOrder(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                reportViewMode === "single"
                  ? "bg-[#0878F9] text-white shadow-xs"
                  : "text-[#526B91] hover:text-[#0878F9]"
              }`}
            >
              Single View
            </button>

            <button
              onClick={() => setReportViewMode("production")}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                reportViewMode === "production"
                  ? "bg-[#0878F9] text-white shadow-xs"
                  : "text-[#526B91] hover:text-[#0878F9]"
              }`}
            >
              Production Order View
            </button>
          </div>
        </div>

        {/* ── MODE 1: SINGLE VIEW ───────────────────────────────────────────── */}
        {reportViewMode === "single" && (
          <div className="space-y-4">
            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA] w-fit gap-1">
                {["ALL", "CELL_TESTED", "RETEST_REQUIRED", "HOLD", "REJECTED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? "bg-[#0878F9] text-white shadow-xs"
                        : "text-[#526B91] hover:text-[#0878F9]"
                    }`}
                  >
                    {st === "ALL" ? "All Results" : st === "CELL_TESTED" ? "PASS" : st === "RETEST_REQUIRED" ? "RETEST" : st}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search serial, SKU, or WO..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-1.5 pl-10 pr-3 text-xs text-[#0B2148] placeholder:text-[#64748B] focus:border-[#0878F9] outline-none"
                />
              </div>
            </div>

            {/* Industrial Single View Table */}
            <div className="bg-white rounded-3xl overflow-hidden border border-[#D8E8FA] shadow-xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">
                      <th className="px-5 py-3.5">Serial Number</th>
                      <th className="px-5 py-3.5">Cell Part Number</th>
                      <th className="px-5 py-3.5">Production Order</th>
                      <th className="px-5 py-3.5">Product</th>
                      <th className="px-5 py-3.5">Test Date/Time</th>
                      <th className="px-5 py-3.5">Test Method</th>
                      <th className="px-5 py-3.5">Test Values</th>
                      <th className="px-5 py-3.5 text-center">Result</th>
                      <th className="px-5 py-3.5 text-center">Grade</th>
                      <th className="px-5 py-3.5 text-center">QC Gate 1</th>
                      <th className="px-5 py-3.5">Tester</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F1FC] text-xs">
                    {loadingReports ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-[#526B91]">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent mb-2" />
                          <span>Loading validated records...</span>
                        </td>
                      </tr>
                    ) : validatedCells.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-[#526B91] space-y-1">
                          <Inbox className="w-6 h-6 mx-auto text-[#526B91]" />
                          <p>No validated cell records found</p>
                        </td>
                      </tr>
                    ) : (
                      validatedCells.map((cell: any) => {
                        const result = cell.status === "CELL_TESTED" ? "PASS" : cell.status === "RETEST_REQUIRED" ? "RETEST" : cell.status === "REJECTED" ? "FAIL" : cell.status;
                        const woNumber = cell.testingRequirement?.workOrder?.workOrderNumber || "WO-GENERAL";
                        const productRef = cell.testingRequirement?.workOrder?.productRef || "Battery Pack Assembly";
                        const testMethod = cell.machineId?.toLowerCase().includes("upload") || cell.inwardBatchId ? "Machine Report" : "Manual Validation";
                        const isQcApproved = cell.qcDecisionHistory && cell.qcDecisionHistory.includes("QC_APPROVED");

                        return (
                          <tr
                            key={cell.serialNumber}
                            onClick={() => setSelectedCellForDetail(cell)}
                            className="hover:bg-[#EAF5FF] transition-colors cursor-pointer group"
                          >
                            {/* Serial */}
                            <td className="px-5 py-3.5 font-mono font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors">
                              {cell.serialNumber}
                            </td>

                            {/* Cell Part Number */}
                            <td className="px-5 py-3.5 font-mono text-[#0878F9] font-medium">
                              {cell.partNumber || "CELL-LFP-3200"}
                            </td>

                            {/* Production Order */}
                            <td className="px-5 py-3.5 font-mono text-[#0B2148] font-semibold">
                              {woNumber}
                            </td>

                            {/* Product */}
                            <td className="px-5 py-3.5 text-[#0B2148] max-w-[180px] truncate" title={productRef}>
                              {productRef}
                            </td>

                            {/* Date */}
                            <td className="px-5 py-3.5 font-mono text-[#526B91] text-[11px]">
                              {cell.updatedAt ? new Date(cell.updatedAt).toLocaleDateString() : "—"}
                            </td>

                            {/* Test Method */}
                            <td className="px-5 py-3.5 text-[#0B2148] text-[11px]">
                              {testMethod}
                            </td>

                            {/* Test Values */}
                            <td className="px-5 py-3.5 font-mono">
                              <span className="text-[#0B2148] font-bold">{cell.ahValue ? `${cell.ahValue.toFixed(2)} AH` : "—"}</span>
                              <span className="text-[#526B91] mx-1.5">|</span>
                              <span className="text-[#0B2148]">{cell.irValue ? `${cell.irValue.toFixed(1)} mΩ` : "—"}</span>
                            </td>

                            {/* Result Badge */}
                            <td className="px-5 py-3.5 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                result === "PASS"
                                  ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                                  : result === "RETEST"
                                  ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                                  : result === "HOLD"
                                  ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                                  : "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                              }`}>
                                {result}
                              </span>
                            </td>

                            {/* Grade */}
                            <td className="px-5 py-3.5 text-center font-mono font-bold">
                              {cell.grade ? (
                                <span className="px-2 py-0.5 rounded bg-[#EAF5FF] text-[#0878F9] text-[10px] border border-[#D8E8FA]">
                                  {cell.grade}
                                </span>
                              ) : (
                                <span className="text-[#526B91]">—</span>
                              )}
                            </td>

                            {/* QC Gate 1 Status */}
                            <td className="px-5 py-3.5 text-center">
                              {result === "PASS" ? (
                                isQcApproved ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    QC Approved
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    QC Pending
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-[#526B91] font-mono">
                                  {result === "RETEST" ? "Retest Req." : result === "FAIL" ? "Scrap Pending" : "—"}
                                </span>
                              )}
                            </td>

                            {/* Tester */}
                            <td className="px-5 py-3.5 text-[#526B91] text-[11px]">
                              {cell.machineOperator || "Test Engineer"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── MODE 2: PRODUCTION ORDER VIEW ─────────────────────────────────── */}
        {reportViewMode === "production" && (
          <div className="space-y-6">
            {!selectedProductionOrder ? (
              /* Production Orders Grid / Cards */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productionOrderSummaries.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-[#526B91] space-y-1">
                    <Layers className="w-6 h-6 mx-auto text-[#526B91]" />
                    <p>No production orders with cell requirements found</p>
                  </div>
                ) : (
                  productionOrderSummaries.map((po: any) => {
                    const isFulfilled = po.passCount >= po.requiredQuantity;

                    return (
                      <div
                        key={po.requirementId}
                        className="p-5 rounded-3xl bg-white border border-[#D8E8FA] hover:border-[#0878F9]/40 transition-all flex flex-col justify-between gap-4 shadow-sm group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-mono font-bold text-[#0B2148] text-base group-hover:text-[#0878F9] transition-colors">
                                {po.workOrderNumber}
                              </span>
                              <p className="text-xs text-[#526B91] mt-0.5 truncate max-w-[220px]" title={po.productRef}>
                                {po.productRef}
                              </p>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isFulfilled
                                ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                                : "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                            }`}>
                              {isFulfilled ? "FULFILLED" : "IN PROGRESS"}
                            </span>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-mono">
                            <div>
                              <span className="text-[#526B91] text-[10px] block uppercase">Required</span>
                              <strong className="text-[#0B2148] text-sm">{po.requiredQuantity}</strong>
                            </div>
                            <div>
                              <span className="text-[#526B91] text-[10px] block uppercase">Serialized</span>
                              <strong className="text-[#0878F9] text-sm">{po.serializedQuantity}</strong>
                            </div>
                            <div>
                              <span className="text-[#526B91] text-[10px] block uppercase">Qualified (PASS)</span>
                              <strong className="text-[#166534] text-sm">{po.passCount}</strong>
                            </div>
                            <div>
                              <span className="text-[#526B91] text-[10px] block uppercase">Pending</span>
                              <strong className="text-amber-600 text-sm">{po.pendingValidation}</strong>
                            </div>
                          </div>

                          {/* Micro breakdown: Retest / Hold / Fail */}
                          <div className="flex items-center gap-2 text-[10px] font-mono text-[#526B91]">
                            <span>Retest: <strong className="text-amber-600">{po.retestCount}</strong></span>
                            <span>•</span>
                            <span>Hold: <strong className="text-[#0878F9]">{po.holdCount}</strong></span>
                            <span>•</span>
                            <span>Fail: <strong className="text-rose-600">{po.failCount}</strong></span>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedProductionOrder(po)}
                          className="w-full py-2.5 rounded-xl bg-[#EAF5FF] hover:bg-[#D8E8FA] border border-[#D8E8FA] text-[#0878F9] hover:text-[#0667DB] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>View Cells</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Drilled-Down Production Order Cell Validation View */
              <div className="space-y-5">
                {/* Header with Back Button */}
                <div className="p-6 rounded-3xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedProductionOrder(null)}
                      className="p-2.5 rounded-xl bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] border border-[#D8E8FA] transition-all cursor-pointer"
                      title="Back to all Production Orders"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#0878F9]">PRODUCTION CELL VALIDATION</span>
                        <span className="text-[#526B91]">•</span>
                        <span className="font-mono font-bold text-[#0B2148] text-sm">{selectedProductionOrder.workOrderNumber}</span>
                      </div>
                      <h3 className="text-base font-bold text-[#0B2148] mt-0.5">
                        {selectedProductionOrder.productRef} · <span className="text-[#0878F9] font-mono">{selectedProductionOrder.cellSku}</span>
                      </h3>
                    </div>
                  </div>

                  {/* Summary Counters */}
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                    <div className="px-3 py-1.5 rounded-xl bg-white border border-[#D8E8FA] text-center">
                      <span className="text-[10px] text-[#526B91] block uppercase">Required</span>
                      <strong className="text-[#0B2148] font-bold">{selectedProductionOrder.requiredQuantity}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-white border border-[#D8E8FA] text-center">
                      <span className="text-[10px] text-[#526B91] block uppercase">Serialized</span>
                      <strong className="text-[#0878F9] font-bold">{selectedProductionOrder.serializedQuantity}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-[#DCFCE7] border border-[#BBF7D0] text-center">
                      <span className="text-[10px] text-[#166534] block uppercase">PASS</span>
                      <strong className="text-[#166534] font-bold">{selectedProductionOrder.passCount}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-center">
                      <span className="text-[10px] text-[#92400E] block uppercase">RETEST</span>
                      <strong className="text-[#92400E] font-bold">{selectedProductionOrder.retestCount}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-center">
                      <span className="text-[10px] text-[#991B1B] block uppercase">FAIL</span>
                      <strong className="text-[#991B1B] font-bold">{selectedProductionOrder.failCount}</strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-white border border-[#D8E8FA] text-center">
                      <span className="text-[10px] text-[#526B91] block uppercase">Pending</span>
                      <strong className="text-amber-600 font-bold">{selectedProductionOrder.pendingValidation}</strong>
                    </div>
                  </div>
                </div>

                {/* Filtered Cells Table for this WO only */}
                <div className="bg-white rounded-3xl overflow-hidden border border-[#D8E8FA] shadow-xl">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                        <tr className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">
                          <th className="px-5 py-3.5">Serial Number</th>
                          <th className="px-5 py-3.5">Cell SKU</th>
                          <th className="px-5 py-3.5">Test Time</th>
                          <th className="px-5 py-3.5">Test Method</th>
                          <th className="px-5 py-3.5">Test Values</th>
                          <th className="px-5 py-3.5 text-center">Result</th>
                          <th className="px-5 py-3.5 text-center">Grade</th>
                          <th className="px-5 py-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8F1FC] text-xs">
                        {validatedCells.filter((c: any) => c.testingRequirementId === selectedProductionOrder.requirementId || c.testingRequirement?.workOrder?.workOrderNumber === selectedProductionOrder.workOrderNumber).length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-[#526B91] space-y-1">
                              <Inbox className="w-6 h-6 mx-auto text-[#526B91]" />
                              <p>No tested cells recorded yet for this production order</p>
                            </td>
                          </tr>
                        ) : (
                          validatedCells
                            .filter((c: any) => c.testingRequirementId === selectedProductionOrder.requirementId || c.testingRequirement?.workOrder?.workOrderNumber === selectedProductionOrder.workOrderNumber)
                            .map((cell: any) => {
                              const result = cell.status === "CELL_TESTED" ? "PASS" : cell.status === "RETEST_REQUIRED" ? "RETEST" : cell.status === "REJECTED" ? "FAIL" : cell.status;
                              const testMethod = cell.machineId?.toLowerCase().includes("upload") || cell.inwardBatchId ? "Machine Report" : "Manual Validation";

                              return (
                                <tr
                                  key={cell.serialNumber}
                                  onClick={() => setSelectedCellForDetail(cell)}
                                  className="hover:bg-[#EAF5FF] transition-colors cursor-pointer group"
                                >
                                  <td className="px-5 py-3.5 font-mono font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors">
                                    {cell.serialNumber}
                                  </td>
                                  <td className="px-5 py-3.5 font-mono text-[#0878F9]">
                                    {cell.partNumber || selectedProductionOrder.cellSku}
                                  </td>
                                  <td className="px-5 py-3.5 font-mono text-[#526B91] text-[11px]">
                                    {cell.updatedAt ? new Date(cell.updatedAt).toLocaleTimeString() : "—"}
                                  </td>
                                  <td className="px-5 py-3.5 text-[#0B2148] text-[11px]">
                                    {testMethod}
                                  </td>
                                  <td className="px-5 py-3.5 font-mono">
                                    <span className="text-[#0B2148] font-bold">{cell.ahValue ? `${cell.ahValue.toFixed(2)} AH` : "—"}</span>
                                    <span className="text-[#526B91] mx-1.5">|</span>
                                    <span className="text-[#0B2148]">{cell.irValue ? `${cell.irValue.toFixed(1)} mΩ` : "—"}</span>
                                  </td>
                                  <td className="px-5 py-3.5 text-center">
                                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      result === "PASS"
                                        ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                                        : result === "RETEST"
                                        ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                                        : result === "HOLD"
                                        ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                                        : "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                                    }`}>
                                      {result}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-center font-mono font-bold">
                                    {cell.grade ? (
                                      <span className="px-2 py-0.5 rounded bg-[#EAF5FF] text-[#0878F9] text-[10px] border border-[#D8E8FA]">
                                        {cell.grade}
                                      </span>
                                    ) : "—"}
                                  </td>
                                  <td className="px-5 py-3.5 text-[#526B91] text-[11px] font-mono">
                                    {cell.status}
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SINGLE CELL DETAIL DRAWER ────────────────────────────────────────── */}
      {selectedCellForDetail && (
        <CellDetailDrawer
          cell={selectedCellForDetail}
          isOpen={!!selectedCellForDetail}
          onClose={() => setSelectedCellForDetail(null)}
          thresholdProfileName={activeThresholds?.name || "Standard QC Profile"}
        />
      )}
    </div>
  );
}
