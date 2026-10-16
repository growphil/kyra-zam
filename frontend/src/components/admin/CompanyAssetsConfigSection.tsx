"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Wrench,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Building2,
  Tag,
  Activity,
  FileText,
  History,
  UserCheck,
  X,
  Loader2,
  RotateCcw,
  Edit,
  Trash2,
  Eye,
  Archive,
  Check,
  ShieldCheck,
  Layers,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";

export type AssetCategory =
  | "MACHINERY"
  | "TESTING_EQUIPMENT"
  | "TOOLING"
  | "FURNITURE"
  | "IT_HARDWARE"
  | "VEHICLE"
  | "SAFETY_EQUIPMENT"
  | "FACILITY"
  | "OTHER";

export type AssetStatus =
  | "OPERATIONAL"
  | "IN_USE"
  | "STANDBY"
  | "UNDER_MAINTENANCE"
  | "CALIBRATION_DUE"
  | "RETIRED"
  | "DISPOSED";

export type AssetCondition =
  | "NEW"
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "POOR"
  | "DAMAGED";

export interface CompanyAssetItem {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  manufacturer?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  vendorId?: string | null;
  vendor?: { id: string; name: string; phone?: string; email?: string } | null;
  warehouseId?: string | null;
  warehouse?: { id: string; name: string; code?: string } | null;
  location?: string | null;
  department?: string | null;
  assignedToUserId?: string | null;
  assignedToUser?: { id: string; name: string; email: string } | null;
  status: AssetStatus;
  condition: AssetCondition;
  warrantyExpiry?: string | null;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDue?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    maintenanceRecords: number;
    assignmentRecords: number;
  };
  maintenanceRecords?: any[];
  assignmentRecords?: any[];
}

const CATEGORY_CONFIG: Record<AssetCategory, { label: string; badgeClass: string }> = {
  MACHINERY: { label: "Machinery & Heavy Plant", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  TESTING_EQUIPMENT: { label: "Testing & Calibration", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
  TOOLING: { label: "Tooling & Fixtures", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  FURNITURE: { label: "Furniture & Workstations", badgeClass: "bg-stone-50 text-stone-700 border-stone-200" },
  IT_HARDWARE: { label: "IT & Computing", badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  VEHICLE: { label: "Vehicles & Transport", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  SAFETY_EQUIPMENT: { label: "Safety & PPE Assets", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
  FACILITY: { label: "Facility & Utilities", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OTHER: { label: "Other Asset", badgeClass: "bg-slate-50 text-slate-700 border-slate-200" }
};

const STATUS_CONFIG: Record<AssetStatus, { label: string; dotClass: string; badgeClass: string }> = {
  OPERATIONAL: { label: "Operational (Ready)", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  IN_USE: { label: "In Active Use", dotClass: "bg-blue-500", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  STANDBY: { label: "Standby / Storage", dotClass: "bg-cyan-500", badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  UNDER_MAINTENANCE: { label: "Under Maintenance", dotClass: "bg-amber-500", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  CALIBRATION_DUE: { label: "Calibration Due", dotClass: "bg-purple-500", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
  RETIRED: { label: "Retired", dotClass: "bg-slate-400", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
  DISPOSED: { label: "Disposed", dotClass: "bg-red-400", badgeClass: "bg-red-50 text-red-600 border-red-200" }
};

const CONDITION_CONFIG: Record<AssetCondition, { label: string; badgeClass: string }> = {
  NEW: { label: "New (Factory Sealed)", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  EXCELLENT: { label: "Excellent", badgeClass: "bg-teal-50 text-teal-700 border-teal-200" },
  GOOD: { label: "Good (Normal Service)", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  FAIR: { label: "Fair (Wear Visible)", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  POOR: { label: "Poor (Needs Service)", badgeClass: "bg-orange-50 text-orange-700 border-orange-200" },
  DAMAGED: { label: "Damaged / Inoperable", badgeClass: "bg-red-50 text-red-700 border-red-200" }
};

const STANDARD_DEPARTMENTS = [
  "Production",
  "Quality Assurance",
  "Battery Pack Assembly",
  "Cell Sorting & Testing Lab",
  "Laser Welding & Busbars",
  "Warehouse & Logistics",
  "Maintenance & Plant Engineering",
  "R&D & Engineering",
  "Administration & HR",
  "Health & Safety"
];

export default function CompanyAssetsConfigSection() {
  const queryClient = useQueryClient();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");

  // Modals state
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CompanyAssetItem | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);
  const [retireConfirmTarget, setRetireConfirmTarget] = useState<CompanyAssetItem | null>(null);

  // Form states
  const [assetForm, setAssetForm] = useState({
    assetTag: "",
    name: "",
    category: "MACHINERY" as AssetCategory,
    manufacturer: "",
    modelNumber: "",
    serialNumber: "",
    purchaseDate: "",
    purchaseCost: "",
    vendorId: "",
    warehouseId: "",
    location: "",
    department: "Production",
    assignedToUserId: "",
    status: "OPERATIONAL" as AssetStatus,
    condition: "GOOD" as AssetCondition,
    warrantyExpiry: "",
    nextMaintenanceDue: "",
    notes: ""
  });

  const [assignForm, setAssignForm] = useState({
    assignedToUserId: "",
    department: "",
    location: "",
    notes: ""
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    type: "PREVENTIVE" as "PREVENTIVE" | "CORRECTIVE" | "CALIBRATION" | "INSPECTION",
    title: "",
    description: "",
    serviceProvider: "",
    cost: "",
    performedDate: new Date().toISOString().split("T")[0],
    nextDue: "",
    status: "COMPLETED" as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    updateAssetCondition: "GOOD" as AssetCondition,
    notes: ""
  });

  // Queries
  const { data: assets = [], isLoading: loadingAssets } = useQuery<CompanyAssetItem[]>({
    queryKey: ["admin-factory-assets", searchTerm, categoryFilter, statusFilter, departmentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (departmentFilter !== "ALL") params.append("department", departmentFilter);
      const res = await api.get(`/admin/factory/assets?${params.toString()}`);
      return res.data;
    }
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/users");
        return res.data || [];
      } catch {
        return [];
      }
    }
  });

  const { data: vendorsList = [] } = useQuery({
    queryKey: ["admin-vendors-list"],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/vendors");
        return res.data || [];
      } catch {
        return [];
      }
    }
  });

  const { data: warehousesList = [] } = useQuery({
    queryKey: ["admin-warehouses-list"],
    queryFn: async () => {
      try {
        const res = await api.get("/inventory/warehouses");
        return res.data || [];
      } catch {
        return [];
      }
    }
  });

  const { data: detailedAsset, isLoading: loadingDetails } = useQuery<CompanyAssetItem | null>({
    queryKey: ["admin-factory-asset-detail", detailAssetId],
    queryFn: async () => {
      if (!detailAssetId) return null;
      const res = await api.get(`/admin/factory/assets/${detailAssetId}`);
      return res.data;
    },
    enabled: !!detailAssetId && isDetailModalOpen
  });

  // Quick Stats
  const activeCount = assets.filter(a => a.status === "OPERATIONAL" || a.status === "IN_USE").length;
  const maintenanceCount = assets.filter(a => a.status === "UNDER_MAINTENANCE" || a.status === "CALIBRATION_DUE").length;
  const inStorageCount = assets.filter(a => a.status === "STANDBY").length;

  // Mutations
  const saveAssetMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing && selectedAsset) {
        const res = await api.patch(`/admin/factory/assets/${selectedAsset.id}`, payload);
        return res.data;
      }
      const res = await api.post("/admin/factory/assets", payload);
      return res.data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-assets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(isEditing ? `Asset "${saved.assetTag}" updated successfully` : `Asset "${saved.assetTag}" registered successfully`);
      setIsAssetModalOpen(false);
      setSelectedAsset(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save asset");
    }
  });

  const assignAssetMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.post(`/admin/factory/assets/${id}/assign`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-assets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      if (detailAssetId) queryClient.invalidateQueries({ queryKey: ["admin-factory-asset-detail", detailAssetId] });
      toast.success("Asset assigned / transferred successfully");
      setIsAssignModalOpen(false);
      setSelectedAsset(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to reassign asset");
    }
  });

  const logMaintenanceMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await api.post(`/admin/factory/assets/${id}/maintenance`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-assets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      if (detailAssetId) queryClient.invalidateQueries({ queryKey: ["admin-factory-asset-detail", detailAssetId] });
      toast.success("Maintenance / calibration record saved successfully");
      setIsMaintenanceModalOpen(false);
      setSelectedAsset(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to log maintenance");
    }
  });

  const retireOrDeleteMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.delete(`/admin/factory/assets/${id}`, { data: { reason } });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-assets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(data?.message || "Asset updated / retired successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to process asset deletion / retirement");
    }
  });

  // Handlers
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setSelectedAsset(null);
    // Generate suggested tag: AST-YEAR-RAND
    const year = new Date().getFullYear();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setAssetForm({
      assetTag: `AST-${year}-${randNum}`,
      name: "",
      category: "MACHINERY",
      manufacturer: "",
      modelNumber: "",
      serialNumber: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      purchaseCost: "",
      vendorId: "",
      warehouseId: "",
      location: "Shop Floor - Line 1",
      department: "Production",
      assignedToUserId: "",
      status: "OPERATIONAL",
      condition: "NEW",
      warrantyExpiry: "",
      nextMaintenanceDue: "",
      notes: ""
    });
    setIsAssetModalOpen(true);
  };

  const handleOpenEditModal = (asset: CompanyAssetItem) => {
    setIsEditing(true);
    setSelectedAsset(asset);
    setAssetForm({
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      manufacturer: asset.manufacturer || "",
      modelNumber: asset.modelNumber || "",
      serialNumber: asset.serialNumber || "",
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split("T")[0] : "",
      purchaseCost: asset.purchaseCost !== null && asset.purchaseCost !== undefined ? String(asset.purchaseCost) : "",
      vendorId: asset.vendorId || "",
      warehouseId: asset.warehouseId || "",
      location: asset.location || "",
      department: asset.department || "Production",
      assignedToUserId: asset.assignedToUserId || "",
      status: asset.status,
      condition: asset.condition,
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split("T")[0] : "",
      nextMaintenanceDue: asset.nextMaintenanceDue ? asset.nextMaintenanceDue.split("T")[0] : "",
      notes: asset.notes || ""
    });
    setIsAssetModalOpen(true);
  };

  const handleOpenAssignModal = (asset: CompanyAssetItem) => {
    setSelectedAsset(asset);
    setAssignForm({
      assignedToUserId: asset.assignedToUserId || "",
      department: asset.department || "Production",
      location: asset.location || "",
      notes: ""
    });
    setIsAssignModalOpen(true);
  };

  const handleOpenMaintenanceModal = (asset: CompanyAssetItem) => {
    setSelectedAsset(asset);
    setMaintenanceForm({
      type: "PREVENTIVE",
      title: `Routine Inspection - ${asset.name}`,
      description: "",
      serviceProvider: "Internal Maintenance Team",
      cost: "",
      performedDate: new Date().toISOString().split("T")[0],
      nextDue: "",
      status: "COMPLETED",
      updateAssetCondition: asset.condition,
      notes: ""
    });
    setIsMaintenanceModalOpen(true);
  };

  const handleOpenDetailModal = (assetId: string) => {
    setDetailAssetId(assetId);
    setIsDetailModalOpen(true);
  };

  const handleSaveAssetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.assetTag.trim() || !assetForm.name.trim()) {
      toast.error("Asset Tag and Asset Name are required");
      return;
    }

    const payload: any = {
      assetTag: assetForm.assetTag.trim().toUpperCase(),
      name: assetForm.name.trim(),
      category: assetForm.category,
      manufacturer: assetForm.manufacturer.trim() || null,
      modelNumber: assetForm.modelNumber.trim() || null,
      serialNumber: assetForm.serialNumber.trim() || null,
      purchaseDate: assetForm.purchaseDate ? new Date(assetForm.purchaseDate).toISOString() : null,
      purchaseCost: assetForm.purchaseCost ? parseFloat(assetForm.purchaseCost) : null,
      vendorId: assetForm.vendorId || null,
      warehouseId: assetForm.warehouseId || null,
      location: assetForm.location.trim() || null,
      department: assetForm.department.trim() || null,
      assignedToUserId: assetForm.assignedToUserId || null,
      status: assetForm.status,
      condition: assetForm.condition,
      warrantyExpiry: assetForm.warrantyExpiry ? new Date(assetForm.warrantyExpiry).toISOString() : null,
      nextMaintenanceDue: assetForm.nextMaintenanceDue ? new Date(assetForm.nextMaintenanceDue).toISOString() : null,
      notes: assetForm.notes.trim() || null
    };

    saveAssetMutation.mutate(payload);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    assignAssetMutation.mutate({
      id: selectedAsset.id,
      payload: {
        assignedToUserId: assignForm.assignedToUserId || null,
        department: assignForm.department.trim() || null,
        location: assignForm.location.trim() || null,
        notes: assignForm.notes.trim() || null
      }
    });
  };

  const handleMaintenanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    if (!maintenanceForm.title.trim()) {
      toast.error("Maintenance title is required");
      return;
    }

    logMaintenanceMutation.mutate({
      id: selectedAsset.id,
      payload: {
        type: maintenanceForm.type,
        title: maintenanceForm.title.trim(),
        description: maintenanceForm.description.trim() || null,
        serviceProvider: maintenanceForm.serviceProvider.trim() || null,
        cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
        performedDate: maintenanceForm.performedDate ? new Date(maintenanceForm.performedDate).toISOString() : new Date().toISOString(),
        nextDue: maintenanceForm.nextDue ? new Date(maintenanceForm.nextDue).toISOString() : null,
        status: maintenanceForm.status,
        updateAssetCondition: maintenanceForm.updateAssetCondition || undefined,
        notes: maintenanceForm.notes.trim() || null
      }
    });
  };

  const handleRetireOrDelete = (asset: CompanyAssetItem) => {
    setRetireConfirmTarget(asset);
  };

  return (
    <div className="space-y-4">
      {/* Container Panel */}
      <div className="glass-panel rounded-2xl border border-[#D8E8FA] shadow-sm overflow-hidden bg-white">
        
        {/* Header Bar */}
        <div className="p-5 border-b border-[#D8E8FA] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/50 via-white to-transparent">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/30 flex items-center justify-center text-[#0878F9]">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#0B2148]">Company Assets Register</h3>
                  <span className="px-2 py-0.5 bg-[#EAF5FF] text-[#0878F9] rounded-md text-[11px] font-mono font-bold border border-[#0878F9]/20">
                    {assets.length} Registered
                  </span>
                </div>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Machinery, testing benches, tooling fixtures, IT systems, and capital factory equipment (Independent from consumable Material SKUs).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Mini Badges */}
            <div className="hidden xl:flex items-center gap-2 mr-2">
              <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeCount} Active
              </span>
              <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                {maintenanceCount} In Maintenance
              </span>
              <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {inStorageCount} In Storage
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 bg-[#0878F9] hover:bg-[#0768D6] px-3.5 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Company Asset
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 bg-[#F8FBFF] border-b border-[#D8E8FA] flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tag, name, model, serial, user..."
              className="w-full bg-white border border-[#D8E8FA] rounded-xl py-1.5 pl-8 pr-3 text-xs text-[#0B2148] placeholder-[#8A9EB5] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9]"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[#D8E8FA] rounded-xl py-1.5 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {Object.keys(CATEGORY_CONFIG).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_CONFIG[cat as AssetCategory].label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-[#D8E8FA] rounded-xl py-1.5 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map((st) => (
                <option key={st} value={st}>
                  {STATUS_CONFIG[st as AssetStatus].label}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-white border border-[#D8E8FA] rounded-xl py-1.5 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {STANDARD_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {(searchTerm || categoryFilter !== "ALL" || statusFilter !== "ALL" || departmentFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("ALL");
                  setStatusFilter("ALL");
                  setDepartmentFilter("ALL");
                }}
                className="flex items-center gap-1 text-[11px] text-[#526B91] hover:text-[#0878F9] px-2 py-1.5 rounded-lg border border-[#D8E8FA] bg-white transition-colors"
                title="Reset Filters"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loadingAssets ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-[#526B91]">
            <Loader2 className="w-6 h-6 animate-spin text-[#0878F9]" />
            <p className="text-xs font-medium">Loading asset register...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FBFF] border-b border-[#D8E8FA]">
                  <th className="px-4 py-3 font-semibold text-[#526B91] w-14 text-center">S.No</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Asset Tag</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Asset Name & Model</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Category</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Location / Dept</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Assigned To</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Status & Condition</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91]">Maintenance / Warranty</th>
                  <th className="px-4 py-3 font-semibold text-[#526B91] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E8FA]">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-[#526B91] text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wrench className="w-8 h-8 text-[#8A9EB5]/50" />
                        <p className="font-semibold text-slate-700">No Company Assets Found</p>
                        <p className="text-[11px] text-[#8A9EB5] max-w-sm">
                          {searchTerm || categoryFilter !== "ALL" || statusFilter !== "ALL"
                            ? "No assets match your search or filter criteria. Try adjusting or resetting filters."
                            : "No company capital assets registered yet. Click \"Add Company Asset\" to register factory machinery, tooling, or test benches."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assets.map((asset, idx) => {
                    const catCfg = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.OTHER;
                    const stCfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.OPERATIONAL;
                    const condCfg = CONDITION_CONFIG[asset.condition] || CONDITION_CONFIG.GOOD;
                    
                    const isWarrantyValid = asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date();
                    const isMaintenanceOverdue = asset.nextMaintenanceDue && new Date(asset.nextMaintenanceDue) < new Date();

                    return (
                      <tr key={asset.id} className="hover:bg-[#F8FBFF]/80 transition-colors">
                        {/* S.No */}
                        <td className="px-4 py-3 text-center font-mono font-bold text-xs text-[#526B91]">
                          {idx + 1}
                        </td>

                        {/* Asset Tag */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(asset.id)}
                            className="font-mono font-bold text-xs text-[#0878F9] hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>{asset.assetTag}</span>
                          </button>
                          {asset.serialNumber && (
                            <p className="text-[10px] text-[#526B91] font-mono truncate mt-0.5">
                              S/N: {asset.serialNumber}
                            </p>
                          )}
                        </td>

                        {/* Name & Model */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#0B2148] text-xs">
                            {asset.name}
                          </div>
                          {(asset.manufacturer || asset.modelNumber) && (
                            <div className="text-[11px] text-[#526B91] mt-0.5">
                              {[asset.manufacturer, asset.modelNumber].filter(Boolean).join(" • ")}
                            </div>
                          )}
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catCfg.badgeClass}`}>
                            {catCfg.label}
                          </span>
                        </td>

                        {/* Location / Dept */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-[11px] font-medium text-[#0B2148]">
                            <MapPin className="w-3 h-3 text-[#526B91] flex-shrink-0" />
                            <span>{asset.location || "Unspecified"}</span>
                          </div>
                          {asset.department && (
                            <div className="flex items-center gap-1 text-[10px] text-[#526B91] mt-0.5">
                              <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                              <span>{asset.department}</span>
                            </div>
                          )}
                        </td>

                        {/* Assigned To */}
                        <td className="px-4 py-3">
                          {asset.assignedToUser ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-[#EAF5FF] border border-[#0878F9]/30 flex items-center justify-center text-[9px] font-bold text-[#0878F9]">
                                {asset.assignedToUser.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold text-[#0B2148] leading-tight">
                                  {asset.assignedToUser.name}
                                </p>
                                <p className="text-[9px] text-[#526B91] leading-tight">
                                  {asset.assignedToUser.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#8A9EB5] italic">Unassigned</span>
                          )}
                        </td>

                        {/* Status & Condition */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${stCfg.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dotClass}`} />
                              {stCfg.label}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium border ${condCfg.badgeClass}`}>
                              {condCfg.label}
                            </span>
                          </div>
                        </td>

                        {/* Maintenance / Warranty */}
                        <td className="px-4 py-3">
                          {asset.nextMaintenanceDue ? (
                            <div className="flex items-center gap-1 text-[10px]">
                              <Clock className="w-3 h-3 text-[#526B91]" />
                              <span className={isMaintenanceOverdue ? "text-red-600 font-bold" : "text-[#526B91]"}>
                                Due: {new Date(asset.nextMaintenanceDue).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#8A9EB5]">No schedule</div>
                          )}
                          {asset.warrantyExpiry && (
                            <div className="text-[9px] text-[#526B91] mt-0.5">
                              Wty: {new Date(asset.warrantyExpiry).toLocaleDateString()}
                              {isWarrantyValid ? " (Active)" : " (Expired)"}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Detail */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(asset.id)}
                              className="p-1 rounded-lg text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] transition-colors"
                              title="View History & Specs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Assign */}
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(asset)}
                              className="p-1 rounded-lg text-[#526B91] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Assign / Transfer Asset"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>

                            {/* Log Maintenance */}
                            <button
                              type="button"
                              onClick={() => handleOpenMaintenanceModal(asset)}
                              className="p-1 rounded-lg text-[#526B91] hover:text-purple-600 hover:bg-purple-50 transition-colors"
                              title="Log Maintenance / Calibration"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(asset)}
                              className="p-1 rounded-lg text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] transition-colors"
                              title="Edit Asset"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Retire / Delete */}
                            <button
                              type="button"
                              onClick={() => handleRetireOrDelete(asset)}
                              className="p-1 rounded-lg text-[#526B91] hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Retire / Decommission Asset"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info note */}
        <div className="p-3 bg-[#F8FBFF] border-t border-[#D8E8FA] flex items-center justify-between text-[11px] text-[#526B91]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0878F9]" />
            <span>
              Company Assets domain is isolated from consumable Material SKUs and does not modify inventory stock quantities.
            </span>
          </div>
          <span className="font-mono text-[10px]">
            Audited via Superadmin RBAC
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT ASSET MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAssetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssetModalOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[#D8E8FA] overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/30 flex items-center justify-center text-[#0878F9]">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B2148]">
                      {isEditing ? `Edit Asset: ${selectedAsset?.assetTag}` : "Register New Company Asset"}
                    </h3>
                    <p className="text-xs text-[#526B91]">
                      Configure asset identifier, department, warranty, and initial operational status.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="p-1 rounded-lg text-[#526B91] hover:text-[#0B2148] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAssetSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Row 1: Asset Tag & Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Asset Tag / Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={assetForm.assetTag}
                      onChange={(e) => setAssetForm({ ...assetForm, assetTag: e.target.value })}
                      placeholder="e.g. AST-2026-001"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-mono font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                    <p className="text-[10px] text-[#526B91] mt-0.5">Must be unique across the entire organization.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Asset Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={assetForm.name}
                      onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                      placeholder="e.g. Ultrasonic Spot Welder Line 2"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 2: Category & Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assetForm.category}
                      onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as AssetCategory })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      {Object.keys(CATEGORY_CONFIG).map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_CONFIG[cat as AssetCategory].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Operational Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={assetForm.status}
                      onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      {Object.keys(STATUS_CONFIG).map((st) => (
                        <option key={st} value={st}>
                          {STATUS_CONFIG[st as AssetStatus].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Manufacturer, Model, Serial Number */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={assetForm.manufacturer}
                      onChange={(e) => setAssetForm({ ...assetForm, manufacturer: e.target.value })}
                      placeholder="e.g. Miyachi / KUKA"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Model Number</label>
                    <input
                      type="text"
                      value={assetForm.modelNumber}
                      onChange={(e) => setAssetForm({ ...assetForm, modelNumber: e.target.value })}
                      placeholder="e.g. UW-5000"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={assetForm.serialNumber}
                      onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                      placeholder="e.g. SN-883719"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 4: Department & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Department</label>
                    <select
                      value={assetForm.department}
                      onChange={(e) => setAssetForm({ ...assetForm, department: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      {STANDARD_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Physical Location</label>
                    <input
                      type="text"
                      value={assetForm.location}
                      onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                      placeholder="e.g. Bay 4, Pack Assembly Zone"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 5: Assigned User & Condition */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Assigned Custodian / Operator</label>
                    <select
                      value={assetForm.assignedToUserId}
                      onChange={(e) => setAssetForm({ ...assetForm, assignedToUserId: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      <option value="">-- Unassigned (Shared / Facility) --</option>
                      {usersList.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role || u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Asset Condition</label>
                    <select
                      value={assetForm.condition}
                      onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value as AssetCondition })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      {Object.keys(CONDITION_CONFIG).map((cond) => (
                        <option key={cond} value={cond}>
                          {CONDITION_CONFIG[cond as AssetCondition].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 6: Purchase Date & Purchase Cost */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Acquisition Date</label>
                    <input
                      type="date"
                      value={assetForm.purchaseDate}
                      onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Acquisition Cost (₹ INR)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={assetForm.purchaseCost}
                      onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Vendor / Supplier</label>
                    <select
                      value={assetForm.vendorId}
                      onChange={(e) => setAssetForm({ ...assetForm, vendorId: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      <option value="">-- Direct / Unknown Vendor --</option>
                      {vendorsList.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 7: Warranty Expiry & Next Maintenance Due */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Warranty Expiry Date</label>
                    <input
                      type="date"
                      value={assetForm.warrantyExpiry}
                      onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">Next Maintenance / Calibration Due</label>
                    <input
                      type="date"
                      value={assetForm.nextMaintenanceDue}
                      onChange={(e) => setAssetForm({ ...assetForm, nextMaintenanceDue: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 8: Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[#0B2148] mb-1">Technical Specs & Maintenance Notes</label>
                  <textarea
                    rows={2}
                    value={assetForm.notes}
                    onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                    placeholder="Enter power ratings, calibration standards, operating manual links or notes..."
                    className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[#D8E8FA] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAssetModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveAssetMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#0878F9] hover:bg-[#0768D6] text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saveAssetMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isEditing ? "Save Asset Changes" : "Register Company Asset"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: ASSIGN / REASSIGN MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAssignModalOpen && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#D8E8FA] overflow-hidden z-10"
            >
              <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B2148]">
                      Assign Asset: {selectedAsset.assetTag}
                    </h3>
                    <p className="text-xs text-[#526B91]">
                      Record custodian transfer and location change for audit compliance.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="p-1 rounded-lg text-[#526B91] hover:text-[#0B2148] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                    Assign Custodian / Personnel
                  </label>
                  <select
                    value={assignForm.assignedToUserId}
                    onChange={(e) => setAssignForm({ ...assignForm, assignedToUserId: e.target.value })}
                    className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Clear Assignment (Return to Central Pool) --</option>
                    {usersList.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role || u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Department
                    </label>
                    <select
                      value={assignForm.department}
                      onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      {STANDARD_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Physical Location
                    </label>
                    <input
                      type="text"
                      value={assignForm.location}
                      onChange={(e) => setAssignForm({ ...assignForm, location: e.target.value })}
                      placeholder="e.g. Line 2 QC Desk"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                    Transfer Reason / Handover Notes
                  </label>
                  <textarea
                    rows={2}
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                    placeholder="e.g. Shift handover, line relocation, or routine re-assignment..."
                    className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                  />
                </div>

                <div className="pt-3 border-t border-[#D8E8FA] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignAssetMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {assignAssetMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Assignment</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: LOG MAINTENANCE / CALIBRATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMaintenanceModalOpen && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMaintenanceModalOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#D8E8FA] overflow-hidden z-10"
            >
              <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B2148]">
                      Log Maintenance: {selectedAsset.assetTag}
                    </h3>
                    <p className="text-xs text-[#526B91]">
                      Record preventive servicing, corrective repair, or ISO calibration events.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  className="p-1 rounded-lg text-[#526B91] hover:text-[#0B2148] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleMaintenanceSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Event Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={maintenanceForm.type}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value as any })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      <option value="PREVENTIVE">Preventive Maintenance (PM)</option>
                      <option value="CORRECTIVE">Corrective Repair / Breakdown</option>
                      <option value="CALIBRATION">Equipment Calibration & Verification</option>
                      <option value="INSPECTION">Safety / Audit Inspection</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Activity Status
                    </label>
                    <select
                      value={maintenanceForm.status}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value as any })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      <option value="COMPLETED">Completed</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                    Activity Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={maintenanceForm.title}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                    placeholder="e.g. Q4 Calibration & Weld Pressure Gauge Check"
                    className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Service Provider / Engineer
                    </label>
                    <input
                      type="text"
                      value={maintenanceForm.serviceProvider}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceProvider: e.target.value })}
                      placeholder="e.g. In-house Maintenance or OEM Rep"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Maintenance Cost (₹ INR)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={maintenanceForm.cost}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Performed Date
                    </label>
                    <input
                      type="date"
                      value={maintenanceForm.performedDate}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performedDate: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Next Due Date
                    </label>
                    <input
                      type="date"
                      value={maintenanceForm.nextDue}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextDue: e.target.value })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                      Update Asset Condition
                    </label>
                    <select
                      value={maintenanceForm.updateAssetCondition}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, updateAssetCondition: e.target.value as AssetCondition })}
                      className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white cursor-pointer"
                    >
                      {Object.keys(CONDITION_CONFIG).map((cond) => (
                        <option key={cond} value={cond}>
                          {CONDITION_CONFIG[cond as AssetCondition].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0B2148] mb-1">
                    Work Description & Findings
                  </label>
                  <textarea
                    rows={2}
                    value={maintenanceForm.description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                    placeholder="Details of calibration certificates, components replaced, tolerances verified..."
                    className="w-full bg-[#F8FBFF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                  />
                </div>

                <div className="pt-3 border-t border-[#D8E8FA] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsMaintenanceModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={logMaintenanceMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {logMaintenanceMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Record Maintenance</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: FULL ASSET DETAIL & LIFECYCLE AUDIT TRAIL MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-[#D8E8FA] overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-transparent">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EAF5FF] border border-[#0878F9]/30 flex items-center justify-center text-[#0878F9]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#0B2148]">
                        Asset Master Record: {detailedAsset?.assetTag || "Loading..."}
                      </h3>
                      {detailedAsset && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_CONFIG[detailedAsset.status].badgeClass}`}>
                          {STATUS_CONFIG[detailedAsset.status].label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#526B91]">
                      {detailedAsset?.name} {detailedAsset?.modelNumber ? `• ${detailedAsset.modelNumber}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 rounded-lg text-[#526B91] hover:text-[#0B2148] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingDetails || !detailedAsset ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2 text-[#526B91]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0878F9]" />
                  <p className="text-xs">Loading complete asset history...</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Quick Specs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FBFF] p-4 rounded-xl border border-[#D8E8FA]">
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Category</p>
                      <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
                        {CATEGORY_CONFIG[detailedAsset.category]?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Condition</p>
                      <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
                        {CONDITION_CONFIG[detailedAsset.condition]?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Department</p>
                      <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
                        {detailedAsset.department || "Unassigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Location</p>
                      <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
                        {detailedAsset.location || "Unspecified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Manufacturer</p>
                      <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
                        {detailedAsset.manufacturer || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Serial Number</p>
                      <p className="text-xs font-mono font-semibold text-[#0B2148] mt-0.5">
                        {detailedAsset.serialNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Acquisition Date</p>
                      <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
                        {detailedAsset.purchaseDate ? new Date(detailedAsset.purchaseDate).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#526B91] uppercase font-bold">Cost</p>
                      <p className="text-xs font-mono font-semibold text-[#0B2148] mt-0.5">
                        {detailedAsset.purchaseCost ? `₹${detailedAsset.purchaseCost.toLocaleString()}` : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Custodian Box */}
                  <div className="flex items-center justify-between p-3.5 bg-white border border-[#D8E8FA] rounded-xl shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/30 flex items-center justify-center text-[#0878F9]">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0B2148]">
                          Assigned Custodian: {detailedAsset.assignedToUser?.name || "Shared / Unassigned Pool"}
                        </p>
                        <p className="text-[10px] text-[#526B91]">
                          {detailedAsset.assignedToUser?.email || "No designated single owner."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenAssignModal(detailedAsset);
                      }}
                      className="px-3 py-1.5 bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Transfer / Reassign
                    </button>
                  </div>

                  {/* Maintenance & Calibration History Timeline */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-[#0B2148] flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-purple-600" />
                        Maintenance & Calibration History ({detailedAsset.maintenanceRecords?.length || 0})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          handleOpenMaintenanceModal(detailedAsset);
                        }}
                        className="text-[11px] font-bold text-purple-600 hover:underline"
                      >
                        + Log Maintenance Event
                      </button>
                    </div>

                    {!detailedAsset.maintenanceRecords || detailedAsset.maintenanceRecords.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-[#526B91]">
                        No maintenance or calibration recorded for this asset yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detailedAsset.maintenanceRecords.map((rec: any) => (
                          <div key={rec.id} className="p-3 bg-white border border-[#D8E8FA] rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#0B2148]">{rec.title}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  {rec.type}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-700">
                                  {rec.status}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-[#526B91]">
                                {new Date(rec.performedDate).toLocaleDateString()}
                              </span>
                            </div>
                            {rec.description && (
                              <p className="text-[11px] text-[#526B91]">{rec.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#526B91] pt-1 border-t border-slate-100">
                              {rec.serviceProvider && <span>Provider: {rec.serviceProvider}</span>}
                              {rec.cost && <span>Cost: ₹{rec.cost.toLocaleString()}</span>}
                              {rec.performedBy && <span>Audited By: {rec.performedBy.name}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assignment History Timeline */}
                  <div>
                    <h4 className="text-xs font-bold text-[#0B2148] flex items-center gap-1.5 mb-2">
                      <History className="w-3.5 h-3.5 text-emerald-600" />
                      Custodian Assignment Timeline ({detailedAsset.assignmentRecords?.length || 0})
                    </h4>

                    {!detailedAsset.assignmentRecords || detailedAsset.assignmentRecords.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-[#526B91]">
                        No historical custodian reassignments logged.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detailedAsset.assignmentRecords.map((hist: any) => (
                          <div key={hist.id} className="p-3 bg-white border border-[#D8E8FA] rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#0B2148]">
                                {hist.assignedTo ? hist.assignedTo.name : "Unassigned / General Pool"}
                              </span>
                              <span className="font-mono text-[10px] text-[#526B91]">
                                {new Date(hist.assignedDate).toLocaleDateString()}
                                {hist.returnedDate ? ` → ${new Date(hist.returnedDate).toLocaleDateString()}` : " (Current)"}
                              </span>
                            </div>
                            {(hist.department || hist.location) && (
                              <p className="text-[10px] text-[#526B91]">
                                {[hist.department, hist.location].filter(Boolean).join(" • ")}
                              </p>
                            )}
                            {hist.notes && (
                              <p className="text-[10px] text-[#526B91] italic">{hist.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-[#D8E8FA] bg-slate-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8E8FA] hover:bg-slate-100 text-[#0B2148] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Asset Deletion / Retirement Confirmation Dialog */}
      {retireConfirmTarget && (
        <ConfirmDeleteDialog
          isOpen={Boolean(retireConfirmTarget)}
          title={
            (retireConfirmTarget._count?.maintenanceRecords || 0) > 0 ||
            (retireConfirmTarget._count?.assignmentRecords || 0) > 0 ||
            retireConfirmTarget.status === "OPERATIONAL" ||
            retireConfirmTarget.status === "IN_USE"
              ? "Retire Asset from Service?"
              : "Delete Asset Record?"
          }
          recordType="Company Asset"
          recordIdentity={`${retireConfirmTarget.assetTag} — ${retireConfirmTarget.name}`}
          description={
            (retireConfirmTarget._count?.maintenanceRecords || 0) > 0 ||
            (retireConfirmTarget._count?.assignmentRecords || 0) > 0 ||
            retireConfirmTarget.status === "OPERATIONAL" ||
            retireConfirmTarget.status === "IN_USE"
              ? "This asset has operational history and will be safely retired from active service to preserve audit compliance."
              : "This unused asset record will be permanently deleted from the database."
          }
          warningText={
            (retireConfirmTarget._count?.maintenanceRecords || 0) > 0 ||
            (retireConfirmTarget._count?.assignmentRecords || 0) > 0
              ? `Contains ${retireConfirmTarget._count?.maintenanceRecords || 0} maintenance logs and ${retireConfirmTarget._count?.assignmentRecords || 0} custody assignments.`
              : undefined
          }
          hasDependencies={
            (retireConfirmTarget._count?.maintenanceRecords || 0) > 0 ||
            (retireConfirmTarget._count?.assignmentRecords || 0) > 0
          }
          confirmButtonText={
            (retireConfirmTarget._count?.maintenanceRecords || 0) > 0 ||
            (retireConfirmTarget._count?.assignmentRecords || 0) > 0 ||
            retireConfirmTarget.status === "OPERATIONAL" ||
            retireConfirmTarget.status === "IN_USE"
              ? "Yes, Retire Asset"
              : "Yes, Delete Asset"
          }
          isPending={retireOrDeleteMutation.isPending}
          onCancel={() => setRetireConfirmTarget(null)}
          onConfirm={async () => {
            const hasHistory =
              (retireConfirmTarget._count?.maintenanceRecords || 0) > 0 ||
              (retireConfirmTarget._count?.assignmentRecords || 0) > 0;
            if (
              hasHistory ||
              retireConfirmTarget.status === "OPERATIONAL" ||
              retireConfirmTarget.status === "IN_USE"
            ) {
              await retireOrDeleteMutation.mutateAsync({
                id: retireConfirmTarget.id,
                reason: "Retired from active service via Factory Settings Asset Register"
              });
            } else {
              await retireOrDeleteMutation.mutateAsync({ id: retireConfirmTarget.id });
            }
            setRetireConfirmTarget(null);
          }}
        />
      )}
    </div>
  );
}
