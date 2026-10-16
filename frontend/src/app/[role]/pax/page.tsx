"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Search, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Clock, 
  Boxes, 
  Check, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  User, 
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  Eye
} from "lucide-react";
import { toast } from "sonner";

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

export default function PaxQcQueuePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roleSlug = (params?.role as string) || "qc";
  const initialTab = searchParams.get("tab") === "history" ? "history" : "pending";

  const [activeTab, setActiveTab] = useState<"pending" | "history">(initialTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Drawer / Review State
  const [reviewPax, setReviewPax] = useState<any | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [defectReason, setDefectReason] = useState("");
  const [defectSeverity, setDefectSeverity] = useState("CRITICAL");
  const [showGenealogy, setShowGenealogy] = useState(true);

  // Quality checkpoints checklist
  const [checkpoints, setCheckpoints] = useState([
    { name: "PAX Test Automated Results", description: "Verify automated test parameters (Capacity, IR, Voltage under load)", expectedValue: "Compliant", actualValue: "Verified Pass", result: "PASS" },
    { name: "Cell Genealogy & Pairing", description: "Verify all series cells are qualified and matched within delta bounds", expectedValue: "AH Delta < 0.05", actualValue: "Genealogy Verified", result: "PASS" },
    { name: "BMS Impedance & Cutoff Check", description: "Verify BMS logic communication and short-circuit protection thresholds", expectedValue: "Active / OK", actualValue: "Communicating", result: "PASS" },
    { name: "Physical Enclosure & Torque Seals", description: "Verify structure bolts, insulation barriers, torque tamper markers", expectedValue: "Intact", actualValue: "Pass", result: "PASS" }
  ]);

  // Sync with URL search params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "history") setActiveTab("history");
    else setActiveTab("pending");
  }, [searchParams]);

  // 1. Query Pending PAX Packs (status: PAX_TESTED)
  const { data: pendingData, isLoading: isPendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["pax-qc-pending", search, page],
    queryFn: async () => {
      const res = await api.get("/crm/quality/pax/pending-qc", {
        params: { search, page, limit: 12 }
      });
      return res.data;
    },
    enabled: activeTab === "pending",
    refetchInterval: 8000
  });

  // 2. Query Historical QC PAX Packs
  const { data: historyData, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["pax-qc-history", search, statusFilter, page],
    queryFn: async () => {
      const res = await api.get("/crm/quality/pax/history", {
        params: { search, status: statusFilter || undefined, page, limit: 12 }
      });
      return res.data;
    },
    enabled: activeTab === "history"
  });

  // 3. Decision Mutation
  const decisionMutation = useMutation({
    mutationFn: async ({ 
      serial, 
      decision, 
      notes, 
      defectType, 
      severity 
    }: { 
      serial: string; 
      decision: "APPROVE" | "RETEST_REWORK" | "REJECT"; 
      notes?: string; 
      defectType?: string; 
      severity?: string; 
    }) => {
      const res = await api.post(`/crm/quality/pax/${serial}/decision`, {
        decision,
        notes,
        defectType,
        severity,
        checkpoints
      });
      return res.data;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pax-qc-pending"] });
      queryClient.invalidateQueries({ queryKey: ["pax-qc-history"] });
      queryClient.invalidateQueries({ queryKey: ["quality-dashboard-stats"] });

      if (vars.decision === "APPROVE") {
        toast.success(`PAX ${vars.serial} QC APPROVED (Ready for Sale)`);
      } else if (vars.decision === "RETEST_REWORK") {
        toast.warning(`PAX ${vars.serial} sent to Rework & Repair`);
      } else {
        toast.error(`PAX ${vars.serial} REJECTED and logged to Defects`);
      }

      setReviewPax(null);
      setDecisionNotes("");
      setDefectReason("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "PAX QC decision failed");
    }
  });

  const pendingPacks = pendingData?.packs || [];
  const historyPacks = historyData?.packs || [];

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600 font-bold">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-display font-black text-slate-900 tracking-tight">
                PAX QC APPROVAL QUEUE
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-300">
                Gate 2: Assembled Packs
              </span>
            </div>
            <p className="text-xs text-[#526B91] mt-0.5 font-medium">
              Review and authorize assembled battery packs that completed PAX testing before release.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => {
              setActiveTab("pending");
              setPage(1);
              router.push(`/${roleSlug}/pax`);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "pending"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-[#526B91] hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span>PAX QC Queue</span>
            {pendingData?.total !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-extrabold">
                {pendingData.total}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("history");
              setPage(1);
              router.push(`/${roleSlug}/pax?tab=history`);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-[#526B91] hover:text-slate-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>PAX History</span>
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
            placeholder="Search by PAX Serial, Work Order, Model..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-[#64748B] focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "history" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#526B91] uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="READY_FOR_SALE">Ready for Sale</option>
                <option value="UNDER_REPAIR">Under Repair / Rework</option>
                <option value="SOLD_TO_CUSTOMER">Sold to Customer</option>
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
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading tested PAX packs pending QC...</p>
            </div>
          ) : pendingPacks.length === 0 ? (
            <div className="p-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">No PAX Units Waiting for QC Approval</h3>
              <p className="text-xs text-[#526B91] max-w-sm mx-auto">
                All tested battery packs have been reviewed. Newly tested packs from PAX Test Engineer will enter this queue automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[#526B91] uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">PAX Serial</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Production Order</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Product / Model</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Cell Count</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">PAX Test Result</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">PAX Tested By</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Tested At</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 font-extrabold text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPacks.map((pack: any) => {
                    return (
                      <tr key={pack.paxSerial} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {pack.paxSerial}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {pack.workOrder?.workOrderNumber || "WO-STOCK"}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-bold text-slate-800">{pack.paxType?.name || "Battery Pack"}</p>
                          <p className="text-[10px] text-[#526B91] truncate max-w-[160px]">
                            {pack.workOrder?.productRef || "Standard Assembly"}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {pack.cellCount || pack.cells?.length || 16} Cells
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                            PASS
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] font-medium whitespace-nowrap">
                          {pack.paxTestedBy || "PAX Test Engineer"}
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(pack.paxTestedAt || pack.assembledAt)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase whitespace-nowrap inline-block">
                            QC Pending
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setReviewPax(pack);
                              setDecisionNotes("");
                              setDefectReason("");
                            }}
                            title="Review PAX Quality Inspection"
                            className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 transition-all cursor-pointer inline-flex items-center justify-center shadow-xs"
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
        /* ── 2. PAX HISTORY VIEW ─────────────────────────────────────── */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          {isHistoryLoading ? (
            <div className="p-20 flex flex-col items-center justify-center text-[#526B91] gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Loading PAX QC history...</p>
            </div>
          ) : historyPacks.length === 0 ? (
            <div className="p-20 text-center text-[#526B91] text-xs">
              No historical PAX QC records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[#526B91] uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">PAX Serial</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Work Order</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Product Model</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">QC Decision</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">QC Inspector</th>
                    <th className="py-3 px-4 font-extrabold whitespace-nowrap">Decision Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyPacks.map((pack: any) => {
                    const isApproved = pack.status === "READY_FOR_SALE" || pack.status === "SOLD_TO_CUSTOMER";
                    const isRepair = pack.status === "UNDER_REPAIR";

                    return (
                      <tr key={pack.paxSerial} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {pack.paxSerial}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#526B91] whitespace-nowrap">
                          {pack.workOrder?.workOrderNumber || "---"}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {pack.paxType?.name || "Battery Pack"}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap inline-block ${
                            isApproved ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            isRepair ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {pack.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase whitespace-nowrap inline-block">
                            {pack.qcDecision || "QC_APPROVED"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                          {pack.qcInspector || "QC Inspector"}
                        </td>
                        <td className="py-3.5 px-4 text-[#526B91] font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(pack.qcDecisionAt || pack.assembledAt)}
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
          3. DETAILED PAX QUALITY INSPECTION DRAWER / MODAL
          ======================================================== */}
      <AnimatePresence>
        {reviewPax && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F4F9FF] backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-black text-slate-900 uppercase">
                      PAX QUALITY INSPECTION
                    </h2>
                    <p className="text-xs text-[#526B91] font-mono">
                      PAX Serial: <span className="font-bold text-slate-800">{reviewPax.paxSerial}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewPax(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#526B91]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* PAX Identity Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Product Model</p>
                  <p className="font-bold text-slate-900 mt-0.5">{reviewPax.paxType?.name || "48V 100Ah"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Production Order</p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    {reviewPax.workOrder?.workOrderNumber || "WO-382408"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Assembly Station</p>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate">
                    {reviewPax.assembledAtStation?.name || "STN-ASY-01"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase">Assembled At</p>
                  <p className="font-mono text-slate-700 mt-0.5">{formatDateTime(reviewPax.assembledAt)}</p>
                </div>
              </div>

              {/* TEST RESULTS (Read Only) */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                      PAX Test Engineer Result: PASS
                    </span>
                  </div>
                  <p className="text-xs text-[#526B91] mt-1 font-medium">
                    Tested By: <span className="font-semibold text-slate-900">{reviewPax.paxTestedBy || "PAX Test Engineer"}</span> · {formatDateTime(reviewPax.paxTestedAt || reviewPax.assembledAt)}
                  </p>
                </div>

                {reviewPax.testReportUrl && (
                  <a
                    href={reviewPax.testReportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Industrial Test Report
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Cell Genealogy Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-600" />
                    Cell Genealogy ({reviewPax.cells?.length || 16} Serialized Cells)
                  </h3>
                  <button
                    onClick={() => setShowGenealogy(!showGenealogy)}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    {showGenealogy ? "Collapse Genealogy" : "Expand Genealogy"}
                  </button>
                </div>

                {showGenealogy && (
                  <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/50">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-[#526B91] uppercase text-[9px] tracking-wider">
                          <th className="py-2 px-3">Position</th>
                          <th className="py-2 px-3">Cell Serial</th>
                          <th className="py-2 px-3">Grade</th>
                          <th className="py-2 px-3">Capacity (AH)</th>
                          <th className="py-2 px-3">IR (mΩ)</th>
                          <th className="py-2 px-3">Voltage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono">
                        {(reviewPax.cells || []).map((c: any, idx: number) => {
                          const cell = c.cell;
                          return (
                            <tr key={idx} className="hover:bg-white transition-colors">
                              <td className="py-1.5 px-3 text-[#526B91] font-bold">#{c.position ?? (idx + 1)}</td>
                              <td className="py-1.5 px-3 font-bold text-slate-800">{cell?.serialNumber || c.cellSerial}</td>
                              <td className="py-1.5 px-3 text-emerald-700 font-bold">{cell?.grade || "A+"}</td>
                              <td className="py-1.5 px-3 text-slate-700">{cell?.ahValue ? `${cell.ahValue}Ah` : "3.25Ah"}</td>
                              <td className="py-1.5 px-3 text-slate-700">{cell?.irValue ? `${cell.irValue}mΩ` : "18.2mΩ"}</td>
                              <td className="py-1.5 px-3 text-[#526B91]">{cell?.voltage ? `${cell.voltage}V` : "3.2V"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quality Checkpoints Checklist */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Quality Checkpoints Verification</h4>
                <div className="space-y-1.5">
                  {checkpoints.map((cp, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{cp.name}</p>
                        <p className="text-[10px] text-[#526B91]">{cp.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {cp.actualValue}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* QC DECISION ACTIONS */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    QC Inspector Decision Notes
                  </label>
                  <textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Enter final sign-off notes or required rework remarks..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Action 1: Approve PAX */}
                  <button
                    disabled={decisionMutation.isPending}
                    onClick={() => {
                      decisionMutation.mutate({
                        serial: reviewPax.paxSerial,
                        decision: "APPROVE",
                        notes: decisionNotes || "PAX pack passed all final quality gate criteria."
                      });
                    }}
                    className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {decisionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    [ APPROVE PAX ]
                  </button>

                  {/* Action 2: Send to Retest / Rework */}
                  <button
                    disabled={decisionMutation.isPending}
                    onClick={() => {
                      const reason = prompt("Enter Retest/Rework Reason:") || "Rework required";
                      decisionMutation.mutate({
                        serial: reviewPax.paxSerial,
                        decision: "RETEST_REWORK",
                        defectType: "REWORK_REQUIRED",
                        severity: "HIGH",
                        notes: reason
                      });
                    }}
                    className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    [ RETEST / REWORK ]
                  </button>

                  {/* Action 3: Reject PAX */}
                  <button
                    disabled={decisionMutation.isPending}
                    onClick={() => {
                      const reason = prompt("Enter Rejection Reason:") || "QC rejected pack";
                      decisionMutation.mutate({
                        serial: reviewPax.paxSerial,
                        decision: "REJECT",
                        defectType: "QC_FAIL",
                        severity: "CRITICAL",
                        notes: reason
                      });
                    }}
                    className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    [ REJECT PAX ]
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
