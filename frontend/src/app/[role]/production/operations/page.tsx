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
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Zap,
  UserCheck,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  ShieldAlert,
  X
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// Normalized Work Order Interface for Operations
export interface WorkOrderOperationalItem {
  id: string;
  workOrderId?: string;
  workOrderNumber: string;
  productRef: string;
  sequence?: number;
  plannedQuantity: number;
  priority?: string;
  status: string;
  estimatedHours: number;
  actualHours: number;
  assignedDate?: string;
  startedAt?: string | null;
  pausedAt?: string | null;
  completedAt?: string | null;
  pauseReason?: string | null;
  isOverdue?: boolean;
  qcStatus?: string;
  isAssignedToUser?: boolean;
  stationName?: string | null;
  stationCode?: string | null;
  technicians?: string[];
  progressState?: string;
  varianceHours?: number;
  cellTestingRequirements?: any[];
}

// Helper to safely extract a valid non-empty Work Order ID
function getWorkOrderId(wo: any): string | null {
  if (!wo) return null;
  const rawId = wo.id || wo.workOrderId;
  if (typeof rawId === "string" && rawId.trim().length > 0 && rawId !== "undefined" && rawId !== "null") {
    return rawId.trim();
  }
  return null;
}

// Live Ticking Timer Component
function LiveExecutionTimer({ startedAt, resumedAt, actualHoursBase, isRunning }: { startedAt?: string | null; resumedAt?: string | null; actualHoursBase: number; isRunning: boolean }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const calculateSeconds = () => {
      const baseSec = (actualHoursBase || 0) * 3600;
      if (!isRunning || (!startedAt && !resumedAt)) {
        return Math.floor(baseSec);
      }
      const refTime = new Date(resumedAt || startedAt || Date.now()).getTime();
      const currentSessionSec = Math.max(0, Math.floor((Date.now() - refTime) / 1000));
      return Math.floor(baseSec + currentSessionSec);
    };

    setElapsedSeconds(calculateSeconds());

    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds(calculateSeconds());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, resumedAt, actualHoursBase, isRunning]);

  const hrs = Math.floor(elapsedSeconds / 3600);
  const mins = Math.floor((elapsedSeconds % 3600) / 60);
  const secs = elapsedSeconds % 60;

  const paddedHrs = hrs.toString().padStart(2, "0");
  const paddedMins = mins.toString().padStart(2, "0");
  const paddedSecs = secs.toString().padStart(2, "0");

  return (
    <span className="font-mono text-xl md:text-2xl font-black tracking-wider text-accent">
      {paddedHrs}:{paddedMins}:{paddedSecs}
    </span>
  );
}

// Due date urgency classification helper
function getDueDateUrgency(dueDateStr?: string) {
  if (!dueDateStr) return { label: "NO DUE DATE", color: "text-[#526B91] border-slate-700 bg-slate-800/40" };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (diffDays < 0) {
    return { label: `OVERDUE (${formatted})`, color: "text-red-400 border-red-500/30 bg-red-500/10" };
  } else if (diffDays === 0) {
    return { label: `DUE TODAY (${formatted})`, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
  } else if (diffDays === 1) {
    return { label: `DUE TOMORROW (${formatted})`, color: "text-sky-400 border-sky-500/30 bg-sky-500/10" };
  } else {
    return { label: `DUE ${formatted}`, color: "text-[#0B2148] border-slate-700 bg-slate-800/40" };
  }
}

export default function ProductionOperationsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = params.role as string;
  const isTechnicianRole = roleSlug === "assembly-technician";

  // Selected date defaults to today
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Filter toggle for technician: "ALL" vs "MY_ASSIGNED"
  const [queueScope, setQueueScope] = useState<"ALL" | "MY_ASSIGNED">("ALL");

  // Dialog Modals state
  const [modalType, setModalType] = useState<"START" | "PAUSE" | null>(null);
  const [activeWo, setActiveWo] = useState<WorkOrderOperationalItem | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [pauseReason, setPauseReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const adjustDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const closeAllModals = () => {
    setModalType(null);
    setActiveWo(null);
    setPauseReason("");
  };

  // Auto-dismiss success toast after 5 seconds
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Role Scope Guard: Assembly Technicians operate in the PAX Assembly Workspace
  useEffect(() => {
    if (isTechnicianRole) {
      router.replace(`/${roleSlug}/pax/create`);
    }
  }, [isTechnicianRole, roleSlug, router]);

  if (isTechnicianRole) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4 text-white">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="text-sm text-[#526B91] font-display">Redirecting to PAX Assembly Workspace...</p>
      </div>
    );
  }

  // --- QUERY: Operations Dashboard Data (Auto-refreshes every 30s) ---
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["operations-dashboard", selectedDate],
    queryFn: async () => (await api.get(`/crm/production/operations/dashboard?date=${selectedDate}`)).data,
    refetchInterval: 30000 // 30s live poll
  });

  // --- MUTATIONS WITH DEFENSIVE URL GUARDS ---
  const startMutation = useMutation({
    mutationFn: async ({ woId, stationId }: { woId: string; stationId?: string }) => {
      if (!woId || typeof woId !== "string" || !woId.trim() || woId === "undefined" || woId === "null") {
        throw new Error("Work Order ID is required to start production");
      }
      return (await api.post(`/crm/production/work-orders/${encodeURIComponent(woId.trim())}/start`, { stationId })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard", selectedDate] });
      const woNum = activeWo?.workOrderNumber || "Work Order";
      closeAllModals();
      setErrorMessage("");
      setSuccessToast(`${woNum} started successfully.`);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || err.message || "Failed to start Work Order");
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async ({ woId, reason }: { woId: string; reason: string }) => {
      if (!woId || typeof woId !== "string" || !woId.trim() || woId === "undefined" || woId === "null") {
        throw new Error("Work Order ID is required to pause production");
      }
      return (await api.post(`/crm/production/work-orders/${encodeURIComponent(woId.trim())}/pause`, { reason })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard", selectedDate] });
      const woNum = activeWo?.workOrderNumber || "Work Order";
      closeAllModals();
      setErrorMessage("");
      setSuccessToast(`${woNum} paused.`);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || err.message || "Failed to pause Work Order");
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async (woId: string) => {
      if (!woId || typeof woId !== "string" || !woId.trim() || woId === "undefined" || woId === "null") {
        throw new Error("Work Order ID is required to resume production");
      }
      return (await api.post(`/crm/production/work-orders/${encodeURIComponent(woId.trim())}/resume`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations-dashboard", selectedDate] });
      setErrorMessage("");
      setSuccessToast("Work Order resumed successfully.");
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || err.message || "Failed to resume Work Order");
    }
  });

  const handleAction = (action: "START" | "PAUSE" | "RESUME", wo: any) => {
    setErrorMessage("");
    const validId = getWorkOrderId(wo);
    if (!validId) {
      setErrorMessage("Unable to identify the Work Order. Please refresh the page and try again.");
      return;
    }

    const normalizedWo: WorkOrderOperationalItem = {
      id: validId,
      workOrderId: validId,
      workOrderNumber: wo.workOrderNumber || "Unknown WO",
      productRef: wo.productRef || "Unknown Product",
      plannedQuantity: typeof wo.plannedQuantity === "number" ? wo.plannedQuantity : 1,
      status: wo.status || "IN_PROGRESS",
      estimatedHours: wo.estimatedHours || 0,
      actualHours: wo.actualHours || 0,
      sequence: wo.sequence,
      priority: wo.priority
    };

    setActiveWo(normalizedWo);

    if (action === "START") {
      const availableStations = data?.stations?.filter((s: any) => s.isActive) || [];
      if (availableStations.length > 0) {
        setSelectedStationId(data?.currentStation?.id || availableStations[0]?.id || "");
        setModalType("START");
      } else {
        startMutation.mutate({ woId: validId });
      }
    } else if (action === "RESUME") {
      resumeMutation.mutate(validId);
    } else if (action === "PAUSE") {
      setPauseReason("");
      setModalType("PAUSE");
    }
  };

  const handleConfirmModal = () => {
    if (!activeWo) {
      setErrorMessage("No Work Order selected.");
      return;
    }
    const validId = getWorkOrderId(activeWo);
    if (!validId) {
      setErrorMessage("Unable to process this Work Order because its identifier is missing. Please refresh and try again.");
      return;
    }

    if (modalType === "START") {
      startMutation.mutate({ woId: validId, stationId: selectedStationId || undefined });
    } else if (modalType === "PAUSE") {
      if (!pauseReason.trim()) {
        setErrorMessage("A valid pause reason is required.");
        return;
      }
      pauseMutation.mutate({ woId: validId, reason: pauseReason });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4 text-white">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <p className="text-sm text-[#526B91] font-display">Loading operations command center...</p>
      </div>
    );
  }

  const summary = data?.summary || { 
    scheduled: 0, 
    ready: 0, 
    inProgress: 0, 
    paused: 0, 
    qcPending: 0, 
    completed: 0, 
    overdue: 0,
    myScheduled: 0,
    myReady: 0,
    myInProgress: 0,
    myPaused: 0,
    myQcPending: 0,
    myCompleted: 0,
    myOverdue: 0
  };
  
  const currentRun = data?.currentRun || null;
  const dataIntegrityWarnings = data?.dataIntegrityWarnings || [];
  const rawQueue = data?.queue || [];
  const bottlenecks = data?.bottlenecks || [];
  const performance = data?.performance || { plannedHours: 0, actualHours: 0, varianceHours: 0, completedCount: 0, averageActualHours: 0, averageVarianceHours: 0 };
  const stations = data?.stations || [];

  // Filter queue by scope if technician view
  const displayQueue = queueScope === "MY_ASSIGNED" 
    ? rawQueue.filter((item: any) => item.isAssignedToUser)
    : rawQueue;

  // Find next eligible ready Work Order if no active run
  const nextReadyWo = rawQueue.find((item: any) => item.status === "READY");

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1700px] mx-auto text-white">
      
      {/* ========================================================
          1. HEADER SECTION & NAVIGATION
          ======================================================== */}
      <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-[#D8E8FA] relative overflow-hidden bg-white shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center text-accent ring-1 ring-accent/50 shadow-inner">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-[#0B2148]">
                  Production Operations Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Live Shopfloor Execution
                </span>
              </div>
              <p className="text-xs md:text-sm text-[#526B91] mt-1 font-medium">
                {isTechnicianRole 
                  ? "Assembly Technician Workstation · Start, pause, resume, and complete active production runs."
                  : "Shopfloor Supervisor Control Center · Live queue execution and bottleneck tracking."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-[#F4F9FF] border border-[#D8E8FA] p-2 rounded-2xl shadow-inner">
            <button 
              onClick={() => router.push(`/${roleSlug}/production/scheduler`)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-semibold text-xs border border-[#D8E8FA] transition-all active:scale-95"
            >
              <CalendarIcon className="w-4 h-4 text-accent" />
              Scheduler View
            </button>

            <div className="flex items-center gap-1.5 bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA]">
              <button 
                onClick={() => adjustDate(-1)}
                className="p-2 hover:bg-[#EAF5FF] rounded-lg text-[#526B91] hover:text-white transition-colors"
                title="Previous Day"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-2.5 text-[#0B2148]">{selectedDate}</span>
              <button 
                onClick={() => adjustDate(1)}
                className="p-2 hover:bg-[#EAF5FF] rounded-lg text-[#526B91] hover:text-white transition-colors"
                title="Next Day"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => refetch()}
              className="p-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] border border-[#D8E8FA] rounded-xl transition-all active:scale-95"
              title="Refresh live floor data"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-accent" : ""}`} />
            </button>
          </div>

        </div>
      </div>

      {/* Success Toast Banner */}
      {successToast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-[#166534] text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-[#166534] flex-shrink-0" />
            <span className="font-bold text-emerald-200">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-[#166534] hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Message Box */}
      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3 text-red-300 text-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-200">Operation Error</p>
            <p className="text-red-300/80 mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-xs text-red-400 hover:text-white font-bold uppercase">
            Dismiss
          </button>
        </div>
      )}

      {/* Data Integrity Warning Banner */}
      {dataIntegrityWarnings.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-300">⚠ Data Integrity Notice</p>
            {dataIntegrityWarnings.map((w: any, idx: number) => (
              <p key={idx} className="text-amber-200/80 mt-0.5">
                Work Order <strong className="text-white">{w.workOrderNumber}</strong>: {w.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          2. KPI SUMMARY OPERATIONAL CARDS
          ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {[
          { 
            label: isTechnicianRole ? "Scheduled Today" : "Scheduled Today", 
            value: isTechnicianRole ? summary.myScheduled : summary.scheduled, 
            unit: "WO",
            color: "text-[#0B2148]", 
            border: "border-slate-500/10" 
          },
          { 
            label: "Ready to Start", 
            value: isTechnicianRole ? summary.myReady : summary.ready, 
            unit: "WO",
            color: (isTechnicianRole ? summary.myReady : summary.ready) > 0 ? "text-sky-400 font-black" : "text-[#526B91]", 
            border: "border-sky-500/20" 
          },
          { 
            label: "In Progress", 
            value: isTechnicianRole ? summary.myInProgress : summary.inProgress, 
            unit: "Active",
            color: (isTechnicianRole ? summary.myInProgress : summary.inProgress) > 0 ? "text-yellow-400 animate-pulse font-black" : "text-[#526B91]", 
            border: "border-yellow-500/20" 
          },
          { 
            label: "Paused / Hold", 
            value: isTechnicianRole ? summary.myPaused : summary.paused, 
            unit: "WO",
            color: (isTechnicianRole ? summary.myPaused : summary.paused) > 0 ? "text-orange-400 font-bold" : "text-[#526B91]", 
            border: "border-orange-500/20" 
          },
          { 
            label: "QC Pending", 
            value: isTechnicianRole ? summary.myQcPending : summary.qcPending, 
            unit: "WO",
            color: "text-purple-400", 
            border: "border-purple-500/20" 
          },
          { 
            label: "Completed", 
            value: isTechnicianRole ? summary.myCompleted : summary.completed, 
            unit: "Done",
            color: "text-[#166534]", 
            border: "border-emerald-500/20" 
          },
          { 
            label: isTechnicianRole ? "My Overdue" : "Overdue Overall", 
            value: isTechnicianRole ? summary.myOverdue : summary.overdue, 
            unit: "Alert",
            color: (isTechnicianRole ? summary.myOverdue : summary.overdue) > 0 ? "text-red-400 font-black" : "text-[#526B91]", 
            border: (isTechnicianRole ? summary.myOverdue : summary.overdue) > 0 ? "border-red-500/30 bg-red-500/5" : "border-slate-500/10" 
          }
        ].map((card, idx) => (
          <div key={idx} className={`glass-panel p-4 rounded-2xl bg-white border ${card.border} flex flex-col justify-between`}>
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">{card.label}</p>
            <div className="mt-2">
              <span className={`text-2xl font-display font-bold ${card.color}`}>{card.value}</span>
              <span className="text-[10px] text-[#526B91] ml-1.5 uppercase font-semibold">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================
          3. MAIN EXECUTION GRID AREA
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Active Run + Live Production Queue (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* ========================================================
              ACTIVE PRODUCTION RUN PANEL
              ======================================================== */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-5 shadow-lg">
            
            <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-3">
              <h3 className="text-xs font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
                <Activity className="w-4 h-4 text-yellow-400 animate-spin" />
                {isTechnicianRole ? "My Current Production Run" : "Active Production Run"}
              </h3>
              
              {currentRun && (
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  currentRun.progressState === "OVERDUE" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                  currentRun.progressState === "AT RISK" ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
                  "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}>
                  {currentRun.progressState}
                </span>
              )}
            </div>

            {/* If there is a real active IN_PROGRESS run with valid startedAt */}
            {currentRun ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                
                {/* Left Info: WO Number, Timer, Progress */}
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 
                        onClick={() => router.push(`/${roleSlug}/production/work-orders/${currentRun.id || currentRun.workOrderId}`)}
                        className="text-xl font-display font-black text-accent cursor-pointer hover:underline flex items-center gap-1.5"
                      >
                        {currentRun.workOrderNumber}
                        <ExternalLink className="w-3.5 h-3.5 text-[#526B91]" />
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 uppercase">
                        IN PROGRESS
                      </span>
                    </div>

                    <p className="text-xs text-[#0B2148] font-medium mt-1">
                      Product: {currentRun.productRef} · Qty: <strong className="text-white">{currentRun.plannedQuantity}</strong>
                    </p>
                    <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mt-0.5">
                      TIMETABLE SEQUENCE: #{currentRun.sequence}
                    </p>
                  </div>

                  {/* Live Timer & Progress Bar */}
                  <div className="p-3.5 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-[#526B91]">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        <span>Elapsed Time:</span>
                      </div>
                      <LiveExecutionTimer 
                        startedAt={currentRun.startedAt}
                        resumedAt={currentRun.resumedAt}
                        actualHoursBase={currentRun.actualHours}
                        isRunning={true}
                      />
                    </div>

                    <div className="w-full bg-[#F4F9FF] rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          currentRun.progressState === "OVERDUE" ? "bg-red-400" :
                          currentRun.progressState === "AT RISK" ? "bg-orange-400" :
                          "bg-accent"
                        }`}
                        style={{ width: `${Math.min(100, (currentRun.actualHours / (currentRun.estimatedHours || 1)) * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-[#526B91] font-mono">
                      <span>Planned Est: {currentRun.estimatedHours}h</span>
                      <span>Actual Est: {currentRun.actualHours.toFixed(2)}h</span>
                    </div>
                  </div>

                  {/* Station & Technician Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#526B91]">
                    {currentRun.stationName && (
                      <span className="flex items-center gap-1 text-[#0B2148]">
                        <Zap className="w-3 h-3 text-accent" />
                        Station: <strong className="text-white font-bold">{currentRun.stationName}</strong>
                      </span>
                    )}

                    {currentRun.technicians?.length > 0 && (
                      <span className="flex items-center gap-1 text-[#0B2148]">
                        <UserCheck className="w-3 h-3 text-[#166534]" />
                        Operator: <strong className="text-white font-bold">{currentRun.technicians.join(", ")}</strong>
                      </span>
                    )}
                  </div>

                  {/* Cell Testing Readiness for Active Run */}
                  {currentRun.cellTestingRequirements && currentRun.cellTestingRequirements.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#D8E8FA]">
                      <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Cell Testing:</span>
                      {currentRun.cellTestingRequirements.map((ctr: any) => {
                        const isDone = ctr.status === "COMPLETED" || ctr.remainingQuantity === 0;
                        return (
                          <span 
                            key={ctr.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                              isDone
                                ? "bg-emerald-500/15 border-emerald-500/30 text-[#166534]"
                                : "bg-accent/15 border-accent/30 text-accent animate-pulse"
                            }`}
                          >
                            <CheckCircle2 className={`w-3 h-3 ${isDone ? "text-[#166534]" : "text-accent"}`} />
                            <span>
                              {ctr.cellSku}: {ctr.testedQuantity}/{ctr.requiredQuantity} cells {isDone ? "(100% Qualified)" : `(${ctr.remainingQuantity} remaining)`}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Actions: Pause & Complete */}
                <div className="md:col-span-5 flex flex-col items-stretch md:items-end gap-3 border-t md:border-t-0 md:border-l border-[#D8E8FA] pt-4 md:pt-0 md:pl-6">
                  <div className="text-left md:text-right space-y-0.5">
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Duration Variance</p>
                    <p className={`text-xl font-mono font-bold ${currentRun.varianceHours > 0 ? "text-red-400" : "text-[#166534]"}`}>
                      {currentRun.varianceHours > 0 ? `+${currentRun.varianceHours.toFixed(2)}` : currentRun.varianceHours.toFixed(2)} Hrs
                    </p>
                  </div>

                  <div className="w-full">
                    <button
                      onClick={() => handleAction("PAUSE", currentRun)}
                      disabled={pauseMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500 hover:text-slate-950 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                    >
                      <Pause className="w-4 h-4" />
                      Pause Run
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              /* No Active Run State */
              <div className="p-6 border border-dashed border-[#D8E8FA] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F4F9FF]">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#0B2148] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#526B91]" />
                    No Active Production Execution
                  </p>
                  <p className="text-xs text-[#526B91]">
                    {nextReadyWo 
                      ? `Next scheduled order: ${nextReadyWo.workOrderNumber} (#${nextReadyWo.sequence}) is READY for manufacturing.`
                      : "Check the queue below or coordinate with the supervisor to schedule next Work Orders."}
                  </p>
                </div>

                {nextReadyWo && (
                  <button
                    onClick={() => handleAction("START", nextReadyWo)}
                    disabled={startMutation.isPending}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-md shrink-0 disabled:opacity-50"
                  >
                    {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Start {nextReadyWo.workOrderNumber}
                  </button>
                )}
              </div>
            )}

          </div>

          {/* ========================================================
              LIVE PRODUCTION QUEUE
              ======================================================== */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-sky-400" />
                  {queueScope === "MY_ASSIGNED" ? "My Production Queue" : "Live Production Queue"}
                </h3>
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider mt-0.5">
                  Ordered by sequence priority for {selectedDate} ({displayQueue.length} orders)
                </p>
              </div>

              {/* Technician Queue Filter Scope */}
              {isTechnicianRole && (
                <div className="flex items-center gap-1 bg-[#F4F9FF] border border-[#D8E8FA] p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setQueueScope("ALL")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      queueScope === "ALL" ? "bg-accent text-slate-950 font-bold" : "text-[#526B91] hover:text-white"
                    }`}
                  >
                    All Shift ({rawQueue.length})
                  </button>
                  <button
                    onClick={() => setQueueScope("MY_ASSIGNED")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      queueScope === "MY_ASSIGNED" ? "bg-accent text-slate-950 font-bold" : "text-[#526B91] hover:text-white"
                    }`}
                  >
                    My Assigned
                  </button>
                </div>
              )}
            </div>

            {displayQueue.length === 0 ? (
              <div className="py-16 border border-dashed border-[#D8E8FA] rounded-2xl text-center text-[#526B91] italic text-xs space-y-1">
                <Layers className="w-8 h-8 text-[#526B91] mx-auto" />
                <p className="text-sm font-semibold text-[#0B2148]">No Work Orders scheduled in this queue.</p>
                <p className="text-[10px] uppercase font-bold text-[#526B91]">
                  Select another date or toggle queue scope
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayQueue.map((item: any) => {
                  const isRunning = item.status === "IN_PROGRESS";
                  const isPaused = item.status === "ON_HOLD";
                  const isReady = item.status === "READY";
                  const isQc = item.status === "QC_PENDING";
                  const isDone = item.status === "COMPLETED" || item.status === "CLOSED";
                  const due = getDueDateUrgency(item.dueDate);

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isRunning ? "bg-yellow-500/[0.04] border-yellow-500/30 shadow-md" :
                        isPaused ? "bg-orange-500/[0.04] border-orange-500/25" :
                        isReady ? "bg-white/[0.03] border-[#D8E8FA] hover:border-[#D8E8FA]" :
                        "bg-[#F4F9FF] border-[#D8E8FA] opacity-80"
                      }`}
                    >
                      {/* Left: Sequence + Order Info */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-xs shrink-0 shadow-inner ${
                          isRunning ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" :
                          isPaused ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" :
                          isReady ? "bg-accent/20 text-accent border border-accent/40" :
                          "bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA]"
                        }`}>
                          #{item.sequence}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span 
                              onClick={() => router.push(`/${roleSlug}/production/work-orders/${item.id}`)}
                              className="text-xs font-bold text-accent cursor-pointer hover:underline flex items-center gap-1"
                            >
                              {item.workOrderNumber}
                              <ExternalLink className="w-3.5 h-3.5 text-[#526B91]" />
                            </span>

                            {/* Status Tag */}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              isRunning ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-pulse" :
                              isPaused ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
                              isReady ? "bg-sky-500/10 border-sky-500/30 text-sky-400" :
                              isQc ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
                              "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            }`}>
                              {isPaused ? "PAUSED / ON HOLD" : item.status}
                            </span>

                            {/* Priority Tag */}
                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              item.priority === "URGENT" || item.priority === "HIGH" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              "bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA]"
                            }`}>
                              {item.priority}
                            </span>
                          </div>

                          <p className="text-xs text-[#0B2148] font-medium truncate">
                            Product: {item.productRef} · Qty: <strong className="text-[#0B2148]">{item.plannedQuantity}</strong>
                          </p>

                          {/* Pause Reason if Paused */}
                          {isPaused && item.pauseReason && (
                            <p className="text-[11px] text-orange-300 flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">
                              <AlertCircle className="w-3 h-3 text-orange-400 shrink-0" />
                              Reason: {item.pauseReason}
                            </p>
                          )}

                          {/* Runtime details & QC */}
                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#526B91] font-mono pt-0.5">
                            <span>Est: <strong className="text-[#0B2148]">{item.estimatedHours}h</strong></span>
                            <span>Act: <strong className={item.actualHours > item.estimatedHours ? "text-red-400" : "text-[#166534]"}>{item.actualHours.toFixed(1)}h</strong></span>
                            {item.qcStatus && item.qcStatus !== "NONE" && (
                              <span className="text-purple-300 font-sans">QC: {item.qcStatus}</span>
                            )}
                          </div>

                          {/* Cell Testing Progress Badges */}
                          {item.cellTestingRequirements && item.cellTestingRequirements.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {item.cellTestingRequirements.map((ctr: any) => {
                                const isDone = ctr.status === "COMPLETED" || ctr.remainingQuantity === 0;
                                return (
                                  <span
                                    key={ctr.id}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border ${
                                      isDone
                                        ? "bg-emerald-500/10 border-emerald-500/25 text-[#166534]"
                                        : "bg-accent/10 border-accent/25 text-accent"
                                    }`}
                                  >
                                    <CheckCircle2 className={`w-2.5 h-2.5 ${isDone ? "text-[#166534]" : "text-accent"}`} />
                                    <span>
                                      {ctr.cellSku}: {ctr.testedQuantity}/{ctr.requiredQuantity} {isDone ? "✓ Complete" : `(${ctr.remainingQuantity} needed)`}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Contextual Action Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {isReady && (
                          <button
                            onClick={() => handleAction("START", item)}
                            disabled={startMutation.isPending}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-sm disabled:opacity-50"
                            title="Start production run"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Start
                          </button>
                        )}

                        {isRunning && (
                          <button
                            onClick={() => handleAction("PAUSE", item)}
                            disabled={pauseMutation.isPending}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500 hover:text-slate-950 font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                            title="Pause production run"
                          >
                            <Pause className="w-3.5 h-3.5" />
                            Pause
                          </button>
                        )}

                        {isPaused && (
                          <button
                            onClick={() => handleAction("RESUME", item)}
                            disabled={resumeMutation.isPending}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-sm disabled:opacity-50"
                            title="Resume production run"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resume
                          </button>
                        )}

                        <button
                          onClick={() => router.push(`/${roleSlug}/production/work-orders/${item.id}`)}
                          className="p-2 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] hover:bg-[#EAF5FF] hover:text-[#0878F9] transition-all"
                          title="View order details & BOM"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Right Column: Operational Blockers + Daily Performance Summary (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Operational Blockers */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-xs font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              {isTechnicianRole ? "Operational Blockers" : "Shift Operational Blockers"}
            </h3>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {bottlenecks.length === 0 ? (
                <div className="py-8 text-center text-[#526B91] italic text-xs border border-dashed border-[#D8E8FA] rounded-2xl">
                  No operational blockers detected today!
                </div>
              ) : (
                bottlenecks.map((b: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                      b.severity === "CRITICAL" ? "bg-red-500/5 border-red-500/20" :
                      b.severity === "HIGH" ? "bg-orange-500/5 border-orange-500/20" :
                      "bg-yellow-500/5 border-yellow-500/20"
                    }`}
                  >
                    <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      b.severity === "CRITICAL" ? "text-red-400" :
                      b.severity === "HIGH" ? "text-orange-400" :
                      "text-yellow-400"
                    }`} />
                    
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex justify-between items-center gap-2">
                        <span 
                          className="font-bold text-xs hover:underline cursor-pointer text-[#0B2148] truncate" 
                          onClick={() => router.push(`/${roleSlug}/production/work-orders/${b.workOrderId}`)}
                        >
                          {b.workOrderNumber}
                        </span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          b.severity === "CRITICAL" ? "bg-red-500/10 text-red-400" :
                          b.severity === "HIGH" ? "bg-orange-500/10 text-orange-400" :
                          "bg-yellow-500/10 text-yellow-400"
                        }`}>
                          {b.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#0B2148] leading-normal">{b.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Daily Performance Tracker */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-xs font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-[#166534]" />
              Execution Performance
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-1">
                  <p className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Planned Hours</p>
                  <p className="text-lg font-mono font-bold text-[#0B2148]">{performance.plannedHours.toFixed(1)}h</p>
                </div>
                <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-1">
                  <p className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Actual Hours</p>
                  <p className="text-lg font-mono font-bold text-[#0B2148]">{performance.actualHours.toFixed(1)}h</p>
                </div>
              </div>

              <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#526B91]">Total Variance:</span>
                  <span className={`font-mono font-bold ${performance.varianceHours > 0 ? "text-red-400" : "text-[#166534]"}`}>
                    {performance.varianceHours > 0 ? `+${performance.varianceHours.toFixed(1)}h` : `${performance.varianceHours.toFixed(1)}h`}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#526B91]">Completed Orders:</span>
                  <span className="font-bold text-[#166534]">{performance.completedCount}</span>
                </div>

                <div className="flex justify-between items-center border-t border-[#D8E8FA] pt-2 mt-2">
                  <span className="text-[#526B91]">Avg Variance / WO:</span>
                  <span className={`font-mono font-bold ${performance.averageVarianceHours > 0 ? "text-red-400" : "text-[#166534]"}`}>
                    {performance.averageVarianceHours > 0 ? `+${performance.averageVarianceHours.toFixed(1)}h` : `${performance.averageVarianceHours.toFixed(1)}h`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Production Station Status */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-xs font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-accent" />
              Production Stations
            </h3>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
              {stations.length === 0 ? (
                <div className="py-6 text-center text-[#526B91] italic text-xs border border-dashed border-[#D8E8FA] rounded-2xl">
                  No stations configured.
                </div>
              ) : (
                stations.map((s: any) => {
                  const assignment = s.assignments?.[0];
                  return (
                    <div key={s.id} className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[#0B2148]">{s.name}</p>
                        <p className="text-[10px] text-[#526B91] font-mono">{s.code} · {s.type}</p>
                      </div>
                      <div className="text-right">
                        {assignment ? (
                          <div>
                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">
                              Active
                            </span>
                            <p className="text-[10px] font-semibold text-[#0B2148] mt-0.5">{assignment.operator.name}</p>
                          </div>
                        ) : (
                          <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-slate-500/10 text-[#526B91] uppercase">
                            Idle
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================
          4. START PRODUCTION MODAL (STATION SELECTION)
          ======================================================== */}
      {modalType === "START" && activeWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-[#D8E8FA] p-6 rounded-3xl text-[#0B2148] space-y-5 animate-in fade-in zoom-in-95 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#D8E8FA] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B2148]">Start Production Execution</h3>
                <p className="text-xs text-[#526B91] font-mono">{activeWo.workOrderNumber}</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#526B91]">Product:</span>
                <span className="text-[#0B2148] font-medium">{activeWo.productRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526B91]">Planned Quantity:</span>
                <span className="text-[#0B2148] font-bold">{activeWo.plannedQuantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#526B91]">Estimated Duration:</span>
                <span className="text-accent font-bold">{activeWo.estimatedHours} hrs</span>
              </div>
            </div>

            {/* Station Selection */}
            {stations.filter((s: any) => s.isActive).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                  Select Assembly Station *
                </label>
                <select
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] focus:outline-none focus:border-accent/50"
                >
                  {stations.filter((s: any) => s.isActive).map((st: any) => (
                    <option key={st.id} value={st.id} className="bg-white text-[#0B2148]">
                      {st.name} ({st.code}) - {st.type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeAllModals}
                disabled={startMutation.isPending}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModal}
                disabled={startMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 active:scale-95 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
              >
                {startMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {startMutation.isPending ? "Starting..." : "Confirm & Start"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. PAUSE MODAL DIALOG
          ======================================================== */}
      {modalType === "PAUSE" && activeWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-amber-200 p-6 rounded-3xl text-[#0B2148] space-y-4 animate-in fade-in zoom-in-95 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-700 border-b border-[#D8E8FA] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Pause className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B2148]">Pause Work Order Execution</h3>
                <p className="text-xs text-[#526B91] font-mono">{activeWo.workOrderNumber}</p>
              </div>
            </div>
            
            <p className="text-xs text-[#0B2148] leading-relaxed">
              Please enter a valid operational reason for pausing production. This reason is logged in audit records and displayed on the floor.
            </p>
            
            <textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="e.g., Equipment calibration needed, Waiting for harness inspection, Part defect under review..."
              rows={3}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-amber-500/50"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeAllModals}
                disabled={pauseMutation.isPending}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModal}
                disabled={pauseMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 active:scale-95 shadow-md shadow-amber-600/20 disabled:opacity-50 transition-all"
              >
                {pauseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {pauseMutation.isPending ? "Pausing..." : "Pause Execution"}
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
