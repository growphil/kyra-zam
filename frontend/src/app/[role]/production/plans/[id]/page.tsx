"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  FileText, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  Check,
  CheckCircle2,
  Plus,
  ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function ProductionPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Work Order generation state
  const [isWOCreateOpen, setIsWOCreateOpen] = useState(false);
  const [woPlannedQty, setWOPlannedQty] = useState(1);
  const [woDueDate, setWODueDate] = useState("");
  const [selectedBOMId, setSelectedBOMId] = useState("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<string[]>([]);
  const [woNotes, setWONotes] = useState("");

  // --- DATA FETCHING ---
  const { data: plan, isLoading } = useQuery({
    queryKey: ["production-plan-details", planId],
    queryFn: async () => {
      const res = await api.get(`/crm/production/plans/${planId}`);
      return res.data;
    }
  });

  const existingWO = plan?.workOrders && plan.workOrders.length > 0 ? plan.workOrders[0] : null;
  const hasWorkOrder = Boolean(existingWO);

  const { data: operators } = useQuery({
    queryKey: ["operators-dropdown"],
    queryFn: async () => {
      const res = await api.get("/crm/users");
      return res.data || [];
    }
  });

  const { data: boms } = useQuery({
    queryKey: ["boms-dropdown"],
    queryFn: async () => (await api.get("/bom")).data || []
  });

  // Modal open handler
  const handleOpenWOModal = (wo?: any) => {
    const targetWO = wo || existingWO;
    if (targetWO) {
      setWOPlannedQty(targetWO.plannedQuantity);
      setWODueDate(targetWO.dueDate ? targetWO.dueDate.split("T")[0] : "");
      setSelectedBOMId(targetWO.bomId || "");
      setSelectedSupervisorId(targetWO.supervisorId || plan?.supervisorId || "");
      const opIds = targetWO.operators?.map((o: any) => o.userId || o.id) || [];
      setSelectedOperatorIds(opIds);
      setWONotes(targetWO.notes || "");
    } else {
      setWOPlannedQty(plan?.plannedQuantity || 1);
      setWODueDate(plan?.plannedCompletionDate ? plan.plannedCompletionDate.split("T")[0] : "");
      setSelectedBOMId(boms?.[0]?.id || "");
      setSelectedSupervisorId(plan?.supervisorId || "");
      setSelectedOperatorIds([]);
      setWONotes("");
    }
    setIsWOCreateOpen(true);
  };

  // --- MUTATIONS ---
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/production/plans/${planId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-plan-details", planId] });
      queryClient.invalidateQueries({ queryKey: ["production-plans"] });
      toast.success("Plan status updated successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Status update failed")
  });

  const saveWOMutation = useMutation({
    mutationFn: async (data: any) => {
      if (existingWO) {
        return api.patch(`/crm/production/work-orders/${existingWO.id}`, data);
      } else {
        return api.post("/crm/production/work-orders", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-plan-details", planId] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success(existingWO ? "Work Order updated successfully" : "Work Order created successfully");
      setIsWOCreateOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to save Work Order")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Production Plan File Not Found</p>
      </div>
    );
  }

  const handleSaveWO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!woDueDate || !selectedBOMId) {
      toast.error("BOM and Due Date are required.");
      return;
    }
    saveWOMutation.mutate({
      productionPlanId: planId,
      productionRequirementId: plan.productionRequirementId,
      salesOrderId: plan.productionRequirement?.salesOrderId,
      productRef: plan.productionRequirement?.productRef,
      bomId: selectedBOMId,
      plannedQuantity: Number(woPlannedQty),
      dueDate: woDueDate,
      supervisorId: selectedSupervisorId || null,
      notes: woNotes || null,
      operatorIds: selectedOperatorIds
    });
  };

  const handleOperatorSelect = (userId: string) => {
    if (selectedOperatorIds.includes(userId)) {
      setSelectedOperatorIds(selectedOperatorIds.filter(id => id !== userId));
    } else {
      setSelectedOperatorIds([...selectedOperatorIds, userId]);
    }
  };

  return (
    <div className="space-y-4 text-[#0B2148] pb-10">
      
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/production/plans`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-[#0B2148] font-bold text-xs bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#0878F9]" />
          <span>Back to Plans</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6 shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">Plan ID</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{plan.planNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                plan.status === "COMPLETED" || plan.status === "CLOSED" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                plan.status === "RELEASED" ? "bg-teal-50 text-teal-700 border-teal-200" :
                plan.status === "PLANNED" ? "bg-blue-50 text-[#0878F9] border-blue-200" :
                plan.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {plan.status}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/20 flex items-center justify-center text-[#0878F9] shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-[#0B2148]">{plan.supervisor?.name || "Unassigned"}</p>
                  <p className="text-xs text-[#526B91]">Supervisor File</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/20 flex items-center justify-center text-[#0878F9] shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-[#0B2148] font-mono text-xs">Requirement: {plan.productionRequirement?.requirementNumber}</p>
                  <p className="text-xs text-[#526B91]">Target Production Requirement</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91] border-t border-[#D8E8FA] pt-4">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Planned Batch Quantity</p>
                  <p className="mt-0.5 text-[#0B2148] font-mono font-bold text-sm">{plan.plannedQuantity} Units</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Priority</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    plan.priority === "URGENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    plan.priority === "HIGH" ? "bg-amber-50 text-amber-800 border-amber-200" :
                    "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9]/20"
                  }`}>
                    {plan.priority}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Planned Start</p>
                  <p className="mt-0.5 text-[#0B2148] font-mono">{new Date(plan.plannedStartDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Completion Target</p>
                  <p className="mt-0.5 text-[#0B2148] font-mono">{new Date(plan.plannedCompletionDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Plan & Execution Control</h3>
            
            {/* If Work Order is already generated for this plan */}
            {hasWorkOrder && existingWO ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Active Work Order</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/20 font-mono">
                      {existingWO.workOrderNumber}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[#0B2148]">
                      <span className="text-[#526B91]">WO Status:</span>
                      <span className="font-bold text-[#0878F9]">{existingWO.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#0B2148]">
                      <span className="text-[#526B91]">Target Due Date:</span>
                      <span className="font-mono text-[#0B2148] text-[11px] font-semibold">
                        {existingWO.dueDate ? new Date(existingWO.dueDate).toLocaleDateString() : "Not set"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#0B2148]">
                      <span className="text-[#526B91]">Planned Quantity:</span>
                      <span className="font-mono font-bold text-[#0B2148]">{existingWO.plannedQuantity} Units</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleOpenWOModal(existingWO)}
                  className="w-full py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Edit Work Order Parameters</span>
                </button>

                <button 
                  onClick={() => router.push(`/${roleSlug}/production/work-orders/${existingWO.id}`)}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0878F9] text-xs font-bold border border-[#D8E8FA] hover:border-[#0878F9]/40 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 text-[#0878F9]" />
                  <span>Open Operation View</span>
                </button>
                
                <p className="text-[10px] text-[#526B91] text-center italic">
                  Work Order already generated. Editable in-place without creating duplicates.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {plan.status === "DRAFT" && (
                  <>
                    <button 
                      onClick={() => updateStatusMutation.mutate("PLANNED")}
                      disabled={updateStatusMutation.isPending}
                      className="w-full py-2.5 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0667DB] transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Approve & Plan Batch</span>
                    </button>
                    <button 
                      onClick={() => updateStatusMutation.mutate("CANCELLED")}
                      disabled={updateStatusMutation.isPending}
                      className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Cancel Plan
                    </button>
                  </>
                )}

                {plan.status === "PLANNED" && (
                  <>
                    <button 
                      onClick={() => updateStatusMutation.mutate("RELEASED")}
                      disabled={updateStatusMutation.isPending}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Release to Production</span>
                    </button>
                    <button 
                      onClick={() => updateStatusMutation.mutate("ON_HOLD")}
                      disabled={updateStatusMutation.isPending}
                      className="w-full py-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Put on Hold
                    </button>
                  </>
                )}

                {plan.status === "RELEASED" && (
                  <button 
                    onClick={() => handleOpenWOModal()}
                    className="w-full py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Generate Work Order</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column Work Orders List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
              <h3 className="text-base font-bold text-[#0B2148]">Production Work Orders</h3>
              {hasWorkOrder && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-[#166534] border border-emerald-200">
                  1 Active Work Order Linked
                </span>
              )}
            </div>

            {plan.workOrders?.length > 0 ? (
              <div className="space-y-3">
                {plan.workOrders.map((wo: any) => (
                  <div key={wo.id} className="p-4 rounded-2xl border border-[#D8E8FA] bg-[#F4F9FF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#0B2148] font-mono text-sm">{wo.workOrderNumber}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono uppercase ${
                          wo.status === "COMPLETED" || wo.status === "CLOSED" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                          wo.status === "IN_PROGRESS" || wo.status === "READY" ? "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9]/20" :
                          wo.status === "QC_PENDING" ? "bg-teal-50 text-teal-700 border-teal-200" :
                          "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          {wo.status}
                        </span>
                      </div>
                      <p className="text-[#526B91] mt-1 text-xs">
                        Planned Qty: <strong className="text-[#0B2148] font-mono font-bold">{wo.plannedQuantity}</strong> | Completed: <strong className="text-[#166534] font-mono font-bold">{wo.completedQuantity || 0}</strong> | Due: <strong className="text-[#0B2148] font-mono font-bold">{wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : "N/A"}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenWOModal(wo)}
                        className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0B2148] hover:text-[#0878F9] font-bold text-xs border border-[#D8E8FA] hover:border-[#0878F9]/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#0878F9]" />
                        <span>Edit Specifications</span>
                      </button>
                      <button 
                        onClick={() => router.push(`/${roleSlug}/production/work-orders/${wo.id}`)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span>Operation View</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#526B91] py-6 text-center">No Work Orders generated from this Plan yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Generate / Edit Work Order Modal */}
      {isWOCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveWO} className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl w-full mx-auto space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl text-[#0B2148]">
            <div>
              <h3 className="text-lg font-bold text-[#0B2148]">
                {hasWorkOrder && existingWO ? "Edit Operations Work Order" : "Generate Operations Work Order"}
              </h3>
              <p className="text-xs text-[#526B91] mt-0.5">
                {hasWorkOrder && existingWO 
                  ? `Update specifications & assignments for ${existingWO.workOrderNumber}`
                  : "Initialize production work order from this released plan"}
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Planned Quantity *</label>
                  <input 
                    type="number"
                    required
                    min={1}
                    value={woPlannedQty}
                    onChange={(e) => setWOPlannedQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Due Date Target *</label>
                  <input 
                    type="date"
                    required
                    value={woDueDate}
                    onChange={(e) => setWODueDate(e.target.value)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Select BOM Specification *</label>
                  <select
                    required
                    value={selectedBOMId}
                    onChange={(e) => setSelectedBOMId(e.target.value)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  >
                    <option value="">Choose BOM</option>
                    {boms?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Supervisor Assignment</label>
                  <select
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0B2148] focus:border-[#0878F9] focus:outline-none shadow-xs"
                  >
                    <option value="">Choose Supervisor</option>
                    {operators?.filter((u: any) => u.roles?.includes("SUPERVISOR") || u.roles?.includes("ADMIN") || u.roles?.includes("SUPERADMIN") || u.roles?.includes("PLANT_MANAGER")).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} {u.roles?.length ? `(${u.roles.join(", ")})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Operators checkboxes */}
              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold block pb-1">Assign Assembly Technicians</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#F4F9FF] p-3.5 rounded-2xl border border-[#D8E8FA] max-h-40 overflow-y-auto">
                  {operators?.filter((u: any) => u.roles?.includes("ASSEMBLY_TECHNICIAN") || u.roles?.includes("OPERATOR")).map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 text-xs text-[#0B2148] cursor-pointer hover:text-[#0878F9] transition-colors p-1.5 rounded-lg hover:bg-white">
                      <input 
                        type="checkbox"
                        checked={selectedOperatorIds.includes(u.id)}
                        onChange={() => handleOperatorSelect(u.id)}
                        className="rounded border-[#D8E8FA] text-[#0878F9] focus:ring-[#0878F9]"
                      />
                      <span className="font-medium">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Technician Remarks & Notes</label>
                <input 
                  type="text"
                  placeholder="Special technician instructions..."
                  value={woNotes}
                  onChange={(e) => setWONotes(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-[#D8E8FA]">
              <button 
                type="button" 
                onClick={() => setIsWOCreateOpen(false)} 
                className="px-4 py-2.5 rounded-xl text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF] bg-white border border-[#D8E8FA] text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saveWOMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saveWOMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{hasWorkOrder && existingWO ? "Update Work Order" : "Create Work Order"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
