"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShieldCheck, 
  Search, 
  Plus, 
  X, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  FileText,
  User,
  ArrowRight,
  TrendingUp,
  Zap,
  Package,
  Clock,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Boxes,
  Check,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

export default function QualityDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params?.role as string) || "qc";
  const queryClient = useQueryClient();

  // Defect Modal State
  const [isDefectOpen, setIsDefectOpen] = useState(false);
  const [defectWOId, setDefectWOId] = useState("");
  const [defectPaxSerial, setDefectPaxSerial] = useState("");
  const [defectType, setDefectType] = useState("Cell Imbalance");
  const [severity, setSeverity] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [disposition, setDisposition] = useState("REWORK");

  // --- DATA FETCHING ---
  const { data: dashboardData, isLoading: isStatsLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["quality-dashboard-stats"],
    queryFn: async () => (await api.get("/crm/quality/dashboard")).data,
    refetchInterval: 10000 // 10s live sync
  });

  const { data: workOrders } = useQuery({
    queryKey: ["quality-wo-dropdown"],
    queryFn: async () => (await api.get("/crm/production/work-orders")).data?.orders || []
  });

  const { data: paxPacks } = useQuery({
    queryKey: ["quality-pax-dropdown"],
    queryFn: async () => (await api.get("/pax/all")).data?.packs || []
  });

  // --- MUTATIONS ---
  const createDefectMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/quality/defects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-dashboard-stats"] });
      toast.success("Defect recorded in Quality Registry");
      setIsDefectOpen(false);
      resetDefectForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Defect reporting failed");
    }
  });

  const resetDefectForm = () => {
    setDefectWOId("");
    setDefectPaxSerial("");
    setDefectType("Cell Imbalance");
    setSeverity("MEDIUM");
    setDescription("");
    setDisposition("REWORK");
  };

  const stats = dashboardData?.stats || {
    cellQcPending: 0,
    cellQcApproved: 0,
    paxQcPending: 0,
    paxQcApproved: 0,
    activeDefects: 0
  };

  const recentInspections = dashboardData?.recentInspections || [];
  const activeDefects = dashboardData?.activeDefects || [];

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-10">
      
      {/* ========================================================
          1. HEADER SECTION (QUALITY CONTROL CENTER)
          ======================================================== */}
      <PageHeader
        title="Quality Control Center"
        subtitle="Authoritative quality gate workspace for Cell QC Approval and PAX Final QC Release"
        icon={<ShieldCheck className="w-5 h-5 text-indigo-600" />}
        breadcrumbs={
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Gate Active
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsDefectOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 font-bold text-xs hover:bg-rose-50 transition-all shadow-xs cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Log Defect
            </button>
            <button
              onClick={() => refetchDashboard()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] border border-[#D8E8FA] hover:border-[#0878F9]/30 text-[#526B91] hover:text-[#0878F9] font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        }
      />

      {/* ========================================================
          2. TOP 5 AUTHORITATIVE QUALITY KPIS
          ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            label: "CELL QC PENDING",
            value: stats.cellQcPending,
            unit: "Cells",
            color: stats.cellQcPending > 0 ? "text-amber-600" : "text-slate-800",
            bg: "bg-amber-50/70 border-amber-200",
            icon: Zap
          },
          {
            label: "CELL QC APPROVED",
            value: stats.cellQcApproved,
            unit: "Cells",
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200",
            icon: CheckCircle2
          },
          {
            label: "PAX QC PENDING",
            value: stats.paxQcPending,
            unit: "PAX Packs",
            color: stats.paxQcPending > 0 ? "text-blue-600" : "text-slate-800",
            bg: "bg-blue-50/70 border-blue-200",
            icon: Package
          },
          {
            label: "PAX QC APPROVED",
            value: stats.paxQcApproved,
            unit: "PAX Packs",
            color: "text-emerald-700",
            bg: "bg-emerald-50/70 border-emerald-200",
            icon: ShieldCheck
          },
          {
            label: "ACTIVE DEFECTS",
            value: stats.activeDefects,
            unit: "Open Tickets",
            color: stats.activeDefects > 0 ? "text-rose-600" : "text-slate-800",
            bg: stats.activeDefects > 0 ? "bg-rose-50/70 border-rose-200" : "bg-slate-50 border-slate-200",
            icon: AlertTriangle
          }
        ].map((kpi, idx) => (
          <div key={idx} className={`p-5 rounded-2xl border ${kpi.bg} bg-white flex flex-col justify-between shadow-xs`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#526B91] uppercase tracking-widest">{kpi.label}</span>
              <kpi.icon className="w-4 h-4 text-[#526B91]" />
            </div>
            <div className="mt-3">
              <span className={`text-3xl font-display font-black ${kpi.color}`}>
                {isStatsLoading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : kpi.value.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#526B91] ml-1.5 uppercase font-semibold">{kpi.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================
          3. PROMINENT 2 QUALITY GATE APPROVAL QUEUES
          ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gate 1 Card: Cell QC Pending */}
        <div className="bg-white border-2 border-amber-200/80 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-900 uppercase tracking-wide">
                    GATE 1: CELL QC APPROVAL
                  </h2>
                  <p className="text-xs text-[#526B91]">Tested physical cells waiting for QC authorization</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                {stats.cellQcPending} Pending
              </span>
            </div>

            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-baseline justify-between">
              <div>
                <p className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Awaiting QC Review</p>
                <p className="text-3xl font-display font-black text-amber-700 mt-0.5">
                  {stats.cellQcPending} <span className="text-xs font-semibold text-[#526B91]">cells ready</span>
                </p>
              </div>
              <p className="text-[11px] text-[#526B91] text-right">
                Tested ≠ Approved<br />
                <span className="font-semibold text-amber-800">Required before Assembly</span>
              </p>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => router.push(`/${roleSlug}/cells`)}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md active:scale-98"
            >
              <span>REVIEW CELLS QUEUE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gate 2 Card: PAX QC Pending */}
        <div className="bg-white border-2 border-blue-200/80 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-slate-900 uppercase tracking-wide">
                    GATE 2: PAX QC APPROVAL
                  </h2>
                  <p className="text-xs text-[#526B91]">Assembled battery packs waiting for final QC release</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 uppercase">
                {stats.paxQcPending} Pending
              </span>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-baseline justify-between">
              <div>
                <p className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Awaiting Final Release</p>
                <p className="text-3xl font-display font-black text-blue-700 mt-0.5">
                  {stats.paxQcPending} <span className="text-xs font-semibold text-[#526B91]">packs ready</span>
                </p>
              </div>
              <p className="text-[11px] text-[#526B91] text-right">
                Tested ≠ QC Approved<br />
                <span className="font-semibold text-blue-800">Required before Release</span>
              </p>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => router.push(`/${roleSlug}/pax`)}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-md active:scale-98"
            >
              <span>REVIEW PAX QUEUE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================
          4. RECENT QUALITY INSPECTIONS (CELL QC & PAX QC) & DEFECTS
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8): Recent Quality Inspections Stream */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-display font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Recent Quality Inspections & Gate Sign-offs
              </h3>
              <p className="text-xs text-[#526B91] mt-0.5">Continuous dual-gate quality audit trail</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-[#526B91]">Live Dual Gate</span>
            </div>
          </div>

          {recentInspections.length === 0 ? (
            <div className="p-12 text-center text-[#526B91] text-xs">
              No recent inspections recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[#526B91] uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 font-extrabold">Inspection ID</th>
                    <th className="py-2.5 px-3 font-extrabold">Gate / Object</th>
                    <th className="py-2.5 px-3 font-extrabold">Serial Number</th>
                    <th className="py-2.5 px-3 font-extrabold">Result</th>
                    <th className="py-2.5 px-3 font-extrabold">Inspector</th>
                    <th className="py-2.5 px-3 font-extrabold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInspections.map((insp: any, idx: number) => {
                    const isCell = insp.type === "CELL";
                    const isPass = insp.result === "PASS" || insp.result === "TESTED";
                    const isFail = insp.result === "FAIL";
                    const isRetest = insp.result === "RETEST";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {insp.inspectionNumber}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isCell 
                              ? "bg-amber-100 text-amber-800 border border-amber-200" 
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}>
                            {isCell ? "CELL QC" : "PAX QC"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 font-semibold">
                          {insp.serial}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isPass ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                            isRetest ? "bg-amber-100 text-amber-800 border border-amber-200" :
                            "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}>
                            {insp.result}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#526B91] font-medium">
                          {insp.inspector}
                        </td>
                        <td className="py-3 px-3 text-[#526B91] font-mono text-[11px]">
                          {new Date(insp.timestamp).toLocaleString("en-US", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (4): Active Defects Registry */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-display font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Active Defects Registry
              </h3>
              <p className="text-xs text-[#526B91] mt-0.5">Live open non-conformance records</p>
            </div>
            <button
              onClick={() => router.push(`/${roleSlug}/reports/defects`)}
              className="text-[10px] font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>

          {activeDefects.length === 0 ? (
            <div className="p-10 text-center text-[#526B91] text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              No active defects logged.
            </div>
          ) : (
            <div className="space-y-3">
              {activeDefects.map((def: any) => (
                <div key={def.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-800">{def.defectNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      def.severity === "CRITICAL" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                      def.severity === "HIGH" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                      "bg-slate-200 text-slate-700"
                    }`}>
                      {def.severity}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 line-clamp-1">{def.description}</p>

                  <div className="flex items-center justify-between text-[10px] text-[#526B91] font-medium">
                    <span>Target: <span className="font-mono text-slate-700">{def.paxSerial || "Cell Item"}</span></span>
                    <span className="text-indigo-600 font-bold uppercase">{def.disposition || "REWORK"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================
          5. LOG DEFECT MODAL DIALOG
          ======================================================== */}
      <AnimatePresence>
        {isDefectOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F4F9FF] backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-base text-slate-900">Log Quality Defect Ticket</h3>
                </div>
                <button 
                  onClick={() => setIsDefectOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#526B91]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target PAX Pack Serial (Optional)</label>
                  <select
                    value={defectPaxSerial}
                    onChange={(e) => setDefectPaxSerial(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono"
                  >
                    <option value="">-- Standalone / Cell Defect --</option>
                    {paxPacks.map((p: any) => (
                      <option key={p.paxSerial} value={p.paxSerial}>
                        {p.paxSerial} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Associated Work Order (Optional)</label>
                  <select
                    value={defectWOId}
                    onChange={(e) => setDefectWOId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  >
                    <option value="">-- Select Work Order --</option>
                    {workOrders.map((wo: any) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.workOrderNumber} ({wo.productRef || "Pack"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Defect Type</label>
                    <input
                      type="text"
                      value={defectType}
                      onChange={(e) => setDefectType(e.target.value)}
                      placeholder="e.g. Voltage Discrepancy"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Severity</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Proposed Disposition Action</label>
                  <select
                    value={disposition}
                    onChange={(e) => setDisposition(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  >
                    <option value="REWORK">REWORK (Assembly Correction)</option>
                    <option value="REPAIR">REPAIR (Component Replacement)</option>
                    <option value="HOLD">HOLD (Investigation Required)</option>
                    <option value="SCRAP">SCRAP (Material Disassembly & Reclaim)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Defect Description & Root Cause</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide non-conformance details..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setIsDefectOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#526B91] font-semibold hover:bg-slate-100 text-xs"
                >
                  Cancel
                </button>
                <button
                  disabled={createDefectMutation.isPending || !description.trim()}
                  onClick={() => {
                    createDefectMutation.mutate({
                      workOrderId: defectWOId || undefined,
                      paxSerial: defectPaxSerial || undefined,
                      defectType,
                      severity,
                      description,
                      disposition
                    });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {createDefectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Defect Ticket
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
