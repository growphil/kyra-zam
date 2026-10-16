"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Layers, 
  Activity, 
  History, 
  Loader2, 
  AlertCircle,
  FileText
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id, role } = params as { id: string; role: string };
  const roleSlug = role;

  // --- QUERY: Work Order Detail ---
  const { data, isLoading, error } = useQuery({
    queryKey: ["work-order-detail", id],
    queryFn: async () => (await api.get(`/crm/production/work-orders/${id}`)).data
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-4 text-white">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
        <p className="text-sm text-[#526B91] font-display">Loading work order details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto mt-24 p-6 glass-panel rounded-3xl border border-red-500/20 text-center text-white space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold">Failed to load Work Order</h3>
        <p className="text-xs text-[#526B91]">Please verify the Work Order ID or role permissions.</p>
        <button 
          onClick={() => router.push(`/${roleSlug}/production/work-orders`)}
          className="px-4 py-2 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-semibold text-xs"
        >
          Go Back
        </button>
      </div>
    );
  }

  const wo = data.workOrder || data || {};
  const sched = wo.scheduling || null;
  const exec = wo.execution || null;
  const bom = wo.bom || null;
  const audits = data.auditHistory || [];

  const estimatedHrs = sched?.estimatedHrs || 0;
  const actualHrs = exec?.actualHours || 0;
  const variance = actualHrs - estimatedHrs;

  const hasScheduled = !!sched;
  const hasStarted = !!exec?.startedAt;
  const hasPaused = audits.some((a: any) => a.action === "PRODUCTION_PAUSED");
  const hasResumed = audits.some((a: any) => a.action === "PRODUCTION_RESUMED");
  const hasQcPending = ["QC_PENDING", "COMPLETED", "CLOSED"].includes(wo.status);
  const hasQc = (wo.inspections && wo.inspections.length > 0) || ["COMPLETED", "CLOSED"].includes(wo.status);
  const hasCompleted = ["COMPLETED", "CLOSED"].includes(wo.status);

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title={wo.workOrderNumber}
        description={`BOM Reference SKU: ${wo.productRef || "N/A"}`}
        icon={<FileText className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Work Orders", href: `/${roleSlug}/production/work-orders` },
          { label: wo.workOrderNumber }
        ]}
        badge={
          <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase ${
            wo.status === "IN_PROGRESS" 
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : wo.status === "ON_HOLD"
              ? "bg-red-50 border-red-200 text-red-700"
              : ["QC_PENDING", "COMPLETED", "CLOSED"].includes(wo.status)
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-slate-100 border-slate-200 text-[#526B91]"
          }`}>
            {wo.status === "ON_HOLD" ? "PAUSED" : wo.status}
          </span>
        }
        actions={
          <button 
            onClick={() => router.push(`/${roleSlug}/production/work-orders`)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Work Orders
          </button>
        }
      />

      {/* Horizontal Operational Timeline Stepper */}
      <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white">
        <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-widest mb-6">Operational Flow Timeline</h3>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-0 relative">
          
          {/* Connector Line for Desktop */}
          <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-[#F4F9FF] -translate-y-1/2 hidden md:block z-0" />
          
          {[
            { label: "SCHEDULED", active: hasScheduled, detail: sched ? `Seq #${sched.sequence}` : "Pending" },
            { label: "STARTED", active: hasStarted, detail: exec?.startedAt ? new Date(exec.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Pending" },
            { label: "PAUSED", active: hasPaused, detail: hasPaused ? "Triggered" : "Not Hit" },
            { label: "RESUMED", active: hasResumed, detail: hasResumed ? "Triggered" : "Not Hit" },
            { label: "QC PENDING", active: hasQcPending, detail: wo.status === "QC_PENDING" ? "Awaiting QC" : "Pending" },
            { label: "QC CHECK", active: hasQc, detail: (wo.inspections && wo.inspections[0]) ? `Result: ${wo.inspections[0].result}` : "Pending" },
            { label: "COMPLETED", active: hasCompleted, detail: exec?.completedAt ? new Date(exec.completedAt).toLocaleDateString() : "Pending" }
          ].map((step, index) => (
            <div key={index} className="flex-1 flex flex-row md:flex-col items-center gap-3 md:gap-2.5 z-10 relative text-left md:text-center">
              {/* Circle Badge */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 ${
                step.active 
                  ? "bg-accent text-black ring-4 ring-accent/20" 
                  : "bg-[#0b0f19] border border-[#D8E8FA] text-[#526B91]"
              }`}>
                {index + 1}
              </div>
              
              <div className="space-y-0.5">
                <p className={`text-[10px] font-bold tracking-wider uppercase ${step.active ? "text-accent" : "text-[#526B91]"}`}>
                  {step.label}
                </p>
                {step.detail && (
                  <p className="text-[10px] text-[#526B91] font-medium">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Columns - Details */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Scheduling & Execution Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Scheduling Card */}
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-accent" />
                Scheduling Details
              </h3>
              {sched ? (
                <div className="space-y-2 text-xs text-[#526B91]">
                  <div className="flex justify-between">
                    <span>Assigned Date:</span>
                    <span className="font-bold text-[#0B2148]">{new Date(sched.assignedDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sequence Position:</span>
                    <span className="font-bold text-[#0B2148]">{sched.sequence}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Duration:</span>
                    <span className="font-bold text-accent">{sched.estimatedHrs} Hrs</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#526B91] italic">Work Order has not been scheduled yet.</p>
              )}
            </div>

            {/* Execution Card */}
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
                <Activity className="w-4 h-4 text-blue-400" />
                Execution Tracking
              </h3>
              {exec ? (
                <div className="space-y-2 text-xs text-[#526B91]">
                  <div className="flex justify-between">
                    <span>Started At:</span>
                    <span className="font-bold text-[#0B2148]">{exec.startedAt ? new Date(exec.startedAt).toLocaleString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed At:</span>
                    <span className="font-bold text-[#0B2148]">{exec.completedAt ? new Date(exec.completedAt).toLocaleString() : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Actual Duration:</span>
                    <span className="font-bold text-[#166534]">{exec.actualHours ? exec.actualHours.toFixed(2) : "0.00"} Hrs</span>
                  </div>
                  {sched && (
                    <div className="flex justify-between">
                      <span>Hours Variance:</span>
                      <span className={`font-bold ${variance > 0 ? "text-red-400" : "text-[#166534]"}`}>
                        {variance > 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2)} Hrs
                      </span>
                    </div>
                  )}
                  {exec.pausedAt && (
                    <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl mt-1 text-[10px] text-red-400">
                      Paused for: {exec.pauseReason}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#526B91] italic">Work Order execution has not started.</p>
              )}
            </div>

          </div>

          {/* BOM Material Allocation Card */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-amber-500" />
              BOM Material Allocations
            </h3>

            {bom ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D8E8FA] text-[#526B91]">
                      <th className="pb-3 font-semibold uppercase tracking-wider">SKU / SKU Name</th>
                      <th className="pb-3 font-semibold uppercase tracking-wider">Qty Needed</th>
                      <th className="pb-3 font-semibold uppercase tracking-wider">Stock Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bom.items?.map((item: any) => (
                      <tr key={item.id} className="border-b border-[#D8E8FA] hover:bg-[#F4F9FF]">
                        <td className="py-3.5">
                          <p className="font-bold text-[#0B2148]">{item.material?.sku}</p>
                          <p className="text-[10px] text-[#526B91]">{item.material?.name}</p>
                        </td>
                        <td className="py-3.5 font-semibold text-[#0B2148]">
                          {item.quantity * wo.plannedQuantity} {item.material?.unit}
                        </td>
                        <td className="py-3.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91]">
                            {item.material?.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#526B91] italic">No bill of materials (BOM) linked to this Work Order.</p>
            )}
          </div>

        </div>

        {/* Right Column - Audit Trail Timeline */}
        <div className="lg:col-span-4">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 h-full">
            <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2 uppercase tracking-wider">
              <History className="w-4 h-4 text-[#526B91]" />
              Audit Log Timeline
            </h3>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {audits.length === 0 ? (
                <p className="text-xs text-[#526B91] italic py-12 text-center">No logs recorded for this Work Order.</p>
              ) : (
                audits.map((log: any) => (
                  <div key={log.id} className="relative pl-6 pb-4 border-l border-[#D8E8FA] last:border-l-0 text-xs">
                    {/* Circle Node */}
                    <div className="absolute -left-1.5 top-0.5 w-3 h-3 rounded-full bg-accent border border-[#020617]" />
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-[#0B2148] uppercase tracking-wider text-[10px]">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-[#526B91]">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="text-[11px] text-[#526B91]">
                        <span>Changed state from <strong className="text-white">{log.prevStatus || "N/A"}</strong> to <strong className="text-white">{log.newStatus || "N/A"}</strong></span>
                      </div>

                      {log.metadata && (
                        <pre className="p-2 bg-[#F4F9FF] rounded-lg text-[9px] text-[#526B91] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
