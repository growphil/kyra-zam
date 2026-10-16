"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Warehouse, 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Loader2, 
  Save, 
  Search, 
  Building2, 
  Boxes, 
  Archive, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Hash,
  Layers,
  ChevronRight,
  Filter,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface WarehouseData {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  locations: LocationData[];
  _count?: {
    locations: number;
    stockBalances: number;
  };
}

interface LocationData {
  id: string;
  warehouseId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

const WAREHOUSE_PRESETS = [
  { name: "Raw Materials Central Store", code: "WH-RAW", address: "Main Factory - Bay 1, Raw Inventory Receiving" },
  { name: "Battery Pack Assembly WIP Depot", code: "WH-ASM", address: "Factory Floor Ground - Module Assembly Line" },
  { name: "Finished Goods Central Depo", code: "WH-FG", address: "Logistics Wing - Finished Packs Storage & Dispatch Bay" },
  { name: "Incoming Quality & Quarantine Hold", code: "WH-QC", address: "QC Laboratory - Inbound Cell Testing & Staging" },
  { name: "Service, RMA & Repairs Facility", code: "WH-SRV", address: "Service Wing - Warranty Replacement & Battery Rework" },
];

const LOCATION_PRESETS = [
  { name: "Aisle A - Bulk Storage Bin", code: "BIN-A01" },
  { name: "Aisle B - High-Density Rack", code: "RACK-B01" },
  { name: "QC Inbound Staging Area", code: "STAGING-QC" },
  { name: "Finished Pack Pallet Bay 1", code: "PALLET-FG1" },
  { name: "Small Components Drawer Shelf", code: "SHELF-01" },
];

export default function WarehouseSettingsTab() {
  const queryClient = useQueryClient();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "WITH_LOCATIONS" | "EMPTY">("ALL");

  // Warehouse Modal States
  const [isWHModalOpen, setIsWHModalOpen] = useState(false);
  const [editingWH, setEditingWH] = useState<WarehouseData | null>(null);
  const [whForm, setWhForm] = useState({ name: "", code: "", address: "" });

  // Location Modal States
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [targetWHForLoc, setTargetWHForLoc] = useState<WarehouseData | null>(null);
  const [editingLoc, setEditingLoc] = useState<LocationData | null>(null);
  const [locForm, setLocForm] = useState({ name: "", code: "" });

  // Delete Confirmation States
  const [deletingWH, setDeletingWH] = useState<WarehouseData | null>(null);
  const [deletingLoc, setDeletingLoc] = useState<{ warehouse: WarehouseData; location: LocationData } | null>(null);

  // --- QUERIES ---
  const { data: warehouses, isLoading: loadingWarehouses } = useQuery<WarehouseData[]>({
    queryKey: ["admin-warehouses"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data
  });

  const { data: balances } = useQuery({
    queryKey: ["inventory-location-balances"],
    queryFn: async () => (await api.get("/inventory/location-balances")).data
  });

  // --- MUTATIONS ---
  // Create or Update Warehouse
  const saveWHMutation = useMutation({
    mutationFn: async (payload: { id?: string; name: string; code: string; address?: string }) => {
      if (payload.id) {
        return (await api.put(`/inventory/warehouses/${payload.id}`, payload)).data;
      }
      return (await api.post("/inventory/warehouses", payload)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      toast.success(editingWH ? `Warehouse "${data.name}" updated successfully` : `Warehouse "${data.name}" created successfully`);
      setIsWHModalOpen(false);
      setEditingWH(null);
      setWhForm({ name: "", code: "", address: "" });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save warehouse");
    }
  });

  // Delete Warehouse
  const deleteWHMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/inventory/warehouses/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      toast.success("Warehouse facility deleted successfully");
      setDeletingWH(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete warehouse");
    }
  });

  // Create or Update Location
  const saveLocMutation = useMutation({
    mutationFn: async (payload: { warehouseId: string; locId?: string; name: string; code: string }) => {
      if (payload.locId) {
        return (await api.put(`/inventory/warehouses/${payload.warehouseId}/locations/${payload.locId}`, {
          name: payload.name,
          code: payload.code
        })).data;
      }
      return (await api.post(`/inventory/warehouses/${payload.warehouseId}/locations`, {
        name: payload.name,
        code: payload.code
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      toast.success(editingLoc ? `Location bin "${locForm.code}" updated` : `Location bin "${locForm.code}" created`);
      setIsLocModalOpen(false);
      setEditingLoc(null);
      setTargetWHForLoc(null);
      setLocForm({ name: "", code: "" });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save location bin");
    }
  });

  // Delete Location
  const deleteLocMutation = useMutation({
    mutationFn: async ({ warehouseId, locId }: { warehouseId: string; locId: string }) => {
      return (await api.delete(`/inventory/warehouses/${warehouseId}/locations/${locId}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      toast.success("Location bin deleted successfully");
      setDeletingLoc(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete location bin");
    }
  });

  // --- HANDLERS ---
  const handleOpenAddWarehouse = () => {
    setEditingWH(null);
    setWhForm({ name: "", code: "", address: "" });
    setIsWHModalOpen(true);
  };

  const handleOpenEditWarehouse = (wh: WarehouseData) => {
    setEditingWH(wh);
    setWhForm({
      name: wh.name,
      code: wh.code,
      address: wh.address || ""
    });
    setIsWHModalOpen(true);
  };

  const handleOpenAddLocation = (wh: WarehouseData) => {
    setTargetWHForLoc(wh);
    setEditingLoc(null);
    setLocForm({ name: "", code: "" });
    setIsLocModalOpen(true);
  };

  const handleOpenEditLocation = (wh: WarehouseData, loc: LocationData) => {
    setTargetWHForLoc(wh);
    setEditingLoc(loc);
    setLocForm({ name: loc.name, code: loc.code });
    setIsLocModalOpen(true);
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whForm.name.trim() || !whForm.code.trim()) {
      toast.error("Warehouse Name and Code are required");
      return;
    }
    saveWHMutation.mutate({
      id: editingWH?.id,
      name: whForm.name.trim(),
      code: whForm.code.trim().toUpperCase(),
      address: whForm.address.trim() || undefined
    });
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWHForLoc) return;
    if (!locForm.name.trim() || !locForm.code.trim()) {
      toast.error("Location Name and Code are required");
      return;
    }
    saveLocMutation.mutate({
      warehouseId: targetWHForLoc.id,
      locId: editingLoc?.id,
      name: locForm.name.trim(),
      code: locForm.code.trim().toUpperCase()
    });
  };

  // Filter Warehouses
  const filteredWarehouses = (warehouses || []).filter((wh) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      wh.name.toLowerCase().includes(q) ||
      wh.code.toLowerCase().includes(q) ||
      (wh.address && wh.address.toLowerCase().includes(q)) ||
      (wh.locations && wh.locations.some(l => l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)));

    if (!matchesSearch) return false;

    if (filterType === "WITH_LOCATIONS") {
      return (wh.locations?.length || 0) > 0;
    }
    if (filterType === "EMPTY") {
      return (wh.locations?.length || 0) === 0;
    }
    return true;
  });

  // Total Location Count across all warehouses
  const totalLocationsCount = (warehouses || []).reduce((acc, wh) => acc + (wh.locations?.length || 0), 0);
  const totalBalancesCount = Array.isArray(balances) ? balances.length : 0;

  return (
    <div className="space-y-6">
      {/* 1. KPI Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Warehouses */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#526B91]">Warehouse Facilities</p>
            <p className="text-xl font-bold font-mono text-[#0B2148] mt-0.5">
              {loadingWarehouses ? "..." : warehouses?.length || 0}
            </p>
          </div>
        </div>

        {/* Total Storage Bins / Zones */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#526B91]">Storage Bins & Racks</p>
            <p className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
              {loadingWarehouses ? "..." : totalLocationsCount}
            </p>
          </div>
        </div>

        {/* Mapped Stock Balances */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#526B91]">Active Stock Positions</p>
            <p className="text-xl font-bold font-mono text-purple-700 mt-0.5">
              {totalBalancesCount} Mapped
            </p>
          </div>
        </div>

        {/* Operational System Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#526B91]">ERP Storage Governance</p>
            <p className="text-sm font-bold text-[#0B2148] mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Online
            </p>
          </div>
        </div>
      </div>

      {/* 2. Search, Filter, and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-white rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-xl">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search warehouses by name, code, address, or bin..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-[#0B2148] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#526B91]" />
            <select
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
            >
              <option value="ALL">All Warehouses ({warehouses?.length || 0})</option>
              <option value="WITH_LOCATIONS">Configured With Bins</option>
              <option value="EMPTY">No Bins Configured</option>
            </select>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenAddWarehouse}
            className="flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Configure New Warehouse
          </button>
        </div>
      </div>

      {/* 3. Main Warehouses & Locations List */}
      {loadingWarehouses ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-xs font-semibold text-[#526B91]">Loading factory warehouses and storage locations...</p>
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 space-y-3">
          <Warehouse className="w-12 h-12 mx-auto text-[#526B91]" />
          <h4 className="text-sm font-bold text-[#0B2148]">
            {searchQuery ? "No matching warehouses found" : "No warehouses registered yet"}
          </h4>
          <p className="text-xs text-[#526B91] max-w-md mx-auto">
            {searchQuery 
              ? `No warehouse matched your query "${searchQuery}". Try clearing search filters.`
              : "Set up factory warehouses and storage locations to manage inventory movements, receiving, and packing stations."
            }
          </p>
          <div className="pt-2">
            <button
              onClick={handleOpenAddWarehouse}
              className="inline-flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Warehouse Facility
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWarehouses.map((wh, whIdx) => {
            const locCount = wh.locations?.length || 0;
            return (
              <div
                key={wh.id}
                className="rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 transition-all overflow-hidden"
              >
                {/* Warehouse Header Card */}
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                      <Warehouse className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 font-mono font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
                          #{whIdx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-[#0B2148]">
                          {wh.name}
                        </h4>
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {wh.code}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-[#526B91]">
                          {locCount} {locCount === 1 ? "Location Bin" : "Location Bins"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-[#526B91]">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#526B91]" />
                        <span className="truncate">
                          {wh.address || "No physical building address specified"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenAddLocation(wh)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                      title="Add a new storage bin/zone inside this warehouse"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Bin
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditWarehouse(wh)}
                      className="p-1.5 rounded-xl text-[#526B91] hover:text-[#0B2148] hover:bg-slate-100 transition-all cursor-pointer"
                      title="Edit warehouse details"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingWH(wh)}
                      className="p-1.5 rounded-xl text-[#526B91] hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                      title="Delete warehouse"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Locations / Bins Grid */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#526B91] uppercase tracking-wider text-[10px]">
                      Storage Bins, Racks & Zones Configuration ({locCount}):
                    </span>
                    {locCount > 0 && (
                      <span className="text-[#526B91] text-[11px] font-mono">
                        Unique codes strictly enforced per facility
                      </span>
                    )}
                  </div>

                  {locCount === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                      <Boxes className="w-6 h-6 mx-auto text-[#526B91]" />
                      <p className="text-xs text-[#526B91]">
                        No location bins configured for this facility yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenAddLocation(wh)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add First Location Bin
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {wh.locations.map((loc, locIdx) => (
                        <div
                          key={loc.id}
                          className="p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-between gap-2.5 text-xs group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border border-blue-200">
                                #{locIdx + 1}
                              </span>
                              <span className="font-mono font-bold text-blue-700 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                                {loc.code}
                              </span>
                            </div>
                            <p className="font-medium text-[#0B2148] truncate mt-1 text-[11px]">
                              {loc.name}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleOpenEditLocation(wh, loc)}
                              className="p-1 rounded-md text-[#526B91] hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer"
                              title="Edit location bin"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingLoc({ warehouse: wh, location: loc })}
                              className="p-1 rounded-md text-[#526B91] hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                              title="Delete location bin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CREATE / EDIT WAREHOUSE */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isWHModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWHModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B2148]">
                      {editingWH ? "Edit Warehouse Facility" : "Configure New Warehouse"}
                    </h3>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      Define facility master identifier, code, and physical site address.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWHModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-[#526B91] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSaveWarehouse} className="p-6 space-y-4">
                {/* Presets if creating */}
                {!editingWH && (
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                    <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Quick Preset Templates:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {WAREHOUSE_PRESETS.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => setWhForm({ name: p.name, code: p.code, address: p.address })}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-blue-200 text-blue-800 hover:bg-blue-100 transition-all cursor-pointer"
                        >
                          {p.code} ({p.name.split(" ")[0]})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warehouse Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0B2148]">
                    Warehouse Facility Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={whForm.name}
                    onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                    placeholder="e.g. Finished Goods Central Depo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-[#0B2148] font-medium focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* Warehouse Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0B2148]">
                    Facility Code (Unique Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    value={whForm.code}
                    onChange={(e) => setWhForm({ ...whForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WH-FG, WH-RAW, WH-ASM"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  <p className="text-[10px] text-[#526B91]">
                    Used across barcodes, transfers, goods receipts, and packing slips.
                  </p>
                </div>

                {/* Address / Location Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0B2148]">
                    Physical Site Location / Address
                  </label>
                  <textarea
                    rows={2}
                    value={whForm.address}
                    onChange={(e) => setWhForm({ ...whForm, address: e.target.value })}
                    placeholder="e.g. Building C, Floor 1, Logistics Receiving Bay 2"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-blue-600 focus:bg-white resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsWHModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveWHMutation.isPending}
                    className="flex items-center gap-1.5 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {saveWHMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingWH ? "Save Changes" : "Create Warehouse"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: CREATE / EDIT LOCATION BIN */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isLocModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLocModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B2148]">
                      {editingLoc ? "Edit Location Bin" : "Add Location Bin"}
                    </h3>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      Warehouse: <span className="font-bold text-[#0B2148]">{targetWHForLoc?.name}</span> ({targetWHForLoc?.code})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-[#526B91] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSaveLocation} className="p-6 space-y-4">
                {/* Presets if creating */}
                {!editingLoc && (
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Standard Bin Code Suggestions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {LOCATION_PRESETS.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => setLocForm({ name: p.name, code: p.code })}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
                        >
                          {p.code}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0B2148]">
                    Location / Bin Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={locForm.code}
                    onChange={(e) => setLocForm({ ...locForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. BIN-A01, RACK-01, PALLET-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                  <p className="text-[10px] text-[#526B91]">
                    Barcode / QR identifier printed on shelves and storage bins.
                  </p>
                </div>

                {/* Location Name / Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0B2148]">
                    Location Description / Zone Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={locForm.name}
                    onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                    placeholder="e.g. Aisle 1 - Top Shelf Raw Inventory"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-[#0B2148] font-medium focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsLocModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveLocMutation.isPending}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {saveLocMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingLoc ? "Update Location Bin" : "Add Location Bin"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: DELETE WAREHOUSE CONFIRMATION */}
      {/* ========================================================= */}
      <AnimatePresence>
        {deletingWH && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingWH(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4 z-10"
            >
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold text-[#0B2148]">
                  Delete Warehouse Facility?
                </h4>
                <p className="text-xs text-[#526B91] mt-1.5 leading-relaxed">
                  Are you sure you want to delete warehouse <span className="font-bold text-[#0B2148]">"{deletingWH.name}"</span> ({deletingWH.code})? 
                  All associated storage locations ({deletingWH.locations?.length || 0}) will also be removed.
                </p>
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mt-3 font-medium">
                  Note: Facilities with active stock balances or historic movement records cannot be deleted.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingWH(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteWHMutation.isPending}
                  onClick={() => deleteWHMutation.mutate(deletingWH.id)}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  {deleteWHMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: DELETE LOCATION BIN CONFIRMATION */}
      {/* ========================================================= */}
      <AnimatePresence>
        {deletingLoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingLoc(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4 z-10"
            >
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold text-[#0B2148]">
                  Delete Location Bin?
                </h4>
                <p className="text-xs text-[#526B91] mt-1.5 leading-relaxed">
                  Are you sure you want to remove storage location bin <span className="font-bold text-[#0B2148]">"{deletingLoc.location.code}"</span> ({deletingLoc.location.name}) from warehouse <span className="font-bold text-[#0B2148]">{deletingLoc.warehouse.name}</span>?
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingLoc(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLocMutation.isPending}
                  onClick={() => deleteLocMutation.mutate({ warehouseId: deletingLoc.warehouse.id, locId: deletingLoc.location.id })}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  {deleteLocMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
