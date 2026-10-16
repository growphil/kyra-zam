"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  FileText,
  TrendingUp,
  Activity,
  Layers,
  Archive,
  ShieldCheck,
  Cpu,
  Box,
  CheckCircle
} from "lucide-react";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ProductionExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = params.role as string;

  // Selected date defaults to today
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Selected Work Order Scheduling ID for execution details panel
  const [selectedSchedId, setSelectedSchedId] = useState<string | null>(null);

  // Dialog Modals state (Supervisor only controls START & PAUSE)
  const [modalType, setModalType] = useState<"START" | "PAUSE" | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedStationId, setSelectedStationId] = useState<string>("");

  const adjustDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
    setSelectedSchedId(null);
  };

  // --- QUERY: Execution Dashboard Data ---
  const { data: dashboard = { ready: [], inProgress: [], paused: [], completed: [] }, isLoading, refetch } = useQuery({
    queryKey: ["execution-dashboard", selectedDate],
    queryFn: async () => (await api.get(`/crm/production/execution/dashboard?date=${selectedDate}`)).data
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => (await api.get("/crm/stations")).data
  });

  const activeStations = stations.filter((s: any) => s.isActive);

  // Flat array of all scheduled items for selection lookup
  const allScheduledItems = [
    ...dashboard.ready,
    ...dashboard.inProgress,
    ...dashboard.paused,
    ...dashboard.completed
  ];

  const selectedItem = allScheduledItems.find(item => item.id === selectedSchedId);
  const selectedWo = selectedItem?.workOrder;
  const selectedExec = selectedWo?.execution;

  const startMutation = useMutation({
    mutationFn: async ({ woId, stationId }: { woId: string; stationId: string }) => {
      return (await api.post(`/crm/production/work-orders/${woId}/start`, { stationId })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-dashboard", selectedDate] });
      setModalType(null);
      setSelectedStationId("");
      setErrorMessage("");
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || "Failed to start Work Order");
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async ({ woId, reason }: { woId: string; reason: string }) => {
      return (await api.post(`/crm/production/work-orders/${woId}/pause`, { reason })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-dashboard", selectedDate] });
      setModalType(null);
      setPauseReason("");
      setErrorMessage("");
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || "Failed to pause Work Order");
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async (woId: string) => (await api.post(`/crm/production/work-orders/${woId}/resume`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-dashboard", selectedDate] });
      setErrorMessage("");
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || "Failed to resume Work Order");
    }
  });

  const handleActionClick = (action: "START" | "PAUSE" | "RESUME") => {
    if (!selectedWo) return;
    setErrorMessage("");

    if (action === "START") {
      setModalType("START");
      const active = stations.find((s: any) => s.isActive);
      if (active) setSelectedStationId(active.id);
    } else if (action === "RESUME") {
      resumeMutation.mutate(selectedWo.id);
    } else if (action === "PAUSE") {
      setModalType("PAUSE");
    }
  };

  const handleConfirmModal = () => {
    if (!selectedWo) return;
    if (modalType === "START") {
      if (!selectedStationId) {
        setErrorMessage("Please select a production station.");
        return;
      }
      startMutation.mutate({ woId: selectedWo.id, stationId: selectedStationId });
    } else if (modalType === "PAUSE") {
      if (!pauseReason.trim()) {
        setErrorMessage("A valid pause reason is required.");
        return;
      }
      pauseMutation.mutate({ woId: selectedWo.id, reason: pauseReason });
    }
  };

  // Downstream status derivation for selected Work Order
  const pctrs = selectedWo?.cellTestingRequirements || [];
  const totalCellsReq = pctrs.reduce((acc: number, r: any) => acc + (r.requiredQuantity || 0), 0);
  const totalCellsTested = pctrs.reduce((acc: number, r: any) => acc + (r.testedQuantity || 0), 0);
  const isCellTestingComplete = pctrs.length > 0 && pctrs.every((r: any) => r.status === "COMPLETED");

  const packs = selectedWo?.packs || [];
  const isAssemblyComplete = packs.length > 0 && packs.length >= (selectedWo?.plannedQuantity || 1);
  const isPaxTested = packs.length > 0 && packs.every((p: any) => ["PAX_TESTED", "READY_FOR_SALE", "COMPLETED"].includes(p.status));
  const isQcPassed = packs.length > 0 && packs.every((p: any) => p.status === "READY_FOR_SALE" || p.inspections?.some((i: any) => i.inspectionType === "FINAL" && i.result === "PASS"));
  const isCompletedAuto = selectedWo?.status === "COMPLETED" || selectedWo?.status === "CLOSED";

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto text-[#0B2148] pb-8">
      
      {/* Header Panel */}
      <PageHeader
        title="Production Execution"
        subtitle="Shopfloor Run Queue & Supervisor Execution Cockpit (START / PAUSE / RESUME)"
        icon={<Activity className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            {/* Date Navigator */}
            <div className="flex items-center gap-1.5 bg-white border border-[#D8E8FA] p-1 rounded-xl shadow-xs">
              <button 
                onClick={() => adjustDate(-1)} 
                className="p-1.5 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              
              <div className="flex items-center gap-1.5 px-2 font-semibold text-xs text-[#0B2148] select-none">
                <CalendarIcon className="w-3.5 h-3.5 text-[#0878F9]" />
                <span>{selectedDate}</span>
              </div>

              <button 
                onClick={() => adjustDate(1)} 
                className="p-1.5 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer"
                title="Next Day"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <button 
              onClick={() => refetch()}
              className="text-xs font-bold text-[#0878F9] px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAF5FF] border border-[#D8E8FA] hover:border-[#0878F9]/30 transition-all cursor-pointer shadow-xs"
            >
              Refresh
            </button>
          </div>
        }
      />

      {/* Execution Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Ready to Start", value: dashboard.ready.length, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "In Progress", value: dashboard.inProgress.length, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Paused Runs", value: dashboard.paused.length, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Finished / QC", value: dashboard.completed.length, color: "text-[#166534]", bg: "bg-emerald-500/10" }
        ].map(stat => (
          <div key={stat.label} className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white">
            <p className="text-[#526B91] text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
            <div className="flex justify-between items-end mt-4">
              <h4 className={`text-4xl font-display font-bold ${stat.color}`}>{stat.value}</h4>
              <span className={`w-8 h-8 rounded-full ${stat.bg} flex items-center justify-center`}>
                <div className={`w-2 h-2 rounded-full ${stat.color.replace('text', 'bg')}`} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Workspace split */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-24 gap-4">
          <Loader2 className="w-12 h-12 text-accent animate-spin" />
          <p className="text-sm text-[#526B91] font-display">Loading run queues...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Scheduled run lists */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h2 className="text-base font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Schedule Priority List
              </h2>
              
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {allScheduledItems.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-[#D8E8FA] rounded-2xl text-[#526B91]">
                    <p className="text-sm">No work orders scheduled for this date.</p>
                    <p className="text-[10px] uppercase font-bold mt-1 text-[#526B91]">Scheduler must assign sequences first</p>
                  </div>
                ) : (
                  allScheduledItems.map((item: any) => {
                    const wo = item.workOrder || {};
                    const isSelected = item.id === selectedSchedId;
                    return (
                      <div 
                        key={item.id}
                        onClick={() => { setSelectedSchedId(item.id); setErrorMessage(""); }}
                        className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-4 ${
                          isSelected 
                            ? "bg-accent/10 border-accent/50 shadow-md" 
                            : "bg-white/[0.03] border-[#D8E8FA] hover:border-[#D8E8FA]"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-center font-bold text-xs">
                            {item.sequence}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#0B2148]">{wo.workOrderNumber}</p>
                            <p className="text-[10px] text-[#526B91] mt-0.5">Product: {wo.productRef || "BOM Assembly"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                            wo.status === "IN_PROGRESS" 
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : wo.status === "ON_HOLD"
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : ["QC_PENDING", "COMPLETED", "CLOSED"].includes(wo.status)
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-500/10 border-slate-500/20 text-[#526B91]"
                          }`}>
                            {wo.status === "ON_HOLD" ? "PAUSED" : wo.status}
                          </span>
                          <span className="text-[10px] font-semibold text-[#526B91]">{item.estimatedHrs} Hrs</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Detailed Control Panel */}
          <div className="lg:col-span-5">
            {selectedWo ? (
              <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-[#0B2148]">{selectedWo.workOrderNumber}</h3>
                    <button 
                      onClick={() => router.push(`/${roleSlug}/production/work-orders/${selectedWo.id}`)}
                      className="text-[10px] font-bold uppercase text-accent hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Details
                    </button>
                  </div>
                  <p className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider mt-1">Supervisor Shopfloor Controls</p>
                </div>

                {/* KPI stats Grid */}
                <div className="grid grid-cols-2 gap-4 bg-[#F4F9FF] p-4 rounded-2xl border border-[#D8E8FA] text-xs">
                  <div>
                    <span className="text-[#526B91] font-semibold">Priority</span>
                    <p className="font-bold text-[#0B2148] mt-0.5">{selectedWo.priority || "NORMAL"}</p>
                  </div>
                  <div>
                    <span className="text-[#526B91] font-semibold">Estimated Hrs</span>
                    <p className="font-bold text-accent mt-0.5">{selectedItem?.estimatedHrs} Hrs</p>
                  </div>
                  <div>
                    <span className="text-[#526B91] font-semibold">Planned Qty</span>
                    <p className="font-bold text-[#0B2148] mt-0.5">{selectedWo.plannedQuantity} Units</p>
                  </div>
                  <div>
                    <span className="text-[#526B91] font-semibold">Actual Run Time</span>
                    <p className="font-bold text-[#166534] mt-0.5">
                      {selectedExec?.actualHours ? selectedExec.actualHours.toFixed(2) : "0.00"} Hrs
                    </p>
                  </div>
                </div>

                {/* Started and Paused logs summary */}
                {(selectedExec?.startedAt || selectedExec?.pausedAt) && (
                  <div className="space-y-2 text-xs border-t border-[#D8E8FA] pt-4">
                    {selectedExec.startedAt && (
                      <div className="flex justify-between text-[#526B91]">
                        <span>Started At:</span>
                        <span className="font-bold text-[#0B2148]">{new Date(selectedExec.startedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedExec.pausedAt && (
                      <div className="flex flex-col bg-red-500/5 border border-red-500/10 p-3 rounded-xl gap-1.5 mt-2">
                        <div className="flex justify-between text-red-400">
                          <span>Paused At:</span>
                          <span className="font-bold">{new Date(selectedExec.pausedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-[#526B91]"><strong className="text-red-300">Reason:</strong> {selectedExec.pauseReason}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Downstream Production Gates Progress Monitor */}
                <div className="border-t border-[#D8E8FA] pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    Downstream Production Workflow Gates
                  </h4>

                  <div className="space-y-2 text-xs">
                    {/* 1. Cell Testing */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        <span className="font-medium text-[#0B2148]">Cell Testing (PCTR)</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isCellTestingComplete ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {pctrs.length > 0 ? `${totalCellsTested} / ${totalCellsReq} Qualified ${isCellTestingComplete ? '✓' : ''}` : 'Pending Handoff'}
                      </span>
                    </div>

                    {/* 2. PAX Assembly */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-amber-400" />
                        <span className="font-medium text-[#0B2148]">PAX Assembly</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isAssemblyComplete ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-[#526B91]'}`}>
                        {packs.length > 0 ? `${packs.length} Assembled ${isAssemblyComplete ? '✓' : ''}` : 'Awaiting Assembly'}
                      </span>
                    </div>

                    {/* 3. PAX Testing */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-[#0B2148]">PAX Testing</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isPaxTested ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-[#526B91]'}`}>
                        {isPaxTested ? 'Passed ✓' : packs.length > 0 ? 'Testing Pending' : 'Awaiting Assembly'}
                      </span>
                    </div>

                    {/* 4. Final QC */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#166534]" />
                        <span className="font-medium text-[#0B2148]">Final QC Inspection</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isQcPassed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-[#526B91]'}`}>
                        {isQcPassed ? 'Passed ✓' : 'Awaiting Final QC'}
                      </span>
                    </div>
                  </div>

                  {/* Auto-completion status explanation */}
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed">
                    {isCompletedAuto ? (
                      <span className="text-[#166534] font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Work Order completed automatically via Final QC PASS.
                      </span>
                    ) : (
                      <span>
                        <strong>System Rule:</strong> Supervisor controls START, PAUSE & RESUME. Work Order completion is system-driven and closes automatically once downstream Cell Testing, Assembly, PAX Testing, and Final QC pass.
                      </span>
                    )}
                  </div>
                </div>

                {/* Supervisor Operations Buttons (START / PAUSE / RESUME ONLY) */}
                <div className="space-y-3 border-t border-[#D8E8FA] pt-6">
                  {selectedWo.status === "READY" && (
                    <button 
                      onClick={() => handleActionClick("START")}
                      disabled={startMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent hover:bg-accent/80 font-bold text-xs text-white transition-colors shadow-lg"
                    >
                      {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      START RUN
                    </button>
                  )}

                  {selectedWo.status === "IN_PROGRESS" && (
                    <button 
                      onClick={() => handleActionClick("PAUSE")}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                      PAUSE RUN
                    </button>
                  )}

                  {selectedWo.status === "ON_HOLD" && (
                    <button 
                      onClick={() => handleActionClick("RESUME")}
                      disabled={resumeMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-600 font-bold text-xs text-white transition-colors"
                    >
                      {resumeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      RESUME RUN
                    </button>
                  )}

                  {["QC_PENDING", "COMPLETED", "CLOSED", "CANCELLED"].includes(selectedWo.status) && (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-center text-xs text-[#166534] font-bold">
                      Execution phase active control completed. Current Status: {selectedWo.status}
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel p-16 rounded-3xl border border-[#D8E8FA] bg-white text-center text-[#526B91] text-xs">
                Select a Work Order from the schedule grid to manage its running state.
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal Dialog overlay for Start / Pause */}
      {modalType && selectedWo && (
        <div className="fixed inset-0 bg-[#061B3A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E8FA] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-[#0B2148]">
              {modalType === "START" ? "Start Production Run" : "Pause Production Run"}
            </h3>

            {modalType === "START" ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Select Production Station *</label>
                {activeStations.length === 0 ? (
                  <div className="text-xs text-red-500 font-medium">No active production stations configured. Please contact an Administrator.</div>
                ) : (
                  <select
                    value={selectedStationId}
                    onChange={(e) => setSelectedStationId(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl px-4 py-3 text-[#0B2148] text-sm focus:outline-none focus:border-accent/40"
                  >
                    <option value="" disabled>-- Select Station --</option>
                    {activeStations.map((s: any) => (
                      <option key={s.id} value={s.id} className="bg-white text-[#0B2148]">
                        {s.name} ({s.code}) - {s.type}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Pause Reason *</label>
                <textarea 
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="E.g., Component shortage, machine calibration required..."
                  rows={3}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl px-4 py-3 text-[#0B2148] text-sm focus:outline-none focus:border-accent/40"
                />
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => { setModalType(null); setPauseReason(""); setErrorMessage(""); setSelectedStationId(""); }}
                className="px-4 py-2.5 rounded-2xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmModal}
                disabled={startMutation.isPending || pauseMutation.isPending}
                className="px-5 py-2.5 rounded-2xl bg-[#0878F9] hover:bg-[#0878F9]/90 text-white text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {(startMutation.isPending || pauseMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
