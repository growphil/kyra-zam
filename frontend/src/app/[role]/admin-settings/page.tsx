"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import { 
  Settings, 
  ShieldCheck, 
  Battery, 
  Truck, 
  Users, 
  ShieldAlert, 
  ArrowRight, 
  Zap, 
  Sliders,
  History,
  CheckCircle2,
  ChevronRight,
  Shield,
  LayoutDashboard,
  Sparkles,
  ArrowLeft,
  Building2,
  Warehouse,
  GripVertical,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Embedded Admin Sub-Tabs
import QcSettingsTab from "@/components/admin/QcSettingsTab";
import VendorRegistryTab from "@/components/admin/VendorRegistryTab";
import UserManagementTab from "@/components/admin/UserManagementTab";
import MaintenanceTab from "@/components/admin/MaintenanceTab";
import FactorySettingsTab from "@/components/admin/FactorySettingsTab";
import WarehouseSettingsTab from "@/components/admin/WarehouseSettingsTab";

type TabKey = "overview" | "factory" | "warehouses" | "qc" | "vendors" | "users" | "maintenance";

const DEFAULT_ADMIN_TAB_KEYS: TabKey[] = ["overview", "factory", "warehouses", "qc", "vendors", "users", "maintenance"];
const ADMIN_TAB_ORDER_STORAGE_KEY = "admin_control_center_tab_order";

function AdminSettingsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleSlug = (params?.role as string) || "superadmin";

  const rawTabParam = searchParams.get("tab");
  const initialTab = rawTabParam === "pax" ? "factory" : ((rawTabParam as TabKey) || "overview");
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Tab Alignment (Drag-and-Drop) state with local persistence
  const [tabOrder, setTabOrder] = useState<TabKey[]>(DEFAULT_ADMIN_TAB_KEYS);
  const [draggedTabKey, setDraggedTabKey] = useState<TabKey | null>(null);
  const [dragOverTabKey, setDragOverTabKey] = useState<TabKey | null>(null);

  // Load custom tab alignment order
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_TAB_ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validKeys = parsed.filter((k: any): k is TabKey => DEFAULT_ADMIN_TAB_KEYS.includes(k));
          const missingKeys = DEFAULT_ADMIN_TAB_KEYS.filter((k) => !validKeys.includes(k));
          setTabOrder([...validKeys, ...missingKeys]);
        }
      }
    } catch (e) {
      console.warn("Failed to load admin tab order", e);
    }
  }, []);

  const handleTabDragStart = (e: React.DragEvent, key: TabKey) => {
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTabKey(key);
  };

  const handleTabDragOver = (e: React.DragEvent, key: TabKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTabKey !== key) {
      setDragOverTabKey(key);
    }
  };

  const handleTabDrop = (e: React.DragEvent, targetKey: TabKey) => {
    e.preventDefault();
    const sourceKey = (e.dataTransfer.getData("text/plain") as TabKey) || draggedTabKey;
    setDraggedTabKey(null);
    setDragOverTabKey(null);

    if (!sourceKey || sourceKey === targetKey) return;

    setTabOrder((prevOrder) => {
      const newOrder = [...prevOrder];
      const sourceIdx = newOrder.indexOf(sourceKey);
      const targetIdx = newOrder.indexOf(targetKey);
      if (sourceIdx === -1 || targetIdx === -1) return prevOrder;

      newOrder.splice(sourceIdx, 1);
      newOrder.splice(targetIdx, 0, sourceKey);

      try {
        localStorage.setItem(ADMIN_TAB_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
        const movedTab = tabsConfig.find((t) => t.key === sourceKey);
        toast.success("Tab Alignment Updated", {
          description: `Repositioned "${movedTab?.label || sourceKey}" tab.`
        });
      } catch (err) {
        console.error("Failed to save admin tab order", err);
      }
      return newOrder;
    });
  };

  const handleTabDragEnd = () => {
    setDraggedTabKey(null);
    setDragOverTabKey(null);
  };

  const handleResetTabOrder = () => {
    setTabOrder(DEFAULT_ADMIN_TAB_KEYS);
    try {
      localStorage.removeItem(ADMIN_TAB_ORDER_STORAGE_KEY);
      toast.info("Tab alignment reset to default order");
    } catch (e) {
      console.warn("Failed to reset tab order", e);
    }
  };

  const isCustomTabOrder = useMemo(() => {
    if (tabOrder.length !== DEFAULT_ADMIN_TAB_KEYS.length) return true;
    return tabOrder.some((key, i) => key !== DEFAULT_ADMIN_TAB_KEYS[i]);
  }, [tabOrder]);

  // Sync tab with URL search parameter; safe redirect fallback for old tab=pax
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "pax") {
      router.replace(`/${roleSlug}/admin-settings?tab=factory`, { scroll: false });
      setActiveTab("factory");
    } else if (tabParam && ["overview", "factory", "warehouses", "qc", "vendors", "users", "maintenance"].includes(tabParam)) {
      setActiveTab(tabParam as TabKey);
    } else if (!tabParam) {
      setActiveTab("overview");
    }
  }, [searchParams, roleSlug, router]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const newUrl = tab === "overview" 
      ? `/${roleSlug}/admin-settings` 
      : `/${roleSlug}/admin-settings?tab=${tab}`;
    router.replace(newUrl, { scroll: false });
  };

  // Live queries for header stats and overview
  const { data: thresholds } = useQuery({
    queryKey: ["admin-thresholds"],
    queryFn: async () => (await api.get("/admin/qc-thresholds")).data
  });

  const { data: paxTypes } = useQuery({
    queryKey: ["admin-pax-types"],
    queryFn: async () => (await api.get("/admin/pax-types")).data
  });

  const { data: vendors } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => (await api.get("/admin/vendors")).data
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users")).data
  });

  const { data: auditLogsData } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => (await api.get("/admin/audit-logs?limit=6")).data
  });

  const { data: factoryOverview } = useQuery({
    queryKey: ["admin-factory-overview"],
    queryFn: async () => (await api.get("/admin/factory/overview")).data
  });

  const { data: warehouses } = useQuery({
    queryKey: ["admin-warehouses"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data
  });

  const activePaxModel = paxTypes?.find((p: any) => p.isProductionActive);

  const tabsConfig: { key: TabKey; label: string; icon: any; badge?: string | number }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "factory", label: "Factory", icon: Building2, badge: factoryOverview?.materialCount ? `${factoryOverview.materialCount}` : undefined },
    { key: "warehouses", label: "Warehouses", icon: Warehouse, badge: warehouses?.length ? `${warehouses.length}` : undefined },
    { key: "qc", label: "QC Limits", icon: ShieldCheck, badge: thresholds ? "Online" : undefined },
    { key: "vendors", label: "Vendors", icon: Truck, badge: vendors?.length ? `${vendors.length}` : undefined },
    { key: "users", label: "Personnel", icon: Users, badge: users?.length ? `${users.length}` : undefined },
    { key: "maintenance", label: "Maintenance", icon: ShieldAlert },
  ];

  const orderedTabsConfig = useMemo(() => {
    const map = new Map(tabsConfig.map((t) => [t.key, t]));
    const ordered = tabOrder.map((key) => map.get(key)).filter(Boolean) as typeof tabsConfig;
    tabsConfig.forEach((t) => {
      if (!ordered.some((ot) => ot.key === t.key)) {
        ordered.push(t);
      }
    });
    return ordered;
  }, [tabOrder, tabsConfig]);

  const settingCards = [
    {
      tab: "factory" as TabKey,
      title: "Factory Master Configuration",
      desc: "Material Part Number mapping, Cell Master SKUs, default quotation terms, controlled financial amounts, and operational schedules.",
      icon: Building2,
      color: "text-[#0878F9]",
      borderHover: "hover:border-[#0878F9]/40 hover:shadow-blue-500/10",
      bgIcon: "bg-blue-50 border-blue-200 text-[#0878F9]",
      badge: factoryOverview?.materialCount ? `${factoryOverview.materialCount} SKUs` : "Master Data",
      features: [
        "Material Part Number (SKU) Mapping",
        "Cell Chemistry & Parameter Registry",
        "Quotation Defaults & Controlled Amounts"
      ]
    },
    {
      tab: "warehouses" as TabKey,
      title: "Warehouses & Storage Facilities",
      desc: "Configure factory storage buildings, raw material staging depots, finished pack dispatch bays, and rack/bin location codes.",
      icon: Warehouse,
      color: "text-blue-600",
      borderHover: "hover:border-blue-500/40 hover:shadow-blue-500/10",
      bgIcon: "bg-blue-50 border-blue-200 text-blue-600",
      badge: warehouses?.length ? `${warehouses.length} Facilities` : "Storage Hub",
      features: [
        "Factory Storage Facilities & Warehouses",
        "Storage Bins, Racks & Holding Shelves",
        "Location Codes (e.g. WH-RAW, WH-FG, BIN-01)",
        "Inventory Balance Tracking Readiness"
      ]
    },
    {
      tab: "qc" as TabKey,
      title: "QC Thresholds & Fallback",
      desc: "Global cell screening tolerance bands, capacity margins, and serial number display rules.",
      icon: ShieldCheck,
      color: "text-[#166534]",
      borderHover: "hover:border-emerald-500/40 hover:shadow-emerald-500/10",
      bgIcon: "bg-emerald-50 border-emerald-200 text-[#166534]",
      badge: thresholds ? `${thresholds.ahMin}-${thresholds.ahMax} Ah | IR: ${thresholds.irMax}mΩ` : "Configured",
      features: ["Global Safety Bands", "Production Model Sync", "Barcode Suffix Masking"]
    },
    {
      tab: "vendors" as TabKey,
      title: "Vendor Registry",
      desc: "Supplier and manufacturer master catalog, contact management, and delivery channel statuses.",
      icon: Truck,
      color: "text-sky-600",
      borderHover: "hover:border-sky-500/40 hover:shadow-sky-500/10",
      bgIcon: "bg-sky-50 border-sky-200 text-sky-600",
      badge: `${vendors?.length || 0} Suppliers`,
      features: ["Vendor Master Directory", "Contact Details", "Direct Procurement Linkage"]
    },
    {
      tab: "users" as TabKey,
      title: "Personnel & Access Control",
      desc: "Employee directory, granular departmental permissions, role matrix assignments, and token security.",
      icon: Users,
      color: "text-purple-600",
      borderHover: "hover:border-purple-500/40 hover:shadow-purple-500/10",
      bgIcon: "bg-purple-50 border-purple-200 text-purple-600",
      badge: `${users?.length || 0} Accounts`,
      features: ["Multi-Role Assignment", "Instant Token Revocation", "Operator Authorization"]
    },
    {
      tab: "maintenance" as TabKey,
      title: "Maintenance & Purge",
      desc: "Factory pre-commissioning tools, selective database purge, and irreversible system reset protocols.",
      icon: ShieldAlert,
      color: "text-rose-600",
      borderHover: "hover:border-rose-500/40 hover:shadow-rose-500/10",
      bgIcon: "bg-rose-50 border-rose-200 text-rose-600",
      badge: "High-Security Zone",
      features: ["Selective Data Wipes", "Factory Reset Procedures", "Audit Safeguards"]
    }
  ];

  return (
    <div className="space-y-3 sm:space-y-3.5 max-w-[1600px] mx-auto pb-10 p-3 sm:p-5 text-[#0B2148]">
      
      {/* 1. Top Compact Breadcrumbs & System Hub Badge */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#526B91]">
            <Link href={`/${roleSlug}`} className="hover:text-[#0B2148] transition-colors">
              Workspace
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#526B91]" />
            <button 
              type="button"
              onClick={() => handleTabChange("overview")}
              className={`hover:text-[#0B2148] transition-colors cursor-pointer ${activeTab === "overview" ? "text-[#0B2148] font-bold" : ""}`}
            >
              Administration
            </button>
            {activeTab !== "overview" && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-[#526B91]" />
                <span className="text-[#0878F9] font-bold">
                  {tabsConfig.find(t => t.key === activeTab)?.label}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 border border-amber-200/80 rounded-full text-amber-700 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
              <Shield className="w-3 h-3 text-amber-600" />
              <span>Executive System Hub</span>
            </div>
            {activeTab !== "overview" && (
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[#526B91] hover:text-[#0878F9] bg-white hover:bg-[#EAF5FF] border border-[#D8E8FA] transition-all cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Overview Hub</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Compact Hero Title Section (Reduced Gap & Clean Sizing) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#D8E8FA]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] shadow-2xs flex-shrink-0">
              <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-display font-bold text-[#0B2148] tracking-tight leading-tight">
                Administration Control Center
              </h1>
              <p className="text-xs text-[#526B91] font-medium tracking-tight">
                Centralized administration hub for industrial parameters, matching engine logic, and personnel access control.
              </p>
            </div>
          </div>

          {/* Tab Reordering alignment controls */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {isCustomTabOrder && (
              <button
                type="button"
                onClick={handleResetTabOrder}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-white hover:bg-slate-50 border border-[#D8E8FA] rounded-lg shadow-2xs transition-all cursor-pointer"
                title="Reset tab alignment to default order"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#526B91]" />
                <span>Reset Alignment</span>
              </button>
            )}
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#526B91] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#D8E8FA] shadow-2xs select-none">
              <GripVertical className="w-3.5 h-3.5 text-[#0878F9]" />
              <span>Drag tabs to realign</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Segmented Tab Navigation Control — Single View, Every Option with Defined Border, No Scroll */}
      <div className="bg-slate-50/70 p-1 rounded-xl border border-[#D8E8FA] shadow-2xs w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 w-full">
          {orderedTabsConfig.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            const isDragging = draggedTabKey === tab.key;
            const isDragOver = dragOverTabKey === tab.key && !isDragging;

            return (
              <button
                key={tab.key}
                type="button"
                draggable
                onDragStart={(e) => handleTabDragStart(e, tab.key)}
                onDragOver={(e) => handleTabDragOver(e, tab.key)}
                onDrop={(e) => handleTabDrop(e, tab.key)}
                onDragEnd={handleTabDragEnd}
                onClick={() => handleTabChange(tab.key)}
                title="Drag to realign position • Click to view"
                className={`group relative flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all select-none border shadow-2xs cursor-grab active:cursor-grabbing ${
                  isDragging
                    ? "opacity-40 border-dashed border-[#0878F9] bg-[#EAF5FF]/60 scale-95"
                    : isDragOver
                    ? "ring-2 ring-[#0878F9] ring-dashed bg-[#EAF5FF] scale-[1.02] border-[#0878F9]"
                    : isActive 
                    ? "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9] font-bold ring-1 ring-[#0878F9]/20" 
                    : "bg-white text-slate-700 hover:text-[#0878F9] hover:bg-[#F4F9FF] border-[#D8E8FA] hover:border-[#0878F9]/40"
                }`}
              >
                <GripVertical className={`w-3 h-3 flex-shrink-0 transition-opacity ${
                  isActive ? "text-[#0878F9]/70" : "text-slate-300 group-hover:text-slate-500"
                }`} />
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? "text-[#0878F9]" : "text-[#526B91] group-hover:text-[#0878F9]"}`} />
                <span className="truncate tracking-tight">{tab.label}</span>
                {tab.badge !== undefined && (
                  tab.badge === "Online" ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold flex-shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      ON
                    </span>
                  ) : (
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold flex-shrink-0 border ${
                      isActive 
                        ? "bg-[#0878F9]/15 text-[#0878F9] border-[#0878F9]/30" 
                        : "bg-slate-50 text-[#526B91] border-slate-200"
                    }`}>
                      {tab.badge}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Tab Contents with Animated Transitions */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4 sm:space-y-5"
          >
            {/* Live Operational Metrics Grid (Compact ~16-18px padding) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              
              {/* Metric 1 */}
              <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#D8E8FA] flex items-center justify-between shadow-2xs">
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Active Model</p>
                  <p className="text-lg sm:text-xl font-display font-bold text-[#0B2148] mt-0.5">
                    {activePaxModel ? activePaxModel.name : "Global Fallback"}
                  </p>
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5 mt-0.5 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Engine Online
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
              </div>

              {/* Metric 2 */}
              <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#D8E8FA] flex items-center justify-between shadow-2xs">
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Total Personnel</p>
                  <p className="text-lg sm:text-xl font-display font-bold text-[#0B2148] mt-0.5">
                    {users?.length || 0} Users
                  </p>
                  <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                    {users?.filter((u: any) => u.isActive !== false).length || 0} Active Authorized
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Metric 3 */}
              <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#D8E8FA] flex items-center justify-between shadow-2xs">
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Material Catalog</p>
                  <p className="text-lg sm:text-xl font-display font-bold text-[#0B2148] mt-0.5">
                    {factoryOverview?.materialCount || 0} SKUs
                  </p>
                  <p className="text-[11px] text-[#0878F9] font-semibold mt-0.5">
                    Master Parts & BOM Ready
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0878F9] flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>

              {/* Metric 4 */}
              <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#D8E8FA] flex items-center justify-between shadow-2xs">
                <div>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Active Suppliers</p>
                  <p className="text-lg sm:text-xl font-display font-bold text-[#0B2148] mt-0.5">
                    {vendors?.length || 0} Vendors
                  </p>
                  <p className="text-[11px] text-sky-700 font-semibold mt-0.5">
                    Supply Chain Linked
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 flex-shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Subsystem Direct Action Workspace Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-display font-bold text-[#0B2148] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0878F9]" />
                  Administrative Subsystems
                </h2>
                <span className="text-xs text-[#526B91] font-medium">Select any module to configure parameters</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {settingCards.map((card, idx) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <button
                      type="button"
                      onClick={() => handleTabChange(card.tab)}
                      className={`w-full text-left group block h-full bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] ${card.borderHover} hover:bg-[#F4F9FF] transition-all relative overflow-hidden shadow-2xs flex flex-col justify-between cursor-pointer`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.bgIcon} flex-shrink-0`}>
                            <card.icon className="w-4.5 h-4.5" />
                          </div>
                          <span className="px-2.5 py-0.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-md text-[10px] font-mono font-bold text-[#0B2148]">
                            {card.badge}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-display font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors flex items-center gap-1.5">
                          <span>{card.title}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#0878F9]" />
                        </h3>

                        <p className="text-xs text-[#526B91] mt-1 leading-relaxed line-clamp-2">
                          {card.desc}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 space-y-1.5">
                        {card.features.map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#526B91]">
                            <CheckCircle2 className="w-3 h-3 text-[#0878F9] flex-shrink-0" />
                            <span className="truncate">{f}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Audit Logs Trail */}
            {auditLogsData?.logs && auditLogsData.logs.length > 0 && (
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0878F9]">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-display font-bold text-[#0B2148]">Recent System Audit Trail</h3>
                      <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Latest Administrative Activity</p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[#E8F1FC] border border-[#D8E8FA] rounded-xl overflow-hidden bg-slate-50/30">
                  {auditLogsData.logs.map((log: any, idx: number) => (
                    <div key={log.id} className="p-3 flex items-center justify-between gap-3 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 text-center text-[10px] font-mono font-bold text-[#526B91] shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-mono font-bold text-[#0878F9] uppercase">
                          {log.action}
                        </span>
                        <p className="text-xs text-[#0B2148] font-medium truncate">
                          {log.entityType}: <span className="text-[#526B91]">{log.entityId}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-[10px] text-[#526B91]">
                        <span>{log.actor?.name || log.actor?.email || "System"}</span>
                        <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Factory Settings Tab */}
        {activeTab === "factory" && (
          <motion.div
            key="factory"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white rounded-xl border border-[#D8E8FA] shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0878F9]">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2148]">Factory Master Control & Financial Defaults</h2>
                  <p className="text-xs text-[#526B91]">Configure factory master mappings, operational defaults and financial controls.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="px-3 py-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-lg border border-[#D8E8FA] transition-colors cursor-pointer"
              >
                Back to Overview
              </button>
            </div>
            <FactorySettingsTab />
          </motion.div>
        )}

        {/* Warehouses & Locations Tab */}
        {activeTab === "warehouses" && (
          <motion.div
            key="warehouses"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white rounded-xl border border-[#D8E8FA] shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Warehouse className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2148]">Warehouses & Storage Facilities</h2>
                  <p className="text-xs text-[#526B91]">Manage factory buildings, storage zones, and bin location codes for goods receipts, transfers, and finished goods.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="px-3 py-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-lg border border-[#D8E8FA] transition-colors cursor-pointer"
              >
                Back to Overview
              </button>
            </div>
            <WarehouseSettingsTab />
          </motion.div>
        )}

        {/* QC Settings Tab */}
        {activeTab === "qc" && (
          <motion.div
            key="qc"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white rounded-xl border border-[#D8E8FA] shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534]">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2148]">QC Thresholds & Safety Standards</h2>
                  <p className="text-xs text-[#526B91]">Configure master safety fallback tolerances, IR limits, and active production models.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="px-3 py-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-lg border border-[#D8E8FA] transition-colors cursor-pointer"
              >
                Back to Overview
              </button>
            </div>
            <QcSettingsTab onNavigateToPax={() => handleTabChange("factory")} />
          </motion.div>
        )}

        {/* Vendor Registry Tab */}
        {activeTab === "vendors" && (
          <motion.div
            key="vendors"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white rounded-xl border border-[#D8E8FA] shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <Truck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2148]">Vendor & Supplier Registry</h2>
                  <p className="text-xs text-[#526B91]">Maintain battery cell suppliers, procurement directories, and active vendor communication channels.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="px-3 py-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-lg border border-[#D8E8FA] transition-colors cursor-pointer"
              >
                Back to Overview
              </button>
            </div>
            <VendorRegistryTab />
          </motion.div>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white rounded-xl border border-[#D8E8FA] shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2148]">Personnel & Role Management</h2>
                  <p className="text-xs text-[#526B91]">Provision employee accounts, assign granular role-based permissions, and manage token revocation.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="px-3 py-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-lg border border-[#D8E8FA] transition-colors cursor-pointer"
              >
                Back to Overview
              </button>
            </div>
            <UserManagementTab />
          </motion.div>
        )}

        {/* System Maintenance Tab */}
        {activeTab === "maintenance" && (
          <motion.div
            key="maintenance"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white rounded-xl border border-[#D8E8FA] shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2148]">System Maintenance & Data Purge</h2>
                  <p className="text-xs text-[#526B91]">Execute factory reset operations, purge historical transaction batches, and audit reset logs.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange("overview")}
                className="px-3 py-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-lg border border-[#D8E8FA] transition-colors cursor-pointer"
              >
                Back to Overview
              </button>
            </div>
            <MaintenanceTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminSettingsHubPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0878F9] border-t-transparent animate-spin" />
      </div>
    }>
      <AdminSettingsContent />
    </Suspense>
  );
}
