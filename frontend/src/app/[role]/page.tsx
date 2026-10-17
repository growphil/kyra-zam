"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Activity, 
  Package, 
  Microscope, 
  AlertTriangle, 
  ArrowUpRight, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  Loader2,
  Boxes,
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  ChevronRight,
  FlaskConical,
  Trash2,
  Search,
  Gauge,
  Info,
  Clock,
  Layers,
  Check
} from "lucide-react";

import QualityDashboardPage from "./quality/page";
import MarketingManagerDashboard from "@/components/dashboard/MarketingManagerDashboard";
import StatusBadge from "@/components/ui/StatusBadge";
import PageHeader from "@/components/ui/PageHeader";

export default function RoleDashboard() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const role = (params?.role as string) || "admin";
  const userName = session?.user?.name || "Team Member";
  const userRoles = (session?.user as any)?.roles || [];
  const isAssemblyTech = role === "assembly-technician" || userRoles.includes("ASSEMBLY_TECHNICIAN");
  const isTestEngineer = role === "test-engineer" || role === "tester" || userRoles.includes("TEST_ENGINEER") || userRoles.includes("TESTER");
  const isQC = role === "qc" || (userRoles.includes("QC") && role === "qc");
  const isMarketingManager = role === "marketing-manager" || userRoles.includes("MARKETING_MANAGER");
  const isPaxTestEngineer = role === "pax-test-engineer";
  const isPackingOperator = role === "packing-operator" || (userRoles.includes("PACKING_OPERATOR") && role === "packing-operator");
  const isSeller = role === "seller" || userRoles.includes("SELLER");
  const isHrPayroll = role === "hr-payroll" || (userRoles.includes("HR_PAYROLL") && role === "hr-payroll");

  // Filter and search state for Test Engineer view
  const [prodFilter, setProdFilter] = useState<"ALL" | "IN_PROGRESS" | "COMPLETED">("IN_PROGRESS");
  const [searchQuery, setSearchQuery] = useState("");

  // General dashboard stats (for admin/other roles)
  const { data: dashboardData, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/admin/dashboard-stats")).data,
    enabled: !isAssemblyTech && !isTestEngineer && !isMarketingManager && !isQC && !isPaxTestEngineer && !isPackingOperator && !isSeller
  });

  const { data: auditData, isLoading: loadingLogs } = useQuery({
    queryKey: ["recent-logs"],
    queryFn: async () => (await api.get("/admin/audit-logs?limit=5")).data,
    enabled: !isAssemblyTech && !isTestEngineer && !isMarketingManager && !isQC && !isPaxTestEngineer && !isPackingOperator && !isSeller
  });

  // Dedicated Assembly Technician Dashboard Query
  const { data: assemblyDashboard, isLoading: loadingAssembly } = useQuery({
    queryKey: ["assembly-dashboard-data"],
    queryFn: async () => (await api.get("/pax/assembly-dashboard")).data,
    enabled: isAssemblyTech,
    refetchInterval: 15000
  });

  // Dedicated Test Engineer Queries: Running Production Requirements & Station KPIs
  const { data: prodRequirementsData, isLoading: loadingProdReqs } = useQuery({
    queryKey: ["test-engineer-prod-requirements"],
    queryFn: async () => (await api.get("/testing/production-requirements")).data,
    enabled: isTestEngineer,
    refetchInterval: 8000
  });

  const { data: stationSummary, isLoading: loadingStationSummary } = useQuery({
    queryKey: ["test-engineer-station-summary"],
    queryFn: async () => (await api.get("/testing/station-summary")).data,
    enabled: isTestEngineer,
    refetchInterval: 8000
  });

  const { data: recentTestsData } = useQuery({
    queryKey: ["test-engineer-recent-tests"],
    queryFn: async () => (await api.get("/testing/recent-tests")).data,
    enabled: isTestEngineer,
    refetchInterval: 10000
  });

  useEffect(() => {
    if (isPaxTestEngineer) {
      router.replace(`/${role}/pax-testing`);
    } else if (isPackingOperator) {
      router.replace(`/${role}/packing`);
    } else if (isSeller) {
      router.replace(`/${role}/sales`);
    } else if (isHrPayroll) {
      router.replace(`/${role}/hr/dashboard`);
    }
  }, [isPaxTestEngineer, isPackingOperator, isSeller, isHrPayroll, role, router]);

  if (isPaxTestEngineer) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#526B91]">Redirecting to PAX Testing Workspace...</p>
      </div>
    );
  }

  if (isPackingOperator) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#526B91]">Redirecting to Packing Station...</p>
      </div>
    );
  }

  if (isSeller) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#526B91]">Redirecting to Sales Dashboard...</p>
      </div>
    );
  }

  if (isQC) {
    return <QualityDashboardPage />;
  }

  if (isMarketingManager) {
    return <MarketingManagerDashboard roleSlug={role} userName={userName} />;
  }

  // --- ASSEMBLY TECHNICIAN PRIMARY WORKSPACE ---
  if (isAssemblyTech) {
    const kpis = assemblyDashboard?.kpis || {
      assignedPacks: 0,
      readyForAssembly: 0,
      inAssembly: 0,
      awaitingQc: 0,
      completedToday: 0
    };

    const queue = assemblyDashboard?.queue || [];
    const currentStation = assemblyDashboard?.currentStation;

    return (
      <div className="space-y-6 text-[#0B2148]">
        <PageHeader
          title="PAX Assembly Station"
          description="Assemble assigned battery packs using verified cells, approved BOM specifications and station matrix binding."
          badge={
            <StatusBadge 
              status="ACTIVE" 
              customLabel={`Station: ${currentStation?.name || "STN-ASY-01"}`}
              variant="success"
            />
          }
          actions={
            <button
              onClick={() => router.push(`/${role}/pax/create`)}
              className="btn-primary"
            >
              <Sparkles className="w-4 h-4" />
              <span>Open Active Assembly</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          }
        />

        {/* 5 Operational KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Assigned Packs", value: kpis.assignedPacks, unit: "Total Units", variant: "info" },
            { label: "Ready for Assembly", value: kpis.readyForAssembly, unit: "Eligible WOs", variant: "warning" },
            { label: "In Assembly", value: kpis.inAssembly, unit: "Active Batches", variant: "hold" },
            { label: "Awaiting QC", value: kpis.awaitingQc, unit: "At Inspection", variant: "info" },
            { label: "Completed Today", value: kpis.completedToday, unit: "Packs Done", variant: "success" }
          ].map((kpi, idx) => (
            <div key={idx} className="surface-card p-4 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-[#526B91] uppercase tracking-wider">{kpi.label}</p>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-[#0B2148]">
                  {loadingAssembly ? <Loader2 className="w-5 h-5 animate-spin text-[#0878F9]" /> : kpi.value}
                </span>
                <span className="text-[10px] text-[#64748B] ml-1.5 uppercase font-medium">{kpi.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Assembly Workflow Stepper */}
        <div className="surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#526B91]">
            {[
              "1. Assigned Packs",
              "2. Ready for Assembly",
              "3. Cell Matching",
              "4. Cell Binding",
              "5. Component Assembly",
              "6. Assembly Validation",
              "7. Submit for QC"
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-xs ${idx === 2 || idx === 3 ? "bg-[#EAF5FF] text-[#0878F9] font-bold border border-[#D8E8FA]" : "bg-[#F4F9FF] text-[#526B91]"}`}>
                  {step}
                </span>
                {idx < 6 && <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] hidden sm:inline" />}
              </div>
            ))}
          </div>
        </div>

        {/* Queue & Sidebar Rules */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#0878F9]" />
                Assigned Battery Pack Assembly Queue
              </h2>
              <span className="text-xs text-[#526B91]">{queue.length} Assigned Jobs</span>
            </div>

            {loadingAssembly ? (
              <div className="py-20 text-center surface-card">
                <Loader2 className="w-7 h-7 text-[#0878F9] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#526B91]">Loading assigned assembly jobs...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="py-16 text-center text-[#526B91] space-y-2 surface-card">
                <Package className="w-10 h-10 text-[#94A3B8] mx-auto" />
                <p className="text-sm font-bold text-[#0B2148]">No PAX Assembly Jobs Assigned</p>
                <p className="text-xs text-[#526B91] max-w-md mx-auto">
                  All current battery packs have been assembled or are pending supervisor work order scheduling.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item: any) => (
                  <div 
                    key={item.id}
                    className="surface-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#0878F9]">{item.workOrderNumber}</span>
                        <StatusBadge status={item.rawStatus || item.status} />
                        {item.priority && (
                          <StatusBadge 
                            status={item.priority === "URGENT" || item.priority === "HIGH" ? "FAILED" : "DRAFT"} 
                            customLabel={item.priority}
                          />
                        )}
                      </div>

                      <p className="text-xs text-[#0B2148] font-semibold">
                        Product: {item.productRef} · <span className="text-[#526B91]">{item.paxTypeName}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#526B91] font-mono pt-1">
                        <span>Required Cells: <strong className="text-[#0B2148]">{item.requiredCellCount}</strong></span>
                        <span>Cells Matched: <strong className="text-[#0878F9]">{item.cellsMatched}</strong></span>
                        <span>Planned Packs: <strong className="text-[#0B2148]">{item.plannedQuantity}</strong></span>
                        <span>Station: <strong className="text-emerald-700">{item.station}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => router.push(`/${role}/pax/create?workOrderId=${item.id}`)}
                        className="btn-primary text-xs py-2 px-4 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Open Assembly</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Assembly Rules & Quality Invariants */}
          <div className="lg:col-span-4 space-y-4">
            <div className="surface-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0878F9]" />
                Assembly Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push(`/${role}/pax/create`)}
                  className="w-full p-3 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-[#0878F9]" />
                    <div>
                      <p className="text-xs font-bold text-[#0B2148]">Open Active Assembly</p>
                      <p className="text-[10px] text-[#526B91]">Match cells, verify BOM & assemble</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </button>

                <button
                  onClick={() => router.push(`/${role}/pax/all`)}
                  className="w-full p-3 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-[#0B2148]">View Assembly History</p>
                      <p className="text-[10px] text-[#526B91]">Track submitted & completed packs</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </button>
              </div>
            </div>

            <div className="surface-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Assembly Quality Invariants
              </h3>
              <div className="space-y-2 text-xs text-[#0B2148]">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Only <strong className="font-mono text-emerald-900">CELL_TESTED</strong> cells are eligible for binding.</span>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>Strict capacity variance: <strong className="font-mono text-blue-900">ΔAH ≤ 0.050 Ah</strong>.</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Strict internal resistance: <strong className="font-mono text-amber-900">ΔIR ≤ 3.0 mΩ</strong>.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- TEST ENGINEER PRIMARY WORKSPACE ---
  if (isTestEngineer) {
    const rawReqs = (prodRequirementsData?.requirements || []) as any[];
    const metrics = prodRequirementsData?.metrics || {
      activeRequirementsCount: 0,
      totalRequired: 0,
      totalTested: 0,
      totalRemaining: 0
    };

    const activeBatches = (stationSummary?.activeBatches || []) as any[];
    const testedToday = stationSummary?.testedTodayCount || 0;
    const recentTests = (recentTestsData?.tests || []) as any[];

    const filteredReqs = rawReqs.filter((req: any) => {
      const matchesFilter =
        prodFilter === "ALL" ? true :
        prodFilter === "IN_PROGRESS" ? req.status === "IN_PROGRESS" :
        req.status === "COMPLETED";

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        req.workOrder?.workOrderNumber?.toLowerCase().includes(q) ||
        req.workOrder?.productRef?.toLowerCase().includes(q) ||
        req.cellSku?.toLowerCase().includes(q) ||
        req.workOrder?.supervisor?.name?.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });

    return (
      <div className="space-y-6 text-[#0B2148]">
        <PageHeader
          title="Operational Cockpit"
          description="Live monitoring of active production cell demands, serialization throughput and raw bulk stock readiness."
          badge={
            <StatusBadge 
              status="ACTIVE" 
              customLabel="Station: STN-QC-01" 
              variant="success" 
            />
          }
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/${role}/cells`)}
                className="btn-primary"
              >
                <Zap className="w-4 h-4" />
                <span>Cell Serialization</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push(`/${role}/testing`)}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148] font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#0878F9]" />
                <span>Testing Station</span>
              </button>
              <button
                onClick={() => router.push(`/${role}/scrap`)}
                className="px-3 py-2 rounded-lg bg-white border border-[#D8E8FA] hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Scrap Review</span>
              </button>
            </div>
          }
        />

        {/* 5 KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Active Demand Orders", value: metrics.activeRequirementsCount, unit: "Work Orders", icon: Layers },
            { label: "Total Cells Required", value: metrics.totalRequired, unit: "Cells", icon: Boxes },
            { label: "Qualified Cells", value: metrics.totalTested, unit: "PASS Cells", icon: CheckCircle2 },
            { label: "Remaining Needed", value: metrics.totalRemaining, unit: "Cells Needed", icon: Zap },
            { label: "Cells Tested Today", value: testedToday, unit: "Cells Today", icon: Gauge }
          ].map((kpi, idx) => (
            <div key={idx} className="surface-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#526B91]">
                <p className="text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</p>
                <kpi.icon className="w-4 h-4 text-[#0878F9]" />
              </div>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-bold text-[#0B2148]">
                  {loadingProdReqs ? <Loader2 className="w-5 h-5 animate-spin text-[#0878F9]" /> : kpi.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#64748B] ml-1.5 uppercase font-medium">{kpi.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Requirements Cockpit & Side Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#0878F9]" />
                Running Production Cell Requirements
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search WO or SKU..."
                    className="pl-8 pr-3 py-1 text-xs w-44"
                  />
                </div>
                <div className="flex bg-[#F4F9FF] p-0.5 rounded-lg border border-[#D8E8FA] text-xs">
                  <button
                    onClick={() => setProdFilter("IN_PROGRESS")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      prodFilter === "IN_PROGRESS" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setProdFilter("COMPLETED")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      prodFilter === "COMPLETED" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    Fulfilled
                  </button>
                  <button
                    onClick={() => setProdFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      prodFilter === "ALL" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>

            {loadingProdReqs ? (
              <div className="py-20 text-center surface-card">
                <Loader2 className="w-7 h-7 text-[#0878F9] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#526B91]">Loading running production requirements...</p>
              </div>
            ) : filteredReqs.length === 0 ? (
              <div className="py-16 text-center text-[#526B91] space-y-2 surface-card">
                <Boxes className="w-10 h-10 text-[#94A3B8] mx-auto" />
                <p className="text-sm font-bold text-[#0B2148]">No Active Cell Requirements</p>
                <p className="text-xs text-[#526B91] max-w-md mx-auto">
                  Production requirements will appear here when Work Orders requiring cell testing are active.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReqs.map((req: any) => {
                  const requiredQty = req.requiredQuantity || 0;
                  const qualifiedQty = req.testedQuantity || 0;
                  const serializedQty = req.serializedQuantity ?? 0;
                  const remainingQty = req.remainingQuantity ?? Math.max(0, requiredQty - qualifiedQty);
                  const pct = requiredQty > 0 ? Math.min(100, Math.round((qualifiedQty / requiredQty) * 100)) : 0;
                  const isCompleted = req.status === "COMPLETED" || remainingQty === 0;

                  return (
                    <div 
                      key={req.id}
                      className="surface-card p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E8F1FC]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#0878F9]">
                            {req.workOrder?.workOrderNumber || "WO-N/A"}
                          </span>
                          <StatusBadge status={isCompleted ? "COMPLETED" : "IN_PROGRESS"} />
                        </div>
                        {req.workOrder?.supervisor?.name && (
                          <span className="text-xs text-[#526B91]">
                            Supervisor: <strong className="text-[#0B2148]">{req.workOrder.supervisor.name}</strong>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-7 space-y-2">
                          <p className="text-sm font-bold text-[#0B2148]">
                            {req.workOrder?.productRef || "Battery Pack Product"}
                          </p>

                          <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] font-mono text-xs text-center">
                            <div>
                              <span className="text-[10px] text-[#64748B] block">Required</span>
                              <strong className="text-[#0B2148] text-sm">{requiredQty}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#64748B] block">Serialized</span>
                              <strong className="text-[#0878F9] text-sm">{serializedQty}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#64748B] block">Qualified</span>
                              <strong className="text-emerald-700 text-sm">{qualifiedQty}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#64748B] block">Remaining</span>
                              <strong className="text-amber-800 text-sm">{remainingQty}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-5 flex flex-col sm:items-end justify-between gap-3">
                          <div className="w-full sm:text-right">
                            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-mono font-semibold text-[#0B2148]">
                              <span>Progress:</span>
                              <span className="text-[#0878F9]">{qualifiedQty} / {requiredQty} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-[#EAF5FF] h-2 rounded-full overflow-hidden mt-1.5 border border-[#D8E8FA]">
                              <div 
                                className="h-full bg-[#0878F9] transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => router.push(`/${role}/cells?requirementId=${req.id}&workOrderId=${req.workOrderId || req.workOrder?.id}`)}
                            className="btn-primary text-xs py-2 px-4 cursor-pointer"
                          >
                            <span>View Requirement</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Inward Stock & Invariants */}
          <div className="lg:col-span-4 space-y-4">
            <div className="surface-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#0878F9]" />
                  Available Bulk Cell Inward Stock
                </span>
                <span className="text-[11px] font-mono text-[#526B91]">{activeBatches.length} Batches</span>
              </h3>

              {loadingStationSummary ? (
                <div className="py-6 text-center text-[#526B91]">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0878F9] mb-1" />
                  <p className="text-[11px]">Loading inward stock...</p>
                </div>
              ) : activeBatches.length === 0 ? (
                <p className="text-xs text-[#526B91] text-center py-4">No active inward batches available.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {activeBatches.slice(0, 6).map((b: any) => (
                    <div 
                      key={b.id}
                      className="p-2.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-mono font-bold text-[#0B2148]">{b.partNumber}</p>
                        <p className="text-[10px] text-[#526B91]">Batch: {b.batchNumber}</p>
                      </div>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                        {b.availableQty} pcs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent QC Stream */}
            {recentTests.length > 0 && (
              <div className="surface-card p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                    Recent Cell QC Stream
                  </span>
                  <button 
                    onClick={() => router.push(`/${role}/testing`)}
                    className="text-[11px] text-[#0878F9] font-semibold hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </h3>

                <div className="space-y-1.5">
                  {recentTests.slice(0, 4).map((test: any, idx: number) => (
                    <div 
                      key={idx}
                      className="p-2 bg-[#F4F9FF] rounded-md flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <p className="text-[#0B2148] font-semibold">{test.serialNumber}</p>
                        <p className="text-[10px] text-[#526B91]">{test.voltage}V · {test.irValue ? `${test.irValue}mΩ` : "N/A"}</p>
                      </div>
                      <StatusBadge status={test.status} customLabel={test.grade || test.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT DASHBOARD FOR EXECUTIVE ROLES ---
  const stats = [
    { label: "Total Pax Packs", value: dashboardData?.stats?.pax || 0, icon: Package },
    { label: "Raw Cells in Stock", value: dashboardData?.stats?.raw || 0, icon: Microscope },
    { label: "Tested Today", value: dashboardData?.stats?.todayTested || 0, icon: Zap },
    { label: "QC Rejections", value: dashboardData?.stats?.rejected || 0, icon: AlertTriangle }
  ];

  return (
    <div className="space-y-6 text-[#0B2148]">
      <PageHeader
        title={`Welcome back, ${userName}`}
        description={`Here is your operational overview for the ${(role || "terminal").replace('-', ' ')} workspace.`}
        badge={
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-emerald-800 text-[11px] font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>KYRA ZAM 2.0 Live</span>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="surface-card p-5 flex items-start justify-between"
          >
            <div>
              <p className="text-[#526B91] text-[11px] font-semibold uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#0B2148] mt-1.5">
                {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-[#0878F9]" /> : stat.value.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 rounded-lg bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA]">
              <stat.icon className="w-5 h-5" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Operations Log */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#0878F9]" />
              Recent Operations & Audit Trail
            </h2>
            <span className="text-xs text-[#526B91]">Realtime Audit Logs</span>
          </div>

          <div className="surface-card overflow-hidden">
            {loadingLogs ? (
              <div className="flex items-center justify-center p-16">
                <Loader2 className="w-7 h-7 text-[#0878F9] animate-spin" />
              </div>
            ) : auditData?.logs?.length > 0 ? (
              auditData.logs.map((log: any) => (
                <div key={log.id} className="p-3.5 border-b border-[#E8F1FC] last:border-0 flex items-center justify-between hover:bg-[#F4F9FF] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] flex items-center justify-center border border-[#D8E8FA] text-[#0878F9]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#0B2148]">{log.action.replace(/_/g, ' ').toUpperCase()}</p>
                      <p className="text-[10px] text-[#526B91]">
                        {log.entityType} ID: <span className="font-mono text-[#0B2148]">{log.entityId}</span> • {new Date(log.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#94A3B8]" />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-[#526B91]">
                <Activity className="w-8 h-8 text-[#94A3B8] mb-2" />
                <p className="text-sm font-medium">No recent activity logs recorded.</p>
              </div>
            )}
          </div>
        </section>

        {/* System Alerts */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            System Notifications & Alerts
          </h2>
          <div className="space-y-2.5">
            {dashboardData?.stats?.rejected > 10 && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-xs font-bold text-rose-800">High Rejection Rate</p>
                <p className="text-[11px] text-rose-700 mt-0.5">Significant cell rejections detected in today's testing batches.</p>
              </div>
            )}
            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs font-bold text-blue-800">WebSocket Live Sync</p>
              <p className="text-[11px] text-blue-700 mt-0.5">Realtime data bus is operational across all shopfloor stations.</p>
            </div>
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-bold text-emerald-800">System Optimization</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">Database connections and cache layers are running optimally.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
