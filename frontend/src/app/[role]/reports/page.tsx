"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  BarChart3, 
  Search, 
  History, 
  Download, 
  Filter, 
  Loader2,
  Package,
  Zap,
  Activity,
  User,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FileText,
  IndianRupee,
  Calendar,
  Layers,
  Wrench,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"audit" | "cost-analytics">("audit");
  
  // Audit logs state
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");

  // Cost analytics state & filters
  const [costFilters, setCostFilters] = useState({
    startDate: "",
    endDate: "",
    status: ""
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => (await api.get("/admin/dashboard-stats")).data
  });

  const { data: auditData, isLoading: loadingLogs } = useQuery({
    queryKey: ["admin-audit-logs", page, entityType],
    queryFn: async () => {
      const res = await api.get("/admin/audit-logs", { params: { page, entityType, limit: 20 } });
      return res.data;
    }
  });

  const { data: costAnalytics, isLoading: loadingCost, refetch: refetchCost } = useQuery({
    queryKey: ["service-cost-analytics", costFilters],
    queryFn: async () => {
      const res = await api.get("/service/analytics", { params: costFilters });
      return res.data;
    },
    enabled: activeTab === "cost-analytics"
  });

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-10">
      <PageHeader
        title="System Reports & Audit"
        description="Comprehensive overview of production metrics, system-wide audit trails, and financials"
        icon={<BarChart3 className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Tab Switcher */}
            <div className="flex bg-white border border-[#D8E8FA] rounded-xl p-1 shadow-xs">
              <button 
                onClick={() => setActiveTab("audit")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "audit" 
                    ? "bg-[#0878F9] text-white shadow-xs" 
                    : "text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Audit Logs
              </button>
              <button 
                onClick={() => setActiveTab("cost-analytics")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "cost-analytics" 
                    ? "bg-[#0878F9] text-white shadow-xs" 
                    : "text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" />
                Service Cost Analytics
              </button>
            </div>

            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 rounded-xl text-xs font-bold text-[#0B2148] transition-all border border-[#D8E8FA] cursor-pointer shadow-xs">
              <Download className="w-3.5 h-3.5 text-[#526B91]" />
              Export
            </button>
          </div>
        }
      />

      {activeTab === "audit" ? (
        <>
          {/* High-Level Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Cells", value: stats?.stats?.raw + stats?.stats?.tested + stats?.stats?.rejected || 0, icon: Package, color: "text-blue-600", bg: "bg-blue-500/10" },
              { label: "Tested Today", value: stats?.stats?.todayTested || 0, icon: Zap, color: "text-[#0878F9]", bg: "bg-[#0878F9]/10" },
              { label: "Rejected Assets", value: stats?.stats?.rejected || 0, icon: ShieldAlert, color: "text-[#991B1B]", bg: "bg-[#FEE2E2]" },
              { label: "PAX Packs", value: stats?.stats?.pax || 0, icon: CheckCircle2, color: "text-[#166534]", bg: "bg-[#DCFCE7]" },
            ].map((item, i) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-4 rounded-2xl border border-[#D8E8FA] flex items-center gap-4 shadow-xs"
              >
                <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center ${item.color} shrink-0`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">{item.label}</p>
                  <p className="text-2xl font-bold text-[#0B2148] mt-0.5">{item.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-12 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-display font-bold text-[#0B2148] flex items-center gap-2">
                  <History className="w-5 h-5 text-[#526B91]" />
                  Live System Audit Trail
                </h3>
                <div className="flex flex-wrap gap-2">
                  {["", "cell", "pax", "inventory", "ServiceCost"].map(type => (
                    <button
                      key={type}
                      onClick={() => setEntityType(type)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
                        entityType === type 
                          ? "bg-[#EAF5FF] border-[#0878F9] text-[#0878F9]" 
                          : "bg-white border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
                      }`}
                    >
                      {type === "" ? "All Activity" : type === "ServiceCost" ? "Service Cost" : type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-panel bg-white rounded-[2rem] overflow-hidden border border-[#D8E8FA] shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Timestamp</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Actor</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Entity / Action</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">State Transition</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F1FC]">
                    {loadingLogs ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="px-8 py-6 h-16 bg-[#F4F9FF]" />
                        </tr>
                      ))
                    ) : auditData?.logs?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-[#F8FBFF] transition-all group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3 text-[#526B91]">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-mono">{new Date(log.timestamp || log.createdAt).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#F4F9FF] flex items-center justify-center text-[#526B91] group-hover:text-[#0878F9] transition-colors">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#0B2148]">{log.actor.name}</p>
                              <p className="text-[9px] text-[#526B91] font-mono">{log.actor.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded text-[9px] font-bold uppercase text-[#526B91]">
                              {log.entityType}
                            </span>
                            <span className="text-xs text-[#0B2148] font-medium">{log.action.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-[10px] text-[#526B91] mt-1 font-mono">{log.entityId}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-[#526B91]">{log.prevStatus || "NONE"}</span>
                            <ArrowRight className="w-3 h-3 text-[#0878F9]" />
                            <span className="text-[#166534]">{log.newStatus || "DONE"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button className="p-2 hover:bg-[#F4F9FF] rounded-lg text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer">
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {auditData?.logs?.length === 0 && !loadingLogs && (
                  <div className="p-20 text-center">
                    <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">No activity logs found for this criteria.</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {!loadingLogs && auditData?.total > 0 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-widest">
                    Showing <span className="text-[#0B2148]">{(page - 1) * 20 + 1} - {Math.min(page * 20, auditData.total)}</span> of <span className="text-[#0B2148]">{auditData.total}</span> events
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-6 py-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 disabled:opacity-40 disabled:cursor-not-allowed border border-[#D8E8FA] rounded-xl text-[10px] font-bold text-[#0B2148] transition-all cursor-pointer shadow-xs"
                    >
                      Prev
                    </button>
                    <button 
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * 20 >= auditData.total}
                      className="px-6 py-2 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-[10px] font-bold text-white transition-all shadow-sm cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Service Cost Analytics Tab */
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="glass-panel bg-white p-6 rounded-3xl border border-[#D8E8FA] flex flex-wrap items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#526B91]">
              <Filter className="w-4 h-4 text-[#0878F9]" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Filters:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#526B91]" />
              <input 
                type="date"
                value={costFilters.startDate}
                onChange={e => setCostFilters({...costFilters, startDate: e.target.value})}
                className="bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
              />
              <span className="text-xs text-[#526B91]">to</span>
              <input 
                type="date"
                value={costFilters.endDate}
                onChange={e => setCostFilters({...costFilters, endDate: e.target.value})}
                className="bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#526B91]">Status:</span>
              <select 
                value={costFilters.status}
                onChange={e => setCostFilters({...costFilters, status: e.target.value})}
                className="bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] appearance-none min-w-[150px] cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="REPAIR_IN_PROGRESS">Repair In Progress</option>
                <option value="READY_FOR_DELIVERY">Ready For Delivery</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>

            <button 
              onClick={() => setCostFilters({ startDate: "", endDate: "", status: "" })}
              className="px-4 py-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-[#0878F9] rounded-xl text-[10px] font-bold uppercase tracking-wider border border-[#D8E8FA] transition-all cursor-pointer shadow-xs"
            >
              Reset Filters
            </button>
          </div>

          {loadingCost ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Analyzing Financial Data...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Service Revenue", value: costAnalytics?.totalServiceRevenue || 0, icon: IndianRupee, color: "text-[#166534]", desc: "Combined value of all services" },
                  { label: "Material Cost Total", value: costAnalytics?.totalMaterialCost || 0, icon: Layers, color: "text-purple-600", desc: "Replacement component values" },
                  { label: "Labour Revenue", value: costAnalytics?.totalLabourRevenue || 0, icon: Wrench, color: "text-blue-600", desc: "Total technician billing" },
                  { label: "Gross Margin", value: costAnalytics?.grossMargin || 0, icon: Sparkles, color: "text-[#0878F9]", desc: "Margin profit amount" },
                  { label: "Warranty Service Cost", value: costAnalytics?.warrantyCost || 0, icon: ShieldAlert, color: "text-[#92400E]", desc: "Warranty absorbed costs" },
                  { label: "Paid Service Revenue", value: costAnalytics?.paidServiceRevenue || 0, icon: CheckCircle2, color: "text-teal-600", desc: "Actual collections received" },
                  { label: "Outstanding Payments", value: costAnalytics?.outstandingPayments || 0, icon: AlertCircle, color: "text-[#991B1B]", desc: "Outstanding dues to collect" },
                  { label: "Average Repair Cost", value: costAnalytics?.averageRepairCost || 0, icon: Activity, color: "text-indigo-600", desc: "Average bill size" }
                ].map((item, i) => (
                  <motion.div 
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-panel bg-white p-6 rounded-3xl border border-[#D8E8FA] flex items-center gap-6 shadow-sm"
                  >
                    <div className={`w-14 h-14 bg-[#F4F9FF] rounded-2xl flex items-center justify-center ${item.color}`}>
                      <item.icon className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-2xl font-display font-bold text-[#0B2148]">₹{Number(item.value).toFixed(2)}</p>
                      <p className="text-[10px] text-[#526B91] mt-1">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Top Service Types and Top Materials Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Service Types */}
                <div className="glass-panel bg-white p-6 rounded-3xl border border-[#D8E8FA] space-y-4 shadow-sm">
                  <h4 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#0878F9]" />
                    Top Service Types
                  </h4>
                  <div className="divide-y divide-[#E8F1FC]">
                    {(costAnalytics?.topServiceTypes || []).map((type: any, index: number) => (
                      <div key={type.serviceType} className="py-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-[#526B91] font-bold font-mono">#{index + 1}</span>
                          <span className="text-[#0B2148] font-medium uppercase">{type.serviceType}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#0B2148] font-bold block">₹{Number(type.revenue).toFixed(2)}</span>
                          <span className="text-[10px] text-[#526B91]">{type.count} occurrences</span>
                        </div>
                      </div>
                    ))}
                    {(!costAnalytics?.topServiceTypes || costAnalytics.topServiceTypes.length === 0) && (
                      <p className="text-xs text-[#526B91] italic p-4 text-center">No service types recorded yet.</p>
                    )}
                  </div>
                </div>

                {/* Top Consumed Materials */}
                <div className="glass-panel bg-white p-6 rounded-3xl border border-[#D8E8FA] space-y-4 shadow-sm">
                  <h4 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0878F9]" />
                    Top Consumed Spares (Inventory Cost)
                  </h4>
                  <div className="divide-y divide-[#E8F1FC]">
                    {(costAnalytics?.topConsumedMaterials || []).map((mat: any, index: number) => (
                      <div key={mat.name} className="py-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-[#526B91] font-bold font-mono">#{index + 1}</span>
                          <span className="text-[#0B2148] font-medium">{mat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#0B2148] font-bold block">₹{Number(mat.cost).toFixed(2)}</span>
                          <span className="text-[10px] text-[#526B91]">Qty Billed: {mat.quantity}</span>
                        </div>
                      </div>
                    ))}
                    {(!costAnalytics?.topConsumedMaterials || costAnalytics.topConsumedMaterials.length === 0) && (
                      <p className="text-xs text-[#526B91] italic p-4 text-center">No materials consumed yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive summary panel */}
              <div className="glass-panel bg-white p-8 rounded-3xl border border-[#D8E8FA] shadow-sm">
                <h3 className="text-lg font-bold text-[#0B2148] mb-2">Service Execution Summary</h3>
                <p className="text-xs text-[#526B91]">Analysis run on <span className="text-[#0B2148] font-bold">{costAnalytics?.count || 0}</span> service records matching your active filters. Service costs are mapped to <span className="text-[#0B2148] font-bold">{costAnalytics?.countWithCost || 0}</span> batteries.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}
