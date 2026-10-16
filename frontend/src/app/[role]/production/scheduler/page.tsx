"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Plus, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  XCircle, 
  Search, 
  Layers, 
  CalendarDays,
  Zap,
  BarChart3,
  RefreshCw,
  ExternalLink,
  Play,
  Activity,
  Check,
  Cpu
} from "lucide-react";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

// Configurable shift & capacity constants (defaults)
const DEFAULT_DAILY_CAPACITY = 8.0; // Standard 8-hour production shift
const SHIFT_START_HOUR = 8.0; // 08:00 AM production start

// Helper to format hours into HH:MM format
function formatHoursToTime(decimalHours: number): string {
  const normalizedHours = decimalHours % 24;
  const hours = Math.floor(normalizedHours);
  const minutes = Math.round((normalizedHours - hours) * 60);
  const paddedHours = hours.toString().padStart(2, "0");
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${paddedHours}:${paddedMinutes}`;
}

// Helper to get formatted readable date
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// Due date urgency classification with enterprise light-theme tokens
function getDueDateUrgency(dueDateStr?: string) {
  if (!dueDateStr) return { label: "NO DUE DATE", urgency: "none", color: "text-[#526B91] border-[#D8E8FA] bg-white" };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (diffDays < 0) {
    return { label: `OVERDUE (${formattedDate})`, urgency: "overdue", color: "text-rose-700 border-rose-200 bg-rose-50" };
  } else if (diffDays === 0) {
    return { label: `DUE TODAY (${formattedDate})`, urgency: "today", color: "text-amber-800 border-amber-200 bg-amber-50" };
  } else if (diffDays === 1) {
    return { label: `DUE TOMORROW (${formattedDate})`, urgency: "tomorrow", color: "text-[#0878F9] border-blue-200 bg-blue-50" };
  } else if (diffDays <= 7) {
    return { label: `THIS WEEK (${formattedDate})`, urgency: "week", color: "text-indigo-700 border-indigo-200 bg-indigo-50" };
  } else {
    return { label: `DUE ${formattedDate}`, urgency: "upcoming", color: "text-[#0B2148] border-[#D8E8FA] bg-white" };
  }
}

// Material readiness calculation based on actual backend data
function getMaterialReadiness(wo: any) {
  const status = wo?.status;
  
  // WorkOrders that have already reached READY, IN_PROGRESS, QC_PENDING, COMPLETED are allocated
  if (status === "READY" || status === "IN_PROGRESS" || status === "QC_PENDING" || status === "COMPLETED") {
    return {
      state: "READY",
      label: "READY",
      color: "text-[#166534] border-emerald-200 bg-emerald-50",
      icon: CheckCircle2,
      detail: "Materials fully allocated & reserved"
    };
  }

  // If Work Order has BOM with items
  if (wo?.bom?.items && wo.bom.items.length > 0) {
    const items = wo.bom.items;
    let hasShortage = false;
    for (const item of items) {
      const needed = (item.quantity || 1) * (wo.plannedQuantity || 1);
      const stock = item.material?.quantity || 0;
      if (stock < needed) {
        hasShortage = true;
        break;
      }
    }

    if (hasShortage) {
      return {
        state: "NOT READY",
        label: "NOT READY",
        color: "text-rose-700 border-rose-200 bg-rose-50",
        icon: XCircle,
        detail: "Stock insufficient for BOM requirement"
      };
    }

    return {
      state: "PARTIAL",
      label: "ALLOCATION PENDING",
      color: "text-amber-800 border-amber-200 bg-amber-50",
      icon: AlertTriangle,
      detail: "Stock available, needs allocation"
    };
  }

  if (!wo?.bomId && !wo?.bom) {
    return {
      state: "NOT READY",
      label: "NO BOM",
      color: "text-[#526B91] border-[#D8E8FA] bg-white",
      icon: XCircle,
      detail: "BOM not assigned to Work Order"
    };
  }

  return {
    state: "PARTIAL",
    label: "CHECK REQUIRED",
    color: "text-amber-800 border-amber-200 bg-amber-50",
    icon: AlertCircle,
    detail: "Material verification required"
  };
}

export default function ProductionSchedulerPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = params.role as string;

  // Active schedule date (defaults to today ISO string)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Search & filter states for unscheduled pool
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dueDateFilter, setDueDateFilter] = useState("ALL");
  const [readinessFilter, setReadinessFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Scheduling Modal State
  const [scheduleModalTarget, setScheduleModalTarget] = useState<any | null>(null);
  const [scheduleTargetDate, setScheduleTargetDate] = useState(selectedDate);
  const [estimatedHrs, setEstimatedHrs] = useState("2.0");
  const [scheduleErrorMsg, setScheduleErrorMsg] = useState("");

  // Rescheduling Modal State
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null);
  const [rescheduleNewDate, setRescheduleNewDate] = useState("");
  const [rescheduleHours, setRescheduleHours] = useState("2.0");
  const [rescheduleErrorMsg, setRescheduleErrorMsg] = useState("");

  // Unschedule Confirmation Modal State
  const [unscheduleTarget, setUnscheduleTarget] = useState<any | null>(null);

  // Start Production Modal State
  const [startModalTarget, setStartModalTarget] = useState<any | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [startErrorMsg, setStartErrorMsg] = useState("");

  // Helper to adjust date by days
  const adjustDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // --- QUERY: Unscheduled Work Orders ---
  const { 
    data: unscheduled = [], 
    isLoading: loadingUnscheduled,
    isRefetching: refetchingUnscheduled,
    refetch: refetchUnscheduled
  } = useQuery<any[]>({
    queryKey: ["unscheduled-work-orders"],
    queryFn: async () => (await api.get("/crm/production/schedule/unscheduled")).data,
    staleTime: 1000 * 30 // 30s
  });

  // --- QUERY: Scheduled Work Orders for Selected Date ---
  const { 
    data: scheduled = [], 
    isLoading: loadingScheduled,
    isRefetching: refetchingScheduled,
    refetch: refetchScheduled
  } = useQuery<any[]>({
    queryKey: ["scheduled-work-orders", selectedDate],
    queryFn: async () => (await api.get(`/crm/production/schedule?date=${selectedDate}`)).data,
    staleTime: 1000 * 30
  });

  // --- QUERY: Available Workstations ---
  const { 
    data: stations = [], 
    isLoading: loadingStations
  } = useQuery<any[]>({
    queryKey: ["production-stations"],
    queryFn: async () => (await api.get("/crm/stations")).data,
    staleTime: 1000 * 30
  });

  // --- MUTATION: Schedule Work Order ---
  const scheduleMutation = useMutation({
    mutationFn: async (payload: { workOrderId: string; assignedDate: string; sequence: number; estimatedHrs: number }) => {
      return (await api.post("/crm/production/schedule", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unscheduled-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", selectedDate] });
      if (scheduleTargetDate !== selectedDate) {
        queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", scheduleTargetDate] });
      }
      setScheduleModalTarget(null);
      setEstimatedHrs("2.0");
      setScheduleErrorMsg("");
      toast.success("Work Order scheduled successfully");
    },
    onError: (err: any) => {
      setScheduleErrorMsg(err.response?.data?.error || "Failed to schedule Work Order");
    }
  });

  // --- MUTATION: Reschedule Work Order (Cross-date or Update) ---
  const rescheduleMutation = useMutation({
    mutationFn: async (payload: { workOrderId: string; assignedDate: string; sequence: number; estimatedHrs: number }) => {
      return (await api.post("/crm/production/schedule", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unscheduled-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", selectedDate] });
      if (rescheduleNewDate && rescheduleNewDate !== selectedDate) {
        queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", rescheduleNewDate] });
      }
      setRescheduleTarget(null);
      setRescheduleErrorMsg("");
      toast.success("Work Order rescheduled successfully");
    },
    onError: (err: any) => {
      setRescheduleErrorMsg(err.response?.data?.error || "Failed to reschedule Work Order");
    }
  });

  // --- MUTATION: Unschedule Work Order ---
  const unscheduleMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      return (await api.delete(`/crm/production/schedule/${workOrderId}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unscheduled-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", selectedDate] });
      setUnscheduleTarget(null);
      toast.success("Work Order unscheduled and returned to planning pool");
    }
  });

  // --- MUTATION: Move / Shift Sequence ---
  const shiftSequenceMutation = useMutation({
    mutationFn: async (payload: { workOrderId: string; assignedDate: string; sequence: number; estimatedHrs: number }) => {
      return (await api.post("/crm/production/schedule", payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", selectedDate] });
    }
  });

  // --- MUTATION: Start Production for Scheduled Work Order ---
  const startProductionMutation = useMutation({
    mutationFn: async ({ workOrderId, stationId }: { workOrderId: string; stationId?: string }) => {
      return (await api.post(`/crm/production/work-orders/${workOrderId}/start`, { stationId: stationId || undefined })).data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-work-orders", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["unscheduled-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["production-overview"] });
      queryClient.invalidateQueries({ queryKey: ["production-stations"] });
      toast.success(`Production started for Work Order ${res.workOrder?.workOrderNumber || ""}`);
      setStartModalTarget(null);
      setStartErrorMsg("");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || "Failed to start production";
      setStartErrorMsg(msg);
      toast.error(msg);
    }
  });

  // Handlers
  const handleOpenStartModal = (wo: any) => {
    setStartModalTarget(wo);
    setStartErrorMsg("");
    const active = stations.filter((s: any) => s.isActive !== false);
    if (active.length > 0) {
      setSelectedStationId(active[0].id);
    } else {
      setSelectedStationId("");
    }
  };

  const handleConfirmStartProduction = () => {
    if (!startModalTarget) return;
    startProductionMutation.mutate({
      workOrderId: startModalTarget.id,
      stationId: selectedStationId || undefined
    });
  };

  const handleOpenScheduleModal = (wo: any) => {
    setScheduleModalTarget(wo);
    setScheduleTargetDate(selectedDate);
    setEstimatedHrs("2.0");
    setScheduleErrorMsg("");
  };

  const handleConfirmSchedule = () => {
    if (!scheduleModalTarget) return;
    const hours = parseFloat(estimatedHrs);
    if (isNaN(hours) || hours <= 0) {
      setScheduleErrorMsg("Please enter a valid positive hours value (e.g. 2.5)");
      return;
    }

    // New items added to the end of target date's queue
    const targetSeq = scheduleTargetDate === selectedDate ? scheduled.length + 1 : 1;
    scheduleMutation.mutate({
      workOrderId: scheduleModalTarget.id,
      assignedDate: scheduleTargetDate,
      sequence: targetSeq,
      estimatedHrs: hours
    });
  };

  const handleOpenRescheduleModal = (item: any) => {
    setRescheduleTarget(item);
    setRescheduleNewDate(selectedDate);
    setRescheduleHours(item.estimatedHrs?.toString() || "2.0");
    setRescheduleErrorMsg("");
  };

  const handleConfirmReschedule = () => {
    if (!rescheduleTarget) return;
    const hours = parseFloat(rescheduleHours);
    if (isNaN(hours) || hours <= 0) {
      setRescheduleErrorMsg("Please enter a valid positive hours value");
      return;
    }
    if (!rescheduleNewDate) {
      setRescheduleErrorMsg("Please select a valid date");
      return;
    }

    rescheduleMutation.mutate({
      workOrderId: rescheduleTarget.workOrderId,
      assignedDate: rescheduleNewDate,
      sequence: rescheduleTarget.sequence || 1,
      estimatedHrs: hours
    });
  };

  const handleShiftSeq = (item: any, direction: "up" | "down") => {
    const currentSeq = item.sequence;
    const newSeq = direction === "up" ? currentSeq - 1 : currentSeq + 1;

    // Boundary check
    if (newSeq < 1 || newSeq > scheduled.length) return;

    shiftSequenceMutation.mutate({
      workOrderId: item.workOrderId,
      assignedDate: selectedDate,
      sequence: newSeq,
      estimatedHrs: item.estimatedHrs
    });
  };

  // --- Calculations & Derived Timeline Data ---
  const scheduledList = useMemo(() => {
    let currentHour = SHIFT_START_HOUR;
    return scheduled.map((item: any) => {
      const duration = Number(item.estimatedHrs) || 0;
      const startHour = currentHour;
      const endHour = currentHour + duration;
      currentHour = endHour;

      const startTimeStr = formatHoursToTime(startHour);
      const endTimeStr = formatHoursToTime(endHour);
      const readiness = getMaterialReadiness(item.workOrder);
      const dueUrgency = getDueDateUrgency(item.workOrder?.dueDate);

      return {
        ...item,
        startTimeStr,
        endTimeStr,
        startHour,
        endHour,
        readiness,
        dueUrgency
      };
    });
  }, [scheduled]);

  // Operational KPI metrics
  const totalScheduledHours = useMemo(() => {
    return scheduled.reduce((acc: number, curr: any) => acc + (Number(curr.estimatedHrs) || 0), 0);
  }, [scheduled]);

  const capacityUtilization = useMemo(() => {
    if (DEFAULT_DAILY_CAPACITY <= 0) return 0;
    return Math.round((totalScheduledHours / DEFAULT_DAILY_CAPACITY) * 100);
  }, [totalScheduledHours]);

  const remainingCapacity = useMemo(() => {
    return Math.max(0, DEFAULT_DAILY_CAPACITY - totalScheduledHours);
  }, [totalScheduledHours]);

  const isOverCapacity = totalScheduledHours > DEFAULT_DAILY_CAPACITY;
  const overCapacityHours = isOverCapacity ? (totalScheduledHours - DEFAULT_DAILY_CAPACITY) : 0;

  const readyScheduledCount = useMemo(() => {
    return scheduled.filter((s: any) => {
      const st = s.workOrder?.status;
      return st === "READY" || st === "IN_PROGRESS" || st === "QC_PENDING" || st === "COMPLETED";
    }).length;
  }, [scheduled]);

  const attentionScheduledCount = useMemo(() => {
    return scheduled.filter((s: any) => {
      const st = s.workOrder?.status;
      return st === "CREATED" || st === "ASSIGNED" || st === "ON_HOLD";
    }).length;
  }, [scheduled]);

  // Filtered Unscheduled Work Orders Pool
  const filteredUnscheduled = useMemo(() => {
    return unscheduled.filter((wo: any) => {
      // 1. Search Query filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const woNum = (wo.workOrderNumber || "").toLowerCase();
        const prod = (wo.productRef || "").toLowerCase();
        const plan = (wo.productionPlan?.planNumber || "").toLowerCase();
        const so = (wo.salesOrder?.salesOrderNumber || wo.productionPlan?.productionRequirement?.salesOrder?.salesOrderNumber || "").toLowerCase();
        const customer = (wo.salesOrder?.customer?.name || wo.productionRequirement?.customer?.name || wo.productionPlan?.productionRequirement?.customer?.name || "").toLowerCase();

        if (!woNum.includes(term) && !prod.includes(term) && !plan.includes(term) && !so.includes(term) && !customer.includes(term)) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== "ALL" && wo.status !== statusFilter) {
        return false;
      }

      // 3. Due Date Urgency Filter
      if (dueDateFilter !== "ALL") {
        const urgency = getDueDateUrgency(wo.dueDate).urgency;
        if (dueDateFilter === "OVERDUE" && urgency !== "overdue") return false;
        if (dueDateFilter === "TODAY" && urgency !== "today") return false;
        if (dueDateFilter === "TOMORROW" && urgency !== "tomorrow") return false;
        if (dueDateFilter === "WEEK" && urgency !== "week") return false;
        if (dueDateFilter === "LATER" && urgency !== "upcoming") return false;
      }

      // 4. Material Readiness Filter
      if (readinessFilter !== "ALL") {
        const readiness = getMaterialReadiness(wo).state;
        if (readinessFilter === "READY" && readiness !== "READY") return false;
        if (readinessFilter === "PARTIAL" && readiness !== "PARTIAL") return false;
        if (readinessFilter === "NOT_READY" && readiness !== "NOT READY") return false;
      }

      // 5. Priority Filter
      if (priorityFilter !== "ALL") {
        const prio = wo.productionPlan?.priority || wo.productionRequirement?.priority || wo.salesOrder?.priority || "NORMAL";
        if (prio !== priorityFilter) return false;
      }

      return true;
    });
  }, [unscheduled, searchTerm, statusFilter, dueDateFilter, readinessFilter, priorityFilter]);

  const isLoading = loadingUnscheduled || loadingScheduled;
  const isTodaySelected = selectedDate === new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto text-[#0B2148] pb-10">
      
      {/* ========================================================
          1. HEADER & DATE NAVIGATION
          ======================================================== */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-[#D8E8FA] bg-white shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-[#EAF5FF] rounded-2xl flex items-center justify-center text-[#0878F9] border border-[#0878F9]/20 shadow-xs shrink-0">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-display font-bold text-[#0B2148]">
                  Production Scheduler
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/20 font-sans">
                  Control Center
                </span>
              </div>
              <p className="text-xs text-[#526B91] mt-0.5 font-medium">
                Plan, sequence, and allocate shopfloor Work Orders for daily execution
              </p>
            </div>
          </div>

          {/* Date Selector & Day Navigation */}
          <div className="flex flex-wrap items-center gap-2 bg-[#F4F9FF] border border-[#D8E8FA] p-1.5 rounded-2xl shadow-xs">
            <button 
              type="button"
              onClick={() => adjustDate(-1)} 
              className="p-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] transition-all shadow-xs cursor-pointer"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ArrowLeft className="w-4 h-4 text-[#0878F9]" />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-[#D8E8FA] shadow-xs relative">
              <Clock className="w-4 h-4 text-[#0878F9] shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#0B2148]">
                  {formatDisplayDate(selectedDate)}
                </span>
                <span className="text-[10px] font-mono text-[#526B91]">
                  {selectedDate}
                </span>
              </div>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Select Calendar Date"
              />
            </div>

            <button 
              type="button"
              onClick={() => adjustDate(1)} 
              className="p-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] transition-all shadow-xs cursor-pointer"
              title="Next Day"
              aria-label="Next Day"
            >
              <ArrowRight className="w-4 h-4 text-[#0878F9]" />
            </button>
            
            <button 
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              disabled={isTodaySelected}
              className={`text-xs uppercase font-bold px-3 py-2 rounded-xl transition-all shadow-xs ${
                isTodaySelected 
                  ? "bg-[#0878F9] text-white cursor-default" 
                  : "bg-white hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] cursor-pointer"
              }`}
            >
              Today
            </button>

            <button 
              type="button"
              onClick={() => router.push(`/${roleSlug}/production/operations`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
              title="Open Live Shopfloor Operations & Execution"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Operations Center</span>
            </button>

            <button 
              type="button"
              onClick={() => { refetchScheduled(); refetchUnscheduled(); }}
              className="p-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] transition-all shadow-xs cursor-pointer"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${(refetchingScheduled || refetchingUnscheduled) ? "animate-spin text-[#0878F9]" : "text-[#526B91]"}`} />
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================
          2. PRODUCTION KPI OPERATIONAL SUMMARY
          ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Scheduled WOs */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#526B91]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Scheduled</span>
            <div className="w-6 h-6 rounded-lg bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-display text-[#0B2148]">{scheduled.length} <span className="text-xs font-normal text-[#526B91]">WO</span></div>
            <p className="text-[10px] text-[#526B91] mt-0.5 font-medium">{isTodaySelected ? "Today's queue" : selectedDate}</p>
          </div>
        </div>

        {/* Total Estimated Hours */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#526B91]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Estimated Time</span>
            <div className="w-6 h-6 rounded-lg bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-display text-[#0B2148] font-mono">{totalScheduledHours.toFixed(1)} <span className="text-xs font-normal text-[#526B91]">hrs</span></div>
            <p className="text-[10px] text-[#526B91] mt-0.5 font-medium">Production work load</p>
          </div>
        </div>

        {/* Shift Capacity */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#526B91]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Daily Capacity</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#166534] flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-display text-[#0B2148] font-mono">{DEFAULT_DAILY_CAPACITY.toFixed(1)} <span className="text-xs font-normal text-[#526B91]">hrs</span></div>
            <p className="text-[10px] text-[#526B91] mt-0.5 font-medium">Standard 1-shift max</p>
          </div>
        </div>

        {/* Remaining Capacity */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#526B91]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Remaining</span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isOverCapacity ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-[#166534]"}`}>
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold font-display font-mono ${isOverCapacity ? "text-rose-700" : "text-[#166534]"}`}>
              {remainingCapacity.toFixed(1)} <span className="text-xs font-normal text-[#526B91]">hrs</span>
            </div>
            <p className="text-[10px] text-[#526B91] mt-0.5 font-medium">
              {isOverCapacity ? `Over by +${overCapacityHours.toFixed(1)}h` : "Available headroom"}
            </p>
          </div>
        </div>

        {/* Capacity Utilization */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#526B91]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Utilization</span>
            <div className={`w-2.5 h-2.5 rounded-full ${isOverCapacity ? "bg-rose-500 animate-pulse" : capacityUtilization > 85 ? "bg-amber-500" : "bg-emerald-500"}`} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold font-display font-mono ${isOverCapacity ? "text-rose-700 font-black" : "text-[#0B2148]"}`}>
              {capacityUtilization}%
            </div>
            <p className="text-[10px] text-[#526B91] mt-0.5 font-medium">Of planned shift capacity</p>
          </div>
        </div>

        {/* Ready vs Blocked */}
        <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#526B91]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ready / Pending</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#166534] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-display font-mono text-[#0B2148]">
              <span className="text-[#166534]">{readyScheduledCount}</span>
              <span className="text-[#526B91] font-normal text-lg"> / </span>
              <span className={attentionScheduledCount > 0 ? "text-amber-700 font-bold" : "text-[#526B91]"}>{attentionScheduledCount}</span>
            </div>
            <p className="text-[10px] text-[#526B91] mt-0.5 font-medium">
              {readyScheduledCount} ready, {attentionScheduledCount} attention
            </p>
          </div>
        </div>

      </div>

      {/* ========================================================
          3. CAPACITY PROGRESS BAR & OVER-CAPACITY BANNER
          ======================================================== */}
      <div className="glass-panel p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0878F9]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B2148]">
              Shift Production Capacity
            </span>
            <span className="text-xs font-mono text-[#526B91] font-medium">
              ({totalScheduledHours.toFixed(1)} / {DEFAULT_DAILY_CAPACITY.toFixed(1)} hrs)
            </span>
          </div>
          <div className="text-xs font-bold">
            <span className={isOverCapacity ? "text-rose-700 font-black" : capacityUtilization > 85 ? "text-amber-800" : "text-[#166534]"}>
              {capacityUtilization}% Load
            </span>
            <span className="text-[#526B91] ml-1.5 font-normal">
              {isOverCapacity ? `(Over by +${overCapacityHours.toFixed(1)}h)` : `(${remainingCapacity.toFixed(1)}h available)`}
            </span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-3 bg-[#F4F9FF] rounded-full overflow-hidden p-0.5 border border-[#D8E8FA] relative">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isOverCapacity 
                ? "bg-rose-600" 
                : capacityUtilization > 80 
                  ? "bg-amber-500" 
                  : "bg-[#0878F9]"
            }`}
            style={{ width: `${Math.min(100, capacityUtilization)}%` }}
          />
        </div>

        {/* Over Capacity Warning Alert Banner */}
        {isOverCapacity && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs shadow-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-900">
                ⚠ Production Capacity Exceeded: {totalScheduledHours.toFixed(1)} hrs scheduled vs {DEFAULT_DAILY_CAPACITY.toFixed(1)} hrs capacity.
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">
                The scheduled queue exceeds normal single-shift hours by +{overCapacityHours.toFixed(1)} hrs. Plan supervisor overtime or reschedule lower priority orders to subsequent days.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          4. MAIN SCHEDULER BOARD (DUAL PANEL)
          ======================================================== */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-24 glass-panel rounded-3xl border border-[#D8E8FA] bg-white gap-4 shadow-xs">
          <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin" />
          <p className="text-sm text-[#526B91] font-display">Loading Shopfloor Timetables & Unscheduled Pool...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ========================================================
              LEFT PANEL: UNSCHEDULED WORK ORDERS POOL
              ======================================================== */}
          <div className="lg:col-span-5 glass-panel p-5 md:p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 flex flex-col shadow-xs">
            
            {/* Pool Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
              <div>
                <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#0878F9]" />
                  <span>Unscheduled Work Orders</span>
                </h2>
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider mt-0.5">
                  Available planning queue ({filteredUnscheduled.length} available)
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                {unscheduled.length} Total
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search WO #, Product, Customer, Sales Order..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#D8E8FA] rounded-xl pl-10 pr-8 py-2.5 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] shadow-xs"
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#526B91] hover:text-[#0B2148] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 text-[10px]">
              {/* Due Date Filter */}
              <select 
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value)}
                className="bg-white border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-[#0B2148] font-medium focus:outline-none focus:border-[#0878F9] shadow-xs"
              >
                <option value="ALL">Due: All</option>
                <option value="OVERDUE">Overdue</option>
                <option value="TODAY">Due Today</option>
                <option value="TOMORROW">Due Tomorrow</option>
                <option value="WEEK">This Week</option>
                <option value="LATER">Later</option>
              </select>

              {/* Material Readiness Filter */}
              <select 
                value={readinessFilter}
                onChange={(e) => setReadinessFilter(e.target.value)}
                className="bg-white border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-[#0B2148] font-medium focus:outline-none focus:border-[#0878F9] shadow-xs"
              >
                <option value="ALL">Material: All</option>
                <option value="READY">Ready ✓</option>
                <option value="PARTIAL">Allocation Pending ⚠</option>
                <option value="NOT_READY">Not Ready ✕</option>
              </select>

              {/* Status Filter */}
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-[#0B2148] font-medium focus:outline-none focus:border-[#0878F9] shadow-xs"
              >
                <option value="ALL">Status: All</option>
                <option value="READY">READY</option>
                <option value="CREATED">CREATED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="ON_HOLD">ON_HOLD</option>
              </select>

              {(searchTerm || dueDateFilter !== "ALL" || readinessFilter !== "ALL" || statusFilter !== "ALL") && (
                <button 
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setDueDateFilter("ALL");
                    setReadinessFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="text-[#0878F9] font-bold underline hover:text-[#0667DB] px-1 py-1 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Unscheduled Items List */}
            <div className="space-y-3 overflow-y-auto max-h-[620px] pr-1.5 flex-1">
              {filteredUnscheduled.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-[#D8E8FA] rounded-2xl bg-[#F4F9FF] text-[#526B91] space-y-2">
                  <Layers className="w-8 h-8 text-[#526B91]/40 mx-auto" />
                  <p className="text-sm font-semibold text-[#0B2148]">
                    {unscheduled.length === 0 
                      ? "All eligible Work Orders are scheduled." 
                      : "No matching Work Orders found."}
                  </p>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wide">
                    {unscheduled.length === 0 
                      ? "All open production orders are placed in timetables" 
                      : "Try adjusting search filters"}
                  </p>
                </div>
              ) : (
                filteredUnscheduled.map((wo: any) => {
                  const due = getDueDateUrgency(wo.dueDate);
                  const mat = getMaterialReadiness(wo);
                  const customerName = wo.salesOrder?.customer?.name || wo.productionRequirement?.customer?.name || wo.productionPlan?.productionRequirement?.customer?.name;
                  const MatIcon = mat.icon;

                  return (
                    <div 
                      key={wo.id}
                      className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl hover:border-[#0878F9]/40 hover:bg-[#EAF5FF]/40 transition-all group flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-2">
                        {/* Top Meta Line: WO number + Due Urgency + Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => router.push(`/${roleSlug}/production/work-orders/${wo.id}`)}
                              className="text-xs font-bold font-mono text-[#0878F9] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{wo.workOrderNumber}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-white text-[#0B2148] border border-[#D8E8FA] uppercase">
                              {wo.status}
                            </span>
                          </div>

                          {/* Due Date Urgency Badge */}
                          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${due.color}`}>
                            {due.label}
                          </span>
                        </div>

                        {/* Product & Customer */}
                        <div>
                          <p className="text-xs font-bold text-[#0B2148] line-clamp-1">
                            {wo.productRef || "Standard Battery Pack"}
                          </p>
                          {customerName && (
                            <p className="text-[10px] text-[#526B91] mt-0.5">
                              Customer: <span className="text-[#0B2148] font-semibold">{customerName}</span>
                            </p>
                          )}
                        </div>

                        {/* Quantity & Material Readiness */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#D8E8FA] text-[10px]">
                          <span className="text-[#526B91]">
                            Planned Qty: <strong className="text-[#0B2148] font-mono font-bold">{wo.plannedQuantity}</strong>
                          </span>

                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${mat.color}`} title={mat.detail}>
                            <MatIcon className="w-3 h-3" />
                            <span>{mat.label}</span>
                          </div>
                        </div>
                      </div>

                      {/* Schedule Button */}
                      <button 
                        type="button"
                        onClick={() => handleOpenScheduleModal(wo)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-xs mt-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Schedule For {selectedDate === new Date().toISOString().split("T")[0] ? "Today" : selectedDate}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* ========================================================
              RIGHT PANEL: TODAY'S SCHEDULED TIMETABLE
              ======================================================== */}
          <div className="lg:col-span-7 glass-panel p-5 md:p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 flex flex-col shadow-xs">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D8E8FA]">
              <div>
                <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#0878F9]" />
                  <span>Production Schedule</span>
                </h2>
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider mt-0.5">
                  Sequence priority queue for {formatDisplayDate(selectedDate)} ({scheduledList.length} scheduled)
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#0B2148]">
                <span className="px-2.5 py-1 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] font-bold">
                  Total: {totalScheduledHours.toFixed(1)} hrs
                </span>
              </div>
            </div>

            {/* Scheduled Timetable List */}
            <div className="space-y-3 overflow-y-auto max-h-[620px] pr-1.5 flex-1">
              {scheduledList.length === 0 ? (
                <div className="text-center py-24 border border-dashed border-[#D8E8FA] rounded-2xl bg-[#F4F9FF] text-[#526B91] space-y-2">
                  <CalendarDays className="w-10 h-10 text-[#526B91]/40 mx-auto" />
                  <p className="text-sm font-semibold text-[#0B2148]">No Work Orders scheduled for this date.</p>
                  <p className="text-[10px] uppercase font-bold text-[#526B91]">
                    Schedule a Work Order from the left pool or navigate to another date
                  </p>
                </div>
              ) : (
                scheduledList.map((item: any, idx: number) => {
                  const wo = item.workOrder || {};
                  const mat = item.readiness;
                  const due = item.dueUrgency;
                  const MatIcon = mat.icon;
                  const isInProgress = wo.status === "IN_PROGRESS";
                  const isCompleted = ["COMPLETED", "CLOSED", "CANCELLED", "QC_PENDING"].includes(wo.status);

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs group ${
                        isInProgress 
                          ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-300" 
                          : "border-[#D8E8FA] bg-[#F4F9FF] hover:bg-[#EAF5FF]/50"
                      }`}
                    >
                      {/* Left: Sequence Badge + WO details */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Sequence Number Badge */}
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-display font-black text-sm shrink-0 shadow-xs ${
                          isInProgress 
                            ? "bg-emerald-100 border border-emerald-300 text-[#166534]" 
                            : "bg-[#EAF5FF] border border-[#0878F9]/30 text-[#0878F9]"
                        }`}>
                          #{item.sequence}
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          {/* Order Header: WO Number + Status + Due Badge + Live State */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => router.push(`/${roleSlug}/production/work-orders/${wo.id}`)}
                              className="text-xs font-bold font-mono text-[#0878F9] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{wo.workOrderNumber}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>

                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                              isInProgress 
                                ? "bg-emerald-100 text-[#166534] border border-emerald-300" 
                                : "bg-white text-[#0B2148] border border-[#D8E8FA]"
                            }`}>
                              {wo.status}
                            </span>

                            <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${due.color}`}>
                              {due.label}
                            </span>

                            {/* Live In-Production State Indicator */}
                            {isInProgress && (
                              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-[#166534] text-[10px] font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping inline-block" />
                                <span>Running</span>
                              </span>
                            )}
                          </div>

                          {/* Product Reference */}
                          <p className="text-xs text-[#0B2148] font-bold truncate">
                            {wo.productRef || "Standard Battery Pack"}
                          </p>

                          {/* Execution Timeline Time Window & Readiness */}
                          <div className="flex flex-wrap items-center gap-3 text-[10px]">
                            {/* Estimated Start / End */}
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-[#D8E8FA] text-[#0878F9] font-bold font-mono">
                              <Clock className="w-3 h-3" />
                              <span>{item.startTimeStr} → {item.endTimeStr}</span>
                              <span className="text-[#526B91] font-normal">({item.estimatedHrs}h)</span>
                            </div>

                            <span className="text-[#526B91]">
                              Qty: <strong className="text-[#0B2148] font-mono font-bold">{wo.plannedQuantity}</strong>
                            </span>

                            {/* Material Readiness */}
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${mat.color}`} title={mat.detail}>
                              <MatIcon className="w-3 h-3" />
                              <span>{mat.label}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Sequence Controls & Execution Actions */}
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
                        
                        {/* Start Production / Live Execution Action Button */}
                        {isInProgress ? (
                          <button 
                            type="button"
                            onClick={() => router.push(`/${roleSlug}/production/operations`)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Open live workstation & shopfloor execution"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Live Execution</span>
                          </button>
                        ) : isCompleted ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#166534] text-xs font-bold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>{wo.status === "COMPLETED" ? "Completed" : "QC Inspection"}</span>
                          </span>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => handleOpenStartModal(wo)}
                            disabled={startProductionMutation.isPending}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                            title="Assign workstation and start production"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Start Production</span>
                          </button>
                        )}

                        {/* Move Up / Move Down Sequence */}
                        <div className="flex flex-col gap-1">
                          <button 
                            type="button"
                            onClick={() => handleShiftSeq(item, "up")}
                            disabled={idx === 0 || shiftSequenceMutation.isPending}
                            className="p-1.5 rounded-lg bg-white hover:bg-[#EAF5FF] disabled:opacity-30 disabled:pointer-events-none transition-colors border border-[#D8E8FA] text-[#0B2148] hover:text-[#0878F9] shadow-xs cursor-pointer"
                            title="Move Priority Up"
                            aria-label="Move Priority Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleShiftSeq(item, "down")}
                            disabled={idx === scheduledList.length - 1 || shiftSequenceMutation.isPending}
                            className="p-1.5 rounded-lg bg-white hover:bg-[#EAF5FF] disabled:opacity-30 disabled:pointer-events-none transition-colors border border-[#D8E8FA] text-[#0B2148] hover:text-[#0878F9] shadow-xs cursor-pointer"
                            title="Move Priority Down"
                            aria-label="Move Priority Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Reschedule Button */}
                        <button 
                          type="button"
                          onClick={() => handleOpenRescheduleModal(item)}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0B2148] hover:text-[#0878F9] text-xs font-bold border border-[#D8E8FA] transition-colors shadow-xs cursor-pointer"
                          title="Reschedule to another date"
                        >
                          Reschedule
                        </button>

                        {/* Unschedule Button */}
                        <button 
                          type="button"
                          onClick={() => setUnscheduleTarget(item)}
                          disabled={isInProgress}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors border border-rose-200 disabled:opacity-30 disabled:pointer-events-none shadow-xs cursor-pointer"
                          title={isInProgress ? "Cannot unschedule work order in progress" : "Unschedule Work Order"}
                          aria-label="Unschedule Work Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          5. DAILY PRODUCTION TIMELINE VIEW
          ======================================================== */}
      {scheduledList.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#D8E8FA]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B2148] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0878F9]" />
              <span>Production Execution Timeline</span>
            </h3>
            <span className="text-[10px] font-mono text-[#526B91]">
              Shift Window: 08:00 AM → {formatHoursToTime(SHIFT_START_HOUR + totalScheduledHours)} ({totalScheduledHours.toFixed(1)} hrs total)
            </span>
          </div>

          {/* Timeline Bar Track */}
          <div className="space-y-2">
            <div className="w-full bg-[#F4F9FF] p-2.5 rounded-2xl border border-[#D8E8FA] flex flex-wrap gap-2">
              {scheduledList.map((item: any) => {
                return (
                  <div 
                    key={item.id}
                    style={{ flexGrow: Number(item.estimatedHrs) || 1, minWidth: "130px" }}
                    className="p-3 bg-white border border-[#D8E8FA] rounded-xl hover:border-[#0878F9]/40 transition-all flex flex-col justify-between shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#526B91]">
                      <span className="font-mono font-bold text-[#0878F9]">#{item.sequence}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#EAF5FF] text-[#0878F9]">
                        {item.estimatedHrs}h
                      </span>
                    </div>

                    <div className="my-1.5">
                      <p className="text-xs font-bold text-[#0B2148] font-mono truncate">
                        {item.workOrder?.workOrderNumber}
                      </p>
                      <p className="text-[10px] text-[#526B91] truncate font-medium">
                        {item.workOrder?.productRef || "Standard Pack"}
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-[#0878F9] font-bold border-t border-[#D8E8FA] pt-1 mt-1">
                      {item.startTimeStr} → {item.endTimeStr}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-[#526B91] px-2 font-mono">
              <span>08:00 AM (Start)</span>
              <span>12:00 PM (Mid-day)</span>
              <span>04:00 PM (8h Shift Mark)</span>
              <span>{formatHoursToTime(SHIFT_START_HOUR + Math.max(DEFAULT_DAILY_CAPACITY, totalScheduledHours))}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          6. SCHEDULE WORK ORDER MODAL
          ======================================================== */}
      {scheduleModalTarget && (
        <div className="fixed inset-0 bg-[#061B3A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E8FA] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-[#0B2148]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-[#0878F9]" />
                  <span>Schedule Work Order</span>
                </h3>
                <p className="text-xs text-[#526B91] mt-0.5">Assign production timetable date and estimated run hours</p>
              </div>
              <button 
                type="button"
                onClick={() => setScheduleModalTarget(null)}
                className="text-[#526B91] hover:text-[#0B2148] text-sm p-1 rounded-lg hover:bg-[#F4F9FF] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target WO Summary Info */}
            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Work Order:</span>
                <span className="font-bold text-[#0878F9] font-mono">{scheduleModalTarget.workOrderNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Product:</span>
                <span className="font-bold text-[#0B2148]">{scheduleModalTarget.productRef || "Standard Pack"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Planned Quantity:</span>
                <span className="font-bold font-mono text-[#0B2148]">{scheduleModalTarget.plannedQuantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Due Date:</span>
                <span className="font-mono text-[#0B2148]">{scheduleModalTarget.dueDate ? new Date(scheduleModalTarget.dueDate).toLocaleDateString() : "N/A"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Material Readiness:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getMaterialReadiness(scheduleModalTarget).color}`}>
                  {getMaterialReadiness(scheduleModalTarget).label}
                </span>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                  Target Production Date *
                </label>
                <input 
                  type="date"
                  value={scheduleTargetDate}
                  onChange={(e) => setScheduleTargetDate(e.target.value)}
                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-[#0B2148] text-xs font-semibold focus:outline-none focus:border-[#0878F9] shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                  Estimated Production Hours *
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  min="0.5"
                  max="48"
                  value={estimatedHrs}
                  onChange={(e) => setEstimatedHrs(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-[#0B2148] text-xs font-mono font-bold focus:outline-none focus:border-[#0878F9] shadow-xs"
                />
                <p className="text-[11px] text-[#526B91]">Positive decimal hours value for shopfloor planning (e.g. 2.0 or 3.5)</p>
              </div>
            </div>

            {/* Error Message */}
            {scheduleErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{scheduleErrorMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D8E8FA]">
              <button 
                type="button"
                onClick={() => setScheduleModalTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmSchedule}
                disabled={scheduleMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {scheduleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>Confirm Schedule</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          7. RESCHEDULE MODAL
          ======================================================== */}
      {rescheduleTarget && (
        <div className="fixed inset-0 bg-[#061B3A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E8FA] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-[#0B2148]">
            
            <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-[#0878F9]" />
                  <span>Reschedule Work Order</span>
                </h3>
                <p className="text-xs text-[#526B91] mt-0.5">Move to a new date or adjust estimated runtime</p>
              </div>
              <button 
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-[#526B91] hover:text-[#0B2148] text-sm p-1 rounded-lg hover:bg-[#F4F9FF] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Work Order:</span>
                <span className="font-bold text-[#0878F9] font-mono">{rescheduleTarget.workOrder?.workOrderNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Currently Scheduled:</span>
                <span className="font-medium text-[#0B2148]">{formatDisplayDate(selectedDate)} (Seq #{rescheduleTarget.sequence})</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                  New Production Date *
                </label>
                <input 
                  type="date"
                  value={rescheduleNewDate}
                  onChange={(e) => setRescheduleNewDate(e.target.value)}
                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-[#0B2148] text-xs font-semibold focus:outline-none focus:border-[#0878F9] shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                  Estimated Hours *
                </label>
                <input 
                  type="number" 
                  step="0.5"
                  min="0.5"
                  value={rescheduleHours}
                  onChange={(e) => setRescheduleHours(e.target.value)}
                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-[#0B2148] text-xs font-mono font-bold focus:outline-none focus:border-[#0878F9] shadow-xs"
                />
              </div>
            </div>

            {rescheduleErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rescheduleErrorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D8E8FA]">
              <button 
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmReschedule}
                disabled={rescheduleMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {rescheduleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>Confirm Reschedule</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          8. UNSCHEDULE CONFIRMATION MODAL
          ======================================================== */}
      {unscheduleTarget && (
        <div className="fixed inset-0 bg-[#061B3A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-[#0B2148]">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B2148]">Unschedule Work Order?</h3>
                <p className="text-xs text-[#526B91] mt-0.5 font-mono">{unscheduleTarget.workOrder?.workOrderNumber}</p>
              </div>
            </div>

            <p className="text-xs text-[#0B2148] leading-relaxed bg-[#F4F9FF] p-3.5 rounded-2xl border border-[#D8E8FA]">
              This will remove <strong className="text-[#0B2148] font-bold">{unscheduleTarget.workOrder?.workOrderNumber}</strong> from <strong className="text-[#0878F9]">{formatDisplayDate(selectedDate)}</strong>&apos;s schedule and return it to the Unscheduled Pool. Any subsequent sequence items on this date will automatically shift up to close sequence gaps.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D8E8FA]">
              <button 
                type="button"
                onClick={() => setUnscheduleTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => unscheduleMutation.mutate(unscheduleTarget.workOrderId)}
                disabled={unscheduleMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {unscheduleMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Unschedule Work Order</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          9. START PRODUCTION & WORKSTATION SELECTION MODAL
          ======================================================== */}
      {startModalTarget && (
        <div className="fixed inset-0 bg-[#061B3A]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E8FA] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-[#0B2148]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534] shrink-0">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
                    Start Production Execution
                  </h3>
                  <p className="text-xs text-[#526B91] mt-0.5 font-mono">
                    {startModalTarget.workOrderNumber}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setStartModalTarget(null)}
                className="text-[#526B91] hover:text-[#0B2148] text-sm p-1.5 rounded-lg hover:bg-[#F4F9FF] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Target Order Summary Card */}
            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Product Reference:</span>
                <span className="font-bold text-[#0B2148]">{startModalTarget.productRef || "Standard Battery Pack"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Batch Planned Quantity:</span>
                <span className="font-bold text-[#0878F9] font-mono">{startModalTarget.plannedQuantity || 1} Units</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#526B91]">Status:</span>
                <span className="px-2 py-0.5 rounded bg-white text-[#0B2148] font-bold uppercase text-[10px] border border-[#D8E8FA]">
                  {startModalTarget.status}
                </span>
              </div>
            </div>

            {/* Workstation Selector Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#0878F9]" />
                  <span>Select Production Workstation</span>
                </label>
                <span className="text-[10px] text-[#526B91]">
                  {stations.length > 0 ? `${stations.length} Registered Stations` : "Auto-Provision Available"}
                </span>
              </div>

              {loadingStations ? (
                <div className="p-6 text-center border border-[#D8E8FA] rounded-2xl bg-[#F4F9FF]">
                  <Loader2 className="w-5 h-5 text-[#0878F9] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[#526B91]">Fetching shopfloor workstations...</p>
                </div>
              ) : stations.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {stations.map((stn: any) => {
                    const isSelected = selectedStationId === stn.id;
                    const activeAssignment = stn.assignments && stn.assignments.length > 0 ? stn.assignments[0] : null;
                    return (
                      <div 
                        key={stn.id}
                        onClick={() => setSelectedStationId(stn.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs" 
                            : "bg-[#F4F9FF] border-[#D8E8FA] hover:border-[#0878F9]/30 text-[#0B2148]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            name="production_station"
                            checked={isSelected}
                            onChange={() => setSelectedStationId(stn.id)}
                            className="text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-white border-[#D8E8FA]"
                          />
                          <div>
                            <p className="text-xs font-bold text-[#0B2148] flex items-center gap-2">
                              <span>{stn.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-[#0B2148] border border-[#D8E8FA]">
                                {stn.code}
                              </span>
                            </p>
                            <p className="text-[11px] text-[#526B91] mt-0.5">
                              Type: <strong className="text-[#0B2148]">{stn.type}</strong>
                              {activeAssignment ? (
                                <span className="text-amber-800 ml-2 font-medium">
                                  • Assigned: {activeAssignment.operator?.name || "Technician"}
                                </span>
                              ) : (
                                <span className="text-[#166534] ml-2 font-medium">
                                  • Ready / Available
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          stn.isActive ? "bg-emerald-100 text-[#166534]" : "bg-red-100 text-red-800"
                        }`}>
                          {stn.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div 
                  onClick={() => setSelectedStationId("")}
                  className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 cursor-pointer text-xs space-y-1"
                >
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Auto-Provision: Main Assembly Station 1 (STN-ASSY-01)</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    No custom stations are configured yet. The system will automatically register and bind this execution to standard Station 1.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {startErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{startErrorMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D8E8FA]">
              <button 
                type="button"
                onClick={() => setStartModalTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmStartProduction}
                disabled={startProductionMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {startProductionMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Starting Production...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Confirm &amp; Start Production</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
