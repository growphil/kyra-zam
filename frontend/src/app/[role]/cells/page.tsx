"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useFormattedSerial } from "@/hooks/useFormattedSerial";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Battery, 
  Search, 
  Loader2, 
  RefreshCcw,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle2, 
  AlertCircle, 
  PackageCheck,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  X,
  Settings,
  Plus,
  ShieldAlert,
  Download,
  Eye,
  Layers,
  Cpu,
  Calendar,
  Clock,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Info,
  ArrowRight,
  Package,
  Inbox,
  Barcode,
  Check,
  Microscope,
  ArrowUpRight,
  Sparkles,
  Boxes
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return dateStr;
  }
}

interface PendingBatch {
  id: string;
  inwardNumber: string;
  partNumber: string;
  batchNumber: string;
  quantity: number;
  availableQty: number;
  testedQty: number;
  rejectedQty: number;
  category: string;
  voltage: number;
  createdAt: string;
}

export interface ProductionTestingRequirement {
  id: string;
  requirementNumber: string;
  workOrderId: string;
  cellSku: string;
  cellName: string;
  requiredQuantity: number;
  testedQuantity: number;
  remainingQuantity: number;
  serializedQuantity?: number;
  qualifiedQuantity?: number;
  availableBulkStock?: number;
  status: string;
  activatedAt: string;
  defaultValues?: {
    chemistry?: string;
    ratedVoltage?: number;
    category?: string;
  };
  workOrder: {
    id: string;
    workOrderNumber: string;
    productRef: string;
    plannedQuantity: number;
    status: string;
    dueDate?: string;
    supervisor?: { name: string; email?: string };
    scheduling?: { sequence: number; assignedDate: string };
    execution?: { startedAt?: string; actualHours?: number };
  };
}

interface CellRecord {
  serialNumber: string;
  partNumber?: string | null;
  batchNumber?: string | null;
  voltage: number;
  category: string;
  cycles: number;
  ahValue?: number | null;
  irValue?: number | null;
  grade?: string | null;
  status: "RAW" | "CELL_TESTED" | "REJECTED" | "HOLD" | "UNMATCHED" | "RETEST_REQUIRED";
  retestCount?: number;
  lastRetestAt?: string | null;
  machineId?: string | null;
  machineCalibrationDate?: string | null;
  machineOperator?: string | null;
  ambientTemperature?: number | null;
  cellTemperature?: number | null;
  createdAt: string;
  updatedAt: string;
  testingRequirementId?: string | null;
  inwardBatch?: {
    id: string;
    inwardNumber: string;
    batchNumber: string;
    createdAt: string;
    receivedBy?: { id: string; name: string; email: string };
    material?: { id: string; name: string; sku: string };
  } | null;
  paxCell?: {
    cellSerial: string;
    paxSerial: string;
    position: number;
    pax?: {
      paxSerial: string;
      status: string;
      paxType?: { name: string };
      assembledAt?: string;
    } | null;
  } | null;
}

interface CellAuditLog {
  id: string;
  action: string;
  prevStatus?: string | null;
  newStatus?: string | null;
  timestamp: string;
  actor?: { id: string; name: string; email: string } | null;
  metadata?: any;
}

export default function CellsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const currentRole = (params?.role as string) || "test-engineer";

  const { data: session } = useSession();
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isTestEngineer = currentRole.toLowerCase().includes("test") || userRoles.includes("TEST_ENGINEER") || userRoles.includes("TESTER");
  const isQcRole = currentRole.toLowerCase() === "qc" || (!isTestEngineer && userRoles.includes("QC") && currentRole.toLowerCase() === "qc");

  const { formatSerial } = useFormattedSerial();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  
  // ── Production Selection & Serialization State ───────────────────────────
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [serialScanInput, setSerialScanInput] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [lastSerializedSerial, setLastSerializedSerial] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSavingAndTesting, setIsSavingAndTesting] = useState(false);

  // General ledger filters (for Admin/Inventory views)
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"serialization" | "ledger">(
    isTestEngineer ? "serialization" : "ledger"
  );

  // Modals & Drawers
  const [selectedCellDetail, setSelectedCellDetail] = useState<CellRecord | null>(null);
  const [cellHistory, setCellHistory] = useState<CellAuditLog[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingCell, setEditingCell] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const serialInputRef = useRef<HTMLInputElement>(null);
  const limit = 12;

  useEffect(() => { 
    setMounted(true); 
  }, []);

  if (isQcRole) {
    return <CellQcApprovalWorkspace roleSlug={currentRole} />;
  }

  // Sync requirement from URL search params if present
  useEffect(() => {
    if (!mounted) return;
    const reqParam = searchParams.get("requirementId");
    if (reqParam) {
      setSelectedRequirementId(reqParam);
      setActiveTab("serialization");
    }
  }, [mounted, searchParams]);

  // Focus scanner input whenever requirement changes or tab is active
  useEffect(() => {
    if (selectedRequirementId && activeTab === "serialization") {
      setTimeout(() => {
        serialInputRef.current?.focus();
      }, 150);
    }
  }, [selectedRequirementId, activeTab]);

  // ── 1. Fetch Production Cell Requirements (PCTR) ─────────────────────────
  const { data: prodRequirementsData, isLoading: loadingProdReqs, isFetching: fetchingProdReqs, refetch: refetchProdReqs } = useQuery<{
    requirements: ProductionTestingRequirement[];
    metrics: {
      activeRequirementsCount: number;
      totalRequired: number;
      totalTested: number;
      totalRemaining: number;
    };
  }>({
    queryKey: ["production-cell-testing-requirements"],
    queryFn: async () => (await api.get("/testing/production-requirements")).data,
    enabled: mounted,
    refetchInterval: 5000,
  });

  const requirements = prodRequirementsData?.requirements || [];
  const selectedReq = requirements.find(r => r.id === selectedRequirementId) || null;

  // Auto-select first active requirement if none selected
  useEffect(() => {
    if (!selectedRequirementId && requirements.length > 0) {
      const activeFirst = requirements.find(r => r.status === "IN_PROGRESS" && (r.remainingQuantity > 0 || (r.serializedQuantity ?? 0) < r.requiredQuantity));
      if (activeFirst) {
        setSelectedRequirementId(activeFirst.id);
      } else {
        setSelectedRequirementId(requirements[0].id);
      }
    }
  }, [requirements, selectedRequirementId]);

  // ── 2. Fetch Bulk Batches & Summary ──────────────────────────────────────
  const { data: stationSummary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery<{
    pendingBulkCount: number;
    testedTodayCount: number;
    retestCount: number;
    rejectedCount: number;
    activeBatches: PendingBatch[];
  }>({
    queryKey: ["testing-station-summary"],
    queryFn: async () => (await api.get("/testing/station-summary")).data,
    enabled: mounted,
  });

  const activeBatches = stationSummary?.activeBatches || [];

  // Filter batches matching selected requirement
  const matchingBatches = selectedReq
    ? activeBatches.filter(b => 
        (b.partNumber || "").toUpperCase() === (selectedReq.cellSku || "").toUpperCase() ||
        (b.partNumber || "").toUpperCase().includes((selectedReq.cellSku || "").toUpperCase()) ||
        (selectedReq.cellSku || "").toUpperCase().includes((b.partNumber || "").toUpperCase())
      )
    : activeBatches;

  // Auto-select matching batch
  useEffect(() => {
    if (matchingBatches.length > 0) {
      if (!selectedBatchId || !matchingBatches.some(b => b.id === selectedBatchId)) {
        setSelectedBatchId(matchingBatches[0].id);
      }
    } else {
      setSelectedBatchId("");
    }
  }, [matchingBatches, selectedBatchId, selectedReq]);

  // ── 3. Fetch Cells Serialized For This Requirement ───────────────────────
  const { data: requirementCellsData, refetch: refetchReqCells } = useQuery<{
    cells: CellRecord[];
    total: number;
  }>({
    queryKey: ["cells-for-requirement", selectedRequirementId],
    queryFn: async () => {
      if (!selectedRequirementId) return { cells: [], total: 0 };
      const res = await api.get("/cells", {
        params: {
          testingRequirementId: selectedRequirementId,
          limit: 30,
          page: 1
        }
      });
      return res.data;
    },
    enabled: mounted && !!selectedRequirementId,
    refetchInterval: 4000
  });

  // ── 4. Fetch General Serialized Cells Ledger ─────────────────────────────
  const { data: ledgerData, isLoading: loadingLedger, isFetching: fetchingLedger, refetch: refetchLedger } = useQuery<{
    cells: CellRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: {
      totalSerialized: number;
      raw: number;
      tested: number;
      rejected: number;
      hold: number;
      bulkAvailableForTesting: number;
      pendingBatches: PendingBatch[];
    };
  }>({
    queryKey: ["serialized-cells", page, status, search, category, grade],
    queryFn: async () => {
      const res = await api.get("/cells", { 
        params: { 
          page, 
          limit, 
          status: status || undefined, 
          search: search || undefined,
          category: category || undefined,
          grade: grade || undefined,
          includeAssigned: "true"
        } 
      });
      return res.data;
    },
    enabled: mounted && activeTab === "ledger",
  });

  // ── 5. Serialize Physical Cell Mutation ──────────────────────────────────
  const serializeMutation = useMutation({
    mutationFn: async (payload: { serialNumber: string; requirementId: string; batchId?: string }) => {
      return (await api.post("/cells/serialize", payload)).data;
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["production-cell-testing-requirements"] });
      queryClient.invalidateQueries({ queryKey: ["testing-station-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cells-for-requirement", selectedRequirementId] });
      queryClient.invalidateQueries({ queryKey: ["serialized-cells"] });

      const scanned = variables.serialNumber.trim();
      setLastSerializedSerial(scanned);
      setSuccessMessage(`Cell ${scanned} serialized successfully.`);
      setSerialScanInput("");

      toast.success(`Cell ${scanned} serialized successfully!`, {
        description: `Associated with ${selectedReq?.cellSku} (${selectedReq?.workOrder?.workOrderNumber})`
      });

      // Refocus scanner input immediately for continuous barcode scanning
      setTimeout(() => {
        serialInputRef.current?.focus();
      }, 50);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || "Failed to serialize cell";
      toast.error(msg);
      serialInputRef.current?.focus();
    }
  });

  // ── 6. Delete / Un-serialize Cell Mutation ───────────────────────────────
  const deleteCellMutation = useMutation({
    mutationFn: async (serial: string) => {
      return (await api.delete(`/cells/${encodeURIComponent(serial)}`)).data;
    },
    onSuccess: (res, serial) => {
      queryClient.invalidateQueries({ queryKey: ["production-cell-testing-requirements"] });
      queryClient.invalidateQueries({ queryKey: ["testing-station-summary"] });
      queryClient.invalidateQueries({ queryKey: ["cells-for-requirement", selectedRequirementId] });
      queryClient.invalidateQueries({ queryKey: ["serialized-cells"] });

      toast.success(`Cell ${serial} un-serialized successfully.`, {
        description: "Stock has been returned to the available bulk inventory."
      });

      if (selectedCellDetail?.serialNumber === serial) {
        setSelectedCellDetail(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to un-serialize cell");
    }
  });

  const handleSerializeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRequirementId) {
      toast.error("Please select a pending production requirement first");
      return;
    }

    const trimmed = serialScanInput.trim();
    if (!trimmed) {
      toast.error("Please scan or enter a cell serial number");
      serialInputRef.current?.focus();
      return;
    }

    serializeMutation.mutate({
      serialNumber: trimmed,
      requirementId: selectedRequirementId,
      batchId: selectedBatchId || undefined
    });
  };

  // ── 7. Save and Test Handler ─────────────────────────────────────────────
  const handleSaveAndTest = async () => {
    if (!selectedRequirementId) {
      toast.error("Please select a pending production requirement first");
      return;
    }

    const trimmed = serialScanInput.trim();
    if (trimmed) {
      setIsSavingAndTesting(true);
      try {
        await serializeMutation.mutateAsync({
          serialNumber: trimmed,
          requirementId: selectedRequirementId,
          batchId: selectedBatchId || undefined
        });
        toast.success(`Cell ${trimmed} serialized. Navigating to Testing Station...`);
        router.push(`/${currentRole}/testing?requirementId=${selectedRequirementId}&searchSerial=${encodeURIComponent(trimmed)}`);
      } catch (err) {
        // Error already handled in onError
      } finally {
        setIsSavingAndTesting(false);
      }
    } else {
      // If input is empty, navigate directly to testing station for this requirement
      router.push(`/${currentRole}/testing?requirementId=${selectedRequirementId}`);
    }
  };

  // Open single cell details drawer
  const openCellDetail = async (serial: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/cells/${serial}`);
      setSelectedCellDetail(res.data.cell);
      setCellHistory(res.data.history || []);
    } catch {
      toast.error("Failed to load cell details");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Update Cell Mutation (Admin Only)
  const updateCellMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/cells/${payload.serialNumber}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serialized-cells"] });
      toast.success("Cell technical adjustments saved successfully");
      setShowEditModal(false);
      if (selectedCellDetail?.serialNumber === editingCell?.serialNumber) {
        openCellDetail(editingCell.serialNumber);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to update cell")
  });

  const refreshAll = () => {
    refetchProdReqs();
    refetchSummary();
    refetchReqCells();
    if (activeTab === "ledger") refetchLedger();
  };

  if (!mounted) return null;

  // Selected requirement metrics calculations
  const reqRequired = selectedReq?.requiredQuantity || 0;
  const reqSerialized = selectedReq?.serializedQuantity ?? (requirementCellsData?.total || 0);
  const reqQualified = selectedReq?.qualifiedQuantity ?? (selectedReq?.testedQuantity || 0);
  const reqRemainingToSerialize = Math.max(0, reqRequired - reqSerialized);
  const reqRemainingToQualify = Math.max(0, reqRequired - reqQualified);
  const reqBulkStock = selectedReq?.availableBulkStock ?? matchingBatches.reduce((acc, b) => acc + b.availableQty, 0);

  const serializedPercent = reqRequired > 0 ? Math.min(100, Math.round((reqSerialized / reqRequired) * 100)) : 0;
  const qualifiedPercent = reqRequired > 0 ? Math.min(100, Math.round((reqQualified / reqRequired) * 100)) : 0;

  return (
    <div className="space-y-8 relative pb-20">
      {/* ── TOP HEADER & SUMMARY METRICS ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#D8E8FA] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-lg shadow-accent/10">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#0B2148] tracking-tight flex items-center gap-3">
                Cell Serialization & Production Allocation
              </h1>
              <p className="text-[#526B91] text-xs sm:text-sm mt-0.5">
                Take physical cells from available bulk stock and serialize them against active production cell requirements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA]">
              <button
                onClick={() => setActiveTab("serialization")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "serialization"
                    ? "bg-[#0878F9] text-white shadow-xs"
                    : "text-[#526B91] hover:text-[#0878F9]"
                }`}
              >
                Serialization Workspace
              </button>
              <button
                onClick={() => setActiveTab("ledger")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "ledger"
                    ? "bg-[#0878F9] text-white shadow-xs"
                    : "text-[#526B91] hover:text-[#0878F9]"
                }`}
              >
                Inventory Ledger
              </button>
            </div>
          )}

          <button 
            onClick={refreshAll} 
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-xs font-bold text-[#0B2148] hover:text-[#0878F9] transition-all cursor-pointer shadow-xs"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${fetchingProdReqs || loadingProdReqs ? 'animate-spin text-[#0878F9]' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => router.push(`/${currentRole}/testing${selectedReq ? `?requirementId=${selectedReq.id}` : ''}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#EAF5FF] border border-[#D8E8FA] hover:bg-[#D8E8FA] text-[#0878F9] hover:text-[#0667DB] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Microscope className="w-4 h-4" />
            <span>Go to Testing Station</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS BAR (PRODUCTION & STOCK OVERVIEW) ────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Active Requirements */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Active Requirements</span>
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-[#0B2148] mt-2">
            {prodRequirementsData?.metrics?.activeRequirementsCount ?? requirements.filter(r => r.status === "IN_PROGRESS").length}
          </p>
          <span className="text-[10px] text-[#526B91] font-medium">Assigned Production PCTR</span>
        </div>

        {/* Total Required Cells */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Total Required</span>
            <Boxes className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-display font-bold text-blue-400 mt-2">
            {prodRequirementsData?.metrics?.totalRequired?.toLocaleString() || "0"}
          </p>
          <span className="text-[10px] text-[#526B91] font-medium">Production cell demand</span>
        </div>

        {/* Total Serialized */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Total Serialized</span>
            <Barcode className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-display font-bold text-amber-400 mt-2">
            {requirements.reduce((acc, r) => acc + (r.serializedQuantity || 0), 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-[#526B91] font-medium">Physical cells assigned (Stage 1)</span>
        </div>

        {/* Total Qualified */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#166534]">Qualified (PASS)</span>
            <CheckCircle2 className="w-4 h-4 text-[#166534]" />
          </div>
          <p className="text-2xl font-display font-bold text-[#166534] mt-2">
            {prodRequirementsData?.metrics?.totalTested?.toLocaleString() || "0"}
          </p>
          <span className="text-[10px] text-[#526B91] font-medium">Tested & ready for Assembly</span>
        </div>

        {/* Bulk Stock Available */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-blue-500/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Bulk Stock Available</span>
            <Inbox className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-display font-bold text-cyan-400 mt-2">
            {stationSummary?.pendingBulkCount?.toLocaleString() || "0"}
          </p>
          <span className="text-[10px] text-[#526B91] font-medium">Unserialized aggregate stock</span>
        </div>
      </div>

      {activeTab === "serialization" ? (
        <div className="space-y-8">
          {/* ── AREA A: PENDING PRODUCTION REQUIREMENTS ────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-bold text-[#0B2148] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-accent" />
                  PENDING PRODUCTION
                </h2>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Select an active production requirement to serialize physical cells against.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent/10 border border-accent/20 text-accent font-mono">
                {requirements.length} Requirement{requirements.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingProdReqs ? (
              <div className="p-12 text-center glass-panel rounded-3xl border border-[#D8E8FA]">
                <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
                <p className="text-sm font-bold text-[#0B2148]">Loading Active Production Requirements...</p>
              </div>
            ) : requirements.length === 0 ? (
              <div className="p-10 text-center glass-panel rounded-3xl border border-[#D8E8FA]">
                <Package className="w-10 h-10 text-[#526B91] mx-auto mb-3" />
                <h3 className="text-sm font-bold text-[#0B2148]">No Active Production Cell Requirements</h3>
                <p className="text-xs text-[#526B91] max-w-md mx-auto mt-1">
                  When the Production Supervisor starts a Work Order, its Production Cell Testing Requirement (PCTR) will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {requirements.map((req) => {
                  const isSelected = req.id === selectedRequirementId;
                  const reqRemainSerialize = Math.max(0, req.requiredQuantity - (req.serializedQuantity ?? 0));
                  const reqRemainQualify = Math.max(0, req.requiredQuantity - (req.qualifiedQuantity ?? req.testedQuantity ?? 0));
                  const isFulfilled = reqRemainQualify === 0 && req.status === "COMPLETED";

                  return (
                    <motion.div
                      key={req.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedRequirementId(req.id)}
                      className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                        isSelected 
                          ? "border-accent/60 bg-accent/[0.04] shadow-xl shadow-accent/10 ring-1 ring-accent/30" 
                          : "border-[#D8E8FA] hover:border-[#D8E8FA] bg-[#F4F9FF]"
                      }`}
                    >
                      {/* Selection Glow Indicator */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/20 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />
                      )}

                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <span className="font-mono font-bold text-sm text-[#0B2148] tracking-wide flex items-center gap-1.5">
                            {req.workOrder?.workOrderNumber || "WO-0000"}
                          </span>
                          <p className="text-xs text-[#526B91] font-medium line-clamp-1 mt-0.5">
                            {req.workOrder?.productRef || "Battery Pack Model"}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isFulfilled
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : req.status === "IN_PROGRESS"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-slate-500/10 text-[#526B91] border border-slate-500/20"
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {/* SKU Box */}
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-[#D8E8FA] mb-4">
                        <span className="text-[10px] text-[#526B91] font-bold uppercase tracking-widest block">
                          Cell SKU / Part Number
                        </span>
                        <p className="text-xs font-mono font-bold text-accent mt-0.5">
                          {req.cellSku}
                        </p>
                      </div>

                      {/* Quantities Grid */}
                      <div className="grid grid-cols-5 gap-1 text-center py-2 border-y border-[#D8E8FA] font-mono">
                        <div>
                          <span className="text-[9px] text-[#526B91] uppercase block font-sans">Required</span>
                          <span className="text-xs font-bold text-[#0B2148]">{req.requiredQuantity}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-amber-400 uppercase block font-sans">Serialized</span>
                          <span className="text-xs font-bold text-amber-300">{req.serializedQuantity ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-accent uppercase block font-sans">To Serialize</span>
                          <span className="text-xs font-bold text-accent">{reqRemainSerialize}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#166534] uppercase block font-sans">Qualified</span>
                          <span className="text-xs font-bold text-[#166534]">{req.qualifiedQuantity ?? req.testedQuantity ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-cyan-400 uppercase block font-sans">Bulk Stock</span>
                          <span className="text-xs font-bold text-cyan-300">{req.availableBulkStock ?? 0}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[11px] text-[#526B91] font-mono">
                          {req.requirementNumber}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequirementId(req.id);
                          }}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? "bg-[#0878F9] text-white font-bold shadow-xs"
                              : "bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] hover:text-[#0878F9] border border-[#D8E8FA]"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>SELECTED</span>
                            </>
                          ) : (
                            <span>SELECT</span>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── WORKSPACE SECTION: CELL INFORMATION & PHYSICAL CELL SCANNING ──── */}
          {selectedReq ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Workspace Focus Banner */}
              <div className="p-4 rounded-2xl bg-accent/[0.08] border border-accent/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center text-accent shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0B2148]">
                      You are serializing physical cells for production requirement: <span className="text-accent font-mono">{selectedReq.cellSku}</span>
                    </p>
                    <p className="text-[11px] text-[#526B91] mt-0.5">
                      Work Order: <strong className="text-[#0B2148] font-mono">{selectedReq.workOrder?.workOrderNumber}</strong> • Product: <strong className="text-[#0B2148]">{selectedReq.workOrder?.productRef}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] font-mono">
                    Remaining to Serialize: <strong className="text-accent">{reqRemainingToSerialize} pcs</strong>
                  </span>
                </div>
              </div>

              {/* 2-COLUMN OPERATIONAL WORKSPACE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ── LEFT SIDE: CELL REQUIREMENT & CONFIGURATION (5 Cols) ────── */}
                <div className="lg:col-span-5 space-y-6">
                  {/* CELL REQUIREMENT CARD */}
                  <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] space-y-5">
                    <div className="border-b border-[#D8E8FA] pb-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#526B91] flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-accent" />
                        CELL REQUIREMENT
                      </h3>
                      <span className="text-xs font-mono font-bold text-[#526B91]">
                        {selectedReq.requirementNumber}
                      </span>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Part Number / SKU</span>
                        <span className="font-mono font-bold text-accent text-sm">{selectedReq.cellSku}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Production Work Order</span>
                        <span className="font-mono font-bold text-[#0B2148]">{selectedReq.workOrder?.workOrderNumber}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Product</span>
                        <span className="font-medium text-[#0B2148]">{selectedReq.workOrder?.productRef}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Required Quantity</span>
                        <span className="font-mono font-bold text-[#0B2148]">{reqRequired} pcs</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Serialized Quantity</span>
                        <span className="font-mono font-bold text-amber-400">{reqSerialized} pcs</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Remaining to Serialize</span>
                        <span className="font-mono font-bold text-accent text-sm">{reqRemainingToSerialize} pcs</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Qualified Quantity (Passed QC)</span>
                        <span className="font-mono font-bold text-[#166534]">{reqQualified} pcs</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#D8E8FA]">
                        <span className="text-[#526B91] font-medium">Remaining to Qualify</span>
                        <span className="font-mono font-bold text-[#526B91]">{reqRemainingToQualify} pcs</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#526B91] font-medium">Available Bulk Stock</span>
                        <span className="font-mono font-bold text-cyan-400">{reqBulkStock} pcs</span>
                      </div>
                    </div>

                    {/* Progress Visualizer */}
                    <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#526B91]">Serialization Progress</span>
                        <span className="font-mono font-bold text-amber-300">{serializedPercent}% ({reqSerialized}/{reqRequired})</span>
                      </div>
                      <div className="w-full h-2 bg-[#F4F9FF] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                          style={{ width: `${serializedPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-[#526B91]">Qualified (PASS) Progress</span>
                        <span className="font-mono font-bold text-[#166534]">{qualifiedPercent}% ({reqQualified}/{reqRequired})</span>
                      </div>
                      <div className="w-full h-2 bg-[#F4F9FF] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                          style={{ width: `${qualifiedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* DEFAULT / CONFIGURED VALUES CARD */}
                  <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] space-y-4">
                    <div className="border-b border-[#D8E8FA] pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#526B91] flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        DEFAULT / CONFIGURED VALUES
                      </h3>
                      <p className="text-[11px] text-[#526B91] mt-0.5">
                        Configured nominal specifications associated with this cell SKU.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-[#D8E8FA]">
                        <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider">Chemistry</span>
                        <p className="text-sm font-bold text-[#0B2148] mt-0.5">
                          {selectedReq.defaultValues?.chemistry || "LFP"}
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-[#D8E8FA]">
                        <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider">Rated Voltage</span>
                        <p className="text-sm font-bold text-[#0B2148] mt-0.5">
                          {selectedReq.defaultValues?.ratedVoltage || 3.2}V
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 text-[11px] text-blue-300">
                      <span className="font-bold">Lifecycle Stage 1:</span> Scanning assigns the physical serial in <strong className="text-white">RAW</strong> status. Actual validation (AH, IR, Grade, PASS/FAIL) takes place in <strong className="text-white">Stage 2 (/testing)</strong>.
                    </div>
                  </div>
                </div>

                {/* ── RIGHT SIDE: PHYSICAL CELL SCANNING (7 Cols) ─────────────── */}
                <div className="lg:col-span-7 space-y-6">
                  {/* SERIALIZE PHYSICAL CELL CARD */}
                  <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-accent/30 bg-accent/[0.02] shadow-2xl shadow-accent/5 space-y-6">
                    <div className="border-b border-[#D8E8FA] pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base sm:text-lg font-display font-bold text-[#0B2148] flex items-center gap-2.5">
                          <Barcode className="w-5 h-5 text-accent" />
                          SERIALIZE PHYSICAL CELL
                        </h3>
                        <p className="text-xs text-[#526B91] mt-0.5">
                          Scan barcode/QR or type the serial number from the physical battery cell.
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 border border-accent/30 text-accent">
                        Stage 1 Active
                      </span>
                    </div>

                    {/* Scanner Input Form */}
                    <form onSubmit={handleSerializeSubmit} className="space-y-5">
                      {/* Batch Source Selector (if multiple inward batches exist) */}
                      {matchingBatches.length > 1 && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] flex items-center justify-between">
                            <span>Source Bulk Stock Batch</span>
                            <span className="text-cyan-400">{matchingBatches.length} Batches Available</span>
                          </label>
                          <select
                            value={selectedBatchId}
                            onChange={(e) => setSelectedBatchId(e.target.value)}
                            className="w-full bg-white border border-[#D8E8FA] rounded-2xl py-3 px-4 text-xs font-mono text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
                          >
                            {matchingBatches.map(b => (
                              <option key={b.id} value={b.id} className="text-[#0B2148]">
                                {b.inwardNumber} — {b.batchNumber} ({b.availableQty} units available)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Main Scan Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center justify-between">
                          <span>Scan / Enter Cell Serial Number</span>
                          <span className="text-[10px] text-[#526B91] font-mono">Keyboard-wedge scanner ready</span>
                        </label>

                        <div className="relative flex items-center">
                          <Barcode className="absolute left-4 w-5 h-5 text-[#0878F9] pointer-events-none" />
                          <input
                            ref={serialInputRef}
                            type="text"
                            value={serialScanInput}
                            onChange={(e) => {
                              setSerialScanInput(e.target.value);
                              setSuccessMessage(null);
                            }}
                            placeholder="e.g. CELL-3200-000184 or scan barcode..."
                            className="w-full bg-white border-2 border-[#D8E8FA] focus:border-[#0878F9] rounded-2xl py-4 pl-12 pr-28 text-sm sm:text-base font-mono font-bold text-[#0B2148] placeholder:text-[#64748B] outline-none transition-all shadow-xs"
                            autoComplete="off"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!serialScanInput.trim() || serializeMutation.isPending}
                            className="absolute right-2 px-4 py-2.5 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-30 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                          >
                            {serializeMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>SCAN</span>
                          </button>
                        </div>
                      </div>

                      {/* Physical Cell Status Card */}
                      <div className={`p-4 rounded-2xl border transition-all ${
                        serialScanInput.trim()
                          ? "bg-[#EAF5FF] border-[#0878F9]/40"
                          : "bg-[#F4F9FF] border-[#D8E8FA]"
                      }`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-[#526B91] font-bold uppercase tracking-widest">
                              Physical Cell
                            </span>
                            <p className="text-sm font-mono font-bold text-[#0B2148] mt-0.5">
                              {serialScanInput.trim() ? formatSerial(serialScanInput.trim()) : "Waiting for barcode scan..."}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] text-[#526B91] font-bold uppercase tracking-widest">
                              Status
                            </span>
                            <div className="mt-0.5">
                              {serialScanInput.trim() ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                                  <CheckCircle2 className="w-3 h-3" /> Ready to serialize
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                                  Scanner Idle
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Batch Info */}
                        {selectedBatchId && (
                          <div className="mt-3 pt-3 border-t border-[#D8E8FA] flex items-center justify-between text-[11px] text-[#526B91] font-mono">
                            <span>Source Batch: <strong className="text-[#0B2148]">{matchingBatches.find(b => b.id === selectedBatchId)?.inwardNumber || "Auto-Selected"}</strong></span>
                            <span>Stock: <strong className="text-cyan-400">{matchingBatches.find(b => b.id === selectedBatchId)?.availableQty ?? reqBulkStock} avail</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Success Feedback Alert */}
                      {successMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-[#166534] font-medium"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#166534]" />
                          <span>{successMessage} Ready for the next physical cell.</span>
                        </motion.div>
                      )}

                      {/* ACTION BUTTONS: SAVE & SERIALIZE and SAVE & TEST */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Primary SAVE & SERIALIZE Button (stays on page) */}
                        <button
                          type="submit"
                          disabled={!serialScanInput.trim() || serializeMutation.isPending || reqBulkStock <= 0}
                          className="w-full py-3.5 rounded-2xl bg-accent hover:bg-accent/90 disabled:opacity-40 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {serializeMutation.isPending && !isSavingAndTesting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Serializing...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>SAVE & SERIALIZE</span>
                            </>
                          )}
                        </button>

                        {/* Secondary SAVE & TEST Button (serializes and navigates to testing) */}
                        <button
                          type="button"
                          onClick={handleSaveAndTest}
                          disabled={serializeMutation.isPending || (reqBulkStock <= 0 && !serialScanInput.trim())}
                          className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSavingAndTesting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Saving & Opening Test...</span>
                            </>
                          ) : (
                            <>
                              <Microscope className="w-4 h-4 text-blue-200" />
                              <span>{serialScanInput.trim() ? "SAVE & TEST CELL" : "TEST SERIALIZED CELLS"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Operational Guidelines footer */}
                    <div className="text-[11px] text-[#526B91] border-t border-[#D8E8FA] pt-4 space-y-1">
                      <p>• <strong>SAVE & SERIALIZE</strong> creates the physical Cell record and clears scanner for the next cell.</p>
                      <p>• <strong>SAVE & TEST</strong> serializes the scanned cell and immediately takes you to the Testing Station.</p>
                    </div>
                  </div>

                  {/* ── RECENT SERIALIZED CELLS FOR THIS REQUIREMENT FEED ─────── */}
                  <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] space-y-4">
                    <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#0B2148] flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-400" />
                          RECENTLY SERIALIZED CELLS FOR THIS WORK ORDER
                        </h4>
                        <p className="text-[11px] text-[#526B91] mt-0.5">
                          Serialized physical cells awaiting AH/IR test validation in Stage 2.
                        </p>
                      </div>

                      <button
                        onClick={() => router.push(`/${currentRole}/testing?requirementId=${selectedReq.id}`)}
                        className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      >
                        <span>Test All In Stage 2</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {requirementCellsData?.cells && requirementCellsData.cells.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1 divide-y divide-[#E8F1FC]">
                        {requirementCellsData.cells.map((cell) => (
                          <div 
                            key={cell.serialNumber} 
                            className="pt-2.5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-[#F4F9FF] p-2.5 rounded-2xl transition-all"
                          >
                            <div 
                              className="flex items-center gap-3 cursor-pointer flex-1"
                              onClick={() => openCellDetail(cell.serialNumber)}
                            >
                              <div className="w-8 h-8 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] font-mono text-xs font-bold shrink-0">
                                <Barcode className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#0B2148] text-sm">
                                    {formatSerial(cell.serialNumber)}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                    cell.status === "CELL_TESTED"
                                      ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                                      : "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                                  }`}>
                                    {cell.status === "RAW" ? "RAW / Awaiting Test" : cell.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#526B91] font-mono mt-0.5">
                                  Batch: {cell.batchNumber || "---"} • Inward: {cell.inwardBatch?.inwardNumber || "---"} • {formatDateTime(cell.createdAt)}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons: Test and Delete */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {/* Test Single Cell Button */}
                              <button
                                onClick={() => router.push(`/${currentRole}/testing?requirementId=${selectedReq.id}&searchSerial=${encodeURIComponent(cell.serialNumber)}`)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] hover:text-[#0667DB] border border-[#D8E8FA] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                title="Test this cell in Testing Station"
                              >
                                <Microscope className="w-3.5 h-3.5" />
                                <span>Test</span>
                              </button>

                              {/* Delete / Un-serialize Button */}
                              {cell.status === "RAW" && (
                                <button
                                  disabled={deleteCellMutation.isPending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete and un-serialize cell ${cell.serialNumber}? Stock will be returned to bulk inventory.`)) {
                                      deleteCellMutation.mutate(cell.serialNumber);
                                    }
                                  }}
                                  className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all cursor-pointer"
                                  title="Delete serialized cell and return stock to bulk batch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* View Details Button */}
                              <button
                                onClick={() => openCellDetail(cell.serialNumber)}
                                className="p-1.5 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-[#0878F9] border border-[#D8E8FA] transition-all cursor-pointer"
                                title="View cell details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-[#526B91]">
                        No physical cells serialized for this requirement yet. Scan your first cell above!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}

          {/* ── AREA B: UNSERIALIZED CELLS / AVAILABLE STOCK ────────────────────── */}
          <div className="space-y-4 pt-4 border-t border-[#D8E8FA]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-bold text-[#0B2148] flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-cyan-400" />
                  UNSERIALIZED CELLS / AVAILABLE STOCK
                </h2>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Bulk aggregate inventory received by Inventory Manager, available for serialization and testing.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">
                {stationSummary?.pendingBulkCount?.toLocaleString() || "0"} Bulk Cells Available
              </span>
            </div>

            {loadingSummary ? (
              <div className="p-8 text-center glass-panel rounded-3xl border border-[#D8E8FA]">
                <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
                <p className="text-xs text-[#526B91]">Loading bulk inventory batches...</p>
              </div>
            ) : activeBatches.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-3xl border border-[#D8E8FA]">
                <Inbox className="w-8 h-8 text-[#526B91] mx-auto mb-2" />
                <h3 className="text-xs font-bold text-[#0B2148]">No Unserialized Bulk Stock</h3>
                <p className="text-[11px] text-[#526B91] mt-0.5">
                  Inventory Manager must receive bulk cell stock before cells can be serialized.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeBatches.map((batch) => (
                  <div 
                    key={batch.id} 
                    className="glass-panel p-4 rounded-3xl border border-[#D8E8FA] space-y-3 bg-[#F4F9FF]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-[#0B2148]">{batch.partNumber}</span>
                        <p className="text-[10px] text-[#526B91] font-mono mt-0.5">Batch: {batch.batchNumber}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                        {batch.availableQty.toLocaleString()} Available
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-xl bg-white/[0.03] text-[10px] font-mono">
                      <div>
                        <span className="text-[#526B91] block font-sans">Received</span>
                        <span className="text-[#0B2148] font-bold">{batch.quantity}</span>
                      </div>
                      <div>
                        <span className="text-[#526B91] block font-sans">Tested</span>
                        <span className="text-[#0B2148] font-bold">{batch.testedQty || 0}</span>
                      </div>
                      <div>
                        <span className="text-[#526B91] block font-sans">Voltage</span>
                        <span className="text-[#0B2148] font-bold">{batch.voltage || 3.2}V</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#526B91] font-mono pt-1">
                      <span>Inward Ref: {batch.inwardNumber}</span>
                      <span>{formatDateTime(batch.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── ADMIN / INVENTORY LEDGER TAB ──────────────────────────────────── */
        <div className="space-y-6">
          {/* Search & Filter Controls */}
          <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search serial number, part number, or batch..." 
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 pl-10 pr-4 text-xs font-mono text-[#0B2148] placeholder:text-[#64748B] focus:border-[#0878F9] outline-none transition-all" 
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="bg-white border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="RAW">RAW (Awaiting Testing)</option>
                <option value="CELL_TESTED">CELL_TESTED (Tested / Available)</option>
                <option value="REJECTED">REJECTED (Failed QC)</option>
                <option value="HOLD">HOLD (On Hold)</option>
              </select>

              {(search || status || category || grade) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setCategory("");
                    setGrade("");
                    setPage(1);
                  }}
                  className="text-xs text-[#526B91] hover:text-[#0878F9] px-2.5 py-1.5 rounded-lg border border-[#D8E8FA] hover:bg-[#F4F9FF] transition-all cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Cells Ledger Table */}
          <div className="glass-panel rounded-3xl border border-[#D8E8FA] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#D8E8FA] bg-[#F4F9FF] text-[10px] text-[#526B91] uppercase tracking-wider font-bold">
                    <th className="p-4">Serial Number</th>
                    <th className="p-4">Part Number / SKU</th>
                    <th className="p-4">Batch Number</th>
                    <th className="p-4">Voltage</th>
                    <th className="p-4">AH / IR</th>
                    <th className="p-4">Grade</th>
                    <th className="p-4">Lifecycle Status</th>
                    <th className="p-4">PAX Allocation</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] font-mono">
                  {loadingLedger ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-[#526B91]">
                        <Loader2 className="w-6 h-6 animate-spin text-[#0878F9] mx-auto mb-2" />
                        Loading serialized cells...
                      </td>
                    </tr>
                  ) : ledgerData?.cells && ledgerData.cells.length > 0 ? (
                    ledgerData.cells.map((cell) => (
                      <tr 
                        key={cell.serialNumber}
                        className="hover:bg-[#F4F9FF] transition-colors cursor-pointer"
                        onClick={() => openCellDetail(cell.serialNumber)}
                      >
                        <td className="p-4 font-bold text-[#0B2148]">{formatSerial(cell.serialNumber)}</td>
                        <td className="p-4 text-[#0B2148]">{cell.partNumber || "CELL-LFP-3200"}</td>
                        <td className="p-4 text-[#526B91]">{cell.batchNumber || "---"}</td>
                        <td className="p-4 text-[#0B2148]">{cell.voltage?.toFixed(2)}V</td>
                        <td className="p-4 text-[#0B2148]">
                          {cell.ahValue ? `${cell.ahValue.toFixed(2)} Ah` : "---"} • {cell.irValue ? `${cell.irValue.toFixed(1)} mΩ` : "---"}
                        </td>
                        <td className="p-4">
                          {cell.grade ? (
                            <span className="px-2 py-0.5 rounded-md bg-[#EAF5FF] text-[#0878F9] font-bold text-[10px] border border-[#D8E8FA]">
                              {cell.grade}
                            </span>
                          ) : "---"}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            cell.status === "CELL_TESTED"
                              ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                              : cell.status === "RAW"
                              ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                              : cell.status === "REJECTED"
                              ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                              : "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                          }`}>
                            {cell.status}
                          </span>
                        </td>
                        <td className="p-4 text-[#526B91] font-sans">
                          {cell.paxCell?.paxSerial ? (
                            <span className="text-[#0878F9] font-mono font-bold text-[11px]">
                              {cell.paxCell.paxSerial}
                            </span>
                          ) : (
                            <span className="text-[#526B91]">Unassigned</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openCellDetail(cell.serialNumber);
                              }}
                              className="p-1.5 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-[#0878F9] border border-[#D8E8FA] transition-all cursor-pointer"
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {cell.status === "RAW" && (
                              <button
                                disabled={deleteCellMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete cell ${cell.serialNumber}? Stock will be returned to bulk inventory.`)) {
                                    deleteCellMutation.mutate(cell.serialNumber);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all cursor-pointer"
                                title="Delete cell"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-[#526B91]">
                        No serialized cells match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {ledgerData && ledgerData.totalPages > 1 && (
              <div className="p-4 border-t border-[#D8E8FA] flex items-center justify-between text-xs text-[#526B91]">
                <span>Page {ledgerData.page} of {ledgerData.totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= ledgerData.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CELL DETAILS & AUDIT DRAWER MODAL ──────────────────────────────── */}
      <AnimatePresence>
        {selectedCellDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedCellDetail(null)} 
              className="absolute inset-0 bg-[#0B2148]/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: "100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative z-10 w-full max-w-xl h-full bg-white border-l border-[#D8E8FA] p-6 sm:p-8 overflow-y-auto space-y-6 custom-scrollbar shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9]">
                    <Battery className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-[#0B2148]">Physical Cell Specification</h3>
                    <p className="text-xs font-mono font-bold text-[#0878F9] mt-0.5">
                      {formatSerial(selectedCellDetail.serialNumber)}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedCellDetail(null)}
                  className="p-2 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] transition-all cursor-pointer"
                  title="Close Details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                <span className="text-xs text-[#526B91] font-medium">Lifecycle Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedCellDetail.status === "CELL_TESTED"
                    ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                    : selectedCellDetail.status === "RAW"
                    ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                    : selectedCellDetail.status === "REJECTED"
                    ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                    : "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                }`}>
                  {selectedCellDetail.status === "RAW" ? "RAW (Awaiting Stage 2 Testing)" : selectedCellDetail.status}
                </span>
              </div>

              {/* Technical Specifications Grid */}
              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3 text-xs">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Technical Metrics</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Voltage</span>
                    <p className="text-[#0B2148] font-mono font-bold mt-0.5">{selectedCellDetail.voltage}V</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Chemistry</span>
                    <p className="text-[#0B2148] font-bold mt-0.5">{selectedCellDetail.category}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Capacity (AH)</span>
                    <p className="text-[#0B2148] font-mono font-bold mt-0.5">
                      {selectedCellDetail.ahValue ? `${selectedCellDetail.ahValue} Ah` : "Awaiting Testing"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Internal Resistance (IR)</span>
                    <p className="text-[#0B2148] font-mono font-bold mt-0.5">
                      {selectedCellDetail.irValue ? `${selectedCellDetail.irValue} mΩ` : "Awaiting Testing"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">QC Grade</span>
                    <p className="text-[#0878F9] font-bold mt-0.5">{selectedCellDetail.grade || "Ungraded"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Serialized Date</span>
                    <p className="text-[#0B2148] font-mono mt-0.5">{formatDateTime(selectedCellDetail.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Source Inward Traceability */}
              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3 text-xs">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Source Inward Traceability</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Inward Number</span>
                    <p className="text-[#0B2148] font-mono font-bold mt-0.5">
                      {selectedCellDetail.inwardBatch?.inwardNumber || "---"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#526B91] font-bold uppercase">Batch Number</span>
                    <p className="text-[#0B2148] font-mono font-bold mt-0.5">
                      {selectedCellDetail.batchNumber || selectedCellDetail.inwardBatch?.batchNumber || "---"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lifecycle Audit History */}
              {cellHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Audit History</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 divide-y divide-[#E8F1FC] text-xs">
                    {cellHistory.map((log) => (
                      <div key={log.id} className="pt-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-[#0B2148]">{log.action}</span>
                          <p className="text-[10px] text-[#526B91]">
                            By {log.actor?.name || "System"} • New Status: {log.newStatus || "---"}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#526B91] font-mono">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons in Drawer */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const serial = selectedCellDetail.serialNumber;
                      setSelectedCellDetail(null);
                      router.push(`/${currentRole}/testing?requirementId=${selectedCellDetail.testingRequirementId || selectedRequirementId || ''}&searchSerial=${encodeURIComponent(serial)}`);
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Microscope className="w-4 h-4" />
                    <span>Test This Cell</span>
                  </button>

                  {selectedCellDetail.status === "RAW" && (
                    <button
                      disabled={deleteCellMutation.isPending}
                      onClick={() => {
                        if (confirm(`Delete cell ${selectedCellDetail.serialNumber}? Stock will be returned to bulk inventory.`)) {
                          deleteCellMutation.mutate(selectedCellDetail.serialNumber);
                        }
                      }}
                      className="px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Un-serialize & Delete</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedCellDetail(null)}
                  className="w-full py-3 rounded-xl bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] hover:text-[#0667DB] border border-[#D8E8FA] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── DEDICATED CELL QC APPROVAL WORKSPACE (GATE 1) ───────────────────────────

function CellQcApprovalWorkspace({ roleSlug }: { roleSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "history" ? "history" : "pending";

  const [activeTab, setActiveTab] = useState<"pending" | "history">(initialTab);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Drawer review state
  const [reviewCell, setReviewCell] = useState<any | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [actionType, setActionType] = useState<"APPROVE" | "RETEST" | "REJECT" | null>(null);

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "history") setActiveTab("history");
    else setActiveTab("pending");
  }, [searchParams]);

  // Query Pending Cells
  const { data: pendingData, isLoading: isPendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["cell-qc-pending", search, gradeFilter, page],
    queryFn: async () => {
      const res = await api.get("/crm/quality/cells/pending-qc", {
        params: { search, grade: gradeFilter || undefined, page, limit: 12 }
      });
      return res.data;
    },
    enabled: activeTab === "pending",
    refetchInterval: 8000
  });

  // Query Cell History
  const { data: historyData, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["cell-qc-history", search, decisionFilter, page],
    queryFn: async () => {
      const res = await api.get("/crm/quality/cells/history", {
        params: { search, decision: decisionFilter || undefined, page, limit: 12 }
      });
      return res.data;
    },
    enabled: activeTab === "history"
  });

  // Decision Mutation
  const decisionMutation = useMutation({
    mutationFn: async ({ serial, decision, reason, notes }: { serial: string; decision: "APPROVE" | "RETEST" | "REJECT"; reason?: string; notes?: string }) => {
      const res = await api.post(`/crm/quality/cells/${serial}/decision`, { decision, reason, notes });
      return res.data;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cell-qc-pending"] });
      queryClient.invalidateQueries({ queryKey: ["cell-qc-history"] });
      queryClient.invalidateQueries({ queryKey: ["quality-dashboard-stats"] });
      
      if (vars.decision === "APPROVE") {
        toast.success(`Cell ${vars.serial} QC APPROVED for production`);
      } else if (vars.decision === "RETEST") {
        toast.warning(`Cell ${vars.serial} sent for QC Retest`);
      } else {
        toast.error(`Cell ${vars.serial} REJECTED and logged to Scrap`);
      }

      setReviewCell(null);
      setDecisionNotes("");
      setDecisionReason("");
      setActionType(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Decision recording failed");
    }
  });

  const pendingCells = pendingData?.cells || [];
  const historyCells = historyData?.cells || [];
  const totalCount = activeTab === "pending" ? (pendingData?.total || 0) : (historyData?.total || 0);

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600 font-bold">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-display font-black text-slate-900 tracking-tight">
                CELL QC APPROVAL QUEUE
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                Gate 1: Physical Cells
              </span>
            </div>
            <p className="text-xs text-[#526B91] mt-0.5 font-medium">
              Review and authorize tested physical cells before they are released to PAX Assembly line.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => {
              setActiveTab("pending");
              setPage(1);
              router.push(`/${roleSlug}/cells`);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "pending"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-[#526B91] hover:text-slate-900"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>QC Pending Queue</span>
            {pendingData?.total !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-extrabold">
                {pendingData.total}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("history");
              setPage(1);
              router.push(`/${roleSlug}/cells?tab=history`);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-[#526B91] hover:text-slate-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cell History</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Cell Serial, SKU, Batch..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-[#64748B] focus:bg-white focus:outline-none focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "pending" ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#526B91] uppercase">Grade:</span>
              <select
                value={gradeFilter}
                onChange={(e) => {
                  setGradeFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">All Grades</option>
                <option value="A+">Grade A+</option>
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#526B91] uppercase">Decision:</span>
              <select
                value={decisionFilter}
                onChange={(e) => {
                  setDecisionFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">All Decisions</option>
                <option value="APPROVED">QC Approved</option>
                <option value="RETEST">QC Retest</option>
                <option value="REJECTED">QC Rejected</option>
              </select>
            </div>
          )}

          <button
            onClick={() => {
              if (activeTab === "pending") refetchPending();
              else refetchHistory();
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#526B91]"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      {activeTab === "pending" ? (
        /* ── 1. PENDING QUEUE VIEW ────────────────────────────────────── */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          {isPendingLoading ? (
            <div className="p-20 flex flex-col items-center justify-center text-[#526B91] gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <p className="text-xs font-semibold">Loading tested cells pending QC...</p>
            </div>
          ) : pendingCells.length === 0 ? (
            <div className="p-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">No Cells Waiting for QC Approval</h3>
              <p className="text-xs text-[#526B91] max-w-sm mx-auto">
                All serialized & tested cells have been reviewed. New tested cells from Test Engineer will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[#526B91] uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Cell Serial</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Part Number / SKU</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Work Order</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Test Result</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Test Values (AH / IR)</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Tested By</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Tested At</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 font-extrabold text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingCells.map((cell: any) => {
                    const wo = cell.testingRequirement?.workOrder;
                    return (
                      <tr key={cell.serialNumber} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {cell.serialNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {cell.partNumber || "CELL-LFP-3200"}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono text-[#526B91] font-semibold">
                            {wo?.workOrderNumber || "WO-STOCK"}
                          </span>
                          <p className="text-[10px] text-[#526B91] truncate max-w-[160px]">
                            {wo?.productRef || "48V 100Ah Pack"}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                              PASS
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              Grade {cell.grade || "A+"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                          <span className="font-bold text-slate-900">{cell.ahValue ? `${cell.ahValue} Ah` : "N/A"}</span>
                          <span className="text-[#526B91] mx-1">·</span>
                          <span className="text-[#526B91]">{cell.irValue ? `${cell.irValue} mΩ` : "N/A"}</span>
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] font-medium whitespace-nowrap">
                          {cell.testedBy || "Sunita Patel"}
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(cell.testedAt)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 uppercase whitespace-nowrap inline-block">
                            QC Pending
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setReviewCell(cell);
                              setDecisionNotes("");
                              setDecisionReason("");
                              setActionType(null);
                            }}
                            title="Review Cell Quality Inspection"
                            className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 transition-all cursor-pointer inline-flex items-center justify-center shadow-xs"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── 2. CELL HISTORY VIEW ─────────────────────────────────────── */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          {isHistoryLoading ? (
            <div className="p-20 flex flex-col items-center justify-center text-[#526B91] gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Loading cell QC history...</p>
            </div>
          ) : historyCells.length === 0 ? (
            <div className="p-20 text-center text-[#526B91] text-xs">
              No historical QC records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[#526B91] uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Cell Serial</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Part Number</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Work Order</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Test Values</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">QC Decision</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">QC Inspector</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Decision Time</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Notes / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyCells.map((cell: any) => {
                    const isApproved = cell.qcDecision === "QC_APPROVED";
                    const isRetest = cell.qcDecision === "QC_RETEST";
                    const isRejected = cell.qcDecision === "QC_REJECTED";

                    return (
                      <tr key={cell.serialNumber} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {cell.serialNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {cell.partNumber || "CELL-LFP-3200"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#526B91] whitespace-nowrap">
                          {cell.testingRequirement?.workOrder?.workOrderNumber || "---"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                          {cell.ahValue ? `${cell.ahValue}Ah` : "-"} / {cell.irValue ? `${cell.irValue}mΩ` : "-"} (Grade {cell.grade || "-"})
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap inline-block ${
                            isApproved ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            isRetest ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {cell.qcDecision.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                          {cell.qcInspector || "QC Inspector"}
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(cell.qcDecisionAt)}
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] truncate max-w-[200px] whitespace-nowrap">
                          {cell.qcNotes || "Standard QC inspection"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          3. DETAILED CELL QUALITY INSPECTION DRAWER / MODAL
          ======================================================== */}
      <AnimatePresence>
        {reviewCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F4F9FF] backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-black text-slate-900 uppercase">
                      CELL QUALITY INSPECTION
                    </h2>
                    <p className="text-xs text-[#526B91] font-mono">
                      Cell Serial: <span className="font-bold text-slate-800">{reviewCell.serialNumber}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewCell(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#526B91]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cell Identity Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Cell SKU / Part</p>
                  <p className="font-bold text-slate-900 mt-0.5">{reviewCell.partNumber || "CELL-LFP-3200"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Production Order</p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    {reviewCell.testingRequirement?.workOrder?.workOrderNumber || "WO-382408"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Product Ref</p>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate">
                    {reviewCell.testingRequirement?.workOrder?.productRef || "48V 100Ah Battery Pack"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Batch Number</p>
                  <p className="font-mono text-slate-700 mt-0.5">{reviewCell.batchNumber || "BATCH-2026-001"}</p>
                </div>
              </div>

              {/* TEST RESULTS (Read Only) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Test Results (Validated by Test Engineer)
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                    RESULT: PASS · GRADE {reviewCell.grade || "A+"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-center">
                    <p className="text-[10px] font-bold text-[#526B91] uppercase">Discharge Capacity (AH)</p>
                    <p className="text-2xl font-mono font-black text-emerald-700 mt-1">
                      {reviewCell.ahValue ? `${reviewCell.ahValue}` : "3.25"} <span className="text-xs font-normal">Ah</span>
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-center">
                    <p className="text-[10px] font-bold text-[#526B91] uppercase">Internal Resistance (IR)</p>
                    <p className="text-2xl font-mono font-black text-emerald-700 mt-1">
                      {reviewCell.irValue ? `${reviewCell.irValue}` : "18.2"} <span className="text-xs font-normal">mΩ</span>
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 text-center">
                    <p className="text-[10px] font-bold text-[#526B91] uppercase">Open Circuit Voltage</p>
                    <p className="text-2xl font-mono font-black text-emerald-700 mt-1">
                      {reviewCell.voltage ? `${reviewCell.voltage}` : "3.20"} <span className="text-xs font-normal">V</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* TEST INFORMATION */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <h4 className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Test Engineer & Station Metadata</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[#526B91] font-medium">
                  <div>
                    <span className="text-[#526B91]">Test Method:</span> {reviewCell.testMethod || "Machine Report (Auto)"}
                  </div>
                  <div>
                    <span className="text-[#526B91]">Tested By:</span> {reviewCell.testedBy || "Sunita Patel"}
                  </div>
                  <div>
                    <span className="text-[#526B91]">Tested Time:</span> {formatDateTime(reviewCell.testedAt)}
                  </div>
                </div>
              </div>

              {/* QC DECISION ACTIONS */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Inspection Notes / Decision Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Enter optional inspector notes or decision rationale..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Action 1: Approve Cell */}
                  <button
                    disabled={decisionMutation.isPending}
                    onClick={() => {
                      decisionMutation.mutate({
                        serial: reviewCell.serialNumber,
                        decision: "APPROVE",
                        notes: decisionNotes || "Cell passed QC inspection criteria."
                      });
                    }}
                    className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {decisionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    [ APPROVE CELL ]
                  </button>

                  {/* Action 2: Send to Retest */}
                  <button
                    disabled={decisionMutation.isPending}
                    onClick={() => {
                      const reason = prompt("Enter Retest Reason (e.g. Marginal IR verification):") || "QC requested retest";
                      decisionMutation.mutate({
                        serial: reviewCell.serialNumber,
                        decision: "RETEST",
                        reason,
                        notes: decisionNotes
                      });
                    }}
                    className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    [ SEND TO RETEST ]
                  </button>

                  {/* Action 3: Reject Cell */}
                  <button
                    disabled={decisionMutation.isPending}
                    onClick={() => {
                      const reason = prompt("Enter Rejection Reason:") || "QC rejected cell";
                      decisionMutation.mutate({
                        serial: reviewCell.serialNumber,
                        decision: "REJECT",
                        reason,
                        notes: decisionNotes
                      });
                    }}
                    className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    [ REJECT CELL ]
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

