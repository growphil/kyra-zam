"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ClipboardList, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  Check,
  Building2,
  FileText,
  Boxes,
  Plus,
  ArrowUpRight,
  Microscope,
  Zap,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function ProductionRequirementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reqId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Planning state
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [planQty, setPlanQty] = useState(1);
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [planPriority, setPlanPriority] = useState("NORMAL");
  const [supervisorId, setSupervisorId] = useState("");
  const [planNotes, setPlanNotes] = useState("");

  // Local tracking of freshly spawned PRs
  const [spawnedPRs, setSpawnedPRs] = useState<Record<string, { prNumber: string }>>({});

  // Material check results
  const [materialsCheck, setMaterialsCheck] = useState<{
    materials: any[];
    cellRequirements: any[];
    normalMaterialStatus: string;
    cellTestingStatus: string;
  } | null>(null);

  // --- DATA FETCHING ---
  const { data: req, isLoading } = useQuery({
    queryKey: ["production-req-details", reqId],
    queryFn: async () => {
      const res = await api.get(`/crm/production/requirements/${reqId}`);
      return res.data;
    }
  });

  const existingPlan = req?.plans && req.plans.length > 0 ? req.plans[0] : null;
  const isScheduled = Boolean(existingPlan);

  const { data: supervisors } = useQuery({
    queryKey: ["supervisors-dropdown"],
    queryFn: async () => {
      const res = await api.get("/crm/users");
      const list = res.data || [];
      return list.filter((u: any) => 
        u.roles?.includes("SUPERVISOR") || 
        u.roles?.includes("ADMIN") || 
        u.roles?.includes("SUPERADMIN") ||
        u.roles?.includes("PLANT_MANAGER")
      );
    }
  });

  // Open modal handlers
  const handleOpenScheduleModal = () => {
    if (existingPlan) {
      setPlanQty(existingPlan.plannedQuantity || req.requiredQuantity);
      setPlanStart(existingPlan.plannedStartDate ? new Date(existingPlan.plannedStartDate).toISOString().split('T')[0] : "");
      setPlanEnd(existingPlan.plannedCompletionDate ? new Date(existingPlan.plannedCompletionDate).toISOString().split('T')[0] : "");
      setPlanPriority(existingPlan.priority || "NORMAL");
      setSupervisorId(existingPlan.supervisorId || (supervisors && supervisors.length > 0 ? supervisors[0].id : ""));
      setPlanNotes(existingPlan.notes || "");
    } else {
      setPlanQty(req?.requiredQuantity || 1);
      setPlanStart("");
      setPlanEnd("");
      setPlanPriority(req?.priority || "NORMAL");
      const defSup = supervisors?.find((s: any) => s.roles?.includes("SUPERVISOR")) || supervisors?.[0];
      setSupervisorId(defSup ? defSup.id : "");
      setPlanNotes("");
    }
    setIsPlanOpen(true);
  };

  // --- MUTATIONS ---
  const checkMaterialsMutation = useMutation({
    mutationFn: () => api.post(`/crm/production/requirements/${reqId}/check-materials`, {}),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["production-req-details", reqId] });
      setMaterialsCheck({
        materials: res.data.materials || [],
        cellRequirements: res.data.cellRequirements || [],
        normalMaterialStatus: res.data.normalMaterialStatus,
        cellTestingStatus: res.data.cellTestingStatus
      });
      toast.success(`Material requirement checked. Status updated to ${res.data.status}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Check failed")
  });

  const spawnPRMutation = useMutation({
    mutationFn: (data: { materialId: string; shortageQty: number }) => 
      api.post(`/crm/production/requirements/${reqId}/spawn-purchase-request`, data),
    onSuccess: (res: any, variables) => {
      toast.success(`Purchase Request ${res.data.prNumber} draft spawned`);
      setSpawnedPRs((prev) => ({
        ...prev,
        [variables.materialId]: { prNumber: res.data.prNumber }
      }));
      queryClient.invalidateQueries({ queryKey: ["production-req-details", reqId] });
      checkMaterialsMutation.mutate();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "PR spawning failed")
  });

  const savePlanMutation = useMutation({
    mutationFn: async (data: any) => {
      if (existingPlan) {
        return api.patch(`/crm/production/plans/${existingPlan.id}`, data);
      } else {
        return api.post("/crm/production/plans", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-req-details", reqId] });
      queryClient.invalidateQueries({ queryKey: ["production-requirement-list"] });
      queryClient.invalidateQueries({ queryKey: ["production-plans"] });
      toast.success(existingPlan ? "Production schedule dates updated successfully" : "Production Plan scheduled successfully");
      setIsPlanOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to save Plan schedule")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
        <p className="font-bold text-[#0B2148]">Production Requirement Not Found</p>
      </div>
    );
  }

  const normalMaterials = materialsCheck?.materials ?? req.materialsAnalysis?.normalMaterials ?? [];
  const cellRequirements = materialsCheck?.cellRequirements ?? req.materialsAnalysis?.cellRequirements ?? [];
  const normalMaterialStatus = materialsCheck?.normalMaterialStatus ?? req.materialsAnalysis?.normalMaterialStatus ?? req.status;
  const cellTestingStatus = materialsCheck?.cellTestingStatus ?? req.materialsAnalysis?.cellTestingStatus ?? "TESTING REQUIRED";

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planStart || !planEnd) {
      toast.error("Timeline dates are required.");
      return;
    }
    savePlanMutation.mutate({
      productionRequirementId: reqId,
      plannedStartDate: planStart,
      plannedCompletionDate: planEnd,
      priority: planPriority,
      plannedQuantity: Number(planQty),
      supervisorId: supervisorId || null,
      notes: planNotes || null
    });
  };

  return (
    <div className="space-y-4 text-[#0B2148] pb-10">
      
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          type="button"
          onClick={() => router.push(`/${roleSlug}/production/requirements`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-[#0B2148] font-bold text-xs bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#0878F9]" />
          <span>Back to Requirements</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">Requirement ID</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{req.requirementNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                req.status === "COMPLETED" || req.status === "CLOSED" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                req.status === "MATERIAL_SHORTAGE" || req.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                req.status === "READY" ? "bg-teal-50 text-teal-700 border-teal-200" :
                "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {req.status}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/20 flex items-center justify-center text-[#0878F9] shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-[#0B2148]">{req.customer?.name}</p>
                  <p className="text-xs text-[#526B91]">Customer File</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/20 flex items-center justify-center text-[#0878F9] shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-[#0B2148] font-mono text-xs">Sales Order: {req.salesOrder?.salesOrderNumber || "Direct Demand"}</p>
                  <p className="text-xs text-[#526B91]">Commercial Order Ref</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91] border-t border-[#D8E8FA] pt-4">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Required Target Quantity</p>
                  <p className="mt-0.5 text-[#0B2148] font-mono font-bold text-sm">{req.requiredQuantity} Units</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Priority</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    req.priority === "URGENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    req.priority === "HIGH" ? "bg-amber-50 text-amber-800 border-amber-200" :
                    "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9]/20"
                  }`}>
                    {req.priority}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Date Created</p>
                  <p className="mt-0.5 text-[#0B2148] font-mono">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Delivery Target Date</p>
                  <p className="mt-0.5 text-[#0B2148] font-mono">{new Date(req.requiredDeliveryDate).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Material & Cell Status Split */}
              <div className="border-t border-[#D8E8FA] pt-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#526B91] font-medium">Normal Materials:</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded text-[10px] border uppercase ${
                    normalMaterialStatus === "READY" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                    "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    {normalMaterialStatus === "READY" ? "✓ READY" : "SHORTAGE"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#526B91] font-medium">Cell Testing:</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded text-[10px] border uppercase ${
                    cellTestingStatus === "COMPLETED" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                    cellTestingStatus === "IN_PROGRESS" ? "bg-amber-50 text-amber-800 border-amber-200" :
                    "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9]/30"
                  }`}>
                    {cellTestingStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Requirement Control</h3>
            
            <button 
              type="button"
              onClick={() => checkMaterialsMutation.mutate()}
              disabled={checkMaterialsMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#0878F9] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {checkMaterialsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-[#0878F9]" /> : <Boxes className="w-4 h-4 text-[#0878F9]" />}
              <span>Recheck Material Availability</span>
            </button>

            {/* Scheduled In-Place Control */}
            {isScheduled && existingPlan ? (
              <div className="space-y-3 pt-2 border-t border-[#D8E8FA]">
                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Scheduled Plan</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/20 font-mono">
                      {existingPlan.planNumber}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[#0B2148]">
                      <span className="text-[#526B91]">Plan Status:</span>
                      <span className="font-bold text-[#0878F9]">{existingPlan.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#0B2148]">
                      <span className="text-[#526B91]">Schedule Window:</span>
                      <span className="font-mono text-[#0B2148] text-[11px] font-semibold">
                        {new Date(existingPlan.plannedStartDate).toLocaleDateString()} → {new Date(existingPlan.plannedCompletionDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#0B2148]">
                      <span className="text-[#526B91]">Planned Qty:</span>
                      <span className="font-mono font-bold text-[#0B2148]">{existingPlan.plannedQuantity} Units</span>
                    </div>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleOpenScheduleModal}
                  className="w-full py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Edit Schedule Dates</span>
                </button>
                <p className="text-[10px] text-[#526B91] text-center italic">
                  Scheduled once. Editing updates the existing plan timeline.
                </p>
              </div>
            ) : req.status === "READY" ? (
              <button 
                type="button"
                onClick={handleOpenScheduleModal}
                className="w-full py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Production Plan</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] text-[11px] text-[#526B91] text-center">
                Material or cell qualifications pending before initial scheduling.
              </div>
            )}
          </div>
        </div>

        {/* Right Column Material availability checklist & Cell Testing & Plans */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. NORMAL MATERIALS AVAILABILITY ANALYSIS (EXCLUDING CELLS) */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D8E8FA]">
              <div>
                <h3 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-[#0878F9]" />
                  <span>Materials Availability Analysis</span>
                </h3>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Normal production BOM components (BMS, Busbars, Insulation, Connectors, Housing).
                </p>
              </div>

              <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider self-start sm:self-auto ${
                normalMaterialStatus === "READY" ? "bg-emerald-50 border-emerald-200 text-[#166534]" :
                "bg-rose-50 border-rose-200 text-rose-700"
              }`}>
                {normalMaterialStatus === "READY" ? "✓ NORMAL MATERIALS READY" : "MATERIAL SHORTAGE"}
              </span>
            </div>
            
            {normalMaterials.length === 0 ? (
              <div className="p-8 text-center text-[#526B91] text-xs">
                No normal BOM materials calculated. Click "Recheck Material Availability" to evaluate.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider text-[10px] bg-[#F4F9FF]">
                      <th className="py-2.5 px-3">Material SKU / Name</th>
                      <th className="py-2.5 px-3">Required</th>
                      <th className="py-2.5 px-3">Physical Stock</th>
                      <th className="py-2.5 px-3">Available</th>
                      <th className="py-2.5 px-3 text-rose-700 font-bold">Shortage</th>
                      <th className="py-2.5 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                    {normalMaterials.map((item: any, idx: number) => (
                      <tr key={`${item.materialId || 'mat'}-${idx}`} className="hover:bg-[#F4F9FF] transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#0B2148]">{item.name}</div>
                          <div className="text-[10px] text-[#526B91] font-mono mt-0.5">SKU: {item.sku}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#0B2148]">{item.required}</td>
                        <td className="py-3 px-3 font-mono text-[#0B2148]">{item.physical}</td>
                        <td className="py-3 px-3 font-mono text-[#0B2148]">{item.available}</td>
                        <td className="py-3 px-3 font-mono font-bold text-rose-700">{item.shortage}</td>
                        <td className="py-3 px-3">
                          {item.shortage > 0 ? (
                            item.prRequested || spawnedPRs[item.materialId] ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-[10px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                                <span>Requested ({item.prNumber || spawnedPRs[item.materialId]?.prNumber || "PR Pending"})</span>
                              </div>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => spawnPRMutation.mutate({ materialId: item.materialId, shortageQty: item.shortage })}
                                disabled={spawnPRMutation.isPending && (spawnPRMutation.variables as any)?.materialId === item.materialId}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-[10px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                {spawnPRMutation.isPending && (spawnPRMutation.variables as any)?.materialId === item.materialId ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-rose-700" />
                                ) : (
                                  <ArrowUpRight className="w-3 h-3" />
                                )}
                                <span>Purchase Request</span>
                              </button>
                            )
                          ) : (
                            <span className="text-[#166534] font-bold text-[10px] flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3.5 h-3.5" />
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. DEDICATED SEPARATE CELL TESTING REQUIREMENT SECTION */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF5FF] flex items-center justify-center text-[#0878F9] border border-[#0878F9]/20 shadow-xs">
                  <Microscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                    CELL TESTING REQUIREMENT
                  </h3>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Cells are a specialized serialized input qualified strictly via electrical testing & QC.
                  </p>
                </div>
              </div>

              <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider self-start sm:self-auto ${
                cellTestingStatus === "COMPLETED" ? "bg-emerald-50 border-emerald-200 text-[#166534]" :
                cellTestingStatus === "IN_PROGRESS" ? "bg-amber-50 border-amber-200 text-amber-800" :
                "bg-[#EAF5FF] border-[#0878F9]/30 text-[#0878F9]"
              }`}>
                {cellTestingStatus === "COMPLETED" ? "✓ CELL TESTING COMPLETE" : cellTestingStatus}
              </span>
            </div>

            {cellRequirements.length === 0 ? (
              <div className="p-8 text-center text-[#526B91] text-xs border border-dashed border-[#D8E8FA] rounded-2xl">
                No cell requirements identified in BOM.
              </div>
            ) : (
              <div className="space-y-4">
                {cellRequirements.map((cellReq: any, idx: number) => {
                  const pct = cellReq.requiredQuantity > 0 
                    ? Math.min(100, Math.round((cellReq.testedQuantity / cellReq.requiredQuantity) * 100)) 
                    : 0;
                  const isFulfilled = cellReq.status === "COMPLETED" || pct >= 100;

                  return (
                    <div 
                      key={`${cellReq.sku || 'cell'}-${idx}`}
                      className="p-5 rounded-2xl border border-[#D8E8FA] bg-[#F4F9FF] space-y-4 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#0878F9]">{cellReq.sku}</span>
                            <span className="text-xs text-[#0B2148] font-semibold">• {cellReq.name}</span>
                          </div>
                          <p className="text-xs text-[#526B91] mt-1">
                            Target Product: <strong className="text-[#0B2148]">{req.productRef || "Battery Pack"}</strong> ({req.requiredQuantity} units × {cellReq.bomQtyPerUnit} cells/pack)
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/${roleSlug}/testing`)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] hover:border-[#0878F9]/40 text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#0878F9]" />
                            <span>View Testing Station</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 4 Precision Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-white border border-[#D8E8FA] shadow-xs">
                          <p className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider">Cells Required</p>
                          <p className="text-lg font-bold font-mono text-[#0B2148] mt-1">{cellReq.requiredQuantity}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
                          <p className="text-[10px] text-[#166534] uppercase font-bold tracking-wider">Cells Qualified</p>
                          <p className="text-lg font-bold font-mono text-[#166534] mt-1">{cellReq.testedQuantity}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 shadow-xs">
                          <p className="text-[10px] text-amber-800 uppercase font-bold tracking-wider">Cells Remaining</p>
                          <p className="text-lg font-bold font-mono text-amber-800 mt-1">{cellReq.remainingQuantity}</p>
                        </div>

                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 shadow-xs">
                          <p className="text-[10px] text-[#0878F9] uppercase font-bold tracking-wider">Bulk Inward Stock</p>
                          <p className="text-lg font-bold font-mono text-[#0878F9] mt-1">
                            {cellReq.bulkInwardAvailable} <span className="text-[10px] text-[#526B91] font-normal">pcs</span>
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#526B91]">Testing Progress:</span>
                          <span className={isFulfilled ? "text-[#166534] font-bold" : "text-[#0878F9] font-bold"}>
                            {cellReq.testedQuantity} / {cellReq.requiredQuantity} Qualified ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-[#D8E8FA]">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              isFulfilled ? "bg-emerald-500" : "bg-[#0878F9]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Informational Callout */}
                      <div className="p-3 rounded-xl bg-white border border-[#D8E8FA] flex items-start gap-2.5 text-xs text-[#0B2148]">
                        <Info className="w-4 h-4 text-[#0878F9] shrink-0 mt-0.5" />
                        <span>
                          <strong>Physical Cell Stock Invariant:</strong> The {cellReq.bulkInwardAvailable} bulk inward cells are un-serialized raw stock. Cells become production-ready only when scanned, tested, and assigned a <strong className="text-[#166534] font-mono">CELL_TESTED</strong> pass decision by the Test Engineer.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Associated Production Plans list */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-[#0B2148]">Associated Production Plans</h3>
            {req.plans?.length > 0 ? (
              <div className="space-y-3">
                {req.plans.map((p: any) => (
                  <div key={p.id} className="p-4 rounded-2xl border border-[#D8E8FA] bg-[#F4F9FF] flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-[#0B2148] font-mono">{p.planNumber}</p>
                      <p className="text-[#526B91] mt-1">Planned Qty: {p.plannedQuantity} | Completion Target: {new Date(p.plannedCompletionDate).toLocaleDateString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/${roleSlug}/production/plans/${p.id}`)}
                      className="text-[#0878F9] hover:text-[#0665d0] flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <span>View Plan</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#526B91]">No Production Plans scheduled for this requirement yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Schedule / Edit Production Plan Modal */}
      {isPlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSavePlan} className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-md w-full mx-auto space-y-4 shadow-2xl text-[#0B2148]">
            <div>
              <h3 className="text-base font-bold text-[#0B2148]">
                {isScheduled && existingPlan ? "Edit Production Plan Schedule" : "Schedule Production Plan"}
              </h3>
              <p className="text-xs text-[#526B91] mt-0.5">
                {isScheduled && existingPlan 
                  ? `Update timeline dates & parameters for ${existingPlan.planNumber}`
                  : "Create initial production schedule for this requirement"}
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Planned Quantity *</label>
                  <input 
                    type="number"
                    required
                    min={1}
                    value={planQty}
                    onChange={(e) => setPlanQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Priority</label>
                  <select
                    value={planPriority}
                    onChange={(e) => setPlanPriority(e.target.value)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Planned Start Date *</label>
                  <input 
                    type="date"
                    required
                    value={planStart}
                    onChange={(e) => setPlanStart(e.target.value)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Target Completion *</label>
                  <input 
                    type="date"
                    required
                    value={planEnd}
                    onChange={(e) => setPlanEnd(e.target.value)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Assign Supervisor *</label>
                <select
                  required
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs font-semibold text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                >
                  <option value="">Select Supervisor</option>
                  {supervisors?.map((sup: any) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} {sup.roles?.length ? `(${sup.roles.join(", ")})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Planning Notes</label>
                <input 
                  type="text"
                  placeholder="Scheduling remarks..."
                  value={planNotes}
                  onChange={(e) => setPlanNotes(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-[#D8E8FA]">
              <button 
                type="button" 
                onClick={() => setIsPlanOpen(false)} 
                className="px-4 py-2 rounded-xl text-[#526B91] hover:text-[#0B2148] bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={savePlanMutation.isPending}
                className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {savePlanMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isScheduled && existingPlan ? "Update Schedule Dates" : "Schedule Plan"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
