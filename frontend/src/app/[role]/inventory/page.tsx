"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Plus, 
  Search, 
  Box, 
  Loader2, 
  RefreshCcw,
  AlertTriangle,
  X,
  CheckCircle2,
  Tag,
  Edit2,
  Trash2,
  Archive,
  Settings2,
  Layers,
  Factory,
  PlayCircle,
  PauseCircle,
  ShieldCheck,
  Boxes,
  FileText,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  Lock,
  Unlock,
  Info,
  Filter,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/ui/PageHeader";
import { useParams, useRouter } from "next/navigation";

interface Material {
  id: string;
  name: string;
  category: string;
  sku: string;
  quantity: number;
  unit: string;
  minStock: number;
  lastRestock: string;
  isPriceVerified: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface BOMMaterialRequirement {
  materialId: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  bomQtyPerUnit: number;
  requiredQty: number;
  physicalStock: number;
  totalReserved: number;
  availableStock: number;
  allocatedToOrder: number;
  shortageQty: number;
  isAllocated: boolean;
  isShortage: boolean;
  status: "AVAILABLE" | "ALLOCATED" | "SHORTAGE" | "LOW_STOCK";
  purchaseRequest?: { id: string; prNumber: string; status: string } | null;
}

interface WorkOrderMaterialRequirement {
  id: string;
  workOrderNumber: string;
  productRef: string;
  plannedQuantity: number;
  startedQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
  status: "CREATED" | "ASSIGNED" | "READY" | "IN_PROGRESS" | "QC_PENDING" | "COMPLETED" | "CLOSED" | "ON_HOLD" | "CANCELLED";
  materialStatus: "READY" | "ATTENTION" | "SHORTAGE" | "ALLOCATED" | "IN_PRODUCTION" | "COMPLETED";
  hasShortage: boolean;
  isAllocated: boolean;
  priority: string;
  dueDate: string;
  startDate?: string | null;
  startedAt?: string | null;
  pauseReason?: string | null;
  productionPlan?: { id: string; planNumber: string; priority: string } | null;
  productionRequirement?: { id: string; requirementNumber: string; priority: string; requiredDeliveryDate: string } | null;
  salesOrder?: { id: string; salesOrderNumber: string; priority: string; customer?: { name: string } } | null;
  supervisor?: { id: string; name: string; email: string } | null;
  bom?: { id: string; name: string; itemCount: number } | null;
  materials: BOMMaterialRequirement[];
}

interface ShortageSummaryItem {
  materialId: string;
  name: string;
  sku: string;
  unit: string;
  totalRequired: number;
  totalAvailable: number;
  totalReserved: number;
  totalShortage: number;
  affectedWorkOrders: {
    id: string;
    workOrderNumber: string;
    productRef: string;
    status: string;
    shortageQty: number;
  }[];
  purchaseRequest?: { id: string; prNumber: string; status: string } | null;
}

interface BatchMaterialItem {
  tempId: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  totalAmount: number;
  materialType: string;
  unitPrice?: number;
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params?.role as string) || "inventory-manager";

  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isPurchaseManager = userRoles.includes("PURCHASE_MANAGER");
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER");
  const canManageInventory = isAdmin || isInventoryManager || isPurchaseManager;
  const showPrice = isAdmin || isPurchaseManager;

  const [mounted, setMounted] = useState(false);
  const [mainTab, setMainTab] = useState<"production" | "registry">("production");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  // Modals & Searchable Master Part Selection
  const [showModal, setShowModal] = useState<"add" | "edit" | "categories" | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [selectedWorkOrderForModal, setSelectedWorkOrderForModal] = useState<WorkOrderMaterialRequirement | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [partSearch, setPartSearch] = useState("");
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const [selectedMasterPart, setSelectedMasterPart] = useState<any | null>(null);

  // Multi-material batch inward state
  const [batchItems, setBatchItems] = useState<BatchMaterialItem[]>([]);

  // Material Registry sub-tab
  const [registrySubTab, setRegistrySubTab] = useState<"verified" | "pending">("verified");
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    category: "Components",
    sku: "",
    quantity: 0,
    unit: "pcs",
    minStock: 5,
    totalAmount: 0,
    materialType: "QTZ"
  });

  const addPartToBatch = (part: any) => {
    setBatchItems(prev => {
      const existingIndex = prev.findIndex(item => item.sku.toLowerCase() === part.sku.toLowerCase());
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          totalAmount: part.unitPrice ? newQty * Number(part.unitPrice) : updated[existingIndex].totalAmount
        };
        return updated;
      }
      return [
        ...prev,
        {
          tempId: `${part.sku}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sku: part.sku,
          name: part.name,
          category: part.category || "Components",
          quantity: 1,
          unit: part.unit || "PCS",
          minStock: part.minStock ?? 5,
          totalAmount: part.unitPrice ? Number(part.unitPrice) * 1 : 0,
          materialType: part.materialType || "QTZ",
          unitPrice: Number(part.unitPrice) || 0
        }
      ];
    });
    setPartSearch("");
    setIsPartDropdownOpen(false);
  };

  const updateBatchItem = (index: number, field: keyof BatchMaterialItem, value: any) => {
    setBatchItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "quantity" && item.unitPrice && item.unitPrice > 0) {
        item.totalAmount = Number(value || 0) * item.unitPrice;
      }
      updated[index] = item;
      return updated;
    });
  };

  const removeBatchItem = (index: number) => {
    setBatchItems(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => { setMounted(true); }, []);

  // Fetch Production Material Requirements
  const { 
    data: prodReqData, 
    isLoading: isProdLoading, 
    refetch: refetchProdReqs 
  } = useQuery<{
    summary: {
      activeProductionCount: number;
      materialShortagesCount: number;
      needsAllocationCount: number;
      materialsReadyCount: number;
      totalWorkOrders: number;
    };
    shortageSummary: ShortageSummaryItem[];
    orders: WorkOrderMaterialRequirement[];
  }>({
    queryKey: ["inventory-production-requirements"],
    queryFn: async () => {
      const res = await api.get("/inventory/production-requirements");
      return res.data;
    },
    enabled: mounted,
    refetchInterval: 15000 // Live refresh every 15s
  });

  // Fetch Admin-Configured Master Material Catalog
  const { data: masterCatalog, isLoading: isCatalogLoading } = useQuery<any[]>({
    queryKey: ["admin-factory-materials"],
    queryFn: async () => {
      const res = await api.get("/admin/factory/material-mappings");
      return res.data;
    },
    enabled: mounted,
  });

  // Fetch Materials
  const { data: materials, isLoading: isMaterialsLoading, refetch: refetchMaterials } = useQuery({
    queryKey: ["materials", search],
    queryFn: async () => {
      const res = await api.get("/inventory/materials");
      return res.data;
    },
    enabled: mounted,
  });

  // Fetch Categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["material-categories"],
    queryFn: async () => {
      const res = await api.get("/inventory/categories");
      return res.data;
    },
    enabled: mounted,
  });

  // Mutations
  const materialMutation = useMutation({
    mutationFn: (data: any) => {
      if (showModal === "edit" && editingMaterial) {
        return api.patch(`/inventory/materials/${editingMaterial.id}`, data);
      }
      return api.post("/inventory/materials", data);
    },
    onSuccess: (_data, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-production-requirements"] });
      if (showModal === "edit") {
        toast.success("Changes saved successfully");
      } else if (variables?.items && variables.items.length > 1) {
        toast.success(`${variables.items.length} materials inward registered in batch!`);
      } else {
        toast.success("Material inward registered successfully");
      }
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-production-requirements"] });
      toast.success("Material deleted from registry");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to delete")
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => api.post("/inventory/categories", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-categories"] });
      setNewCatName("");
      toast.success("Category added");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to add category")
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-categories"] });
      toast.success("Category removed");
    }
  });

  // Allocate Materials Mutation
  const allocateMaterialsMutation = useMutation({
    mutationFn: (workOrderId: string) => api.post(`/crm/production/work-orders/${workOrderId}/allocate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-production-requirements"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Materials successfully reserved! Work Order marked READY.");
      if (selectedWorkOrderForModal) {
        setSelectedWorkOrderForModal(null);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Material allocation failed");
    }
  });

  // Spawn Purchase Request Mutation
  const spawnPRMutation = useMutation({
    mutationFn: ({ workOrderId, materialId, shortageQty }: { workOrderId: string; materialId: string; shortageQty: number }) => 
      api.post(`/crm/production/work-orders/${workOrderId}/spawn-purchase-request`, { materialId, shortageQty }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-production-requirements"] });
      toast.success(`Purchase Request ${data.data?.prNumber || ""} created for shortfall!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to spawn purchase request");
    }
  });

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const openEditModal = (mat: Material) => {
    setEditingMaterial(mat);
    const master = (masterCatalog || []).find((m: any) => m.sku === mat.sku);
    setSelectedMasterPart(master || null);
    setPartSearch(mat.sku);
    setIsPartDropdownOpen(false);
    setFormData({
      name: mat.name,
      category: mat.category,
      sku: mat.sku,
      quantity: mat.quantity,
      unit: mat.unit,
      minStock: mat.minStock,
      totalAmount: (mat as any).totalValue || 0,
      materialType: (mat as any).materialType || "QTZ"
    });
    setShowModal("edit");
  };

  const closeModal = () => {
    setShowModal(null);
    setEditingMaterial(null);
    setSelectedMasterPart(null);
    setPartSearch("");
    setIsPartDropdownOpen(false);
    setFormData({ name: "", category: categories?.[0]?.name || "Components", sku: "", quantity: 0, unit: "pcs", minStock: 5, totalAmount: 0, materialType: "QTZ" });
  };

  if (!mounted) return null;

  // Filter Production Orders
  const filteredOrders = (prodReqData?.orders || []).filter(order => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || 
      order.workOrderNumber.toLowerCase().includes(q) ||
      (order.productRef && order.productRef.toLowerCase().includes(q)) ||
      (order.salesOrder?.salesOrderNumber && order.salesOrder.salesOrderNumber.toLowerCase().includes(q)) ||
      (order.salesOrder?.customer?.name && order.salesOrder.customer.name.toLowerCase().includes(q)) ||
      order.materials.some(m => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "SHORTAGE") return order.materialStatus === "SHORTAGE" || order.hasShortage;
    if (statusFilter === "NEEDS_ALLOCATION") return ["CREATED", "ASSIGNED"].includes(order.status) && !order.isAllocated;
    if (statusFilter === "READY") return order.materialStatus === "READY" || order.materialStatus === "ALLOCATED" || order.status === "READY";
    if (statusFilter === "IN_PROGRESS") return order.status === "IN_PROGRESS" || order.status === "ON_HOLD";
    if (statusFilter === "COMPLETED") return ["COMPLETED", "CLOSED"].includes(order.status);
    return true;
  });

  // Filter Physical Materials
  const filteredMaterials = (materials || []).filter((m: Material) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
      m.sku.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase());
    
    if (registrySubTab === "verified") return matchesSearch && m.isPriceVerified;
    return matchesSearch && !m.isPriceVerified;
  });

  const summary = prodReqData?.summary || {
    activeProductionCount: 0,
    materialShortagesCount: 0,
    needsAllocationCount: 0,
    materialsReadyCount: 0,
    totalWorkOrders: 0
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Compact Page Header */}
      <PageHeader
        title="Inventory & Material Planning"
        description="Industrial Material Requirements • Production Demand • Stock Reservation Ledger"
        icon={<Archive className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button 
                onClick={() => setShowModal("categories")}
                className="px-3 py-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#0B2148] hover:text-[#0878F9] transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs"
              >
                <Settings2 className="w-3.5 h-3.5 text-[#526B91]" />
                Categories
              </button>
            )}
            <button 
              onClick={() => {
                refetchProdReqs();
                refetchMaterials();
                toast.success("Inventory and production material state refreshed");
              }}
              className="p-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-all flex items-center gap-1 text-xs font-bold cursor-pointer shadow-xs"
              title="Refresh state"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync</span>
            </button>
            {canManageInventory && (
              <button 
                onClick={() => setShowModal("add")}
                className="flex items-center gap-1.5 bg-[#0878F9] hover:bg-[#0667DB] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Material
              </button>
            )}
          </div>
        }
      />

      {/* Primary View Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-[#D8E8FA] shadow-xs w-fit">
        <button
          onClick={() => setMainTab("production")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mainTab === "production" 
              ? "bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9] shadow-xs" 
              : "text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
          }`}
        >
          <Factory className="w-4 h-4" />
          Production Material Requirements
          {summary.materialShortagesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] animate-pulse">
              {summary.materialShortagesCount} Short
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setMainTab("registry");
            setRegistrySubTab("verified");
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainTab === "registry" && registrySubTab === "verified"
              ? "bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9] shadow-xs" 
              : "text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
          }`}
        >
          <Box className="w-4 h-4" />
          Material Registry
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EAF5FF] text-[#0B2148]">
            {materials?.length || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setMainTab("registry");
            setRegistrySubTab("pending");
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mainTab === "registry" && registrySubTab === "pending"
              ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] shadow-xs" 
              : "text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
          }`}
        >
          <Tag className="w-4 h-4" />
          Pending Price
          {(materials || []).filter((m: any) => !m.isPriceVerified).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* VIEW 1: PRODUCTION MATERIAL REQUIREMENTS */}
      {/* ==================================================================== */}
      {mainTab === "production" && (
        <div className="space-y-6">
          {/* Top KPI Metrics Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Active Production */}
            <div className="glass-panel p-5 rounded-3xl border border-[#D8E8FA] bg-white shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Active Production</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
                  <PlayCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-display font-black text-[#0B2148]">{summary.activeProductionCount}</span>
                <span className="text-xs text-purple-600 font-medium">Orders Running</span>
              </div>
              <p className="text-[11px] text-[#526B91] mt-1">Live runs active on assembly shopfloor</p>
            </div>

            {/* KPI 2: Material Shortages */}
            <div className={`glass-panel p-5 rounded-3xl border ${summary.materialShortagesCount > 0 ? "border-[#FECACA] bg-[#FEE2E2]" : "border-[#D8E8FA] bg-white"} shadow-sm relative overflow-hidden`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${summary.materialShortagesCount > 0 ? "text-[#991B1B]" : "text-[#526B91]"}`}>Material Shortages</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${summary.materialShortagesCount > 0 ? "bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626]" : "bg-red-500/10 border border-red-500/20 text-[#DC2626]"}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-3xl font-display font-black ${summary.materialShortagesCount > 0 ? "text-[#991B1B]" : "text-[#0B2148]"}`}>
                  {summary.materialShortagesCount}
                </span>
                <span className={`text-xs font-medium ${summary.materialShortagesCount > 0 ? "text-[#991B1B]" : "text-[#526B91]"}`}>Orders Blocked</span>
              </div>
              <p className={`text-[11px] mt-1 ${summary.materialShortagesCount > 0 ? "text-[#991B1B]/80" : "text-[#526B91]"}`}>Orders with insufficient unreserved stock</p>
            </div>

            {/* KPI 3: Needs Allocation */}
            <div className="glass-panel p-5 rounded-3xl border border-[#D8E8FA] bg-white shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Needs Allocation</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#92400E]">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-display font-black text-[#92400E]">{summary.needsAllocationCount}</span>
                <span className="text-xs text-[#92400E]/80 font-medium">Orders Pending</span>
              </div>
              <p className="text-[11px] text-[#526B91] mt-1">Awaiting inventory reservation confirmation</p>
            </div>

            {/* KPI 4: Materials Ready */}
            <div className="glass-panel p-5 rounded-3xl border border-[#D8E8FA] bg-white shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Materials Ready</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#166534]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-display font-black text-[#166534]">{summary.materialsReadyCount}</span>
                <span className="text-xs text-[#166534]/80 font-medium">Ready for Run</span>
              </div>
              <p className="text-[11px] text-[#526B91] mt-1">100% materials allocated and in stock</p>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECTION: MATERIALS NEEDING ATTENTION (Aggregated Shortfall) */}
          {/* ================================================================ */}
          {prodReqData?.shortageSummary && prodReqData.shortageSummary.length > 0 && (
            <div className="glass-panel p-6 rounded-3xl border border-[#FECACA] bg-[#FEE2E2] shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#FECACA]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[#991B1B]">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#991B1B] uppercase tracking-wider flex items-center gap-2">
                      Materials Needing Attention
                      <span className="px-2 py-0.5 text-[10px] bg-[#991B1B] text-white rounded-full font-mono font-bold">
                        {prodReqData.shortageSummary.length} Critical Items
                      </span>
                    </h3>
                    <p className="text-xs text-[#7F1D1D]">
                      Material demand exceeding available unreserved stock across upcoming production runs.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-[#991B1B] font-medium italic">
                  Arrange procurement or stock transfers below
                </span>
              </div>

              <div className="overflow-x-auto bg-white rounded-2xl border border-[#FECACA]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                      <th className="py-2.5 px-3">Material Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Total Demand</th>
                      <th className="py-2.5 px-3 text-right">Available Stock</th>
                      <th className="py-2.5 px-3 text-right text-[#991B1B]">Total Shortage</th>
                      <th className="py-2.5 px-3">Affected Work Orders</th>
                      <th className="py-2.5 px-3 text-right">Procurement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F1FC] text-xs">
                    {prodReqData.shortageSummary.map((item) => (
                      <tr key={item.materialId} className="hover:bg-[#F4F9FF] transition-colors">
                        <td className="py-3 px-3 font-bold text-[#0B2148] flex items-center gap-2">
                          <Box className="w-3.5 h-3.5 text-[#0878F9]" />
                          {item.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#526B91] uppercase">{item.sku}</td>
                        <td className="py-3 px-3 text-right font-medium text-[#0B2148]">
                          {item.totalRequired.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-[#166534]">
                          {item.totalAvailable.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#991B1B]">
                          {item.totalShortage.toLocaleString()} {item.unit}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {item.affectedWorkOrders.map((wo) => (
                              <span 
                                key={wo.id}
                                className="px-1.5 py-0.5 rounded bg-[#F4F9FF] border border-[#D8E8FA] text-[10px] font-mono text-[#0B2148]"
                              >
                                {wo.workOrderNumber} ({wo.shortageQty} {item.unit})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.purchaseRequest ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-600">
                              <Check className="w-3 h-3" />
                              {item.purchaseRequest.prNumber} ({item.purchaseRequest.status})
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const primaryWo = item.affectedWorkOrders[0];
                                if (primaryWo) {
                                  spawnPRMutation.mutate({
                                    workOrderId: primaryWo.id,
                                    materialId: item.materialId,
                                    shortageQty: item.totalShortage
                                  });
                                }
                              }}
                              disabled={spawnPRMutation.isPending}
                              className="px-3 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[11px] font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Create Purchase Request
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Search & Filters Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Work Order #, Product Name, SKU, Material Name..." 
                className="w-full bg-white border border-[#D8E8FA] rounded-2xl py-3 pl-11 pr-4 text-sm text-[#0B2148] focus:border-[#0878F9] focus:outline-none transition-all placeholder:text-[#64748B]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#D8E8FA]">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "ALL" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
                }`}
              >
                All ({prodReqData?.orders?.length || 0})
              </button>
              <button
                onClick={() => setStatusFilter("SHORTAGE")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === "SHORTAGE" ? "bg-[#DC2626] text-white" : "text-[#526B91] hover:text-[#991B1B] hover:bg-[#FEE2E2]"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Shortage ({summary.materialShortagesCount})
              </button>
              <button
                onClick={() => setStatusFilter("NEEDS_ALLOCATION")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "NEEDS_ALLOCATION" ? "bg-amber-600 text-white" : "text-[#526B91] hover:text-[#92400E] hover:bg-[#FEF3C7]"
                }`}
              >
                Needs Allocation ({summary.needsAllocationCount})
              </button>
              <button
                onClick={() => setStatusFilter("READY")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "READY" ? "bg-emerald-600 text-white" : "text-[#526B91] hover:text-[#166534] hover:bg-[#DCFCE7]"
                }`}
              >
                Ready & Allocated ({summary.materialsReadyCount})
              </button>
              <button
                onClick={() => setStatusFilter("IN_PROGRESS")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === "IN_PROGRESS" ? "bg-purple-600 text-white" : "text-[#526B91] hover:text-purple-600 hover:bg-purple-50"
                }`}
              >
                In Production ({summary.activeProductionCount})
              </button>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECTION: WORK ORDER GROUPED MATERIAL REQUIREMENTS */}
          {/* ================================================================ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-2">
                <Factory className="w-4 h-4 text-accent" />
                Production Orders & BOM Material Demand ({filteredOrders.length})
              </h2>
              <span className="text-[11px] text-[#526B91] font-mono">
                Authoritative BOM & Inventory Reserves
              </span>
            </div>

            {isProdLoading ? (
              <div className="glass-panel p-16 rounded-3xl border border-[#D8E8FA] flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest">
                  Computing BOM Demand & Inventory Reserves...
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="glass-panel p-12 rounded-3xl border border-[#D8E8FA] text-center space-y-2">
                <Package className="w-10 h-10 text-[#526B91] mx-auto" />
                <p className="text-sm font-bold text-[#526B91]">No matching production orders found</p>
                <p className="text-xs text-[#526B91]">Try adjusting your search query or filter tags</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderIds[order.id] ?? true;
                  const hasShortage = order.hasShortage || order.materialStatus === "SHORTAGE";

                  return (
                    <div 
                      key={order.id} 
                      className={`glass-panel rounded-3xl border transition-all ${
                        hasShortage 
                          ? "border-red-500/30 bg-white shadow-lg shadow-red-950/20" 
                          : order.status === "IN_PROGRESS"
                          ? "border-purple-500/20 bg-white shadow-lg shadow-purple-950/20"
                          : "border-[#D8E8FA] bg-white"
                      } overflow-hidden`}
                    >
                      {/* Work Order Header */}
                      <div className="p-5 sm:p-6 border-b border-[#D8E8FA] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold border ${
                            hasShortage
                              ? "bg-red-500/10 border-red-500/30 text-red-400"
                              : order.status === "IN_PROGRESS"
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                              : order.status === "READY"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-[#F4F9FF] border-[#D8E8FA] text-[#0B2148]"
                          }`}>
                            <Boxes className="w-6 h-6" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-black text-[#0B2148]">
                                {order.workOrderNumber}
                              </span>
                              
                              {/* Production Status Badge */}
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                order.status === "IN_PROGRESS"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse"
                                  : order.status === "READY"
                                  ? "bg-emerald-500/20 text-[#166534] border-emerald-500/30"
                                  : order.status === "ON_HOLD"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : order.status === "COMPLETED"
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                  : "bg-slate-800 text-[#0B2148] border-slate-700"
                              }`}>
                                {order.status.replace("_", " ")}
                              </span>

                              {/* Material Status Pill */}
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                order.materialStatus === "SHORTAGE"
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : order.materialStatus === "ALLOCATED"
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                  : order.materialStatus === "READY"
                                  ? "bg-emerald-500/20 text-[#166534] border-emerald-500/30"
                                  : order.materialStatus === "IN_PRODUCTION"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              }`}>
                                Material: {order.materialStatus.replace("_", " ")}
                              </span>

                              {order.priority !== "NORMAL" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  {order.priority}
                                </span>
                              )}
                            </div>

                            <h3 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                              {order.productRef || "Standard Assembly Product"}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#526B91]">
                              {order.salesOrder && (
                                <span>Sales Order: <strong className="text-[#0B2148]">{order.salesOrder.salesOrderNumber}</strong></span>
                              )}
                              {order.salesOrder?.customer && (
                                <span>Customer: <strong className="text-[#0B2148]">{order.salesOrder.customer.name}</strong></span>
                              )}
                              <span>Due Date: <strong className="text-[#0B2148]">{new Date(order.dueDate).toLocaleDateString()}</strong></span>
                              {order.startedAt && (
                                <span>Started: <strong className="text-purple-300">{new Date(order.startedAt).toLocaleString()}</strong></span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions & Target Quantity */}
                        <div className="flex flex-wrap items-center gap-3 self-end lg:self-center">
                          <div className="text-right px-4 py-2 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA]">
                            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Production Qty</p>
                            <p className="text-lg font-display font-black text-[#0B2148]">
                              {order.plannedQuantity} <span className="text-xs font-normal text-[#526B91]">Packs</span>
                            </p>
                          </div>

                          {/* Inventory Manager Allocation Button */}
                          {["CREATED", "ASSIGNED"].includes(order.status) && (
                            <button
                              onClick={() => allocateMaterialsMutation.mutate(order.id)}
                              disabled={allocateMaterialsMutation.isPending || hasShortage}
                              title={hasShortage ? "Cannot allocate: material shortage exists" : "Reserve all required materials"}
                              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Allocate Materials
                            </button>
                          )}

                          {/* View Detail Modal Trigger */}
                          <button
                            onClick={() => setSelectedWorkOrderForModal(order)}
                            className="px-3.5 py-2.5 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] hover:text-white border border-[#D8E8FA] text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-accent" />
                            Details
                          </button>

                          {/* Expand/Collapse Toggle */}
                          <button
                            onClick={() => toggleOrderExpand(order.id)}
                            className="p-2.5 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-white border border-[#D8E8FA] transition-all"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Required Materials Table Breakdown */}
                      {isExpanded && (
                        <div className="p-5 sm:p-6 bg-[#F4F9FF] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-accent" />
                              BOM Specification Materials ({order.materials.length} components)
                            </span>
                            {order.bom && (
                              <span className="text-[10px] font-mono text-[#526B91]">
                                Active BOM: {order.bom.name}
                              </span>
                            )}
                          </div>

                          <div className="overflow-x-auto rounded-2xl border border-[#D8E8FA]">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                                  <th className="py-2.5 px-4">Material / Component</th>
                                  <th className="py-2.5 px-3">SKU</th>
                                  <th className="py-2.5 px-3 text-center">BOM / Unit</th>
                                  <th className="py-2.5 px-3 text-right">Required Qty</th>
                                  <th className="py-2.5 px-3 text-right">Available Stock</th>
                                  <th className="py-2.5 px-3 text-right">Reserved Stock</th>
                                  <th className="py-2.5 px-3 text-right">Shortage</th>
                                  <th className="py-2.5 px-3 text-center">Status</th>
                                  <th className="py-2.5 px-4 text-right">Procurement / Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E8F1FC] text-xs">
                                {order.materials.map((mat) => (
                                  <tr key={mat.materialId} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="py-3 px-4 font-bold text-[#0B2148] flex items-center gap-2">
                                      <Box className="w-3.5 h-3.5 text-[#526B91]" />
                                      {mat.name}
                                    </td>
                                    <td className="py-3 px-3 font-mono text-[11px] text-[#526B91] uppercase">
                                      {mat.sku}
                                    </td>
                                    <td className="py-3 px-3 text-center text-[#0B2148] font-mono text-xs">
                                      {mat.bomQtyPerUnit} {mat.unit}
                                    </td>
                                    <td className="py-3 px-3 text-right font-bold text-[#0B2148]">
                                      {mat.requiredQty.toLocaleString()} {mat.unit}
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-[#166534]">
                                      {mat.availableStock.toLocaleString()} {mat.unit}
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-blue-400">
                                      {mat.totalReserved.toLocaleString()} {mat.unit}
                                    </td>
                                    <td className={`py-3 px-3 text-right font-black ${mat.shortageQty > 0 ? "text-red-400" : "text-[#526B91]"}`}>
                                      {mat.shortageQty > 0 ? `${mat.shortageQty.toLocaleString()} ${mat.unit}` : "0"}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                        mat.status === "ALLOCATED"
                                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                          : mat.status === "SHORTAGE"
                                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                                          : mat.status === "LOW_STOCK"
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      }`}>
                                        {mat.status}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      {mat.purchaseRequest ? (
                                        <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                          {mat.purchaseRequest.prNumber}
                                        </span>
                                      ) : mat.shortageQty > 0 ? (
                                        <button
                                          onClick={() => spawnPRMutation.mutate({
                                            workOrderId: order.id,
                                            materialId: mat.materialId,
                                            shortageQty: mat.shortageQty
                                          })}
                                          disabled={spawnPRMutation.isPending}
                                          className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[10px] font-bold transition-all inline-flex items-center gap-1"
                                        >
                                          <ShoppingCart className="w-3 h-3" />
                                          Create PR
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-[#526B91] italic">Sufficient</span>
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: MATERIAL REGISTRY (Physical Inventory Table) */}
      {/* ==================================================================== */}
      {mainTab === "registry" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex bg-white p-1 rounded-xl border border-[#D8E8FA] shadow-xs">
              <button 
                onClick={() => setRegistrySubTab("verified")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  registrySubTab === "verified" ? "bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]" : "text-[#526B91] hover:text-[#0878F9]"
                }`}
              >
                Material Registry
              </button>
              <button 
                onClick={() => setRegistrySubTab("pending")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  registrySubTab === "pending" ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" : "text-[#526B91] hover:text-[#0878F9]"
                }`}
              >
                Pending Price Update
                {(materials || []).filter((m: any) => !m.isPriceVerified).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
                )}
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by part name, category or SKU..." 
                className="w-full bg-white border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-sm text-[#0B2148] focus:border-[#0878F9] focus:outline-none transition-all placeholder:text-[#64748B]" 
              />
            </div>
            <div className="flex items-center gap-3 px-4 bg-white border border-[#D8E8FA] rounded-xl">
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Low Stock:</span>
              <span className="text-xs font-bold text-[#991B1B]">{filteredMaterials.filter((m: Material) => m.quantity <= m.minStock).length}</span>
            </div>
          </div>

          <div className="glass-panel bg-white rounded-2xl overflow-hidden border border-[#D8E8FA] shadow-sm">
            {isMaterialsLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
                <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Syncing Materials...</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Material / Part</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Category</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">SKU</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Stock Status</th>
                    {showPrice && <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Unit Price</th>}
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC]">
                  {filteredMaterials.map((mat: Material) => (
                    <tr key={mat.id} className="hover:bg-[#F8FBFF] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F4F9FF] flex items-center justify-center text-[#526B91] group-hover:text-[#0878F9] transition-all">
                            <Box className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-[#0B2148] transition-colors">{mat.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-[#526B91]">{mat.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(mat as any).materialType === "NQTZ" ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" : "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"}`}>
                          {(mat as any).materialType || "QTZ"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-[#526B91] uppercase">{mat.sku}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${mat.quantity <= mat.minStock ? "text-[#991B1B]" : "text-[#0B2148]"}`}>
                            {mat.quantity} {mat.unit}
                          </span>
                          {mat.quantity <= mat.minStock && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />}
                        </div>
                      </td>
                      {showPrice && (
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-[#526B91]">
                            ₹{((mat as any).unitPrice || 0).toLocaleString()}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManageInventory && (
                            <button 
                              onClick={() => openEditModal(mat)} 
                              className="p-2 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button 
                              onClick={() => { if (confirm(`Delete ${mat.name}?`)) deleteMaterialMutation.mutate(mat.id); }}
                              className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#526B91] hover:text-[#991B1B] transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: WORK ORDER MATERIAL DETAILS INSPECTION */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {selectedWorkOrderForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedWorkOrderForModal(null)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="glass-panel bg-white w-full max-w-4xl p-6 sm:p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EAF5FF] rounded-xl flex items-center justify-center text-[#0878F9]">
                    <Factory className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-[#0B2148]">
                      Production Order Material Breakdown
                    </h2>
                    <p className="text-xs text-[#526B91]">
                      Work Order {selectedWorkOrderForModal.workOrderNumber} • {selectedWorkOrderForModal.productRef}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedWorkOrderForModal(null)} 
                  className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">Status</span>
                  <span className="text-xs font-bold text-[#0B2148] mt-1 block uppercase">
                    {selectedWorkOrderForModal.status.replace("_", " ")}
                  </span>
                </div>
                <div className="p-3 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">Planned Qty</span>
                  <span className="text-xs font-bold text-[#0B2148] mt-1 block">
                    {selectedWorkOrderForModal.plannedQuantity} Units
                  </span>
                </div>
                <div className="p-3 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">Due Date</span>
                  <span className="text-xs font-bold text-[#0B2148] mt-1 block">
                    {new Date(selectedWorkOrderForModal.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="p-3 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">Material State</span>
                  <span className={`text-xs font-bold mt-1 block uppercase ${
                    selectedWorkOrderForModal.hasShortage ? "text-[#991B1B]" : "text-[#166534]"
                  }`}>
                    {selectedWorkOrderForModal.materialStatus.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Material Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Required Materials List</h4>
                <div className="overflow-x-auto rounded-2xl border border-[#D8E8FA]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                        <th className="py-2.5 px-3">Material</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3 text-center">Per Unit</th>
                        <th className="py-2.5 px-3 text-right">Required</th>
                        <th className="py-2.5 px-3 text-right">Available</th>
                        <th className="py-2.5 px-3 text-right">Reserved</th>
                        <th className="py-2.5 px-3 text-right">Shortage</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8F1FC]">
                      {selectedWorkOrderForModal.materials.map((m) => (
                        <tr key={m.materialId}>
                          <td className="py-2.5 px-3 font-bold text-[#0B2148]">{m.name}</td>
                          <td className="py-2.5 px-3 font-mono text-[#526B91] uppercase text-[11px]">{m.sku}</td>
                          <td className="py-2.5 px-3 text-center text-[#0B2148]">{m.bomQtyPerUnit} {m.unit}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#0B2148]">{m.requiredQty} {m.unit}</td>
                          <td className="py-2.5 px-3 text-right text-[#166534]">{m.availableStock} {m.unit}</td>
                          <td className="py-2.5 px-3 text-right text-[#0878F9]">{m.totalReserved} {m.unit}</td>
                          <td className={`py-2.5 px-3 text-right font-bold ${m.shortageQty > 0 ? "text-[#991B1B]" : "text-[#526B91]"}`}>
                            {m.shortageQty} {m.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.status === "SHORTAGE" ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]" : "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                            }`}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#D8E8FA]">
                <div className="text-xs text-[#526B91]">
                  {selectedWorkOrderForModal.hasShortage 
                    ? "⚠️ Action needed: Shortage detected. Create purchase request or restock." 
                    : "✓ Materials ready for reservation & production execution."}
                </div>
                <div className="flex gap-2">
                  {["CREATED", "ASSIGNED"].includes(selectedWorkOrderForModal.status) && !selectedWorkOrderForModal.hasShortage && (
                    <button
                      onClick={() => allocateMaterialsMutation.mutate(selectedWorkOrderForModal.id)}
                      disabled={allocateMaterialsMutation.isPending}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Allocate & Ready Order
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedWorkOrderForModal(null)}
                    className="px-4 py-2.5 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] text-[#0B2148] font-bold text-xs transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {showModal === "categories" && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel bg-white w-full max-w-md p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EAF5FF] rounded-xl flex items-center justify-center text-[#0878F9]"><Layers className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Material Categories</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex gap-2 mb-6">
                <input 
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="New category name..." 
                  className="flex-1 bg-white border border-[#D8E8FA] rounded-xl py-2.5 px-4 text-xs text-[#0B2148] outline-none focus:border-[#0878F9]" 
                />
                <button 
                  onClick={() => addCategoryMutation.mutate(newCatName)}
                  disabled={!newCatName}
                  className="bg-[#0878F9] hover:bg-[#0667DB] px-4 rounded-xl text-xs font-bold text-white disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
                >Add</button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-auto pr-2">
                {(categories || []).map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl group">
                    <span className="text-xs font-bold text-[#0B2148]">{cat.name}</span>
                    <button 
                      onClick={() => { if (confirm("Delete category?")) deleteCategoryMutation.mutate(cat.id); }}
                      className="p-1 text-[#526B91] hover:text-[#991B1B] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Material Modal (Multi-Material Inward Batch / Edit) */}
      <AnimatePresence>
        {(showModal === "add" || showModal === "edit") && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-[#061B3A]/40 backdrop-blur-xs" />
            
            {showModal === "add" ? (
              /* MULTI-MATERIAL BATCH INWARD MODAL */
              <motion.div 
                initial={{ scale: 0.98, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.98, opacity: 0 }} 
                className="glass-panel w-full max-w-4xl p-6 sm:p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl bg-white space-y-6 my-8"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#D8E8FA]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#EAF5FF] border border-[#0878F9]/20 rounded-xl flex items-center justify-center text-[#0878F9]">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-[#0B2148] flex items-center gap-2">
                        <span>Register Material Inward</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/20 font-sans font-bold">
                          Multi-Item Batch
                        </span>
                      </h2>
                      <p className="text-xs text-[#526B91]">
                        Select one or multiple Admin-configured Part Numbers to inward into stock in a single request
                      </p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Top Search & Catalog Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#0878F9]" />
                      <span>Search & Add Master Parts to Batch *</span>
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          closeModal();
                          router.push(`/${roleSlug}/admin-settings?tab=factory`);
                        }}
                        className="text-[10px] text-[#0878F9] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Settings2 className="w-3 h-3" />
                        Manage Catalog in Admin Settings
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        value={partSearch}
                        onChange={(e) => {
                          setPartSearch(e.target.value);
                          setIsPartDropdownOpen(true);
                        }}
                        onFocus={() => setIsPartDropdownOpen(true)}
                        placeholder="Search Part Number (SKU), Name, or Category to add..."
                        className="w-full bg-white border border-[#D8E8FA] focus:border-[#0878F9] rounded-xl py-3 pl-10 pr-10 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#0878F9] shadow-xs"
                      />
                      <ChevronDown className="w-4 h-4 text-[#526B91] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Search Dropdown Results */}
                    {isPartDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsPartDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl max-h-64 overflow-y-auto z-20 divide-y divide-[#E8F1FC]">
                          {isCatalogLoading ? (
                            <div className="p-4 text-center text-xs text-[#526B91] flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-[#0878F9]" />
                              Loading master catalog...
                            </div>
                          ) : (() => {
                            const available = (masterCatalog || []).filter((m: any) => m.isActive !== false);
                            const filtered = available.filter((m: any) => {
                              const q = partSearch.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                m.sku?.toLowerCase().includes(q) ||
                                m.name?.toLowerCase().includes(q) ||
                                m.category?.toLowerCase().includes(q) ||
                                m.materialCode?.toLowerCase().includes(q)
                              );
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="p-5 text-center space-y-2">
                                  <p className="text-xs text-[#526B91] font-medium">
                                    No matching Part Number found in Admin Factory Catalog.
                                  </p>
                                </div>
                              );
                            }

                            return filtered.map((item: any) => {
                              const isAlreadyStaged = batchItems.some(b => b.sku.toLowerCase() === item.sku.toLowerCase());

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => addPartToBatch(item)}
                                  className="w-full p-3 hover:bg-[#F4F9FF] text-left transition-colors flex items-start justify-between gap-3 group cursor-pointer"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-[#0878F9]">
                                        {item.sku}
                                      </span>
                                      <span className="px-1.5 py-0.2 bg-[#EAF5FF] rounded text-[10px] font-mono text-[#0B2148]">
                                        {item.category}
                                      </span>
                                      {isAlreadyStaged && (
                                        <span className="px-1.5 py-0.2 bg-emerald-50 text-[#166534] border border-emerald-200 rounded text-[9px] font-bold">
                                          ✓ Staged (+1)
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold text-[#0B2148] mt-0.5">{item.name}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-[10px] font-mono text-[#526B91] block">{item.unit || "PCS"}</span>
                                    {item.unitPrice > 0 && (
                                      <span className="text-xs font-mono font-bold text-[#166534]">
                                        ₹{Number(item.unitPrice).toLocaleString("en-IN")}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Staged Batch Materials Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] block">
                      Staged Materials List ({batchItems.length} {batchItems.length === 1 ? "Item" : "Items"})
                    </span>
                    {batchItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBatchItems([])}
                        className="text-[10px] text-[#526B91] hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {batchItems.length > 0 ? (
                    <div className="border border-[#D8E8FA] rounded-2xl overflow-hidden bg-white shadow-xs max-h-[45vh] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91]">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Part SKU & Details</th>
                            <th className="py-2.5 px-3 text-center">Inward Qty *</th>
                            <th className="py-2.5 px-3 text-center">Unit</th>
                            <th className="py-2.5 px-3 text-center">Min Stock</th>
                            {(isPurchaseManager || isAdmin) && (
                              <th className="py-2.5 px-3 text-right">Total Purchase (₹)</th>
                            )}
                            <th className="py-2.5 px-3 text-center">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                          {batchItems.map((item, idx) => (
                            <tr key={item.tempId} className="hover:bg-[#F8FBFF] transition-colors">
                              <td className="py-3 px-3 font-mono text-xs text-[#526B91] font-bold">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/20">
                                    {item.sku}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA]">
                                    {item.category}
                                  </span>
                                </div>
                                <p className="font-bold text-[#0B2148] text-xs mt-1 truncate max-w-xs">{item.name}</p>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateBatchItem(idx, "quantity", Math.max(1, item.quantity - 1))}
                                    className="w-6 h-6 rounded bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] flex items-center justify-center text-xs font-bold cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input 
                                    type="number"
                                    min="1"
                                    value={item.quantity || ""}
                                    onChange={(e) => updateBatchItem(idx, "quantity", Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="w-16 text-center font-mono font-bold bg-white border border-[#D8E8FA] focus:border-[#0878F9] rounded-lg py-1 px-1.5 text-xs text-[#0B2148] outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateBatchItem(idx, "quantity", item.quantity + 1)}
                                    className="w-6 h-6 rounded bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] flex items-center justify-center text-xs font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-[11px] text-[#526B91] uppercase">
                                {item.unit}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <input 
                                  type="number"
                                  min="0"
                                  value={item.minStock || ""}
                                  onChange={(e) => updateBatchItem(idx, "minStock", parseInt(e.target.value, 10) || 0)}
                                  className="w-16 text-center font-mono bg-white border border-[#D8E8FA] focus:border-[#0878F9] rounded-lg py-1 px-1.5 text-xs text-[#0B2148] outline-none"
                                />
                              </td>
                              {(isPurchaseManager || isAdmin) && (
                                <td className="py-3 px-3 text-right">
                                  <div className="relative inline-block w-28">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#526B91] font-bold">₹</span>
                                    <input 
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.totalAmount || ""}
                                      onChange={(e) => updateBatchItem(idx, "totalAmount", parseFloat(e.target.value) || 0)}
                                      placeholder="0.00"
                                      className="w-full text-right font-mono font-bold bg-white border border-[#D8E8FA] focus:border-[#0878F9] rounded-lg py-1 pl-5 pr-2 text-xs text-[#0B2148] outline-none"
                                    />
                                  </div>
                                  {item.quantity > 0 && item.totalAmount > 0 && (
                                    <span className="text-[10px] font-mono text-[#0878F9] block mt-0.5">
                                      @ ₹{(item.totalAmount / item.quantity).toFixed(2)}/u
                                    </span>
                                  )}
                                </td>
                              )}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeBatchItem(idx)}
                                  className="p-1.5 text-[#526B91] hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove item from batch"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[#F4F9FF] border border-dashed border-[#D8E8FA] rounded-2xl space-y-2">
                      <Boxes className="w-8 h-8 text-[#526B91]/40 mx-auto" />
                      <p className="text-xs font-semibold text-[#0B2148]">No Materials Staged in Current Batch</p>
                      <p className="text-[11px] text-[#526B91]">
                        Search and select Part Numbers from the master catalog above to inward multiple materials in one request.
                      </p>
                    </div>
                  )}
                </div>

                {/* Batch Calculation Summary Footer */}
                {batchItems.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA] text-center">
                    <div className="p-2 bg-white rounded-xl border border-[#D8E8FA]">
                      <span className="text-[10px] uppercase font-bold text-[#526B91] block">Total Items</span>
                      <p className="text-sm font-bold font-mono text-[#0B2148] mt-0.5">
                        {batchItems.length} Materials
                      </p>
                    </div>
                    <div className="p-2 bg-[#EAF5FF] rounded-xl border border-[#0878F9]/30">
                      <span className="text-[10px] uppercase font-bold text-[#0878F9] block">Total Inward Units</span>
                      <p className="text-sm font-bold font-mono text-[#0878F9] mt-0.5">
                        {batchItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} Units
                      </p>
                    </div>
                    {(isPurchaseManager || isAdmin) ? (
                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="text-[10px] uppercase font-bold text-[#166534] block">Total Batch Value</span>
                        <p className="text-sm font-bold font-mono text-[#166534] mt-0.5">
                          ₹{batchItems.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-white rounded-xl border border-[#D8E8FA]">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Batch Inward Status</span>
                        <p className="text-sm font-bold font-mono text-[#166534] mt-0.5">
                          Ready to Commit
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#D8E8FA] flex items-center justify-between gap-3">
                  <button 
                    type="button"
                    onClick={closeModal} 
                    className="py-2.5 px-5 rounded-xl border border-[#D8E8FA] bg-white text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF] font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      if (batchItems.length === 0) {
                        toast.error("Please add at least one material to inward.");
                        return;
                      }
                      const invalid = batchItems.find(it => !it.quantity || it.quantity <= 0);
                      if (invalid) {
                        toast.error(`Please specify a valid quantity for ${invalid.sku}`);
                        return;
                      }
                      materialMutation.mutate({ items: batchItems });
                    }} 
                    disabled={batchItems.length === 0 || materialMutation.isPending}
                    className="bg-[#0878F9] hover:bg-[#0665d0] disabled:opacity-40 py-2.5 px-6 rounded-xl text-white font-bold transition-all shadow-xs flex items-center gap-2 text-xs cursor-pointer"
                  >
                    {materialMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering {batchItems.length} Materials...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Inward Stock ({batchItems.length} {batchItems.length === 1 ? "Material" : "Materials"})</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              /* SINGLE MATERIAL EDIT MODAL */
              <motion.div 
                initial={{ scale: 0.98, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.98, opacity: 0 }} 
                className="glass-panel w-full max-w-xl p-6 sm:p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl bg-white space-y-5"
              >
                <div className="flex items-center justify-between pb-4 border-b border-[#D8E8FA]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#EAF5FF] border border-[#0878F9]/20 rounded-xl flex items-center justify-center text-[#0878F9]">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-[#0B2148]">
                        Edit Material Resource
                      </h2>
                      <p className="text-xs text-[#526B91]">
                        Update inventory parameters and pricing
                      </p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-[#EAF5FF] border border-[#0878F9]/30 rounded-lg font-mono text-xs font-bold text-[#0878F9]">
                        {formData.sku}
                      </span>
                      <span className="px-2 py-0.5 bg-[#EAF5FF] rounded text-[11px] font-medium text-[#0B2148]">
                        {formData.category}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#0B2148]">{formData.name}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">
                        Current Stock *
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.quantity || ""} 
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({...formData, quantity: val === "" ? 0 : parseInt(val)});
                        }} 
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-xs font-mono font-bold text-[#0B2148] focus:border-[#0878F9] focus:outline-none" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">
                        Min Safety Stock
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.minStock || ""} 
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({...formData, minStock: val === "" ? 0 : parseInt(val)});
                        }} 
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-xs font-mono text-[#0B2148] focus:border-[#0878F9] focus:outline-none" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">
                        Unit of Measure
                      </label>
                      <input 
                        value={formData.unit} 
                        onChange={e => setFormData({...formData, unit: e.target.value})} 
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-xs font-mono text-[#0B2148] focus:border-[#0878F9] focus:outline-none uppercase" 
                      />
                    </div>
                  </div>

                  {(isPurchaseManager || isAdmin) && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#0B2148] ml-1">
                        Total Value (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#526B91] text-xs font-bold">₹</span>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={formData.totalAmount || ""} 
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({...formData, totalAmount: val === "" ? 0 : parseFloat(val)});
                          }} 
                          className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2.5 pl-8 pr-4 text-xs font-mono text-[#0B2148] focus:border-[#0878F9] focus:outline-none" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#D8E8FA] flex gap-3">
                  <button 
                    type="button"
                    onClick={closeModal} 
                    className="flex-1 py-2.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={() => materialMutation.mutate(formData)} 
                    disabled={!formData.name || materialMutation.isPending}
                    className="flex-1 bg-[#0878F9] hover:bg-[#0665d0] disabled:opacity-40 py-2.5 rounded-xl text-white font-bold transition-all shadow-xs flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
                  >
                    {materialMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
