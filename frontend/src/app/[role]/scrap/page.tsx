"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trash2, Plus, Search, Loader2, RefreshCcw, X, CheckCircle2, 
  AlertTriangle, Filter, Package, Wrench, ThermometerSun, ShieldAlert, 
  BadgeInfo, DollarSign, TrendingUp, Layers, Store, Edit, RotateCcw,
  Check, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ScrapManagementPage() {
  const { data: session } = useSession();
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isSuperadmin = userRoles.includes("SUPERADMIN");
  
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"LOSS" | "PROFITABLE">("LOSS");
  
  // Modals visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedScrapForStore, setSelectedScrapForStore] = useState<any>(null);
  const [selectedScrapForSell, setSelectedScrapForSell] = useState<any>(null);
  const [selectedScrapForOverride, setSelectedScrapForOverride] = useState<any>(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const queryClient = useQueryClient();

  useEffect(() => { setMounted(true); }, []);

  // Form states
  const [formData, setFormData] = useState({
    scrapType: "LOSS",
    sourceType: "PRODUCTION",
    materialId: "",
    quantity: 1,
    defectType: "Other",
    severity: "LOW",
    description: "",
    estimatedRecoveryValue: 0,
  });

  const [storeData, setStoreData] = useState({
    location: "Warehouse A"
  });

  const [sellData, setSellData] = useState({
    buyerName: "",
    salePrice: 0,
    quantitySold: 1,
    notes: ""
  });

  const [overrideData, setOverrideData] = useState({
    status: "",
    estimatedRecoveryValue: 0,
    actualSaleValue: 0,
    notes: ""
  });

  const { data: scraps, isLoading, refetch } = useQuery({
    queryKey: ["scraps"],
    queryFn: async () => (await api.get("/scrap")).data,
    enabled: mounted,
  });

  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await api.get("/inventory/materials")).data,
    enabled: mounted,
  });

  const scrapMutation = useMutation({
    mutationFn: (data: any) => api.post("/scrap", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraps"] });
      toast.success("Scrap entry created successfully");
      setShowAddModal(false);
      setFormData({
        scrapType: "LOSS",
        sourceType: "PRODUCTION",
        materialId: "",
        quantity: 1,
        defectType: "Other",
        severity: "LOW",
        description: "",
        estimatedRecoveryValue: 0,
      });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to create entry")
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, ...rest }: { id: string, status: string, [key: string]: any }) => 
      api.patch(`/scrap/${id}/status`, { status, ...rest }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraps"] });
      toast.success("Status updated successfully");
      setSelectedScrapForStore(null);
      setSelectedScrapForSell(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to update status")
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string, [key: string]: any }) => 
      api.patch(`/scrap/${id}/override`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraps"] });
      toast.success("Superadmin override applied successfully");
      setSelectedScrapForOverride(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to apply override")
  });

  if (!mounted) return null;

  // Filter logic
  const filteredScraps = (scraps || []).filter((s: any) => {
    const matchesTab = s.scrapType === activeTab;
    const matchesSearch = s.scrapId.toLowerCase().includes(search.toLowerCase()) || 
      s.materialName.toLowerCase().includes(search.toLowerCase()) ||
      s.sku.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  // Analytics Calculations
  const lossScraps = (scraps || []).filter((s: any) => s.scrapType === "LOSS");
  const totalFinancialLoss = lossScraps
    .filter((s: any) => s.status === "SCRAPPED" || s.status === "DISPOSED")
    .reduce((acc: number, s: any) => acc + s.totalCost, 0);

  const profitableScraps = (scraps || []).filter((s: any) => s.scrapType === "PROFITABLE");
  const totalRevenue = profitableScraps.reduce((acc: number, s: any) => acc + (s.actualSaleValue || 0), 0);
  
  const storedInventoryCount = profitableScraps
    .filter((s: any) => s.status === "STORED")
    .reduce((acc: number, s: any) => acc + (s.scrapInventory?.quantity || 0), 0);

  const pendingReviewCount = (scraps || []).filter((s: any) => 
    s.status === "REPORTED" || s.status === "SCRAP_PENDING_REVIEW" || s.status === "UNDER_REVIEW"
  ).length;

  const defectTypes = [
    "Voltage Failure", "Cell Swelling", "Connector Damage", "Wire Burn", 
    "Thermal Damage", "Water Damage", "BMS Failure", "Assembly Defect", 
    "Physical Damage", "Short Circuit", "Corrosion", "Testing Failure", "Other"
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "REPORTED": return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "SCRAP_PENDING_REVIEW": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "UNDER_REVIEW": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "STORED": return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
      case "SOLD": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "RECYCLED": return "bg-teal-500/10 text-teal-400 border border-teal-500/20";
      case "SCRAPPED": return "bg-red-500/10 text-red-400 border border-red-500/20";
      case "DISPOSED": return "bg-slate-500/10 text-[#526B91] border border-slate-500/20";
      case "REJECTED": return "bg-slate-500/10 text-rose-500 border border-rose-500/20";
      default: return "bg-[#F4F9FF] text-[#0B2148]";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "LOW": return <BadgeInfo className="w-3.5 h-3.5 text-blue-400" />;
      case "MEDIUM": return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case "HIGH": return <ThermometerSun className="w-3.5 h-3.5 text-orange-500" />;
      case "CRITICAL": return <ShieldAlert className="w-3.5 h-3.5 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER SECTION */}
      <PageHeader
        title="Enterprise Scrap & Defect Management"
        subtitle="Dual Track: Profitable Service Recovery vs. Inventory Losses"
        icon={<Trash2 className="w-5 h-5 text-red-500" />}
        actions={
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => refetch()} 
              title="Refresh Data"
              className="p-2 bg-white hover:bg-[#EAF5FF] border border-[#D8E8FA] hover:border-[#0878F9]/30 rounded-xl text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer shadow-xs"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                setFormData({ ...formData, scrapType: activeTab });
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Report Scrap Item
            </button>
          </div>
        }
      />

      {/* ANALYTICS HIGHLIGHTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-[#FECACA] bg-[#FEE2E2] relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 text-[#991B1B]/20"><TrendingUp className="w-12 h-12" /></div>
          <p className="text-[10px] font-bold text-[#991B1B] uppercase tracking-widest mb-1">Total Inventory Loss</p>
          <p className="text-2xl font-display font-bold text-[#991B1B]">₹{totalFinancialLoss.toLocaleString()}</p>
          <p className="text-[10px] text-[#7F1D1D] mt-1">Written-off Defective Materials</p>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl border border-[#BBF7D0] bg-[#DCFCE7] relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 text-[#166534]/20"><DollarSign className="w-12 h-12" /></div>
          <p className="text-[10px] font-bold text-[#166534] uppercase tracking-widest mb-1">Scrap Revenue Generated</p>
          <p className="text-2xl font-display font-bold text-[#166534]">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-[#14532D] mt-1">Realized value recovery sales</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[#D8E8FA] bg-white relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 text-[#0878F9]/10"><Store className="w-12 h-12" /></div>
          <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mb-1">Stored Recovery stock</p>
          <p className="text-2xl font-display font-bold text-[#0878F9]">{storedInventoryCount} <span className="text-xs text-[#526B91]">pcs</span></p>
          <p className="text-[10px] text-[#526B91] mt-1">Items physically stored in inventory</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 text-[#92400E]/20"><Layers className="w-12 h-12" /></div>
          <p className="text-[10px] font-bold text-[#92400E] uppercase tracking-widest mb-1">Pending Reviews</p>
          <p className="text-2xl font-display font-bold text-[#92400E]">{pendingReviewCount}</p>
          <p className="text-[10px] text-[#78350F] mt-1">Requires supervisor or admin review</p>
        </div>
      </div>

      {/* FILTER & TABS NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#D8E8FA] pb-2 gap-4">
        <div className="flex gap-4">
          <button 
            onClick={() => { setActiveTab("LOSS"); setStatusFilter("ALL"); }}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 cursor-pointer ${activeTab === "LOSS" ? "text-[#991B1B] border-b-2 border-[#DC2626]" : "text-[#526B91] hover:text-[#0B2148]"}`}
          >
            Inventory Loss Scrap
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === "LOSS" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#F4F9FF] text-[#526B91]"}`}>{lossScraps.length}</span>
          </button>
          <button 
            onClick={() => { setActiveTab("PROFITABLE"); setStatusFilter("ALL"); }}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 cursor-pointer ${activeTab === "PROFITABLE" ? "text-[#166534] border-b-2 border-emerald-600" : "text-[#526B91] hover:text-[#0B2148]"}`}
          >
            Profitable Scrap (Value Recovery)
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === "PROFITABLE" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F4F9FF] text-[#526B91]"}`}>{profitableScraps.length}</span>
          </button>
        </div>

        <div className="flex gap-3 mb-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scrap ID, material, SKU..." 
              className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-4 text-xs focus:border-[#0878F9] focus:outline-none transition-all placeholder:text-[#64748B] text-[#0B2148]" 
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-[#D8E8FA] rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-[#526B91]" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-[#0B2148] outline-none uppercase tracking-widest cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="REPORTED">Reported</option>
              <option value="SCRAP_PENDING_REVIEW">QC Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              {activeTab === "LOSS" ? (
                <>
                  <option value="SCRAPPED">Scrapped</option>
                  <option value="DISPOSED">Disposed</option>
                </>
              ) : (
                <>
                  <option value="STORED">Stored</option>
                  <option value="SOLD">Sold</option>
                  <option value="RECYCLED">Recycled</option>
                </>
              )}
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* SCROLLABLE GRID LIST */}
      <div className="glass-panel bg-white rounded-2xl overflow-hidden border border-[#D8E8FA] shadow-sm">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading entries...</p>
          </div>
        ) : filteredScraps.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center gap-2 text-[#526B91]">
            <Package className="w-10 h-10 text-[#526B91] mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest text-[#0B2148]">No Scrap Entries Found</p>
            <p className="text-[10px] text-[#526B91]">Try modifying your search query or status filter.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Scrap ID / Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Material Name / SKU</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Qty & Source</th>
                {activeTab === "LOSS" ? (
                  <>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Severity & Defect</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Total Loss Cost</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Valuation & Recovery</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Inventory / Sale Details</th>
                  </>
                )}
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                {isAdmin && <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {filteredScraps.map((scrap: any) => (
                <tr key={scrap.id} className="hover:bg-[#F8FBFF] transition-colors">
                  {/* SCRAP ID */}
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-[#0B2148] font-mono flex items-center gap-1.5">
                      {scrap.scrapId}
                      {scrap.cellSerial && (
                        <span className="bg-[#FEE2E2] text-[#991B1B] text-[8px] font-bold px-1.5 py-0.5 rounded font-sans uppercase">Cell: {scrap.cellSerial}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#526B91] mt-1">{new Date(scrap.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    <div className="text-[10px] text-[#526B91] mt-0.5">By {scrap.creator.name}</div>
                  </td>

                  {/* MATERIAL DETAILS */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#526B91]" />
                      <span className="text-sm font-bold text-[#0B2148]">{scrap.materialName}</span>
                    </div>
                    <div className="text-[10px] font-bold text-[#526B91] mt-1 font-mono uppercase tracking-widest">SKU: {scrap.sku}</div>
                  </td>

                  {/* QTY & SOURCE */}
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-[#0B2148]">{scrap.quantity} <span className="text-[10px] text-[#526B91] font-normal">{scrap.material?.unit || "pcs"}</span></div>
                    <div className="text-[9px] text-[#526B91] mt-1 uppercase tracking-widest flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-[#526B91]" /> {scrap.sourceType}
                    </div>
                  </td>

                  {/* TAB SPECIFIC COLUMNS */}
                  {activeTab === "LOSS" ? (
                    <>
                      {/* LOSS SPECIFIC: SEVERITY */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {getSeverityIcon(scrap.severity)}
                          <span className="text-[10px] font-bold text-[#0B2148]">{scrap.severity}</span>
                        </div>
                        <div className="text-[10px] text-[#526B91] mt-1 font-bold">{scrap.defectType}</div>
                      </td>
                      {/* LOSS SPECIFIC: LOSS COST */}
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-[#991B1B]">₹{scrap.totalCost.toLocaleString()}</div>
                        <div className="text-[9px] text-[#526B91] mt-1">Unit: ₹{scrap.unitCost.toLocaleString()}</div>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* PROFITABLE SPECIFIC: VALUATION */}
                      <td className="px-6 py-4">
                        <div className="text-xs text-[#526B91]">Est. recovery: <span className="font-bold text-[#0878F9]">₹{scrap.estimatedRecoveryValue.toLocaleString()}</span></div>
                        <div className="text-xs text-[#526B91] mt-1">Realized Sale: <span className="font-bold text-[#166534]">₹{scrap.actualSaleValue.toLocaleString()}</span></div>
                      </td>
                      {/* PROFITABLE SPECIFIC: DETAILS */}
                      <td className="px-6 py-4 text-xs">
                        {scrap.status === "STORED" && scrap.scrapInventory && (
                          <div className="text-[#526B91] flex items-center gap-1">
                            <Store className="w-3 h-3 text-[#0878F9]" /> 
                            <span>Qty: {scrap.scrapInventory.quantity} @ <span className="font-bold text-[#0B2148]">{scrap.scrapInventory.location}</span></span>
                          </div>
                        )}
                        {scrap.status === "SOLD" && scrap.scrapSales && scrap.scrapSales.length > 0 && (
                          <div className="text-[#526B91] space-y-0.5">
                            {scrap.scrapSales.map((sale: any) => (
                              <div key={sale.id} className="text-[10px]">
                                Sold {sale.quantitySold} to <span className="font-bold text-[#166534]">{sale.buyerName}</span> @ ₹{sale.salePrice}/pc
                              </div>
                            ))}
                          </div>
                        )}
                        {scrap.status !== "STORED" && scrap.status !== "SOLD" && (
                          <span className="text-[10px] text-[#526B91] italic">No inventory details</span>
                        )}
                      </td>
                    </>
                  )}

                  {/* STATUS PILL */}
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${getStatusColor(scrap.status)}`}>
                      {scrap.status.replace(/_/g, " ")}
                    </span>
                  </td>

                  {/* ACTIONS */}
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* 1. REPORTED -> REVIEW */}
                        {(scrap.status === "REPORTED" || scrap.status === "SCRAP_PENDING_REVIEW") && (
                          <button
                            onClick={() => statusMutation.mutate({ id: scrap.id, status: "UNDER_REVIEW" })}
                            className="text-[10px] font-bold bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] px-2.5 py-1 rounded transition-all flex items-center gap-1 uppercase tracking-wider cursor-pointer shadow-xs"
                          >
                            <span>Start Review</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* 2. UNDER REVIEW -> PROCESS (LOSS vs PROFITABLE) */}
                        {scrap.status === "UNDER_REVIEW" && activeTab === "LOSS" && (
                          <>
                            <button
                              onClick={() => {
                                if (confirm("Verify stock & execute loss write-off? This will deduct inventory.")) {
                                  statusMutation.mutate({ id: scrap.id, status: "SCRAPPED" });
                                }
                              }}
                              className="text-[10px] font-bold bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Confirm Scrap Loss Write-off"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Scrap</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Reject this loss scrap claim?")) {
                                  statusMutation.mutate({ id: scrap.id, status: "REJECTED" });
                                }
                              }}
                              className="text-[10px] font-bold bg-slate-500/10 hover:bg-slate-500/20 text-rose-400 p-1.5 rounded transition-all"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {scrap.status === "UNDER_REVIEW" && activeTab === "PROFITABLE" && (
                          <>
                            <button
                              onClick={() => {
                                setStoreData({ location: "Warehouse A" });
                                setSelectedScrapForStore(scrap);
                              }}
                              className="text-[10px] font-bold bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Store recovery inventory"
                            >
                              <Store className="w-3.5 h-3.5" />
                              <span>Store</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Reject this profitable recovery claim?")) {
                                  statusMutation.mutate({ id: scrap.id, status: "REJECTED" });
                                }
                              }}
                              className="text-[10px] font-bold bg-[#FEE2E2] hover:bg-[#FECACA] text-[#991B1B] p-1.5 rounded transition-all cursor-pointer"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* 3. STORED (PROFITABLE) -> SELL OR RECYCLE */}
                        {scrap.status === "STORED" && activeTab === "PROFITABLE" && (
                          <>
                            <button
                              onClick={() => {
                                setSellData({
                                  buyerName: "",
                                  salePrice: scrap.estimatedRecoveryValue / scrap.quantity,
                                  quantitySold: scrap.scrapInventory?.quantity || scrap.quantity,
                                  notes: ""
                                });
                                setSelectedScrapForSell(scrap);
                              }}
                              className="text-[10px] font-bold bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#166534] px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Record Sale</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Dispose/recycle physically stored scrap without revenue?")) {
                                  statusMutation.mutate({ id: scrap.id, status: "RECYCLED" });
                                }
                              }}
                              className="text-[10px] font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] p-1.5 rounded transition-all cursor-pointer"
                              title="Dispose / Recycle"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* 4. SCRAPPED (LOSS) -> DISPOSE */}
                        {scrap.status === "SCRAPPED" && activeTab === "LOSS" && (
                          <button
                            onClick={() => {
                              if (confirm("Confirm physical destruction/disposal of written-off material?")) {
                                statusMutation.mutate({ id: scrap.id, status: "DISPOSED" });
                              }
                            }}
                            className="text-[10px] font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0B2148] px-2.5 py-1 rounded transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#526B91]" />
                            <span>Dispose</span>
                          </button>
                        )}

                        {/* 5. SUPERADMIN OVERRIDES */}
                        {isSuperadmin && (
                          <button
                            onClick={() => {
                              setOverrideData({
                                status: scrap.status,
                                estimatedRecoveryValue: scrap.estimatedRecoveryValue,
                                actualSaleValue: scrap.actualSaleValue,
                                notes: ""
                              });
                              setSelectedScrapForOverride(scrap);
                            }}
                            className="p-1.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 rounded text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                            title="Superadmin Override"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* PROCESSED & COMPLETED */}
                        {((scrap.status === "SOLD" || scrap.status === "RECYCLED" || scrap.status === "REJECTED" || scrap.status === "DISPOSED") && !isSuperadmin) && (
                          <span className="text-[9px] text-[#526B91] font-bold uppercase tracking-wider select-none">Archived</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: REPORT SCRAP / waste
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel bg-white w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEE2E2] rounded-xl flex items-center justify-center text-[#991B1B]"><Trash2 className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Report Waste or Defective Scrap</h2>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                {/* Scrap Type selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Scrap Type Category</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scrapType: "LOSS", sourceType: "PRODUCTION" })}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${formData.scrapType === "LOSS" ? "border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]" : "border-[#D8E8FA] bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148]"}`}
                    >
                      Loss (Write-off Defect)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scrapType: "PROFITABLE", sourceType: "SERVICE" })}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${formData.scrapType === "PROFITABLE" ? "border-emerald-600 bg-[#DCFCE7] text-[#166534]" : "border-[#D8E8FA] bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148]"}`}
                    >
                      Profitable (Salvage Recovery)
                    </button>
                  </div>
                </div>

                {/* Material Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Material / Component Item</label>
                  <select 
                    value={formData.materialId} 
                    onChange={e => setFormData({...formData, materialId: e.target.value})}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
                  >
                    <option value="">Select Component...</option>
                    {(materials || []).map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} (Stock: {m.quantity} {m.unit || "pcs"}, Price: ₹{m.unitPrice})</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Defective quantity */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Quantity</label>
                    <input 
                      type="number" min="1"
                      value={formData.quantity} 
                      onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                      className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none"
                    />
                  </div>
                  
                  {/* Source area dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Source Area</label>
                    <select 
                      value={formData.sourceType} 
                      onChange={e => setFormData({...formData, sourceType: e.target.value})}
                      className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
                    >
                      {formData.scrapType === "PROFITABLE" ? (
                        <>
                          <option value="SERVICE">SERVICE (Repair Removal)</option>
                          <option value="RETURNED_PRODUCT">RETURNED PRODUCT</option>
                        </>
                      ) : (
                        <>
                          <option value="PRODUCTION">PRODUCTION</option>
                          <option value="TESTING">TESTING</option>
                          <option value="ASSEMBLY">ASSEMBLY</option>
                          <option value="INVENTORY_DAMAGE">INVENTORY DAMAGE</option>
                          <option value="RETURNED_PRODUCT">RETURNED PRODUCT</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {formData.scrapType === "LOSS" ? (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Severity */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Severity Level</label>
                      <select 
                        value={formData.severity} 
                        onChange={e => setFormData({...formData, severity: e.target.value})}
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
                      >
                        <option value="LOW">LOW (Cosmetic)</option>
                        <option value="MEDIUM">MEDIUM (Functional)</option>
                        <option value="HIGH">HIGH (Safety Rejection)</option>
                        <option value="CRITICAL">CRITICAL (Hazardous)</option>
                      </select>
                    </div>
                    {/* Defect type */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Defect Type</label>
                      <select 
                        value={formData.defectType} 
                        onChange={e => setFormData({...formData, defectType: e.target.value})}
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
                      >
                        {defectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* Profitable specific field: Recovery Valuation */
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Estimated Recovery Value (Total ₹)</label>
                    <input 
                      type="number" min="0"
                      value={formData.estimatedRecoveryValue} 
                      onChange={e => setFormData({...formData, estimatedRecoveryValue: parseFloat(e.target.value) || 0})}
                      className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none font-mono"
                      placeholder="e.g. Estimated value of metal recyclables"
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Defect Description / Notes</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none h-20 resize-none"
                    placeholder="Describe how the damage occurred or reasons for write-off..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-[10px] uppercase tracking-widest cursor-pointer">Cancel</button>
                <button 
                  onClick={() => scrapMutation.mutate(formData)} 
                  disabled={!formData.materialId || scrapMutation.isPending}
                  className={`flex-1 disabled:opacity-40 py-3 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest cursor-pointer shadow-sm ${formData.scrapType === "LOSS" ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {scrapMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Report"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: STORE INVENTORY
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedScrapForStore && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedScrapForStore(null)} className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel bg-white w-full max-w-md p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EAF5FF] rounded-xl flex items-center justify-center text-[#0878F9]"><Store className="w-5 h-5" /></div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Store Recovery Component</h2>
                </div>
                <button onClick={() => setSelectedScrapForStore(null)} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-[#526B91]">Specify physical location inside the facility for storing this scrap asset.</p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Storage Location Bin/Rack</label>
                  <input 
                    value={storeData.location} 
                    onChange={e => setStoreData({ location: e.target.value })}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none"
                    placeholder="e.g. Bin B-12, Scrap Area 2"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setSelectedScrapForStore(null)} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-[10px] uppercase tracking-widest cursor-pointer">Cancel</button>
                <button 
                  onClick={() => statusMutation.mutate({ id: selectedScrapForStore.id, status: "STORED", location: storeData.location })}
                  className="flex-1 bg-[#0878F9] hover:bg-[#0667DB] py-3 rounded-xl text-white font-bold transition-all text-[10px] uppercase tracking-widest cursor-pointer shadow-sm"
                >
                  Save to Stored
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: RECORD SALE
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedScrapForSell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedScrapForSell(null)} className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel bg-white w-full max-w-md p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#DCFCE7] rounded-xl flex items-center justify-center text-[#166534]"><DollarSign className="w-5 h-5" /></div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Record Scrap Recovery Sale</h2>
                </div>
                <button onClick={() => setSelectedScrapForSell(null)} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-[#526B91]">Sell stored parts/materials to scrap recyclers and log proceeds.</p>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Buyer / Recycler Name</label>
                  <input 
                    value={sellData.buyerName} 
                    onChange={e => setSellData({ ...sellData, buyerName: e.target.value })}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none"
                    placeholder="e.g. Apex Recycling Ltd."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Quantity Sold</label>
                    <input 
                      type="number" min="1" max={selectedScrapForSell.scrapInventory?.quantity || selectedScrapForSell.quantity}
                      value={sellData.quantitySold} 
                      onChange={e => setSellData({ ...sellData, quantitySold: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Sale Price per Unit (₹)</label>
                    <input 
                      type="number" min="0"
                      value={sellData.salePrice} 
                      onChange={e => setSellData({ ...sellData, salePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Remarks</label>
                  <input 
                    value={sellData.notes} 
                    onChange={e => setSellData({ ...sellData, notes: e.target.value })}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none"
                    placeholder="e.g. Sold in bulk batch"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setSelectedScrapForSell(null)} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-[10px] uppercase tracking-widest cursor-pointer">Cancel</button>
                <button 
                  onClick={() => statusMutation.mutate({ 
                    id: selectedScrapForSell.id, 
                    status: "SOLD", 
                    buyerName: sellData.buyerName, 
                    salePrice: sellData.salePrice, 
                    quantitySold: sellData.quantitySold, 
                    notes: sellData.notes 
                  })}
                  disabled={!sellData.buyerName || sellData.salePrice <= 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 py-3 rounded-xl text-white font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm cursor-pointer"
                >
                  Record Sale
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: SUPERADMIN OVERRIDE
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedScrapForOverride && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedScrapForOverride(null)} className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel bg-white w-full max-w-md p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEE2E2] rounded-xl flex items-center justify-center text-[#991B1B]"><Edit className="w-5 h-5" /></div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Superadmin Correction Override</h2>
                </div>
                <button onClick={() => setSelectedScrapForOverride(null)} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div className="bg-[#FEF3C7] border border-[#FDE68A] p-3.5 rounded-xl text-xs text-[#92400E]">
                  <AlertTriangle className="w-4 h-4 inline mr-2 align-text-bottom" />
                  <strong>WARNING:</strong> Reversing status rules can restore material counts in inventory or undo scrap sales. Please log a mandatory explanation.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Force Transition Status</label>
                  <select 
                    value={overrideData.status} 
                    onChange={e => setOverrideData({ ...overrideData, status: e.target.value })}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none cursor-pointer"
                  >
                    <option value="">Do not change status</option>
                    <option value="REPORTED">REPORTED</option>
                    <option value="SCRAP_PENDING_REVIEW">SCRAP PENDING REVIEW</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    {selectedScrapForOverride.scrapType === "LOSS" ? (
                      <>
                        <option value="SCRAPPED">SCRAPPED (loss log)</option>
                        <option value="DISPOSED">DISPOSED</option>
                      </>
                    ) : (
                      <>
                        <option value="STORED">STORED (salvage log)</option>
                        <option value="SOLD">SOLD</option>
                        <option value="RECYCLED">RECYCLED</option>
                      </>
                    )}
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                {selectedScrapForOverride.scrapType === "PROFITABLE" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Est Recovery Value (₹)</label>
                      <input 
                        type="number" min="0"
                        value={overrideData.estimatedRecoveryValue} 
                        onChange={e => setOverrideData({ ...overrideData, estimatedRecoveryValue: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Actual Sale Value (₹)</label>
                      <input 
                        type="number" min="0"
                        value={overrideData.actualSaleValue} 
                        onChange={e => setOverrideData({ ...overrideData, actualSaleValue: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">Reason / Explanation Notes</label>
                  <input 
                    value={overrideData.notes} 
                    onChange={e => setOverrideData({ ...overrideData, notes: e.target.value })}
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 px-4 text-xs text-[#0B2148] focus:border-[#0878F9] outline-none"
                    placeholder="Mandatory explanation..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex gap-3">
                <button onClick={() => setSelectedScrapForOverride(null)} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-[10px] uppercase tracking-widest cursor-pointer">Cancel</button>
                <button 
                  onClick={() => overrideMutation.mutate({ 
                    id: selectedScrapForOverride.id, 
                    status: overrideData.status || undefined, 
                    estimatedRecoveryValue: overrideData.estimatedRecoveryValue,
                    actualSaleValue: overrideData.actualSaleValue,
                    notes: overrideData.notes 
                  })}
                  disabled={!overrideData.notes}
                  className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 py-3 rounded-xl text-white font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm cursor-pointer"
                >
                  Force Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
