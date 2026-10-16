"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Box,
  Layers,
  Clock,
  ShieldCheck,
  AlertCircle,
  PackageCheck,
  ShoppingCart,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

interface MaterialItem {
  materialId: string;
  sku: string;
  name: string;
  unit: string;
  neededQty: number;
  allocatedToOrder: number;
  physicalStock: number;
  totalReserved: number;
  availableStock: number;
  shortage: number;
  isAllocated: boolean;
  isShortage: boolean;
}

interface LiveRun {
  id: string;
  workOrderNumber: string;
  status: "IN_PROGRESS" | "ON_HOLD";
  productRef?: string;
  plannedQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
  dueDate: string;
  salesOrder?: { salesOrderNumber: string; priority: string; customer?: { name: string } };
  productionPlan?: { planNumber: string; priority: string };
  execution?: {
    startedAt?: string;
    pausedAt?: string;
    pauseReason?: string;
    station?: string;
  };
  operators?: { user: { id: string; name: string; email: string } }[];
  bomName: string;
  materials: MaterialItem[];
  hasActiveShortage: boolean;
  isPausedForMaterial: boolean;
}

interface UnallocatedOrder {
  id: string;
  workOrderNumber: string;
  status: string;
  productRef?: string;
  plannedQuantity: number;
  dueDate: string;
  salesOrder?: { salesOrderNumber: string; customer?: { name: string } };
  productionPlan?: { planNumber: string; priority: string };
  bom?: { id: string; name: string; itemCount: number } | null;
}

export default function ProductionDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = params.role as string;

  // Selected tab in the monitor section
  const [activeTab, setActiveTab] = useState<"LIVE" | "ALLOCATION_GATE" | "READY_QUEUE">("LIVE");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  
  // PR Modal state
  const [prModalOrder, setPrModalOrder] = useState<LiveRun | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [prQuantity, setPrQuantity] = useState<number>(1);
  const [prNotes, setPrNotes] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const { data: dashboardData, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["production-dashboard-stats"],
    queryFn: async () => (await api.get("/crm/production/dashboard")).data,
    refetchInterval: 10000 // Poll every 10s for live production updates
  });

  const stats = dashboardData?.stats || {};
  const liveRuns: LiveRun[] = dashboardData?.liveRuns || [];
  const unallocatedWorkOrders: UnallocatedOrder[] = dashboardData?.unallocatedWorkOrders || [];
  const readyWorkOrders: any[] = dashboardData?.readyWorkOrders || [];
  const shortageAlerts: any[] = dashboardData?.shortageAlerts || [];

  // Toggle expanded BOM details
  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // --- MUTATION: ALLOCATE MATERIALS ---
  const allocateMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      if (!workOrderId) throw new Error("Work Order ID is required");
      return (await api.post(`/crm/production/work-orders/${workOrderId}/allocate`)).data;
    },
    onSuccess: (_, workOrderId) => {
      setActionError(null);
      setActionSuccess(`Materials successfully allocated for Work Order.`);
      queryClient.invalidateQueries({ queryKey: ["production-dashboard-stats"] });
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionSuccess(null);
      setActionError(err.response?.data?.error || err.message || "Failed to allocate materials");
    }
  });

  // --- MUTATION: SPAWN PR ---
  const spawnPrMutation = useMutation({
    mutationFn: async ({ reqId, materialId, shortageQty }: { reqId?: string; materialId: string; shortageQty: number }) => {
      if (reqId) {
        return (await api.post(`/crm/production/requirements/${reqId}/spawn-purchase-request`, {
          materialId,
          shortageQty
        })).data;
      } else {
        // Create direct PR
        return (await api.post(`/crm/procurement/requests`, {
          requiredDate: new Date().toISOString(),
          priority: "URGENT",
          reason: `Floor shortage replenishment: ${prNotes || "Urgent production demand"}`,
          items: [{ materialId, requestedQuantity: shortageQty }]
        })).data;
      }
    },
    onSuccess: () => {
      setPrModalOrder(null);
      setActionError(null);
      setActionSuccess("Purchase Request successfully spawned for shortage replenishment.");
      queryClient.invalidateQueries({ queryKey: ["production-dashboard-stats"] });
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.error || err.message || "Failed to create Purchase Request");
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-32 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-[#526B91] font-medium text-sm">Loading Material Readiness & Live Production Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Toast Feedback */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-sm shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between text-sm shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="Material Readiness & Live Production"
        description="Live BOM Consumption Monitor • Reservation Allocations • Shop-Floor Support"
        icon={<Box className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Inventory Support Hub
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D8E8FA] bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-accent" : "text-[#526B91]"}`} />
              <span>{isRefetching ? "Refreshing..." : "Refresh Live Feed"}</span>
            </button>
            
            <button 
              onClick={() => router.push(`/${roleSlug}/production/work-orders`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <span>All Work Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "Active Live Runs",
            value: stats.liveRunsCount || stats.activeWorkOrders || 0,
            sub: "In progress on shop floor",
            color: "text-blue-600",
            bg: "bg-blue-50/50",
            border: "border-blue-200/60",
            icon: Activity,
            pulse: true,
            tab: "LIVE" as const
          },
          {
            label: "Pending Allocation",
            value: stats.unallocatedCount || 0,
            sub: "Requires material reservation",
            color: "text-amber-600",
            bg: "bg-amber-50/50",
            border: "border-amber-200/60",
            icon: Layers,
            pulse: false,
            tab: "ALLOCATION_GATE" as const
          },
          {
            label: "Ready for Start",
            value: stats.readyCount || stats.readyReqs || 0,
            sub: "Materials locked & staged",
            color: "text-emerald-600",
            bg: "bg-emerald-50/50",
            border: "border-emerald-200/60",
            icon: ShieldCheck,
            pulse: false,
            tab: "READY_QUEUE" as const
          },
          {
            label: "Material Shortages",
            value: stats.shortageReqs || stats.activeShortageAlertsCount || 0,
            sub: "Critical stock alerts",
            color: "text-rose-600",
            bg: "bg-rose-50/50",
            border: "border-rose-200/60",
            icon: AlertTriangle,
            pulse: false,
            onClick: () => router.push(`/${roleSlug}/production/requirements?status=MATERIAL_SHORTAGE`)
          }
        ].map(card => {
          const Icon = card.icon;
          return (
            <div 
              key={card.label} 
              onClick={() => {
                if (card.tab) setActiveTab(card.tab);
                else if (card.onClick) card.onClick();
              }}
              className={`bg-white p-6 rounded-3xl border ${card.border} shadow-xs cursor-pointer hover:shadow-md transition-all group relative overflow-hidden`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[#526B91] text-xs font-bold uppercase tracking-wider">{card.label}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <h4 className={`text-4xl font-display font-bold ${card.color}`}>{card.value}</h4>
                    {card.pulse && (
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-[#526B91] mt-2">{card.sub}</p>
                </div>
                <div className={`p-3 rounded-2xl ${card.bg} border border-slate-100`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Section: Live Production & Material Support Workspace */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {[
              { id: "LIVE", label: "Live Floor Runs", count: liveRuns.length, icon: Activity },
              { id: "ALLOCATION_GATE", label: "Pre-Start Material Allocation Gate", count: unallocatedWorkOrders.length, icon: Layers },
              { id: "READY_QUEUE", label: "Ready Staged Orders", count: readyWorkOrders.length, icon: ShieldCheck }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    isActive 
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200" 
                      : "text-[#526B91] hover:text-slate-900 hover:bg-slate-100/60"
                  }`}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-[#526B91]"}`} />
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive ? "bg-blue-100 text-blue-700 font-extrabold" : "bg-slate-200 text-[#526B91]"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-widest">
            {activeTab === "LIVE" && "Authoritative Shop Floor Status"}
            {activeTab === "ALLOCATION_GATE" && "Inventory Reservation Control"}
            {activeTab === "READY_QUEUE" && "Supervisor Start Queue"}
          </span>
        </div>

        {/* Tab 1: Live Floor Runs */}
        {activeTab === "LIVE" && (
          <div className="p-8 space-y-6">
            {liveRuns.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <PackageCheck className="w-12 h-12 text-[#0B2148] mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">No Active Production Runs</h3>
                <p className="text-xs text-[#526B91] max-w-md mx-auto">
                  There are currently no Work Orders in progress or on hold on the shop floor. Once the Supervisor starts a Work Order, live BOM consumption will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {liveRuns.map(run => {
                  const isExpanded = expandedOrders[run.id] ?? true;
                  const isPaused = run.status === "ON_HOLD";
                  const hasShortage = run.hasActiveShortage || run.isPausedForMaterial;

                  return (
                    <div 
                      key={run.id}
                      className={`rounded-3xl border transition-all ${
                        isPaused 
                          ? "border-amber-300 bg-amber-50/20 shadow-xs" 
                          : hasShortage
                          ? "border-rose-300 bg-rose-50/20 shadow-xs"
                          : "border-slate-200 bg-white shadow-2xs hover:border-blue-400/40"
                      } overflow-hidden`}
                    >
                      {/* Work Order Header */}
                      <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/40 border-b border-slate-100">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-display font-bold text-slate-900">{run.workOrderNumber}</span>
                            
                            {/* Status Badge */}
                            {run.status === "IN_PROGRESS" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                IN PROGRESS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                                PAUSED / ON HOLD
                              </span>
                            )}

                            {hasShortage && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Material Shortage Risk
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-medium text-[#526B91]">
                            Product: <span className="font-bold text-slate-800">{run.productRef || "Custom Battery Pack"}</span>
                            {run.salesOrder?.customer?.name && (
                              <> • Customer: <span className="font-bold text-slate-800">{run.salesOrder.customer.name}</span></>
                            )}
                            {run.salesOrder?.salesOrderNumber && (
                              <> ({run.salesOrder.salesOrderNumber})</>
                            )}
                          </p>
                        </div>

                        {/* Middle Info: Planned & Operators */}
                        <div className="flex items-center gap-6 text-xs text-[#526B91]">
                          <div>
                            <span className="text-[#526B91] block font-semibold text-[10px] uppercase">Batch Quantity</span>
                            <span className="font-bold text-slate-800 text-sm">{run.completedQuantity} / {run.plannedQuantity} Units</span>
                          </div>
                          {run.execution?.station && (
                            <div>
                              <span className="text-[#526B91] block font-semibold text-[10px] uppercase">Station</span>
                              <span className="font-bold text-slate-800">{run.execution.station}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[#526B91] block font-semibold text-[10px] uppercase">BOM Specification</span>
                            <span className="font-bold text-blue-700">{run.bomName}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPrModalOrder(run);
                              setSelectedMaterialId(run.materials.find(m => m.isShortage)?.materialId || run.materials[0]?.materialId || "");
                              setPrQuantity(run.materials.find(m => m.isShortage)?.shortage || 5);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all shadow-2xs"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 text-amber-700" />
                            <span>Request Stock (PR)</span>
                          </button>

                          <button
                            onClick={() => router.push(`/${roleSlug}/production/work-orders/${run.id}`)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#526B91]" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => toggleExpand(run.id)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#526B91] transition-all"
                            title={isExpanded ? "Collapse BOM" : "Expand BOM"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Pause Reason Alert Banner if Paused */}
                      {isPaused && run.execution?.pauseReason && (
                        <div className="px-6 py-3 bg-amber-100/70 border-b border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              <strong className="font-bold">Pause Reason:</strong> {run.execution.pauseReason}
                              {run.execution.pausedAt && (
                                <span className="text-amber-700 ml-2">({new Date(run.execution.pausedAt).toLocaleTimeString()})</span>
                              )}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Floor Support Required</span>
                        </div>
                      )}

                      {/* Expandable Material Matrix */}
                      {isExpanded && (
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#526B91] flex items-center gap-2">
                              <Box className="w-4 h-4 text-[#526B91]" />
                              BOM Component Allocation & Stock Availability Matrix
                            </h4>
                            <span className="text-xs text-[#526B91] font-semibold">
                              {run.materials.length} Configured Components
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[#526B91] uppercase tracking-wider text-[10px] font-bold">
                                  <th className="p-3 pl-4">Component SKU</th>
                                  <th className="p-3">Material Name</th>
                                  <th className="p-3 text-right">Required (Batch)</th>
                                  <th className="p-3 text-right">Physical On-Hand</th>
                                  <th className="p-3 text-right">Total Reserved</th>
                                  <th className="p-3 text-right">Available</th>
                                  <th className="p-3 text-center">Allocation Status</th>
                                  <th className="p-3 text-center pr-4">Shortage</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {run.materials.map(mat => (
                                  <tr 
                                    key={mat.materialId}
                                    className={`hover:bg-slate-50/80 transition-colors ${
                                      mat.isShortage ? "bg-rose-50/40" : ""
                                    }`}
                                  >
                                    <td className="p-3 pl-4 font-mono font-bold text-slate-800">{mat.sku}</td>
                                    <td className="p-3 text-slate-700 font-bold">{mat.name}</td>
                                    <td className="p-3 text-right font-bold text-slate-900">{mat.neededQty} {mat.unit}</td>
                                    <td className="p-3 text-right text-slate-700">{mat.physicalStock} {mat.unit}</td>
                                    <td className="p-3 text-right text-[#526B91]">{mat.totalReserved} {mat.unit}</td>
                                    <td className="p-3 text-right font-bold text-slate-800">
                                      <span className={mat.availableStock <= 0 ? "text-rose-600" : "text-emerald-600"}>
                                        {mat.availableStock} {mat.unit}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      {mat.isAllocated ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                          ALLOCATED / SECURED
                                        </span>
                                      ) : mat.isShortage ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                                          UNRESERVED SHORTAGE
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                          STOCK AVAILABLE
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center pr-4">
                                      {mat.shortage > 0 ? (
                                        <span className="font-extrabold text-rose-600">-{mat.shortage} {mat.unit}</span>
                                      ) : (
                                        <span className="text-[#526B91] font-semibold">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Pre-Start Material Allocation Gate */}
        {activeTab === "ALLOCATION_GATE" && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-200/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">Inventory Allocation Gate</h4>
                  <p className="text-xs text-blue-800">
                    Allocating reservations locks BOM materials in inventory and advances Work Orders from <strong className="font-bold">CREATED</strong> to <strong className="font-bold">READY</strong>, enabling Supervisor scheduling and floor execution.
                  </p>
                </div>
              </div>
            </div>

            {unallocatedWorkOrders.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">All Scheduled Work Orders are Allocated</h3>
                <p className="text-xs text-[#526B91] max-w-md mx-auto">
                  No Work Orders are currently waiting for inventory allocation. All ready jobs have had their BOM reservations placed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#526B91] uppercase tracking-wider text-[10px] font-bold">
                      <th className="p-4">Work Order</th>
                      <th className="p-4">Product / BOM</th>
                      <th className="p-4">Sales Order / Customer</th>
                      <th className="p-4 text-right">Planned Qty</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right pr-6">Allocation Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {unallocatedWorkOrders.map(wo => {
                      const isAllocating = allocateMutation.isPending && (allocateMutation.variables === wo.id);
                      return (
                        <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-900">{wo.workOrderNumber}</td>
                          <td className="p-4">
                            <span className="font-bold text-slate-800">{wo.productRef || "Battery Pack"}</span>
                            {wo.bom && (
                              <span className="block text-[11px] text-blue-600 font-semibold">{wo.bom.name} ({wo.bom.itemCount} components)</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-700">
                            {wo.salesOrder?.customer?.name ? (
                              <>
                                <span className="font-bold">{wo.salesOrder.customer.name}</span>
                                <span className="block text-[11px] text-[#526B91]">{wo.salesOrder.salesOrderNumber}</span>
                              </>
                            ) : (
                              <span className="text-[#526B91]">Stock Order</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-900">{wo.plannedQuantity} Units</td>
                          <td className="p-4 text-[#526B91]">{new Date(wo.dueDate).toLocaleDateString()}</td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {wo.status}
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <button
                              onClick={() => allocateMutation.mutate(wo.id)}
                              disabled={isAllocating}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
                            >
                              {isAllocating ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Allocating...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Allocate Materials</span>
                                </>
                              )}
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
        )}

        {/* Tab 3: Ready Staged Orders */}
        {activeTab === "READY_QUEUE" && (
          <div className="p-8 space-y-6">
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Ready Queue (Materials Secured)</h4>
                <p className="text-xs text-emerald-800">
                  These Work Orders have successfully cleared material allocation. They are staged and ready for the Supervisor to start on the shop floor.
                </p>
              </div>
            </div>

            {readyWorkOrders.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <Box className="w-12 h-12 text-[#0B2148] mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">No Orders in Ready State</h3>
                <p className="text-xs text-[#526B91] max-w-md mx-auto">
                  Allocate materials from the Pre-Start Gate to move work orders to the Ready queue.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#526B91] uppercase tracking-wider text-[10px] font-bold">
                      <th className="p-4">Work Order</th>
                      <th className="p-4">Product</th>
                      <th className="p-4">Sales Order</th>
                      <th className="p-4 text-right">Planned Qty</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {readyWorkOrders.map(wo => (
                      <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900">{wo.workOrderNumber}</td>
                        <td className="p-4 font-bold text-slate-800">{wo.productRef || "Battery Pack"}</td>
                        <td className="p-4 text-slate-700">{wo.salesOrder?.salesOrderNumber || "Direct"}</td>
                        <td className="p-4 text-right font-bold text-slate-900">{wo.plannedQuantity} Units</td>
                        <td className="p-4 text-[#526B91]">{new Date(wo.dueDate).toLocaleDateString()}</td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            READY FOR FLOOR
                          </span>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <button
                            onClick={() => router.push(`/${roleSlug}/production/work-orders/${wo.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#526B91]" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Directory Quick Navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {[
          { 
            title: "Production Requirements", 
            desc: "Review sales order demands, trigger BOM material checks, and identify supply shortages.", 
            href: "/requirements", 
            icon: ClipboardList 
          },
          { 
            title: "Production Planning", 
            desc: "View released supervisor production plans, schedule batches, and track milestones.", 
            href: "/plans", 
            icon: FileText 
          },
          { 
            title: "Work Order Directory", 
            desc: "Manage work order lifecycle, verify operator assignments, and inspect completed packs.", 
            href: "/work-orders", 
            icon: CheckCircle2 
          }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div 
              key={item.title}
              onClick={() => router.push(`/${roleSlug}/production${item.href}`)}
              className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs cursor-pointer hover:shadow-md hover:border-blue-500/40 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                  <p className="text-xs text-[#526B91] mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-600 mt-5 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Open Directory
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          );
        })}
      </div>

      {/* MODAL: Spawn Purchase Request for Shortage */}
      {prModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-slate-900">Request Stock Replenishment</h3>
                  <p className="text-xs text-[#526B91]">Work Order: {prModalOrder.workOrderNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setPrModalOrder(null)}
                className="text-[#526B91] hover:text-[#526B91] text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Component to Replenish *</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                >
                  {prModalOrder.materials.map(m => (
                    <option key={m.materialId} value={m.materialId}>
                      {m.sku} - {m.name} (Shortage: {m.shortage > 0 ? `${m.shortage} ${m.unit}` : "None"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Requisition Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={prQuantity}
                  onChange={(e) => setPrQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Replenishment Notes</label>
                <textarea
                  rows={3}
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                  placeholder="e.g. Urgent floor shortage for active Work Order..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPrModalOrder(null)}
                disabled={spawnPrMutation.isPending}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (!selectedMaterialId) return;
                  spawnPrMutation.mutate({
                    materialId: selectedMaterialId,
                    shortageQty: prQuantity
                  });
                }}
                disabled={spawnPrMutation.isPending || !selectedMaterialId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
              >
                {spawnPrMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Spawning PR...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>Create Purchase Request</span>
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
