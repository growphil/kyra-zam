"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import { 
  PackagePlus, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  Loader2, 
  Search, 
  Layers, 
  Zap, 
  Hash, 
  BatteryCharging, 
  Plus, 
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  Tag,
  ShieldAlert,
  ChevronDown
} from "lucide-react";
import BulkInward from "@/components/cells/BulkInward";
import InwardHistoryTable from "@/components/cells/InwardHistoryTable";

interface MaterialItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
}

interface CellCategory {
  id: string;
  name: string;
}

interface InwardSummary {
  todayInwardCount: number;
  totalAvailableForTesting: number;
  totalTestedCount: number;
  totalRejectedCount: number;
  totalReceivedCount: number;
  totalBatches: number;
}

// Standard Default Cell SKUs for quick suggestions
const STANDARD_CELL_SKUS = [
  { sku: "CELL-LFP-3200", name: "Lithium Iron Phosphate 3.2V 3200mAh Cell" },
  { sku: "CELL-LFP-2800", name: "Lithium Iron Phosphate 3.2V 2800mAh Cell" },
  { sku: "CELL-NMC-2500", name: "Nickel Manganese Cobalt 3.7V 2500mAh Cell" },
  { sku: "CELL-21700-5000", name: "21700 Cylindrical 3.7V 5000mAh Cell" },
  { sku: "CELL-18650-3000", name: "18650 Cylindrical 3.7V 3000mAh Cell" },
  { sku: "CELL-PRISM-100AH", name: "Prismatic LiFePO4 3.2V 100Ah Cell" },
];

export default function InwardPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const currentRole = (params?.role as string) || "inventory-manager";

  const userRoles = (session?.user as any)?.roles || [];
  const isAuthorized = userRoles.some((r: string) => ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"].includes(r));

  const queryClient = useQueryClient();
  const [showUploader, setShowUploader] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Form State
  const [partNumber, setPartNumber] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [quantity, setQuantity] = useState<string>("500");
  const [batchNumber, setBatchNumber] = useState("");
  const [category, setCategory] = useState("LFP 3.2V");
  const [voltage, setVoltage] = useState("3.2");
  const [cycles, setCycles] = useState("0");
  const [notes, setNotes] = useState("");

  // Last Saved Confirmation State
  const [lastSaved, setLastSaved] = useState<{
    inwardNumber: string;
    partNumber: string;
    quantity: number;
    batchNumber: string;
    availableQty: number;
  } | null>(null);

  // Default Batch Number generator
  useEffect(() => {
    const today = new Date();
    const month = today.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const year = today.getFullYear();
    setBatchNumber(`CELL-${month}-${year}-001`);
  }, []);

  // Fetch Materials / Part Numbers
  const { data: materials = [] } = useQuery<MaterialItem[]>({
    queryKey: ["materials-cell-inward"],
    queryFn: async () => {
      const res = await api.get("/inventory/materials");
      return res.data || [];
    },
    enabled: isAuthorized,
  });

  // Fetch Cell Categories
  const { data: categories = [] } = useQuery<CellCategory[]>({
    queryKey: ["cell-categories"],
    queryFn: async () => {
      const res = await api.get("/admin/cell-categories");
      return res.data || [];
    },
    enabled: isAuthorized,
  });

  // Set default category once loaded
  useEffect(() => {
    if (categories.length > 0 && !categories.some(c => c.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

  // Fetch Live Summary KPIs
  const { data: summary } = useQuery<InwardSummary>({
    queryKey: ["inward-batches-summary", refreshKey],
    queryFn: async () => {
      const res = await api.get("/cells/inward-batches/summary");
      return res.data;
    },
    enabled: isAuthorized,
    refetchInterval: 15000,
  });

  // Filter materials to ONLY show Battery Cells (excludes BMS, wires, fasteners, enclosures)
  const cellMaterials = useMemo(() => {
    const fromInventory = materials.filter(m => {
      const cat = (m.category || "").toUpperCase();
      const sku = (m.sku || "").toUpperCase();
      const name = (m.name || "").toUpperCase();
      return cat.includes("CELL") || sku.startsWith("CELL-") || sku.startsWith("BAT-CELL-") || name.includes("CELL");
    });

    if (fromInventory.length > 0) {
      return fromInventory;
    }

    // Fallback standard cell options if inventory does not have cells yet
    return STANDARD_CELL_SKUS.map((s, idx) => ({
      id: `default-cell-${idx}`,
      sku: s.sku,
      name: s.name,
      category: "CELLS",
      quantity: 0
    }));
  }, [materials]);

  // Filter cell materials by search query
  const filteredCellMaterials = useMemo(() => {
    if (!partSearch.trim()) return cellMaterials;
    const q = partSearch.toLowerCase();
    return cellMaterials.filter(m => 
      m.sku.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q)
    );
  }, [cellMaterials, partSearch]);

  // Mutation for Inward Submission
  const inwardMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post("/cells/inward-batches", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Cell Inward completed! ${data.quantity} cells of ${data.partNumber} received.`);
      setLastSaved({
        inwardNumber: data.inwardNumber,
        partNumber: data.partNumber,
        quantity: data.quantity,
        batchNumber: data.batchNumber,
        availableQty: data.availableQty,
      });
      queryClient.invalidateQueries({ queryKey: ["inward-batches-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inward-batches-history"] });
      queryClient.invalidateQueries({ queryKey: ["materials-cell-inward"] });
      setRefreshKey(prev => prev + 1);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to record cell inward");
    }
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanPart = partNumber.trim() || partSearch.trim();
    if (!cleanPart) {
      toast.error("Please select or enter a Cell Part Number (SKU)");
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Please enter a valid quantity greater than 0");
      return;
    }

    if (!batchNumber.trim()) {
      toast.error("Batch number is required for traceability");
      return;
    }

    const voltNum = parseFloat(voltage);
    if (isNaN(voltNum) || voltNum <= 0) {
      toast.error("Please enter a valid voltage value");
      return;
    }

    const cycleNum = parseInt(cycles, 10) || 0;

    inwardMutation.mutate({
      partNumber: cleanPart.toUpperCase(),
      quantity: qtyNum,
      batchNumber: batchNumber.trim().toUpperCase(),
      category,
      voltage: voltNum,
      cycles: cycleNum,
      notes: notes.trim() || null,
    });
  };

  const handleResetForm = () => {
    setLastSaved(null);
    setPartNumber("");
    setPartSearch("");
    setQuantity("500");
    setNotes("");
  };

  const downloadTemplate = () => {
    const headers = ["PartNumber", "Quantity", "BatchNumber", "Category", "Voltage", "Cycles", "Notes"];
    const rows = [
      ["CELL-LFP-3200", "500", "BATCH-OCT-001", "LFP 3.2V", "3.2", "0", "Standard Shipment"],
      ["CELL-LFP-2800", "300", "BATCH-OCT-002", "LFP 3.2V", "3.2", "0", "Standard Shipment"],
    ];
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "cell_inward_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Cell template downloaded!");
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
        <p className="text-xs text-[#526B91] font-mono">Verifying authorization credentials...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-red-500/20 bg-white shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-display font-bold text-[#0B2148] uppercase tracking-wide">
            Access Restricted
          </h2>
          <p className="text-xs text-[#526B91] leading-relaxed">
            Bulk cell receiving and inventory inward operations are restricted to authorized <strong className="text-[#0B2148]">Inventory Managers</strong>.
          </p>
          <p className="text-xs text-[#526B91] leading-relaxed">
            Test Engineers operate directly from physical cell testing on the <strong className="text-accent">Testing Station</strong>.
          </p>
          <div className="pt-3">
            <button
              onClick={() => router.push(`/${currentRole}/testing`)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-accent hover:bg-accent/80 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-accent/20"
            >
              <Zap className="w-4 h-4" />
              Go to Testing Station
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#D8E8FA] pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <PackagePlus className="w-8 h-8 text-accent" />
            Cell Inward
          </h1>
          <p className="text-[#526B91] mt-1 text-sm">
            Receive and register bulk <span className="text-[#0B2148] font-medium">Battery Cell</span> shipments by Part Number and Quantity. Serial numbers are captured downstream during physical testing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            CSV Format
          </button>
          
          <button 
            onClick={() => setShowUploader(!showUploader)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              showUploader 
                ? "bg-accent text-slate-950 shadow-lg shadow-accent/20" 
                : "bg-[#F4F9FF] text-[#0B2148] hover:text-white border border-[#D8E8FA] hover:bg-[#EAF5FF]"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {showUploader ? "Switch to Single Cell Inward" : "Bulk Manifest Upload"}
          </button>
        </div>
      </div>

      {/* ── KPI METRICS RIBBON ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Today&apos;s Inward</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-[#0B2148]">
              {summary?.todayInwardCount?.toLocaleString() || "0"}
            </span>
            <span className="text-xs text-[#526B91] font-medium">pcs</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Available for Test</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <BatteryCharging className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-[#166534]">
              {summary?.totalAvailableForTesting?.toLocaleString() || "0"}
            </span>
            <span className="text-xs text-[#526B91] font-medium">pcs ready</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Tested Physical Cells</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-[#0B2148]">
              {summary?.totalTestedCount?.toLocaleString() || "0"}
            </span>
            <span className="text-xs text-[#526B91] font-medium">pcs tested</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Total Inward Batches</span>
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-[#0B2148]">
              {summary?.totalBatches?.toLocaleString() || "0"}
            </span>
            <span className="text-xs text-[#526B91] font-medium">lots</span>
          </div>
        </div>
      </div>

      {/* ── WORKFLOW CONTAINER ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {showUploader ? (
          <motion.div
            key="bulk-uploader"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <BulkInward onSuccess={() => setRefreshKey(k => k + 1)} />
          </motion.div>
        ) : (
          <motion.div
            key="single-inward-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* ── SAVE CONFIRMATION BANNER ───────────────────────────────────── */}
            {lastSaved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-display font-bold text-[#0B2148]">Cell Inward Transaction Recorded</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-[#166534]">
                        {lastSaved.inwardNumber}
                      </span>
                    </div>
                    <p className="text-xs text-[#166534]/80">
                      Successfully received <span className="text-[#0B2148] font-bold">{lastSaved.quantity.toLocaleString()} pcs</span> of Cell SKU <span className="text-[#0B2148] font-bold font-mono">{lastSaved.partNumber}</span> under batch <span className="text-[#0B2148] font-bold font-mono">{lastSaved.batchNumber}</span>.
                    </p>
                    <div className="text-[11px] text-[#526B91] pt-1">
                      Available for Testing: <span className="text-[#166534] font-bold">{lastSaved.availableQty.toLocaleString()} physical cells</span> ready in testing queue.
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleResetForm}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  New Cell Inward
                </button>
              </motion.div>
            )}

            {/* ── PRIMARY INWARD FORM ────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-3xl border border-[#D8E8FA] space-y-6">
              <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148] flex items-center gap-2">
                    <BatteryCharging className="w-5 h-5 text-accent" />
                    Receive Battery Cell Inventory
                  </h2>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Select a Cell SKU and quantity. Serial numbers will be scanned and verified downstream on the testing station.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-[#526B91] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Form
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. Cell Part Number / SKU (Filter strictly to cells) */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Cell Part Number (SKU) <span className="text-accent">*</span>
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
                    <input
                      type="text"
                      value={partSearch}
                      onChange={(e) => {
                        setPartSearch(e.target.value);
                        setPartNumber(e.target.value);
                        setShowPartDropdown(true);
                      }}
                      onFocus={() => setShowPartDropdown(true)}
                      placeholder="Select or type Cell SKU (e.g. CELL-LFP-3200)..."
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-10 pr-8 text-sm font-mono text-white placeholder:text-[#64748B] focus:outline-none focus:border-accent focus:bg-white transition-all"
                    />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91] pointer-events-none" />
                  </div>

                  {/* Dropdown Menu (Cells Only) */}
                  {showPartDropdown && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto backdrop-blur-xl">
                      {filteredCellMaterials.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#526B91]">
                          Custom Cell SKU: <strong className="text-accent font-mono">{partSearch.toUpperCase()}</strong>
                        </div>
                      ) : (
                        filteredCellMaterials.map((mat) => (
                          <div
                            key={mat.id || mat.sku}
                            onClick={() => {
                              setPartNumber(mat.sku);
                              setPartSearch(mat.sku);
                              setShowPartDropdown(false);
                            }}
                            className="p-3 hover:bg-[#EAF5FF] cursor-pointer border-b border-[#D8E8FA] flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <span className="font-mono font-bold text-accent">{mat.sku}</span>
                              <p className="text-[#526B91] text-[11px] mt-0.5">{mat.name}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                              CELL
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Received Quantity */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Quantity Received <span className="text-accent">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#166534]" />
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="500"
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-10 pr-4 text-base font-display font-bold text-white placeholder:text-[#64748B] focus:outline-none focus:border-accent focus:bg-white transition-all"
                    />
                  </div>
                  {/* Preset quick buttons */}
                  <div className="flex gap-1.5 pt-1">
                    {["100", "250", "500", "1000"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuantity(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          quantity === preset 
                            ? "bg-accent/20 border-accent text-accent font-bold" 
                            : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:text-white"
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Batch Number */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Batch / Lot Number <span className="text-accent">*</span>
                  </label>
                  <input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="CELL-OCT-2026-001"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm font-mono text-white placeholder:text-[#64748B] focus:outline-none focus:border-accent focus:bg-white transition-all"
                  />
                </div>

                {/* 4. Cell Category / Chemistry */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Chemistry / Category <span className="text-accent">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#020617] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-accent transition-all cursor-pointer appearance-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name} className="bg-[#020617]">
                        {cat.name}
                      </option>
                    ))}
                    {categories.length === 0 && (
                      <option value="LFP 3.2V" className="bg-[#020617]">LFP 3.2V</option>
                    )}
                  </select>
                </div>

                {/* 5. Open Circuit Voltage */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Rated Nominal Voltage (V)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={voltage}
                    onChange={(e) => setVoltage(e.target.value)}
                    placeholder="3.2"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-accent focus:bg-white transition-all"
                  />
                </div>

                {/* 6. Initial Cycles */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Arrival Cycles
                  </label>
                  <input
                    type="number"
                    value={cycles}
                    onChange={(e) => setCycles(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-accent focus:bg-white transition-all"
                  />
                </div>

                {/* 7. Receiving Notes & Supplier Ref */}
                <div className="space-y-2 lg:col-span-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">
                    Receiving Notes / Supplier Challan Reference (Optional)
                  </label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Challan #CH-8823, EVE Energy Container #2"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:border-accent focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Action Ribbon */}
              <div className="pt-4 border-t border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[#526B91]">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Physical serial numbers will be allocated when Test Engineer begins testing.</span>
                </div>

                <button
                  type="submit"
                  disabled={inwardMutation.isPending}
                  className="w-full sm:w-auto bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-slate-950 font-bold py-3.5 px-10 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 cursor-pointer text-sm"
                >
                  {inwardMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording Cell Inward...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>SAVE CELL INWARD</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* ── INWARD HISTORY TABLE ───────────────────────────────────────── */}
            <InwardHistoryTable refreshKey={refreshKey} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
