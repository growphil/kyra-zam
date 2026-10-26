"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Building2, 
  Layers, 
  Battery, 
  DollarSign, 
  Sliders, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Loader2, 
  Save, 
  Search, 
  CheckCircle2, 
  Info,
  Tag,
  Hash,
  Filter,
  ArrowRight,
  LayoutGrid,
  Boxes,
  FolderPlus,
  ChevronDown,
  Cpu,
  Zap,
  Star,
  Check,
  ShieldCheck,
  AlertCircle,
  Factory,
  FileText,
  Component,
  ExternalLink,
  Eye,
  RotateCcw,
  Package,
  Sparkles,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Minus,
  AlertTriangle,
  Wrench,
  Printer,
  GripVertical,
  Truck
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CompanyAssetsConfigSection from "./CompanyAssetsConfigSection";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";

export const getCurrencySymbol = (currency: string) => {
  switch (currency?.toUpperCase()) {
    case "ZMW":
      return "ZK";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "ZAR":
      return "R";
    case "INR":
    default:
      return "₹";
  }
};


const DEFAULT_PRESET_CATEGORIES = [
  "BMS",
  "BUSBAR",
  "INSULATION",
  "WIRE",
  "ENCLOSURE",
  "HARDWARE",
  "ELECTRONICS",
  "RAW_MATERIAL",
  "OTHER"
];

const UNIT_OPTIONS = ["PCS", "METER", "SET", "KG", "ROLL", "PAIR", "BOX", "LITER"];
const CHEMISTRY_OPTIONS = ["LFP", "NMC", "LTO", "Sodium-Ion", "Lead-Carbon", "Li-Polymer"];
const CELL_GRADE_OPTIONS = ["A+", "A", "B+", "B", "C"];

type FactorySection = "products" | "boms" | "materials" | "assets" | "cells" | "categories" | "financial" | "defaults" | "all";

const DEFAULT_MENU_KEYS: FactorySection[] = [
  "products",
  "boms",
  "materials",
  "assets",
  "cells",
  "categories",
  "financial",
  "defaults",
  "all"
];

export default function FactorySettingsTab() {
  const queryClient = useQueryClient();

  // --- SUB-SECTION SELECTOR & DRAGGABLE MENU ALIGNMENT ---
  const activeSection_initial: FactorySection = "products";
  const [activeSection, setActiveSection] = useState<FactorySection>(activeSection_initial);
  
  // Custom drag alignment order for menu tabs
  const [menuOrder, setMenuOrder] = useState<FactorySection[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(localStorage.getItem("factory_subnav_order") || "[]");
        if (Array.isArray(saved) && saved.length > 0) {
          const valid = saved.filter((k: string) => DEFAULT_MENU_KEYS.includes(k as FactorySection));
          const missing = DEFAULT_MENU_KEYS.filter(k => !valid.includes(k));
          return [...valid, ...missing];
        }
      } catch {}
    }
    return DEFAULT_MENU_KEYS;
  });

  const [draggedMenuKey, setDraggedMenuKey] = useState<FactorySection | null>(null);
  const [dragOverMenuKey, setDragOverMenuKey] = useState<FactorySection | null>(null);

  const handleMenuDragStart = (e: React.DragEvent, key: FactorySection) => {
    setDraggedMenuKey(key);
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleMenuDragOver = (e: React.DragEvent, targetKey: FactorySection) => {
    e.preventDefault();
    if (draggedMenuKey && draggedMenuKey !== targetKey) {
      setDragOverMenuKey(targetKey);
    }
  };

  const handleMenuDrop = (e: React.DragEvent, targetKey: FactorySection) => {
    e.preventDefault();
    if (!draggedMenuKey || draggedMenuKey === targetKey) {
      setDraggedMenuKey(null);
      setDragOverMenuKey(null);
      return;
    }

    setMenuOrder(prev => {
      const fromIdx = prev.indexOf(draggedMenuKey);
      const toIdx = prev.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("factory_subnav_order", JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    toast.success("Menu alignment updated", { duration: 1500 });
    setDraggedMenuKey(null);
    setDragOverMenuKey(null);
  };

  const handleMenuDragEnd = () => {
    setDraggedMenuKey(null);
    setDragOverMenuKey(null);
  };

  const handleResetMenuOrder = () => {
    setMenuOrder(DEFAULT_MENU_KEYS);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("factory_subnav_order");
      } catch {}
    }
    toast.info("Menu tabs reset to standard alignment");
  };

  // --- LOCAL STATES ---
  // Product / PaxType - Extended Configuration & BOM Details
  const [paxSearch, setPaxSearch] = useState("");
  const [isPaxModalOpen, setIsPaxModalOpen] = useState(false);
  const [selectedPaxType, setSelectedPaxType] = useState<any>(null);
  const [paxSelectedGrades, setPaxSelectedGrades] = useState<string[]>(["A+", "A"]);
  const [paxCellCount, setPaxCellCount] = useState<number>(16);
  const [selectedCellPartNumber, setSelectedCellPartNumber] = useState<string>("");
  const [selectedCellChemistry, setSelectedCellChemistry] = useState<string>("LFP");
  const [selectedBomId, setSelectedBomId] = useState<string>("");
  const [selectedBomNumber, setSelectedBomNumber] = useState<string>("");
  const [paxNominalVoltage, setPaxNominalVoltage] = useState<number>(48.0);
  const [paxNominalCapacity, setPaxNominalCapacity] = useState<number>(100.0);
  const [paxConfiguration, setPaxConfiguration] = useState<string>("16S1P");
  const [previewBomModalItem, setPreviewBomModalItem] = useState<any>(null);

  // BOM Management States
  const [bomSearch, setBomSearch] = useState("");
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState<any>(null);
  const [bomFormName, setBomFormName] = useState("");
  const [bomFormDescription, setBomFormDescription] = useState("");
  const [bomFormItems, setBomFormItems] = useState<{ materialId: string; quantity: number }[]>([]);
  const [onBomSavedCallback, setOnBomSavedCallback] = useState<((newBom: any) => void) | null>(null);
  const [bomQuickAddSearch, setBomQuickAddSearch] = useState("");
  const [activeBomRowSearchIdx, setActiveBomRowSearchIdx] = useState<number | null>(null);
  const [bomRowSearchText, setBomRowSearchText] = useState("");

  // BOM Modal Catalog Picker & Search States
  const [bomCatalogSearch, setBomCatalogSearch] = useState("");
  const [bomCatalogCategoryFilter, setBomCatalogCategoryFilter] = useState("ALL");
  const [bomCatalogPage, setBomCatalogPage] = useState(1);
  const [bomCatalogPerPage, setBomCatalogPerPage] = useState<number | "ALL">(6);

  // BOM Modal Added Items Pagination & Search
  const [bomAddedSearch, setBomAddedSearch] = useState("");
  const [bomAddedPage, setBomAddedPage] = useState(1);
  const [bomAddedPerPage, setBomAddedPerPage] = useState<number | "ALL">(10);

  // Global Delete Confirmation State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: "model" | "bom" | "material" | "cell" | "category" | "financialReset" | "defaultsReset";
    id?: string;
    title?: string;
    recordType?: string;
    recordIdentity?: string;
    description?: string;
    warningText?: string;
    hasDependencies?: boolean;
    confirmButtonText?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Materials & Cells
  const [materialSearch, setMaterialSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "QTZ" | "NQZ">("ALL");
  const [cellSearch, setCellSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  // Modals
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [materialTypeValue, setMaterialTypeValue] = useState<"QTZ" | "NQZ">("QTZ");
  const [materialFormSku, setMaterialFormSku] = useState("");
  const [materialFormName, setMaterialFormName] = useState("");
  const [materialFormCode, setMaterialFormCode] = useState("");
  const [materialFormUnit, setMaterialFormUnit] = useState("PCS");
  const [materialFormUnitPrice, setMaterialFormUnitPrice] = useState<number | string>(0);
  const [materialFormMinStock, setMaterialFormMinStock] = useState<number | string>(5);
  const [materialFormDescription, setMaterialFormDescription] = useState("");
  const [materialFormIsActive, setMaterialFormIsActive] = useState(true);

  // Deleted Categories tracking (persisted so preset categories can also be deleted)
  const [deletedCategoryNames, setDeletedCategoryNames] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("factory_deleted_categories") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<any>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  // Inline Category Creation in Material Modal
  const [isInlineCategoryOpen, setIsInlineCategoryOpen] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [selectedCategoryValue, setSelectedCategoryValue] = useState<string>("");

  // Financial Form State
  const [financialForm, setFinancialForm] = useState({
    defaultPaymentTerms: "100% Advance",
    defaultAdvancePercentage: 100,
    defaultFreightAmount: 0,
    defaultHandlingCharge: 0,
    defaultTaxRate: 18,
    defaultQuotationValidityDays: 30,
    defaultCurrency: "INR",
    minimumOrderValue: 0,
    // Shipping & Logistics Charge Configuration
    shippingCalculationMethod: "FLAT_RATE",
    freeShippingThreshold: 0,
    defaultShippingCarrier: "Standard Road Logistics",
    shippingTaxRate: 18,
    estimatedDeliveryLeadDays: 3
  });

  // Factory Defaults Form State
  const [defaultsForm, setDefaultsForm] = useState({
    defaultUnitSystem: "METRIC",
    defaultTimezone: "Asia/Kolkata",
    workingHoursPerDay: 8,
    productionDaysPerWeek: 6,
    defaultDeliveryTerms: "EXW - Ex Works"
  });

  // --- QUERIES ---
  const { data: paxTypes, isLoading: loadingPaxTypes } = useQuery({
    queryKey: ["admin-pax-types"],
    queryFn: async () => (await api.get("/admin/pax-types")).data
  });

  const { data: bomsList } = useQuery({
    queryKey: ["admin-boms"],
    queryFn: async () => (await api.get("/admin/boms")).data
  });

  const { data: materials, isLoading: loadingMaterials } = useQuery({
    queryKey: ["admin-factory-materials"],
    queryFn: async () => (await api.get("/admin/factory/material-mappings")).data
  });

  const { data: cellMappings, isLoading: loadingCells } = useQuery({
    queryKey: ["admin-factory-cells"],
    queryFn: async () => (await api.get("/admin/factory/cell-mappings")).data
  });

  const { data: materialCategories, isLoading: loadingCategories } = useQuery({
    queryKey: ["admin-factory-categories"],
    queryFn: async () => (await api.get("/admin/factory/material-categories")).data
  });

  const { data: financialSettings, isLoading: loadingFinancial } = useQuery({
    queryKey: ["admin-factory-financial"],
    queryFn: async () => (await api.get("/admin/factory/financial-settings")).data
  });

  const { data: factoryDefaults, isLoading: loadingDefaults } = useQuery({
    queryKey: ["admin-factory-defaults"],
    queryFn: async () => (await api.get("/admin/factory/defaults")).data
  });

  const { data: overviewStats } = useQuery({
    queryKey: ["admin-factory-overview"],
    queryFn: async () => (await api.get("/admin/factory/overview")).data
  });

  // Active production model in factory
  const activeProductionPax = (paxTypes || []).find((p: any) => p.isProductionActive);

  // Calculate Combined Available Categories (Strictly non-cell materials, excluding deleted categories)
  const allAvailableCategories = useMemo(() => {
    const raw = Array.from(
      new Set([
        ...DEFAULT_PRESET_CATEGORIES,
        ...(materialCategories || []).map((c: any) => c.name),
        ...(materials || []).map((m: any) => m.category).filter(Boolean)
      ])
    ).filter(cat => cat && cat.toUpperCase() !== "CELL");

    return raw.filter(cat => !deletedCategoryNames.includes(cat.toUpperCase())).sort();
  }, [materialCategories, materials, deletedCategoryNames]);

  // Sync Financial Settings Query
  useEffect(() => {
    if (financialSettings) {
      setFinancialForm({
        defaultPaymentTerms: financialSettings.defaultPaymentTerms || "100% Advance",
        defaultAdvancePercentage: financialSettings.defaultAdvancePercentage ?? 100,
        defaultFreightAmount: financialSettings.defaultFreightAmount ?? 0,
        defaultHandlingCharge: financialSettings.defaultHandlingCharge ?? 0,
        defaultTaxRate: financialSettings.defaultTaxRate ?? 18,
        defaultQuotationValidityDays: financialSettings.defaultQuotationValidityDays ?? 30,
        defaultCurrency: financialSettings.defaultCurrency || "INR",
        minimumOrderValue: financialSettings.minimumOrderValue ?? 0,
        shippingCalculationMethod: financialSettings.shippingCalculationMethod || "FLAT_RATE",
        freeShippingThreshold: financialSettings.freeShippingThreshold ?? 0,
        defaultShippingCarrier: financialSettings.defaultShippingCarrier || "Standard Road Logistics",
        shippingTaxRate: financialSettings.shippingTaxRate ?? financialSettings.defaultTaxRate ?? 18,
        estimatedDeliveryLeadDays: financialSettings.estimatedDeliveryLeadDays ?? 3
      });
    }
  }, [financialSettings]);

  // Sync Defaults Query
  useEffect(() => {
    if (factoryDefaults) {
      setDefaultsForm({
        defaultUnitSystem: factoryDefaults.defaultUnitSystem || "METRIC",
        defaultTimezone: factoryDefaults.defaultTimezone || "Asia/Kolkata",
        workingHoursPerDay: factoryDefaults.workingHoursPerDay ?? 8,
        productionDaysPerWeek: factoryDefaults.productionDaysPerWeek ?? 6,
        defaultDeliveryTerms: factoryDefaults.defaultDeliveryTerms || "EXW - Ex Works"
      });
    }
  }, [factoryDefaults]);

  // --- MUTATIONS ---

  // Save PaxType (Product Model)
  const savePaxTypeMutation = useMutation({
    mutationFn: async ({ payload, makeProductionActive }: { payload: any; makeProductionActive: boolean }) => {
      let res;
      if (selectedPaxType) {
        res = await api.patch(`/admin/pax-types/${selectedPaxType.id}`, payload);
      } else {
        res = await api.post("/admin/pax-types", payload);
      }

      const targetId = selectedPaxType ? selectedPaxType.id : res.data.id;
      if (makeProductionActive && targetId) {
        await api.post(`/admin/pax-types/${targetId}/set-production`);
      }

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types-packing"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["packing-material-configs"] });
      queryClient.invalidateQueries({ queryKey: ["packing-queue"] });
      queryClient.invalidateQueries({ queryKey: ["packing-stats"] });
      toast.success(selectedPaxType ? "Production model updated successfully" : "New production model registered successfully");
      setIsPaxModalOpen(false);
      setSelectedPaxType(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save production model");
    }
  });

  // Delete PaxType
  const deletePaxTypeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/pax-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("Production model deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete production model");
    }
  });

  // Set Active Production Model
  const setProductionActiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/pax-types/${id}/set-production`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(`Factory Active Model set to "${res.data.activeModel || "Selected Model"}"`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to set active production model");
    }
  });

  // Clear Active Production Model
  const clearProductionActiveMutation = useMutation({
    mutationFn: () => api.post("/admin/pax-types/clear-production"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.info("Production model cleared. System is now using Global Fallback QC Rules.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to clear active production model");
    }
  });

  // Save BOM Master Template
  const saveBomMutation = useMutation({
    mutationFn: async (data: { id?: string; name: string; description?: string; items: { materialId: string; quantity: number }[] }) => {
      if (data.id) {
        return (await api.patch(`/admin/boms/${data.id}`, { name: data.name, description: data.description, items: data.items })).data;
      }
      return (await api.post("/admin/boms", { name: data.name, description: data.description, items: data.items })).data;
    },
    onSuccess: (savedBom) => {
      queryClient.invalidateQueries({ queryKey: ["admin-boms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(selectedBom ? `BOM "${savedBom.name}" updated successfully` : `BOM "${savedBom.name}" registered successfully`);
      setIsBomModalOpen(false);
      
      if (onBomSavedCallback) {
        onBomSavedCallback(savedBom);
        setOnBomSavedCallback(null);
      } else if (isPaxModalOpen) {
        setSelectedBomId(savedBom.id);
        setSelectedBomNumber(savedBom.name);
      }
      setSelectedBom(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save BOM template");
    }
  });

  // Delete BOM Master Template
  const deleteBomMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/boms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-boms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pax-types"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("BOM template deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete BOM template");
    }
  });

  // Save Material Mapping
  const saveMaterialMutation = useMutation({
    mutationFn: (data: any) => {
      if (selectedMaterial) {
        return api.patch(`/admin/factory/material-mappings/${selectedMaterial.id}`, data);
      }
      return api.post("/admin/factory/material-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(selectedMaterial ? "Material Part Number updated" : "Material Part Number registered");
      setIsMaterialModalOpen(false);
      setSelectedMaterial(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save material mapping");
    }
  });

  // Toggle Material Status
  const toggleMaterialMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/factory/material-mappings/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("Material mapping status updated");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update material status");
    }
  });

  // Save Cell Mapping
  const saveCellMutation = useMutation({
    mutationFn: (data: any) => {
      if (selectedCell) {
        return api.patch(`/admin/factory/cell-mappings/${selectedCell.id}`, data);
      }
      return api.post("/admin/factory/cell-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-cells"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inward-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(selectedCell ? "Cell SKU mapping updated" : "Cell SKU mapping registered");
      setIsCellModalOpen(false);
      setSelectedCell(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to save cell mapping");
    }
  });

  // Toggle Cell Status
  const toggleCellMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/factory/cell-mappings/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-cells"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inward-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("Cell mapping status updated");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update cell status");
    }
  });

  // Create Material Category
  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => api.post("/admin/factory/material-categories", { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      const createdName = (res.data?.name || "").toUpperCase();
      setDeletedCategoryNames(prev => {
        const next = prev.filter(c => c !== createdName);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("factory_deleted_categories", JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      toast.success(`Material category "${res.data.name}" created`);
      setNewCategoryInput("");
      setIsCategoryModalOpen(false);
      
      if (isInlineCategoryOpen) {
        setSelectedCategoryValue(res.data.name);
        setIsInlineCategoryOpen(false);
        setInlineCategoryName("");
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to create category");
    }
  });

  // Delete Material Category
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/factory/material-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("Material category deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete category");
    }
  });

  // Delete Material Mapping
  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/factory/material-mappings/${id}`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-products"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-materials"] });
      toast.success(res?.data?.message || "Material and catalog products permanently deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete material");
    }
  });

  // Delete Cell Mapping
  const deleteCellMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/factory/cell-mappings/${id}`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-cells"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-products"] });
      queryClient.invalidateQueries({ queryKey: ["inward-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(res?.data?.message || "Cell Part Number deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete cell part number");
    }
  });

  // Save Financial Settings
  const saveFinancialMutation = useMutation({
    mutationFn: (data: typeof financialForm) => api.put("/admin/factory/financial-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-financial"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("Factory financial settings saved");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save financial settings");
    }
  });

  // Reset Financial Settings to standard defaults
  const resetFinancialMutation = useMutation({
    mutationFn: () => api.post("/admin/factory/financial-settings/reset"),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-financial"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      if (res?.data) {
        setFinancialForm({
          defaultPaymentTerms: res.data.defaultPaymentTerms || "100% Advance",
          defaultAdvancePercentage: res.data.defaultAdvancePercentage ?? 100,
          defaultFreightAmount: res.data.defaultFreightAmount ?? 0,
          defaultHandlingCharge: res.data.defaultHandlingCharge ?? 0,
          defaultTaxRate: res.data.defaultTaxRate ?? 18,
          defaultQuotationValidityDays: res.data.defaultQuotationValidityDays ?? 30,
          defaultCurrency: res.data.defaultCurrency || "INR",
          minimumOrderValue: res.data.minimumOrderValue ?? 0,
          shippingCalculationMethod: res.data.shippingCalculationMethod || "FLAT_RATE",
          freeShippingThreshold: res.data.freeShippingThreshold ?? 0,
          defaultShippingCarrier: res.data.defaultShippingCarrier || "Standard Road Logistics",
          shippingTaxRate: res.data.shippingTaxRate ?? 18,
          estimatedDeliveryLeadDays: res.data.estimatedDeliveryLeadDays ?? 3
        });
      }
      toast.success("Financial defaults reset to system standards");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to reset financial settings");
    }
  });

  // Save Factory Defaults
  const saveDefaultsMutation = useMutation({
    mutationFn: (data: typeof defaultsForm) => api.put("/admin/factory/defaults", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-defaults"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success("Factory operational defaults saved");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save factory defaults");
    }
  });

  // Reset Operational Factory Defaults
  const resetDefaultsMutation = useMutation({
    mutationFn: () => api.post("/admin/factory/defaults/reset"),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factory-defaults"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      if (res?.data) {
        setDefaultsForm({
          defaultUnitSystem: res.data.defaultUnitSystem || "METRIC",
          defaultTimezone: res.data.defaultTimezone || "Asia/Kolkata",
          workingHoursPerDay: res.data.workingHoursPerDay ?? 8,
          productionDaysPerWeek: res.data.productionDaysPerWeek ?? 6,
          defaultDeliveryTerms: res.data.defaultDeliveryTerms || "EXW - Ex Works"
        });
      }
      toast.success("Operational defaults reset to system standards");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to reset factory defaults");
    }
  });

  // --- MODAL HANDLERS ---
  const handleOpenPaxModal = (pax: any = null) => {
    setSelectedPaxType(pax);
    setPaxSelectedGrades(pax?.allowedGrades && pax.allowedGrades.length > 0 ? pax.allowedGrades : ["A+", "A"]);
    setPaxCellCount(pax?.cellCount || 16);
    setSelectedCellPartNumber(pax?.cellPartNumber || "");
    setSelectedCellChemistry(pax?.cellChemistry || "LFP");
    setSelectedBomId(pax?.bomId || "");
    setSelectedBomNumber(pax?.bomNumber || (pax?.bom?.name || ""));
    setPaxNominalVoltage(pax?.nominalVoltage || (pax?.cellCount ? Number((pax.cellCount * 3.2).toFixed(1)) : 48.0));
    setPaxNominalCapacity(pax?.nominalCapacity || (pax ? Number(((pax.ahMin + pax.ahMax) / 2).toFixed(1)) : 100.0));
    setPaxConfiguration(pax?.configuration || (pax?.cellCount ? `${pax.cellCount}S1P` : "16S1P"));

    setIsPaxModalOpen(true);
  };

  const handlePaxFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string || "").trim();
    const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
    const cellCount = parseInt(formData.get("cellCount") as string, 10) || paxCellCount || 16;
    const cellPartNumber = selectedCellPartNumber.trim() || null;
    const cellChemistry = selectedCellChemistry.trim() || "LFP";
    const nominalVoltage = parseFloat(formData.get("nominalVoltage") as string) || paxNominalVoltage || 48.0;
    const nominalCapacity = parseFloat(formData.get("nominalCapacity") as string) || paxNominalCapacity || null;
    const configuration = (formData.get("configuration") as string || paxConfiguration || "16S1P").trim();
    const bomId = selectedBomId.trim() || null;
    const bomNumber = selectedBomNumber.trim() || null;
    const description = (formData.get("description") as string || "").trim() || null;

    const ahMin = parseFloat(formData.get("ahMin") as string);
    const ahMax = parseFloat(formData.get("ahMax") as string);
    const irMin = parseFloat(formData.get("irMin") as string);
    const irMax = parseFloat(formData.get("irMax") as string);
    const retestAhMargin = parseFloat(formData.get("retestAhMargin") as string) || 0.1;
    const retestIrMargin = parseFloat(formData.get("retestIrMargin") as string) || 2.0;
    const hardFailAh = parseFloat(formData.get("hardFailAh") as string) || 3.0;
    const hardFailIr = parseFloat(formData.get("hardFailIr") as string) || 70.0;
    const maxAhDifference = parseFloat(formData.get("maxAhDifference") as string) || 0.05;
    const maxIrDifference = parseFloat(formData.get("maxIrDifference") as string) || 3.0;
    const autoPackEnabled = formData.get("autoPackEnabled") === "on";
    const makeProductionActive = formData.get("isProductionActive") === "on";

    if (!name) {
      toast.error("Model Name / SKU is required");
      return;
    }
    if (isNaN(ahMin) || isNaN(ahMax) || ahMin <= 0 || ahMax <= 0) {
      toast.error("Please enter valid positive numbers for Ah range");
      return;
    }
    if (ahMin > ahMax) {
      toast.error("Minimum Ah cannot exceed Maximum Ah");
      return;
    }
    if (isNaN(irMin) || isNaN(irMax) || irMin <= 0 || irMax <= 0) {
      toast.error("Please enter valid positive numbers for IR range");
      return;
    }
    if (irMin > irMax) {
      toast.error("Minimum IR cannot exceed Maximum IR");
      return;
    }
    if (paxSelectedGrades.length === 0) {
      toast.error("Select at least one allowed cell grade");
      return;
    }

    const payload: any = {
      name,
      cellPartNumber,
      cellChemistry,
      nominalVoltage,
      nominalCapacity,
      configuration,
      bomId,
      bomNumber,
      description,
      unitPrice,
      cellCount,
      ahMin,
      ahMax,
      irMin,
      irMax,
      retestAhMargin,
      retestIrMargin,
      hardFailAh,
      hardFailIr,
      allowedGrades: paxSelectedGrades,
      maxAhDifference,
      maxIrDifference,
      autoPackEnabled
    };

    savePaxTypeMutation.mutate({
      payload,
      makeProductionActive
    });
  };

  const handleOpenBomModal = (bom: any = null, callback?: (newBom: any) => void) => {
    setSelectedBom(bom);
    setBomFormName(bom?.name || "");
    setBomFormDescription(bom?.description || "");
    if (bom?.items && bom.items.length > 0) {
      setBomFormItems(bom.items.map((it: any) => ({
        materialId: it.materialId || it.material?.id,
        quantity: it.quantity || 1
      })));
    } else {
      const firstMat = (materials || [])[0];
      setBomFormItems(firstMat ? [{ materialId: firstMat.id, quantity: 1 }] : []);
    }
    if (callback) {
      setOnBomSavedCallback(() => callback);
    } else {
      setOnBomSavedCallback(null);
    }
    // Reset modal filters & pagination
    setBomCatalogSearch("");
    setBomCatalogCategoryFilter("ALL");
    setBomCatalogPage(1);
    setBomCatalogPerPage(6);
    setBomAddedSearch("");
    setBomAddedPage(1);
    setBomAddedPerPage(10);
    setIsBomModalOpen(true);
  };

  const handleAddBomItemRow = () => {
    const unselected = (materials || []).find((m: any) => !bomFormItems.some(item => item.materialId === m.id));
    const matToUse = unselected || (materials || [])[0];
    if (matToUse) {
      setBomFormItems(prev => [...prev, { materialId: matToUse.id, quantity: 1 }]);
    } else {
      toast.error("No materials found in catalog. Please register materials first.");
    }
  };

  const handleQuickAddBomMaterial = (mat: any) => {
    if (!mat) return;
    const exists = bomFormItems.some(it => it.materialId === mat.id);
    if (exists) {
      toast.info(`Material "${mat.sku}" is already in BOM. Incremented quantity.`);
      setBomFormItems(prev => prev.map(it => it.materialId === mat.id ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setBomFormItems(prev => [...prev, { materialId: mat.id, quantity: 1 }]);
      toast.success(`Added ${mat.sku} (${mat.name})`);
    }
    setBomQuickAddSearch("");
  };

  const handleDecrementBomMaterial = (matId: string) => {
    setBomFormItems(prev => {
      const target = prev.find(it => it.materialId === matId);
      if (!target) return prev;
      if (target.quantity <= 1) {
        return prev.filter(it => it.materialId !== matId);
      }
      return prev.map(it => it.materialId === matId ? { ...it, quantity: it.quantity - 1 } : it);
    });
  };

  const handleBomItemStepQty = (originalIdx: number, delta: number) => {
    setBomFormItems(prev => {
      const copy = [...prev];
      if (copy[originalIdx]) {
        const nextQty = Math.max(1, (copy[originalIdx].quantity || 1) + delta);
        copy[originalIdx] = {
          ...copy[originalIdx],
          quantity: nextQty
        };
      }
      return copy;
    });
  };

  const handleRemoveBomItemRow = (idx: number) => {
    setBomFormItems(prev => prev.filter((_, i) => i !== idx));
    if (activeBomRowSearchIdx === idx) {
      setActiveBomRowSearchIdx(null);
      setBomRowSearchText("");
    }
  };

  const handleBomItemChange = (idx: number, field: "materialId" | "quantity", val: any) => {
    setBomFormItems(prev => {
      const copy = [...prev];
      if (copy[idx]) {
        if (field === "quantity") {
          copy[idx].quantity = Math.max(1, parseInt(val, 10) || 1);
        } else {
          copy[idx].materialId = val;
        }
      }
      return copy;
    });
  };

  // --- BOM Modal Memoized Filters & Pagination ---
  const filteredCatalogMaterials = useMemo(() => {
    const list = materials || [];
    const q = bomCatalogSearch.toLowerCase().trim();
    return list.filter((m: any) => {
      if (bomCatalogCategoryFilter !== "ALL" && (m.category || "").toUpperCase() !== bomCatalogCategoryFilter.toUpperCase()) {
        return false;
      }
      if (!q) return true;
      const sku = (m.sku || "").toLowerCase();
      const name = (m.name || "").toLowerCase();
      const code = (m.materialCode || "").toLowerCase();
      const cat = (m.category || "").toLowerCase();
      const desc = (m.description || "").toLowerCase();
      const unit = (m.unit || "").toLowerCase();
      return (
        sku.includes(q) ||
        name.includes(q) ||
        code.includes(q) ||
        cat.includes(q) ||
        desc.includes(q) ||
        unit.includes(q)
      );
    });
  }, [materials, bomCatalogSearch, bomCatalogCategoryFilter]);

  const catalogTotalPages = useMemo(() => {
    if (bomCatalogPerPage === "ALL") return 1;
    return Math.max(1, Math.ceil(filteredCatalogMaterials.length / (bomCatalogPerPage as number)));
  }, [filteredCatalogMaterials.length, bomCatalogPerPage]);

  const currentCatalogPage = Math.min(bomCatalogPage, catalogTotalPages);

  const paginatedCatalogMaterials = useMemo(() => {
    if (bomCatalogPerPage === "ALL") return filteredCatalogMaterials;
    const start = (currentCatalogPage - 1) * (bomCatalogPerPage as number);
    return filteredCatalogMaterials.slice(start, start + (bomCatalogPerPage as number));
  }, [filteredCatalogMaterials, currentCatalogPage, bomCatalogPerPage]);

  const indexedBomItems = useMemo(() => {
    return bomFormItems.map((item, originalIndex) => {
      const mat = (materials || []).find((m: any) => m.id === item.materialId);
      return {
        ...item,
        originalIndex,
        material: mat
      };
    });
  }, [bomFormItems, materials]);

  const filteredAddedBomItems = useMemo(() => {
    const q = bomAddedSearch.toLowerCase().trim();
    if (!q) return indexedBomItems;
    return indexedBomItems.filter((item) => {
      const mat = item.material;
      if (!mat) return false;
      const sku = (mat.sku || "").toLowerCase();
      const name = (mat.name || "").toLowerCase();
      const code = (mat.materialCode || "").toLowerCase();
      const cat = (mat.category || "").toLowerCase();
      const desc = (mat.description || "").toLowerCase();
      const unit = (mat.unit || "").toLowerCase();
      return (
        sku.includes(q) ||
        name.includes(q) ||
        code.includes(q) ||
        cat.includes(q) ||
        desc.includes(q) ||
        unit.includes(q)
      );
    });
  }, [indexedBomItems, bomAddedSearch]);

  const addedTotalPages = useMemo(() => {
    if (bomAddedPerPage === "ALL") return 1;
    return Math.max(1, Math.ceil(filteredAddedBomItems.length / (bomAddedPerPage as number)));
  }, [filteredAddedBomItems.length, bomAddedPerPage]);

  const currentAddedPage = Math.min(bomAddedPage, addedTotalPages);

  const paginatedAddedBomItems = useMemo(() => {
    if (bomAddedPerPage === "ALL") return filteredAddedBomItems;
    const start = (currentAddedPage - 1) * (bomAddedPerPage as number);
    return filteredAddedBomItems.slice(start, start + (bomAddedPerPage as number));
  }, [filteredAddedBomItems, currentAddedPage, bomAddedPerPage]);

  const totalBomPiecesCount = useMemo(() => {
    return bomFormItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [bomFormItems]);

  const handleBomFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = bomFormName.trim();
    if (!name) {
      toast.error("BOM Drawing Code / Name is required");
      return;
    }
    if (bomFormItems.length === 0) {
      toast.error("Please add at least one component material to the BOM");
      return;
    }

    // 1. Check for missing material selections
    for (const item of bomFormItems) {
      if (!item.materialId) {
        toast.error("Please select a material for all BOM items");
        return;
      }
    }

    // 2. Duplicate validation
    const seenIds = new Set<string>();
    for (const item of bomFormItems) {
      if (seenIds.has(item.materialId)) {
        const dupMat = (materials || []).find((m: any) => m.id === item.materialId);
        toast.error(`Duplicate material "${dupMat?.name || dupMat?.sku || item.materialId}" in BOM. Please combine quantities into a single row.`);
        return;
      }
      seenIds.add(item.materialId);
    }

    // 3. Verify material identity in active catalog
    for (const item of bomFormItems) {
      const exists = (materials || []).some((m: any) => m.id === item.materialId);
      if (!exists) {
        toast.error("One or more selected materials could not be verified in the active catalog.");
        return;
      }
    }

    saveBomMutation.mutate({
      id: selectedBom?.id,
      name,
      description: bomFormDescription.trim() || undefined,
      items: bomFormItems
    });
  };

  const handleOpenMaterialModal = (material: any = null) => {
    setSelectedMaterial(material);
    setMaterialFormSku(material?.sku || "");
    setMaterialFormName(material?.name || "");
    setMaterialFormCode(material?.materialCode || "");
    setMaterialFormUnit(material?.unit || "PCS");
    setMaterialFormUnitPrice(material?.unitPrice ?? 0);
    setMaterialFormMinStock(material?.minStock ?? 5);
    setMaterialFormDescription(material?.description || "");
    setMaterialFormIsActive(material ? material.isActive !== false : true);
    setSelectedCategoryValue(material?.category || allAvailableCategories[0] || "BMS");
    setMaterialTypeValue((material?.materialType as "QTZ" | "NQZ") || "QTZ");
    setIsInlineCategoryOpen(false);
    setInlineCategoryName("");
    setIsMaterialModalOpen(true);
  };

  const handleOpenCellModal = (cell: any = null) => {
    setSelectedCell(cell);
    setIsCellModalOpen(true);
  };

  // Real-time duplicate part number validation for Material Modal
  const trimmedMaterialSku = materialFormSku.trim().toUpperCase();
  const duplicateMaterial = useMemo(() => {
    if (!trimmedMaterialSku) return null;
    return (materials || []).find(
      (m: any) => m.sku?.trim().toUpperCase() === trimmedMaterialSku && m.id !== selectedMaterial?.id
    );
  }, [materials, trimmedMaterialSku, selectedMaterial]);

  const duplicateCellForMaterial = useMemo(() => {
    if (!trimmedMaterialSku) return null;
    return (cellMappings || []).find(
      (c: any) => c.cellSku?.trim().toUpperCase() === trimmedMaterialSku
    );
  }, [cellMappings, trimmedMaterialSku]);

  const materialSkuConflict = duplicateMaterial || duplicateCellForMaterial;

  const handleMaterialFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sku = materialFormSku.trim();
    const name = materialFormName.trim();
    const category = selectedCategoryValue.trim();
    const materialCode = materialFormCode.trim() || null;
    const unit = materialFormUnit.trim().toUpperCase() || "PCS";
    const description = materialFormDescription.trim() || null;
    const minStock = parseInt(String(materialFormMinStock), 10) || 0;
    const unitPrice = parseFloat(String(materialFormUnitPrice)) || 0;
    const isActive = materialFormIsActive;

    if (!sku || !name || !category) {
      toast.error("Part Number (SKU), Material Name, and Category are required.");
      return;
    }

    // Check for duplicate SKU in materials
    const dupMat = (materials || []).find(
      (m: any) => m.sku?.trim().toUpperCase() === sku.toUpperCase() && m.id !== selectedMaterial?.id
    );
    if (dupMat) {
      toast.error(`Part Number / SKU "${sku}" already exists for material "${dupMat.name}". Duplicate part numbers are not allowed.`);
      return;
    }

    // Check for duplicate SKU in cells
    const dupCell = (cellMappings || []).find(
      (c: any) => c.cellSku?.trim().toUpperCase() === sku.toUpperCase()
    );
    if (dupCell) {
      toast.error(`Part Number / SKU "${sku}" is already registered as a Cell Part Number ("${dupCell.cellName}"). Please use a unique SKU.`);
      return;
    }

    saveMaterialMutation.mutate({
      name,
      materialCode,
      sku,
      category,
      unit,
      description,
      minStock,
      unitPrice,
      materialType: materialTypeValue,
      isActive
    });
  };

  const handleCellFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cellSku = (formData.get("cellSku") as string || "").trim();
    const cellName = (formData.get("cellName") as string || "").trim();
    const chemistry = (formData.get("chemistry") as string || "LFP").trim().toUpperCase();
    const nominalVoltage = parseFloat(formData.get("nominalVoltage") as string) || 3.2;
    const nominalCapacity = parseFloat(formData.get("nominalCapacity") as string) || 3.2;
    const supplier = (formData.get("supplier") as string || "").trim() || null;
    const description = (formData.get("description") as string || "").trim() || null;
    const isActive = formData.get("isActive") === "on";

    if (!cellSku || !cellName) {
      toast.error("Cell Part Number / SKU and Cell Name are required.");
      return;
    }

    if (nominalVoltage <= 0 || nominalCapacity <= 0) {
      toast.error("Nominal voltage and capacity must be positive numbers.");
      return;
    }

    saveCellMutation.mutate({
      cellSku,
      cellName,
      chemistry,
      nominalVoltage,
      nominalCapacity,
      supplier,
      description,
      isActive
    });
  };

  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) {
      toast.error("Please enter a category name");
      return;
    }
    createCategoryMutation.mutate(trimmed);
  };

  const handleInlineCreateCategory = () => {
    const trimmed = inlineCategoryName.trim();
    if (!trimmed) {
      toast.error("Please enter a category name");
      return;
    }
    createCategoryMutation.mutate(trimmed);
  };

  // --- FILTERED DATA ---
  const filteredPaxTypes = (paxTypes || []).filter((p: any) => {
    const q = paxSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      String(p.cellCount)?.includes(q) ||
      p.allowedGrades?.some((g: string) => g.toLowerCase().includes(q))
    );
  });

  const filteredMaterials = (materials || []).filter((m: any) => {
    const q = materialSearch.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      m.name?.toLowerCase().includes(q) ||
      m.sku?.toLowerCase().includes(q) ||
      m.materialCode?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q);
    const matchesCategory = 
      categoryFilter === "ALL" || 
      (m.category && m.category.trim().toLowerCase() === categoryFilter.trim().toLowerCase());
    const matchesType = typeFilter === "ALL" || (m.materialType || "QTZ") === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const filteredCells = (cellMappings || []).filter((c: any) => {
    const q = cellSearch.toLowerCase();
    return (
      c.cellName?.toLowerCase().includes(q) ||
      c.cellSku?.toLowerCase().includes(q) ||
      c.chemistry?.toLowerCase().includes(q) ||
      c.supplier?.toLowerCase().includes(q)
    );
  });

  const filteredBoms = (bomsList || []).filter((b: any) => {
    const q = bomSearch.toLowerCase();
    return (
      b.name?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.items?.some((it: any) => it.material?.name?.toLowerCase().includes(q) || it.material?.sku?.toLowerCase().includes(q))
    );
  });

  const filteredCategories = (allAvailableCategories || []).filter((cat: string) => {
    return cat.toLowerCase().includes(categorySearch.toLowerCase());
  });

  const sectionsConfig: { key: FactorySection; label: string; fullLabel: string; icon: any; count?: number | string }[] = [
    { key: "products", label: "Production Models", fullLabel: "Production Product Models & Specs", icon: Cpu, count: paxTypes?.length || 0 },
    { key: "boms", label: "BOM Templates", fullLabel: "BOM Master Templates", icon: Component, count: bomsList?.length || 0 },
    { key: "materials", label: "Material SKUs", fullLabel: "Material Catalog (Non-Cell SKUs)", icon: Layers, count: materials?.length || 0 },
    { key: "assets", label: "Company Assets", fullLabel: "Company Asset Register & Capital Equipment", icon: Wrench, count: overviewStats?.assetCount !== undefined ? `${overviewStats.assetCount} Assets` : "Register" },
    { key: "cells", label: "Cell Part Numbers", fullLabel: "Cell Part Numbers & Chemistries", icon: Battery, count: cellMappings?.length || 0 },
    { key: "categories", label: "Categories", fullLabel: "Material Custom Categories", icon: Tag, count: allAvailableCategories.length },
    { key: "financial", label: "Financial & Shipping", fullLabel: "Financial, Operating Currency & Shipping Configuration", icon: DollarSign, count: `${financialForm.defaultCurrency} (${getCurrencySymbol(financialForm.defaultCurrency)})` },
    { key: "defaults", label: "Shift & Defaults", fullLabel: "Factory Shift & Operational Defaults", icon: Sliders, count: `${defaultsForm.workingHoursPerDay}h` },
    { key: "all", label: "All Settings", fullLabel: "View All Settings & Configurations", icon: LayoutGrid }
  ];

  const orderedSectionsConfig = useMemo(() => {
    const configMap = new Map(sectionsConfig.map((s) => [s.key, s]));
    const list: typeof sectionsConfig = [];
    menuOrder.forEach((key) => {
      const item = configMap.get(key);
      if (item) list.push(item);
    });
    // Fallback: any section not in menuOrder is appended
    sectionsConfig.forEach((s) => {
      if (!list.some((item) => item.key === s.key)) {
        list.push(s);
      }
    });
    return list;
  }, [menuOrder, sectionsConfig]);

  const isCustomOrder = useMemo(() => {
    return JSON.stringify(menuOrder) !== JSON.stringify(DEFAULT_MENU_KEYS);
  }, [menuOrder]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Sub-Navigator Tabs with Drag Alignment & Full-Name Hover Tooltips */}
      <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-[#D8E8FA] shadow-2xs space-y-2">
        <div className="flex items-center justify-between px-1 border-b border-[#EAF2FC] pb-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-[#526B91]">
            <GripVertical className="w-3.5 h-3.5 text-[#0878F9]" />
            <span className="font-semibold text-slate-700">Factory Navigation</span>
            <span className="text-[11px] text-[#526B91]/80 hidden sm:inline">• Drag tabs horizontally to re-align menus</span>
          </div>
          {isCustomOrder && (
            <button
              type="button"
              onClick={handleResetMenuOrder}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-[#0878F9] hover:bg-[#EAF5FF] transition-all cursor-pointer border border-[#D8E8FA]"
              title="Reset to default menu alignment"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Alignment</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {orderedSectionsConfig.map((sec) => {
            const isCurrent = activeSection === sec.key;
            const isBeingDragged = draggedMenuKey === sec.key;
            const isDragOver = dragOverMenuKey === sec.key;
            const Icon = sec.icon;

            return (
              <button
                key={sec.key}
                type="button"
                draggable={true}
                onDragStart={(e) => handleMenuDragStart(e, sec.key)}
                onDragOver={(e) => handleMenuDragOver(e, sec.key)}
                onDrop={(e) => handleMenuDrop(e, sec.key)}
                onDragEnd={handleMenuDragEnd}
                title={`${sec.fullLabel} (Drag to re-align)`}
                onClick={() => setActiveSection(sec.key)}
                className={`group relative flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-grab active:cursor-grabbing select-none whitespace-nowrap ${
                  isBeingDragged 
                    ? "opacity-35 scale-95 border-dashed border-[#0878F9] bg-[#EAF5FF]" 
                    : isDragOver
                    ? "ring-2 ring-[#0878F9] bg-[#EAF5FF] border-[#0878F9] scale-105"
                    : isCurrent 
                    ? "bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/40 shadow-2xs font-bold" 
                    : "bg-white text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF] border border-slate-200/70"
                }`}
              >
                {/* Floating Hover Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 transform scale-95 group-hover:scale-100 z-50">
                  <div className="bg-[#061B3A] text-white text-[11px] font-semibold py-1 px-2.5 rounded-lg shadow-xl border border-[#1E3A8A] whitespace-nowrap flex items-center gap-1.5">
                    <Icon className="w-3 h-3 text-[#0878F9]" />
                    <span>{sec.fullLabel}</span>
                    <span className="text-[10px] text-blue-300 ml-1">⋮⋮ Drag</span>
                  </div>
                  <div className="w-2 h-2 bg-[#061B3A] border-r border-b border-[#1E3A8A] rotate-45 mx-auto -mt-1" />
                </div>

                {/* Grip Handle */}
                <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-[#0878F9] shrink-0 -mr-0.5 transition-colors" />

                <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isCurrent ? "text-[#0878F9]" : "text-[#526B91] group-hover:text-[#0878F9]"}`} />
                <span>{sec.label}</span>
                {sec.count !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    isCurrent 
                      ? "bg-[#0878F9]/15 text-[#0878F9] border border-[#0878F9]/30" 
                      : "bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA]"
                  }`}>
                    {sec.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 0: PRODUCTION PRODUCT MODELS & SPECS */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "products") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  Production Product Models & Specs
                </h3>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md text-[11px] font-mono font-semibold border border-blue-200 dark:border-blue-800">
                  {paxTypes?.length || 0} Models
                </span>
              </div>
              <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
                Define and configure battery pack product models, cell series counts, capacity (Ah) bands, IR tolerance limits, and active factory production specifications.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={paxSearch}
                  onChange={(e) => setPaxSearch(e.target.value)}
                  placeholder="Search model, cells, grade..."
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button 
                type="button"
                onClick={() => handleOpenPaxModal(null)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Production Model
              </button>
            </div>
          </div>

          {/* Active Production Model Banner */}
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-white border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                activeProductionPax 
                  ? "bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/20" 
                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
              }`}>
                {activeProductionPax ? <Factory className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                  <span>Factory Active Production Model:</span>
                  {activeProductionPax ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-[#166534] text-[11px] font-mono font-bold border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {activeProductionPax.name} ({activeProductionPax.cellCount}S • {activeProductionPax.ahMin}-{activeProductionPax.ahMax} Ah)
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 font-semibold text-xs">
                      No active model selected (Using Global QC Fallback)
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-[#526B91] dark:text-[#526B91]">
                  {activeProductionPax 
                    ? "Inward cell QC grading, clustering delta checks, and automatic pack pairing are strictly bound to this model."
                    : "Activate any model below to enforce strict product tolerances during cell testing and assembly."}
                </p>
              </div>
            </div>

            {activeProductionPax && (
              <button
                type="button"
                onClick={() => clearProductionActiveMutation.mutate()}
                disabled={clearProductionActiveMutation.isPending}
                className="self-start sm:self-center text-xs font-medium text-[#526B91] dark:text-[#526B91] hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-300 transition-all cursor-pointer whitespace-nowrap"
              >
                {clearProductionActiveMutation.isPending ? "Clearing..." : "Switch to Global Fallback"}
              </button>
            )}
          </div>

          {loadingPaxTypes ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#526B91]">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Loading production models...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 font-semibold text-[#526B91] dark:text-[#526B91] w-14 text-center">S.No</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Product Model / Name</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Cell Part # / Chemistry</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">BOM Connection</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Standard Price (₹)</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Cell Topology</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Capacity Band (Ah)</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">IR Limits (mΩ)</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Allowed Grades</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Production Status</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredPaxTypes.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-[#526B91] text-xs">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <Cpu className="w-8 h-8 text-[#0B2148] dark:text-[#526B91]" />
                          <p className="font-semibold text-slate-700 dark:text-[#0B2148]">
                            {paxSearch ? "No production models match your search query." : "No product models configured yet."}
                          </p>
                          <p className="text-[11px] text-[#526B91]">
                            Click &ldquo;Add Production Model&rdquo; to register your battery pack variants, cell part numbers, linked BOMs, and quality criteria.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleOpenPaxModal(null)}
                            className="mt-2 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-xl text-white font-semibold text-xs shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add First Product Model
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPaxTypes.map((pax: any, idx: number) => {
                      const isActive = !!pax.isProductionActive;
                      const linkedBom = pax.bom || (bomsList || []).find((b: any) => b.id === pax.bomId);
                      const bomItemsCount = linkedBom?.items?.length || 0;

                      return (
                        <tr 
                          key={pax.id} 
                          className={`transition-colors ${
                            isActive 
                              ? "bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20" 
                              : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          {/* Serial Number */}
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-xs text-[#526B91]">
                            {idx + 1}
                          </td>

                          {/* Model Identity */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 dark:text-[#0B2148] font-mono text-[13px]">{pax.name}</p>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#166534] text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-semibold text-[#526B91] dark:text-[#0B2148]">
                                {pax.configuration || `${pax.cellCount}S1P`}
                              </span>
                              <span className="text-[10px] text-[#526B91] font-mono">
                                {pax.nominalVoltage ? `${pax.nominalVoltage}V` : `${(pax.cellCount * 3.2).toFixed(1)}V`}
                              </span>
                              {pax.description && (
                                <span className="text-[10px] text-[#526B91] truncate max-w-[120px]" title={pax.description}>
                                  • {pax.description}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Connected Cell Part Number & Chemistry */}
                          <td className="px-5 py-3.5">
                            {pax.cellPartNumber ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-mono font-bold border border-blue-200 dark:border-blue-800">
                                  <Battery className="w-3 h-3 text-blue-500" />
                                  {pax.cellPartNumber}
                                </span>
                                <p className="text-[10px] text-[#526B91] font-mono mt-0.5">
                                  {pax.cellChemistry || "LFP"} • {pax.nominalCapacity ? `${pax.nominalCapacity}Ah` : `${pax.ahMin}Ah`}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[#526B91] italic text-[11px]">Unassigned Cell Part</span>
                            )}
                          </td>

                          {/* BOM Connection & Details */}
                          <td className="px-5 py-3.5">
                            {linkedBom || pax.bomNumber ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-mono font-bold border border-purple-200 dark:border-purple-800">
                                    <Component className="w-3 h-3 text-purple-500 inline mr-1" />
                                    {pax.bomNumber || linkedBom?.name || "BOM Linked"}
                                  </span>
                                </div>
                                {linkedBom && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewBomModalItem(linkedBom)}
                                    className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    {bomItemsCount} Kit Components
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#526B91] italic text-[11px]">No BOM Connected</span>
                            )}
                          </td>

                          {/* Standard Price */}
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-emerald-600 dark:text-[#166534] text-xs">
                              ₹{Number(pax.unitPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <p className="text-[10px] text-[#526B91] font-mono">per pack</p>
                          </td>

                          {/* Cell Topology */}
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-[#0B2148] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold">
                              <Battery className="w-3 h-3 text-blue-500" />
                              {pax.cellCount}S ({pax.cellCount} Cells)
                            </span>
                          </td>

                          {/* Capacity Band */}
                          <td className="px-5 py-3.5">
                            <p className="font-mono font-bold text-slate-800 dark:text-[#0B2148]">
                              {pax.ahMin} – {pax.ahMax} Ah
                            </p>
                            <p className="text-[10px] text-[#526B91] font-mono">
                              Retest: ±{pax.retestAhMargin ?? 0.1}
                            </p>
                          </td>

                          {/* IR Limits */}
                          <td className="px-5 py-3.5">
                            <p className="font-mono font-bold text-slate-800 dark:text-[#0B2148]">
                              {pax.irMin} – {pax.irMax} mΩ
                            </p>
                            <p className="text-[10px] text-[#526B91] font-mono">
                              ΔIR: ≤{pax.maxIrDifference ?? 3.0} mΩ
                            </p>
                          </td>

                          {/* Allowed Grades */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {(pax.allowedGrades || []).map((grade: string) => (
                                <span 
                                  key={grade}
                                  className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded text-[10px] font-mono font-bold"
                                >
                                  {grade}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Production Status */}
                          <td className="px-5 py-3.5">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-[#166534] text-[11px] font-bold border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#166534]" />
                                In Production
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setProductionActiveMutation.mutate(pax.id)}
                                disabled={setProductionActiveMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[#526B91] dark:text-[#0B2148] hover:text-emerald-700 dark:hover:text-[#166534] text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-all cursor-pointer"
                              >
                                <Star className="w-3 h-3 text-[#526B91] hover:text-amber-500" />
                                Set Active
                              </button>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {linkedBom && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewBomModalItem(linkedBom)}
                                  className="p-1.5 text-[#526B91] hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="View BOM Components"
                                >
                                  <Component className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenPaxModal(pax)}
                                className="p-1.5 text-[#526B91] hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Edit Production Model & BOM Link"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmTarget({
                                    type: "model",
                                    id: pax.id,
                                    recordType: "Product Model & Specs",
                                    recordIdentity: `${pax.name} (${pax.series || "Model Series"})`,
                                    hasDependencies: true,
                                    warningText: "This action cannot be undone. Active shopfloor work orders or testing stations referencing this model will be blocked from forming new packs.",
                                    onConfirm: async () => {
                                      await deletePaxTypeMutation.mutateAsync(pax.id);
                                    }
                                  });
                                }}
                                className="p-1.5 text-[#526B91] hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Delete Model"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </motion.div>
      )}


      {/* ========================================================= */}
      {/* SECTION: BOM MASTER TEMPLATES & RECIPES */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "boms") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Component className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                    BOM Master Templates & Kit Recipes
                    <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-md text-[11px] font-mono font-semibold border border-purple-200 dark:border-purple-800">
                      {bomsList?.length || 0} Registered
                    </span>
                  </h3>
                  <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
                    Configure standardized Bill of Materials (BOM) recipes with exact non-cell raw materials, busbars, BMS, harnesses, and quantities per battery pack.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                  placeholder="Search BOM drawing, material SKU..."
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <button 
                type="button"
                onClick={() => handleOpenBomModal(null)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 px-4 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Register BOM Template
              </button>
            </div>
          </div>

          {/* BOM Cards Grid */}
          <div className="p-5">
            {filteredBoms.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-white border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3.5 border border-purple-200 dark:border-purple-800/60 shadow-xs">
                  <Component className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-[#0B2148]">
                  {bomsList?.length === 0 ? "No BOM Master Templates Registered" : "No Matching BOM Templates"}
                </h4>
                <p className="text-xs text-[#526B91] max-w-md mt-1 mb-4">
                  {bomsList?.length === 0 
                    ? "Register Bill of Materials recipes to automatically allocate and replicate component kits across production models and assembly lines."
                    : "No BOM recipes matched your search criteria. Clear your search or create a new template."}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenBomModal(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Register First BOM Template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBoms.map((bom: any, idx: number) => {
                  const linkedModels = (paxTypes || []).filter((p: any) => p.bomId === bom.id || p.bomNumber === bom.name);
                  const totalPartsCount = (bom.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);

                  return (
                    <div 
                      key={bom.id}
                      className="p-4.5 rounded-2xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 hover:border-purple-400/60 dark:hover:border-purple-600/60 transition-all shadow-xs flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        {/* Top Badge & Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 font-mono font-bold text-xs flex items-center justify-center border border-purple-200 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono font-bold text-xs border border-purple-200 dark:border-purple-800/80">
                              {bom.name}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setPreviewBomModalItem(bom)}
                              className="p-1.5 text-[#526B91] hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Preview Components"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenBomModal(bom)}
                              className="p-1.5 text-[#526B91] hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit BOM"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmTarget({
                                  type: "bom",
                                  id: bom.id,
                                  recordType: "BOM Master Template",
                                  recordIdentity: `${bom.name} (${bom.items?.length || 0} components)`,
                                  hasDependencies: true,
                                  warningText: "Cannot delete if currently linked to an active Production Model. Verification will be performed by the server.",
                                  onConfirm: async () => {
                                    await deleteBomMutation.mutateAsync(bom.id);
                                  }
                                });
                              }}
                              className="p-1.5 text-[#526B91] hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete BOM"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {bom.description ? (
                          <p className="text-xs text-[#526B91] dark:text-[#0B2148] line-clamp-2">
                            {bom.description}
                          </p>
                        ) : (
                          <p className="text-xs text-[#526B91] italic">
                            No description provided
                          </p>
                        )}

                        {/* Linked Production Models */}
                        <div className="pt-1">
                          <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider mb-1">
                            Linked Production Models:
                          </p>
                          {linkedModels.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {linkedModels.map((m: any) => (
                                <span 
                                  key={m.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold border border-blue-200 dark:border-blue-800/60"
                                >
                                  <Cpu className="w-2.5 h-2.5 text-blue-500" />
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#526B91] italic">Unassigned (Ready to link to models)</span>
                          )}
                        </div>

                        {/* Components Breakdown */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-[#0B2148]">
                            <span>Kit Components ({bom.items?.length || 0} materials)</span>
                            <span className="font-mono text-purple-600 dark:text-purple-400">{totalPartsCount} Total Parts</span>
                          </div>
                          
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {(bom.items || []).slice(0, 4).map((item: any, idx: number) => (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-[11px]"
                              >
                                <div className="truncate mr-2">
                                  <p className="font-semibold text-slate-800 dark:text-[#0B2148] truncate">
                                    {item.material?.name || `Material #${item.materialId?.slice(0, 8)}`}
                                  </p>
                                  <p className="text-[10px] font-mono text-[#526B91] truncate">
                                    {item.material?.sku || "SKU"} • {item.material?.category || "PART"}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs shrink-0">
                                  x{item.quantity} {item.material?.unit || "PCS"}
                                </span>
                              </div>
                            ))}
                            {(bom.items || []).length > 4 && (
                              <button
                                type="button"
                                onClick={() => setPreviewBomModalItem(bom)}
                                className="w-full text-center text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline py-1"
                              >
                                + {(bom.items || []).length - 4} more components (View All)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-[#526B91] font-mono">
                          {new Date(bom.createdAt || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenBomModal(bom)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 cursor-pointer"
                          >
                            <Edit className="w-3 h-3" /> Edit BOM
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: MATERIAL PART NUMBER MAPPING */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "materials") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148]">Material Catalog (Non-Cell Components)</h3>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#526B91] dark:text-[#0B2148] rounded-md text-[11px] font-mono font-semibold border border-slate-200 dark:border-slate-700">
                  {materials?.length || 0} Materials
                </span>
              </div>
              <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
                BMS units, busbars, enclosures, wires, insulation, and hardware components used in BOM kit assemblies (Cells are managed separately).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  placeholder="Search SKU, name, code..."
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Categories ({allAvailableCategories.length})</option>
                {allAvailableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Material Type Filter (QTZ / NQZ) */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer font-mono"
              >
                <option value="ALL">All Types</option>
                <option value="QTZ">QTZ</option>
                <option value="NQZ">NQZ</option>
              </select>

              <button 
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0B2148] dark:text-[#0B2148] px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
                title="Print current filtered catalog"
              >
                <Printer className="w-3.5 h-3.5 text-[#526B91]" />
                Print Catalog
              </button>

              <button 
                type="button"
                onClick={() => handleOpenMaterialModal(null)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Material
              </button>
            </div>
          </div>

          {loadingMaterials ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#526B91]">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Loading material catalog...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 font-semibold text-[#526B91] dark:text-[#526B91] w-14 text-center">S.No</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Material Identity</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Code</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Part Number / SKU</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Category</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Type</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Unit</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Base Cost</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Status</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-[#526B91] text-xs">
                        {materialSearch || categoryFilter !== "ALL" || typeFilter !== "ALL"
                          ? "No materials match the active search, category, or type filter." 
                          : "No material part numbers configured. Click \"Add Material\" to register your first SKU."}
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((mat: any, idx: number) => (
                      <tr key={mat.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-center font-mono font-bold text-xs text-[#526B91]">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 dark:text-[#0B2148]">{mat.name}</p>
                          {mat.description && (
                            <p className="text-[11px] text-[#526B91] truncate max-w-xs">{mat.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono text-[#526B91] dark:text-[#0B2148]">
                          {mat.materialCode || "—"}
                        </td>
                        <td className="px-5 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {mat.sku}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-medium text-slate-700 dark:text-[#0B2148]">
                            {mat.category}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            (mat.materialType || "QTZ") === "NQZ"
                              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
                              : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"
                          }`}>
                            {(mat.materialType || "QTZ") === "NQZ" ? "NQZ" : "QTZ"}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-[#526B91] dark:text-[#526B91]">
                          {mat.unit || "PCS"}
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-700 dark:text-[#0B2148]">
                          ₹{Number(mat.unitPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            mat.isActive !== false
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-[#0B2148] border border-slate-300 dark:border-slate-700"
                              : "bg-slate-100 text-[#526B91] border border-slate-200 line-through"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${mat.isActive !== false ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {mat.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleMaterialMutation.mutate({ id: mat.id, isActive: mat.isActive === false })}
                              className="px-2 py-1 text-[11px] font-medium text-[#526B91] dark:text-[#526B91] hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {mat.isActive === false ? "Enable" : "Disable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenMaterialModal(mat)}
                              className="p-1.5 text-[#526B91] hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Material"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmTarget({
                                  type: "material",
                                  id: mat.id,
                                  title: "Permanently Delete Material SKU?",
                                  recordType: "Material SKU & Product Catalog",
                                  recordIdentity: `${mat.name} (${mat.sku})`,
                                  hasDependencies: true,
                                  description: `Are you sure you want to permanently delete material SKU "${mat.sku}"? This will permanently purge the material master and any synchronized product catalog identities (UINs) from Purchase Orders, Procurement, and Inventory.`,
                                  warningText: "Permanent Deletion • Irreversible: Deleting this SKU permanently purges the material and its synchronized catalog products from the database. It will NO LONGER appear in Purchase Orders (/superadmin/procurement/purchase-orders/create). Any active inventory balances or drafts linked to this SKU will be permanently removed.",
                                  confirmButtonText: "Permanently Delete SKU",
                                  onConfirm: async () => {
                                    await deleteMaterialMutation.mutateAsync(mat.id);
                                  }
                                });
                              }}
                              className="p-1.5 text-[#526B91] hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Permanently Delete Material SKU"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* SECTION: COMPANY CAPITAL ASSETS REGISTER */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "assets") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CompanyAssetsConfigSection />
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: CELL PART NUMBER MAPPING */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "cells") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148]">Cell Part Numbers & Chemistries (Cells Only)</h3>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#526B91] dark:text-[#0B2148] rounded-md text-[11px] font-mono font-semibold border border-slate-200 dark:border-slate-700">
                  {cellMappings?.length || 0} Cell SKUs
                </span>
              </div>
              <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
                Master battery cell catalog (LFP, NMC, 32140, etc.) with nominal voltage, Ah capacity, and individual cell serial testing tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={cellSearch}
                  onChange={(e) => setCellSearch(e.target.value)}
                  placeholder="Search cell SKU, chemistry..."
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button 
                type="button"
                onClick={() => handleOpenCellModal(null)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Cell SKU
              </button>
            </div>
          </div>

          {loadingCells ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#526B91]">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Loading cell catalog...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 font-semibold text-[#526B91] dark:text-[#526B91] w-14 text-center">S.No</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Cell Model / Name</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Cell Part Number</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Chemistry</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Nominal Voltage</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Nominal Capacity</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Supplier</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91]">Status</th>
                    <th className="px-5 py-3 font-semibold text-[#526B91] dark:text-[#526B91] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCells.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-[#526B91] text-xs">
                        {cellSearch ? "No cell part numbers match the search term." : "No cell part numbers registered."}
                      </td>
                    </tr>
                  ) : (
                    filteredCells.map((cell: any, idx: number) => (
                      <tr key={cell.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-center font-mono font-bold text-xs text-[#526B91]">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 dark:text-[#0B2148]">{cell.cellName}</p>
                          {cell.description && (
                            <p className="text-[11px] text-[#526B91] truncate max-w-xs">{cell.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {cell.cellSku}
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-700 dark:text-[#0B2148]">
                          {cell.chemistry}
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-700 dark:text-[#0B2148]">
                          {cell.nominalVoltage} V
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-700 dark:text-[#0B2148]">
                          {cell.nominalCapacity} Ah
                        </td>
                        <td className="px-5 py-3 text-[#526B91]">
                          {cell.supplier || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            cell.isActive !== false
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-[#0B2148] border border-slate-300 dark:border-slate-700"
                              : "bg-slate-100 text-[#526B91] border border-slate-200 line-through"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cell.isActive !== false ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {cell.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => toggleCellMutation.mutate({ id: cell.id, isActive: cell.isActive === false })}
                              className="px-2 py-1 text-[11px] font-medium text-[#526B91] dark:text-[#526B91] hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {cell.isActive === false ? "Enable" : "Disable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCellModal(cell)}
                              className="p-1.5 text-[#526B91] hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Cell SKU"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmTarget({
                                  type: "cell",
                                  id: cell.id,
                                  title: "Permanently Delete Cell SKU?",
                                  recordType: "Cell Part Number / Chemistry",
                                  recordIdentity: `${cell.cellName} (${cell.cellSku})`,
                                  hasDependencies: true,
                                  description: `Are you sure you want to permanently delete cell SKU "${cell.cellSku}"? This will permanently purge the cell master and any linked materials or catalog entries.`,
                                  warningText: "Permanent Deletion • Irreversible: Deleting this master cell SKU permanently purges the record and removes it from cell inward lots, grading criteria, and purchase order catalogs.",
                                  confirmButtonText: "Permanently Delete Cell SKU",
                                  onConfirm: async () => {
                                    await deleteCellMutation.mutateAsync(cell.id);
                                  }
                                });
                              }}
                              className="p-1.5 text-[#526B91] hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Permanently Delete Cell SKU"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: MATERIAL CATEGORIES */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "categories") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148]">Material Categories</h3>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[#526B91] dark:text-[#0B2148] rounded-md text-[11px] font-mono font-semibold border border-slate-200 dark:border-slate-700">
                  {allAvailableCategories.length} Categories
                </span>
              </div>
              <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
                Classification tags used for inventory structuring and BOM categorization.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button 
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Category
              </button>
            </div>
          </div>

          {/* Inline Quick Add Input Bar */}
          <div className="p-4 bg-slate-50/60 dark:bg-white border-b border-slate-200 dark:border-slate-800">
            <form onSubmit={handleCreateCategorySubmit} className="flex flex-col sm:flex-row items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-[#0B2148] whitespace-nowrap">
                Quick Add:
              </span>
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="e.g. THERMAL_PAD, BUSBAR_INSULATOR, CONNECTOR..."
                className="flex-1 bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-xs text-slate-900 dark:text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="submit"
                disabled={createCategoryMutation.isPending || !newCategoryInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-1.5 rounded-xl text-white font-semibold text-xs transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                {createCategoryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Category"}
              </button>
            </form>
          </div>

          {/* Categories Grid */}
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredCategories.map((categoryName, idx) => {
                const dbRecord = (materialCategories || []).find((c: any) => c.name === categoryName);
                const isCustom = !!dbRecord;
                const materialCount = (materials || []).filter((m: any) => m.category === categoryName).length;

                return (
                  <div
                    key={categoryName}
                    className="p-3.5 rounded-xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-slate-100 text-[#526B91] font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200 mt-0.5">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] tracking-tight">{categoryName}</p>
                          <p className="text-[10px] text-[#526B91] mt-0.5">
                            {isCustom ? "Custom Category" : "Standard Preset"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (materialCount > 0) {
                            toast.error(`Cannot delete category "${categoryName}" because ${materialCount} material(s) use it. Please reassign those materials first.`);
                            return;
                          }
                          setDeleteConfirmTarget({
                            type: "category",
                            recordType: "Material Category Tag",
                            recordIdentity: categoryName,
                            hasDependencies: false,
                            warningText: `Are you sure you want to delete category "${categoryName}"? It will be removed from your factory catalog tags.`,
                            onConfirm: async () => {
                              if (dbRecord) {
                                await deleteCategoryMutation.mutateAsync(dbRecord.id);
                              }
                              setDeletedCategoryNames(prev => {
                                const next = Array.from(new Set([...prev, categoryName.toUpperCase()]));
                                if (typeof window !== "undefined") {
                                  try {
                                    localStorage.setItem("factory_deleted_categories", JSON.stringify(next));
                                  } catch {}
                                }
                                return next;
                              });
                              toast.success(`Category "${categoryName}" deleted`);
                            }
                          });
                        }}
                        className="p-1 text-[#526B91] hover:text-red-600 rounded transition-colors cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-[#526B91]">
                      <span>{materialCount} SKUs</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter(categoryName);
                          setActiveSection("materials");
                        }}
                        className="text-blue-600 hover:text-blue-700 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        View <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* SECTION 4: FINANCIAL & SHIPPING CHARGE SETTINGS */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "financial") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Commercial & Financial Defaults
              </h3>
              <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
                Default pre-fill currency, tax schedules, quotation terms, and logistics shipping charges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-bold">
                Operating Currency: {financialForm.defaultCurrency} ({getCurrencySymbol(financialForm.defaultCurrency)})
              </span>
            </div>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              saveFinancialMutation.mutate(financialForm);
            }} 
            className="p-5 space-y-6"
          >
            {/* Commercial Terms Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#526B91] flex items-center gap-1.5">
                <span>1. Commercial & Currency Schedule</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148] flex items-center justify-between">
                    <span>Operating Currency</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">Active: {getCurrencySymbol(financialForm.defaultCurrency)}</span>
                  </label>
                  <select
                    value={financialForm.defaultCurrency}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultCurrency: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-semibold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer ring-1 ring-emerald-500/20"
                  >
                    <option value="ZMW">ZMW (ZK) - Zambian Kwacha (Zambia)</option>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="ZAR">ZAR (R) - South African Rand</option>
                  </select>
                </div>

                {/* Default Tax Rate */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Standard Tax / VAT Rate (%)
                  </label>
                  <select
                    value={financialForm.defaultTaxRate}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="0">0% (Zero-Rated / Exempt)</option>
                    <option value="5">5% (Concessional / Solar / EV)</option>
                    <option value="12">12%</option>
                    <option value="16">16% (Zambia Standard VAT)</option>
                    <option value="18">18% (Standard GST / Electronics)</option>
                    <option value="28">28% (Luxury / Higher Bracket)</option>
                  </select>
                </div>

                {/* Payment Terms */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Default Payment Terms
                  </label>
                  <select
                    value={financialForm.defaultPaymentTerms}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultPaymentTerms: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="100% Advance">100% Advance</option>
                    <option value="50% Advance, 50% Before Dispatch">50% Advance, 50% Before Dispatch</option>
                    <option value="30% Advance, 70% Before Dispatch">30% Advance, 70% Before Dispatch</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="100% Against PI">100% Against PI</option>
                  </select>
                </div>

                {/* Advance Percentage */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Default Advance Required (%)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={financialForm.defaultAdvancePercentage}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultAdvancePercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Quotation Validity */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Quotation Validity (Days)
                  </label>
                  <input 
                    type="number"
                    min="1"
                    max="365"
                    value={financialForm.defaultQuotationValidityDays}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultQuotationValidityDays: parseInt(e.target.value, 10) || 30 })}
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Minimum Order Value */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Minimum Order Value ({getCurrencySymbol(financialForm.defaultCurrency)})
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={financialForm.minimumOrderValue}
                    onChange={(e) => setFinancialForm({ ...financialForm, minimumOrderValue: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* DEDICATED SHIPPING CHARGE CONFIGURATION CARD */}
            <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/40 via-white to-slate-50/60 dark:from-blue-950/10 dark:via-transparent dark:to-slate-900/20 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blue-100 dark:border-blue-900/40 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                      <span>2. Shipping & Freight Charge Configuration</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">
                        Logistics Rules
                      </span>
                    </h4>
                    <p className="text-[11px] text-[#526B91]">
                      Configure base dispatch freight fees, calculation formulas, free delivery thresholds, and freight tax.
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-[#526B91] bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  Rate Unit: <span className="font-bold text-blue-600">{financialForm.defaultCurrency} ({getCurrencySymbol(financialForm.defaultCurrency)})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Shipping Calculation Method */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Shipping Calculation Method
                  </label>
                  <select
                    value={financialForm.shippingCalculationMethod}
                    onChange={(e) => setFinancialForm({ ...financialForm, shippingCalculationMethod: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
                  >
                    <option value="FLAT_RATE">Flat Base Fee Per Dispatch</option>
                    <option value="WEIGHT_BASED">Weight-Based / Volumetric Tier</option>
                    <option value="FREE_THRESHOLD">Free Shipping Above Threshold</option>
                    <option value="PERCENTAGE">Percentage of Order Subtotal</option>
                    <option value="EXW_CUSTOMER_PICKUP">Ex-Works / Customer Pickup (0 Charge)</option>
                  </select>
                </div>

                {/* Default Freight Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Default Base Freight Charge ({getCurrencySymbol(financialForm.defaultCurrency)})
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={financialForm.defaultFreightAmount}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultFreightAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-semibold"
                  />
                </div>

                {/* Handling Charge */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Packaging & Handling Surcharge ({getCurrencySymbol(financialForm.defaultCurrency)})
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={financialForm.defaultHandlingCharge}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultHandlingCharge: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Free Shipping Threshold */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148] flex items-center justify-between">
                    <span>Free Shipping Threshold ({getCurrencySymbol(financialForm.defaultCurrency)})</span>
                    <span className="text-[10px] text-blue-600 font-normal">0 = Inactive</span>
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={financialForm.freeShippingThreshold}
                    onChange={(e) => setFinancialForm({ ...financialForm, freeShippingThreshold: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    placeholder="e.g. 5000"
                  />
                </div>

                {/* Preferred Carrier / Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Default Shipping Carrier / Method
                  </label>
                  <select
                    value={financialForm.defaultShippingCarrier}
                    onChange={(e) => setFinancialForm({ ...financialForm, defaultShippingCarrier: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Standard Road Logistics">Standard Road Logistics</option>
                    <option value="Swift Express Cargo (Zambia)">Swift Express Cargo (Zambia)</option>
                    <option value="Zampost Courier Express">Zampost Courier Express</option>
                    <option value="Blue Dart / DTDC Express">Blue Dart / DTDC Express</option>
                    <option value="Air Freight Express">Air Freight Express</option>
                    <option value="Dedicated Factory Fleet">Dedicated Factory Fleet</option>
                    <option value="Customer Arranged Transport">Customer Arranged Transport</option>
                  </select>
                </div>

                {/* Shipping Tax Rate */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Freight VAT / GST Rate (%)
                  </label>
                  <select
                    value={financialForm.shippingTaxRate}
                    onChange={(e) => setFinancialForm({ ...financialForm, shippingTaxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="0">0% (Zero-Rated / Exempt)</option>
                    <option value="5">5% (Concessional Freight)</option>
                    <option value="12">12% (Standard Logistics)</option>
                    <option value="16">16% (Zambia VAT on Freight)</option>
                    <option value="18">18% (Standard GST on Freight)</option>
                  </select>
                </div>

                {/* Transit Lead Time */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Estimated Delivery Lead Time (Days)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="60"
                    value={financialForm.estimatedDeliveryLeadDays}
                    onChange={(e) => setFinancialForm({ ...financialForm, estimatedDeliveryLeadDays: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => {
                  setDeleteConfirmTarget({
                    type: "financialReset",
                    recordType: "Commercial & Financial Configuration",
                    recordIdentity: "Standard ERP Financial & Shipping Settings",
                    hasDependencies: false,
                    warningText: "This will reset default currencies, GST/VAT rates, freight amounts, shipping rules, and quotation terms back to factory standards.",
                    onConfirm: async () => {
                      await resetFinancialMutation.mutateAsync();
                    }
                  });
                }}
                disabled={resetFinancialMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-semibold transition-all cursor-pointer"
                title="Reset all financial and shipping values to factory standards"
              >
                {resetFinancialMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Reset Defaults
              </button>

              <button 
                type="submit"
                disabled={saveFinancialMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-xl text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                {saveFinancialMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Financial & Shipping Configuration
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* SECTION 5: FACTORY DEFAULTS */}
      {/* ========================================================= */}
      {(activeSection === "all" || activeSection === "defaults") && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl border overflow-hidden shadow-sm"
        >
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148]">Factory Operational Defaults</h3>
            <p className="text-xs text-[#526B91] dark:text-[#526B91] mt-0.5">
              Production schedule rules, measurement systems, and shipping terms.
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              saveDefaultsMutation.mutate(defaultsForm);
            }} 
            className="p-5 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Unit System */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                  Standard Unit System
                </label>
                <select
                  value={defaultsForm.defaultUnitSystem}
                  onChange={(e) => setDefaultsForm({ ...defaultsForm, defaultUnitSystem: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="METRIC">Metric (kg, mm, °C)</option>
                  <option value="IMPERIAL">Imperial (lbs, in, °F)</option>
                </select>
              </div>

              {/* Factory Timezone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                  Factory Operating Timezone
                </label>
                <select
                  value={defaultsForm.defaultTimezone}
                  onChange={(e) => setDefaultsForm({ ...defaultsForm, defaultTimezone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="Africa/Lusaka">Africa/Lusaka (CAT - UTC+2:00 - Zambia)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                  <option value="UTC">UTC - Coordinated Universal Time</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                </select>
              </div>

              {/* Default Delivery Terms */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                  Default Incoterms
                </label>
                <select
                  value={defaultsForm.defaultDeliveryTerms}
                  onChange={(e) => setDefaultsForm({ ...defaultsForm, defaultDeliveryTerms: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="EXW - Ex Works">EXW - Ex Works (Factory Gate)</option>
                  <option value="FOB - Free on Board">FOB - Free on Board</option>
                  <option value="CIF - Cost, Insurance and Freight">CIF - Cost, Insurance & Freight</option>
                  <option value="DAP - Delivered at Place">DAP - Delivered at Place</option>
                </select>
              </div>

              {/* Working Hours */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                  Standard Shift Hours / Day
                </label>
                <input 
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={defaultsForm.workingHoursPerDay}
                  onChange={(e) => setDefaultsForm({ ...defaultsForm, workingHoursPerDay: parseFloat(e.target.value) || 8 })}
                  required
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Production Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                  Operating Days / Week
                </label>
                <input 
                  type="number"
                  min="1"
                  max="7"
                  value={defaultsForm.productionDaysPerWeek}
                  onChange={(e) => setDefaultsForm({ ...defaultsForm, productionDaysPerWeek: parseInt(e.target.value, 10) || 6 })}
                  required
                  className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => {
                  setDeleteConfirmTarget({
                    type: "defaultsReset",
                    recordType: "Operational Schedules & Shift Defaults",
                    recordIdentity: "Shift & Production Parameters",
                    hasDependencies: false,
                    warningText: "This will restore standard factory shifts (8h), target operational capacity, and line balancing defaults.",
                    onConfirm: async () => {
                      await resetDefaultsMutation.mutateAsync();
                    }
                  });
                }}
                disabled={resetDefaultsMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-semibold transition-all cursor-pointer"
                title="Reset operational parameters to factory defaults"
              >
                {resetDefaultsMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Reset Defaults
              </button>

              <button 
                type="submit"
                disabled={saveDefaultsMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-xl text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                {saveDefaultsMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Operational Defaults
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* MODAL 0: ADD / EDIT PRODUCTION PRODUCT MODEL & BOM */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isPaxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsPaxModalOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              <form onSubmit={handlePaxFormSubmit} className="flex flex-col h-full max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B2148]">
                        {selectedPaxType ? "Edit Production Model & BOM Link" : "Configure New Production Model"}
                      </h3>
                      <p className="text-xs text-[#526B91] mt-0.5">
                        Define cell part numbers, BOM kit configuration, electrical specs, and quality tolerances across all ERP roles.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsPaxModalOpen(false)} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-[#526B91] hover:text-[#0B2148] transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body / Form Fields (Internally Scrollable) */}
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                {/* 1. Model Profile & Commercial Pricing */}
                <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    1. Model Identification & Master Profile
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Product Model Name / SKU *
                      </label>
                      <input 
                        name="name"
                        defaultValue={selectedPaxType?.name}
                        required
                        placeholder="e.g. KYRA-48V-100AH-LFP, KZ-72V-45AH"
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Standard Selling Price (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#526B91] font-mono font-semibold text-xs">₹</span>
                        <input 
                          name="unitPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={selectedPaxType?.unitPrice ?? 0}
                          required
                          placeholder="0.00"
                          className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-7 pr-3 text-xs font-mono font-bold text-emerald-600 dark:text-[#166534] focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Model Description / Application Scope
                      </label>
                      <input 
                        name="description"
                        defaultValue={selectedPaxType?.description}
                        placeholder="e.g. 48V 100Ah Commercial Solar ESS & Golf Cart Battery Pack"
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Cell Part Number & Chemistry Connection */}
                <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <Battery className="w-3.5 h-3.5 text-blue-600" />
                    2. Cell Master Connection & Electrical Topology
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Cell Part Number Selector */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148] flex items-center justify-between">
                        <span>Connected Cell Part Number / SKU</span>
                        <span className="text-[10px] text-[#526B91]">From Cell Catalog</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={selectedCellPartNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedCellPartNumber(val);
                            const matched = (cellMappings || []).find((c: any) => c.cellSku === val);
                            if (matched) {
                              if (matched.chemistry) setSelectedCellChemistry(matched.chemistry);
                              if (matched.nominalCapacity) setPaxNominalCapacity(matched.nominalCapacity);
                            }
                          }}
                          className="flex-1 bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-semibold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                          <option value="">-- Select Cell Part Number --</option>
                          {(cellMappings || []).map((c: any) => (
                            <option key={c.id} value={c.cellSku}>
                              {c.cellSku} ({c.cellName} • {c.chemistry} • {c.nominalCapacity}Ah)
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={selectedCellPartNumber}
                          onChange={(e) => setSelectedCellPartNumber(e.target.value)}
                          placeholder="Or type custom SKU"
                          className="w-36 bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    {/* Cell Chemistry */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Cell Chemistry
                      </label>
                      <select
                        value={selectedCellChemistry}
                        onChange={(e) => setSelectedCellChemistry(e.target.value)}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-semibold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                      >
                        {CHEMISTRY_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Series Cell Count */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Total Cells (Series Count) *
                      </label>
                      <input 
                        name="cellCount"
                        type="number"
                        min="1"
                        max="256"
                        value={paxCellCount}
                        onChange={(e) => {
                          const count = parseInt(e.target.value, 10) || 16;
                          setPaxCellCount(count);
                          setPaxNominalVoltage(Number((count * 3.2).toFixed(1)));
                          setPaxConfiguration(`${count}S1P`);
                        }}
                        required
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Nominal Voltage */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Nominal Pack Voltage (V)
                      </label>
                      <input 
                        name="nominalVoltage"
                        type="number"
                        step="0.1"
                        min="1"
                        value={paxNominalVoltage}
                        onChange={(e) => setPaxNominalVoltage(parseFloat(e.target.value) || 48.0)}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Nominal Capacity & Configuration */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        Topology / Config
                      </label>
                      <input 
                        name="configuration"
                        type="text"
                        value={paxConfiguration}
                        onChange={(e) => setPaxConfiguration(e.target.value)}
                        placeholder="e.g. 16S1P, 16S2P"
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Quick Series Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-[#526B91] font-medium">Series Presets:</span>
                    {[
                      { label: "16S (48V / 51.2V)", count: 16, volt: 51.2 },
                      { label: "20S (60V / 64V)", count: 20, volt: 64.0 },
                      { label: "24S (72V / 76.8V)", count: 24, volt: 76.8 },
                      { label: "32S (96V / 102.4V)", count: 32, volt: 102.4 }
                    ].map(p => (
                      <button
                        key={p.count}
                        type="button"
                        onClick={() => {
                          setPaxCellCount(p.count);
                          setPaxNominalVoltage(p.volt);
                          setPaxConfiguration(`${p.count}S1P`);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border transition-all cursor-pointer ${
                          paxCellCount === p.count
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-700 shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-[#526B91] dark:text-[#526B91] border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. BOM Connection & Bill of Materials Details */}
                <div className="p-4 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Component className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      3. BOM Connection & Bill of Materials Details
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-700 dark:text-purple-400 font-mono">
                        {bomsList?.length || 0} Registered BOMs
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenBomModal(null, (newBom) => {
                          setSelectedBomId(newBom.id);
                          setSelectedBomNumber(newBom.name);
                        })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Register New BOM
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* BOM Selector */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                          Linked BOM Template
                        </label>
                        {selectedBomId && (
                          <button
                            type="button"
                            onClick={() => {
                              const activeBom = (bomsList || []).find((b: any) => b.id === selectedBomId);
                              if (activeBom) handleOpenBomModal(activeBom);
                            }}
                            className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Edit className="w-2.5 h-2.5" /> Edit BOM
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedBomId}
                        onChange={(e) => {
                          const bomId = e.target.value;
                          setSelectedBomId(bomId);
                          const matchedBom = (bomsList || []).find((b: any) => b.id === bomId);
                          if (matchedBom) {
                            setSelectedBomNumber(matchedBom.name);
                          }
                        }}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-semibold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-purple-600 cursor-pointer"
                      >
                        <option value="">-- Select BOM Template --</option>
                        {(bomsList || []).map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.items?.length || 0} components)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* BOM Number / Drawing Code */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                        BOM Number / Drawing Code
                      </label>
                      <input
                        type="text"
                        value={selectedBomNumber}
                        onChange={(e) => setSelectedBomNumber(e.target.value)}
                        placeholder="e.g. BOM-KYRA-48V-100-REV1"
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  {/* Dynamic BOM Kit Components Preview */}
                  {(() => {
                    const activeBom = (bomsList || []).find((b: any) => b.id === selectedBomId);
                    if (!activeBom || !activeBom.items || activeBom.items.length === 0) {
                      return (
                        <div className="p-3.5 rounded-xl bg-white/60 dark:bg-white border border-dashed border-purple-200 dark:border-purple-800 text-[11px] text-[#526B91] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span>Select an existing BOM template or click <strong>Register New BOM</strong> to build kit components.</span>
                          <button
                            type="button"
                            onClick={() => handleOpenBomModal(null, (newBom) => {
                              setSelectedBomId(newBom.id);
                              setSelectedBomNumber(newBom.name);
                            })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline shrink-0 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Create BOM Template
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2 p-3.5 rounded-xl bg-white dark:bg-white border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-200">
                          <span>BOM Kit Component Breakdown ({activeBom.items.length} materials):</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenBomModal(activeBom)}
                              className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3 h-3" /> Edit Components
                            </button>
                            <span className="text-[10px] font-mono text-[#526B91]">• Per 1 Pack Assembly</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                          {activeBom.items.map((item: any, idx: number) => (
                            <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between text-[11px]">
                              <p className="font-semibold text-slate-900 dark:text-[#0B2148] truncate">{item.material?.name || `Part #${item.materialId?.slice(0, 8)}`}</p>
                              <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-[#526B91]">
                                <span className="truncate">{item.material?.sku || "SKU"}</span>
                                <span className="font-bold text-purple-600 dark:text-purple-400">Qty: {item.quantity}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* 4. Cell Quality Testing & Grading Thresholds */}
                <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    4. Cell Quality Testing & Grading Thresholds
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Ah Min */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Min Capacity (Ah) *
                      </label>
                      <input 
                        name="ahMin"
                        type="number"
                        step="0.01"
                        min="0.1"
                        defaultValue={selectedPaxType?.ahMin ?? 3.1}
                        required
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Ah Max */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Max Capacity (Ah) *
                      </label>
                      <input 
                        name="ahMax"
                        type="number"
                        step="0.01"
                        min="0.1"
                        defaultValue={selectedPaxType?.ahMax ?? 3.5}
                        required
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* IR Min */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Min IR (mΩ) *
                      </label>
                      <input 
                        name="irMin"
                        type="number"
                        step="0.1"
                        min="0.1"
                        defaultValue={selectedPaxType?.irMin ?? 10.0}
                        required
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* IR Max */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Max IR (mΩ) *
                      </label>
                      <input 
                        name="irMax"
                        type="number"
                        step="0.1"
                        min="0.1"
                        defaultValue={selectedPaxType?.irMax ?? 30.0}
                        required
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Retest Ah Margin */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Retest Ah Margin
                      </label>
                      <input 
                        name="retestAhMargin"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={selectedPaxType?.retestAhMargin ?? 0.1}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Retest IR Margin */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Retest IR Margin (mΩ)
                      </label>
                      <input 
                        name="retestIrMargin"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={selectedPaxType?.retestIrMargin ?? 2.0}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Hard Fail Ah */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Hard Fail Below Ah
                      </label>
                      <input 
                        name="hardFailAh"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={selectedPaxType?.hardFailAh ?? 3.0}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Hard Fail IR */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                        Hard Fail Above IR (mΩ)
                      </label>
                      <input 
                        name="hardFailIr"
                        type="number"
                        step="0.1"
                        min="0"
                        defaultValue={selectedPaxType?.hardFailIr ?? 70.0}
                        className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Clustering Delta Tolerances & Allowed Grades */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Delta Tolerances */}
                  <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-xs font-bold text-slate-800 dark:text-[#0B2148] uppercase tracking-wider">
                      5. Clustering Delta Tolerances
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                          Max ΔAh (Delta) *
                        </label>
                        <input 
                          name="maxAhDifference"
                          type="number"
                          step="0.005"
                          min="0"
                          defaultValue={selectedPaxType?.maxAhDifference ?? 0.05}
                          required
                          className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#526B91] dark:text-[#0B2148]">
                          Max ΔIR (mΩ) *
                        </label>
                        <input 
                          name="maxIrDifference"
                          type="number"
                          step="0.1"
                          min="0"
                          defaultValue={selectedPaxType?.maxIrDifference ?? 3.0}
                          required
                          className="w-full bg-white dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Allowed Grades Chips */}
                  <div className="space-y-2 p-4 bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800 dark:text-[#0B2148] uppercase tracking-wider">
                        Allowed Cell Quality Grades *
                      </p>
                      <span className="text-[10px] text-[#526B91] font-mono">
                        {paxSelectedGrades.length} Selected
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {CELL_GRADE_OPTIONS.map(grade => {
                        const isSelected = paxSelectedGrades.includes(grade);
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (paxSelectedGrades.length === 1) {
                                  toast.error("At least one quality grade must be selected");
                                  return;
                                }
                                setPaxSelectedGrades(paxSelectedGrades.filter(g => g !== grade));
                              } else {
                                setPaxSelectedGrades([...paxSelectedGrades, grade]);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all border cursor-pointer ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white dark:bg-slate-900 text-[#526B91] dark:text-[#526B91] border-slate-200 dark:border-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            Grade {grade}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 6. Feature Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
                    <input 
                      name="autoPackEnabled"
                      type="checkbox"
                      defaultChecked={selectedPaxType ? selectedPaxType.autoPackEnabled !== false : true}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-[#0B2148]">Auto-Pack Clustering</p>
                      <p className="text-[10px] text-[#526B91]">Allow engine to auto-allocate compatible cells to this model</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl cursor-pointer">
                    <input 
                      name="isProductionActive"
                      type="checkbox"
                      defaultChecked={selectedPaxType ? selectedPaxType.isProductionActive : false}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                        <Star className="w-3 h-3 text-emerald-600" />
                        Set as Active Factory Model
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-[#166534]">Immediately switches current line QC & assembly to this model</p>
                    </div>
                  </label>
                </div>
                </div>

                {/* Sticky Visible Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-[#D8E8FA] flex items-center justify-end gap-2.5 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsPaxModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:text-[#0B2148] hover:bg-slate-200/60 bg-white border border-[#D8E8FA] transition-all cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={savePaxTypeMutation.isPending}
                    className="flex items-center gap-1.5 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 px-6 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    {savePaxTypeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {selectedPaxType ? "Save Model & BOM Link" : "Create Production Model"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL: BOM COMPONENTS DETAILS PREVIEW */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewBomModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setPreviewBomModalItem(null)} 
              className="absolute inset-0 bg-white backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-5xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-900 dark:text-[#0B2148]"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                    <Component className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                      <span>{previewBomModalItem.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-mono font-bold">
                        {previewBomModalItem.items?.length || 0} Components
                      </span>
                    </h3>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      {previewBomModalItem.description || "Bill of Materials kit specification for pack assembly"}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setPreviewBomModalItem(null)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[#526B91] hover:text-[#526B91] dark:hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-4 py-2.5 font-semibold text-[#526B91] dark:text-[#526B91]">#</th>
                        <th className="px-4 py-2.5 font-semibold text-[#526B91] dark:text-[#526B91]">Material Name</th>
                        <th className="px-4 py-2.5 font-semibold text-[#526B91] dark:text-[#526B91]">Part SKU / Code</th>
                        <th className="px-4 py-2.5 font-semibold text-[#526B91] dark:text-[#526B91]">Category</th>
                        <th className="px-4 py-2.5 font-semibold text-[#526B91] dark:text-[#526B91] text-right">Required Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(!previewBomModalItem.items || previewBomModalItem.items.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[#526B91] text-xs">
                            No materials recorded in this BOM batch.
                          </td>
                        </tr>
                      ) : (
                        previewBomModalItem.items.map((item: any, idx: number) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-2.5 font-mono text-[#526B91]">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-[#0B2148]">
                              {item.material?.name || "Material Item"}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[#526B91] dark:text-[#0B2148]">
                              {item.material?.sku || "-"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-[#526B91] dark:text-[#0B2148]">
                                {item.material?.category || "RAW"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-purple-600 dark:text-purple-400 text-right">
                              {item.quantity} {item.material?.unit || "pcs"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50/40 dark:bg-white">
                <button
                  type="button"
                  onClick={() => setPreviewBomModalItem(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-[#0B2148] font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT MATERIAL PART NUMBER MAPPING */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isMaterialModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsMaterialModalOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-4xl xl:max-w-5xl max-h-[92vh] flex flex-col bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#0B2148]">
                        {selectedMaterial ? "Edit Material Part Number & Specs" : "Register Material SKU & Part Number"}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        selectedMaterial 
                          ? "bg-blue-50 text-blue-700 border-blue-200" 
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        {selectedMaterial ? `SKU: ${selectedMaterial.sku}` : "New Component Master"}
                      </span>
                    </div>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      Configure master SKU identity, category classification, duplicate prevention, and inventory specifications in a single view.
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)} 
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[#526B91] hover:text-[#0B2148] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <form id="material-sku-form" onSubmit={handleMaterialFormSubmit} className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
                {/* 1. Component Identification & Part Number Section */}
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      1. Master Part Number & Identity
                    </p>
                    <span className="text-[11px] font-mono text-[#526B91]">
                      Non-cell auxiliary components (BMS, busbars, wire, enclosure)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                    {/* Part Number / SKU */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>Part Number / SKU *</span>
                        <span className="text-[10px] text-[#526B91]">Unique Identifier</span>
                      </label>
                      <input 
                        type="text"
                        value={materialFormSku}
                        onChange={(e) => setMaterialFormSku(e.target.value.toUpperCase())}
                        required
                        placeholder="e.g. BMS-JK-16S-100A, BB-CU-16S-2MM"
                        className={`w-full bg-white border rounded-xl py-2 px-3 text-xs font-mono font-bold focus:outline-none shadow-xs ${
                          materialSkuConflict 
                            ? "border-red-500 text-red-600 focus:ring-1 focus:ring-red-500" 
                            : "border-slate-300 text-blue-600 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        }`}
                      />
                      {/* Duplicate Validation Status */}
                      {materialSkuConflict ? (
                        <p className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>
                            Duplicate SKU! Already used by {duplicateMaterial ? `"${duplicateMaterial.name}"` : `Cell "${duplicateCellForMaterial?.cellName}"`}.
                          </span>
                        </p>
                      ) : trimmedMaterialSku ? (
                        <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Part Number is unique & available</span>
                        </p>
                      ) : null}
                    </div>

                    {/* Internal Material Code */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Internal Material Code
                      </label>
                      <input 
                        type="text"
                        value={materialFormCode}
                        onChange={(e) => setMaterialFormCode(e.target.value)}
                        placeholder="e.g. MAT-BMS-001, KZ-HW-042"
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-blue-600 shadow-xs"
                      />
                    </div>

                    {/* Material Name / Identity */}
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Material Name / Commercial Identity *
                      </label>
                      <input 
                        type="text"
                        value={materialFormName}
                        onChange={(e) => setMaterialFormName(e.target.value)}
                        required
                        placeholder="e.g. Smart BMS 16S 100A CAN/RS485 Common Port with NTC"
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-blue-600 shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Classification & Inventory Parameters */}
                <div className="p-4 bg-blue-50/30 border border-blue-200/80 rounded-2xl space-y-3.5">
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    2. Classification, Costing & Inventory Specs
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                    {/* Category with Inline Quick-Create */}
                    <div className="md:col-span-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Material Category *
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsInlineCategoryOpen(!isInlineCategoryOpen)}
                          className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          {isInlineCategoryOpen ? "Close Category Input" : "+ New Category"}
                        </button>
                      </div>

                      {isInlineCategoryOpen && (
                        <div className="p-2.5 bg-white border border-blue-300 rounded-xl space-y-2 mb-2 shadow-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={inlineCategoryName}
                              onChange={(e) => setInlineCategoryName(e.target.value)}
                              placeholder="New category name..."
                              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-blue-600"
                            />
                            <button
                              type="button"
                              onClick={handleInlineCreateCategory}
                              disabled={createCategoryMutation.isPending || !inlineCategoryName.trim()}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-semibold text-xs cursor-pointer shadow-xs"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsInlineCategoryOpen(false)}
                              className="text-[#526B91] hover:text-slate-700 text-xs px-2 py-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <select
                        value={selectedCategoryValue}
                        onChange={(e) => setSelectedCategoryValue(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer shadow-xs"
                      >
                        {allAvailableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Material Type (QTZ / NQZ) */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Quality Testing Tier (Type) *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMaterialTypeValue("QTZ")}
                          className={`py-2 px-3 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer flex flex-col items-center ${
                            materialTypeValue === "QTZ"
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                          }`}
                        >
                          <span>QTZ</span>
                          <span className="text-[9px] opacity-80 font-normal">Quality Testing Zone</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaterialTypeValue("NQZ")}
                          className={`py-2 px-3 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer flex flex-col items-center ${
                            materialTypeValue === "NQZ"
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                          }`}
                        >
                          <span>NQZ</span>
                          <span className="text-[9px] opacity-80 font-normal">Non-Quality Zone</span>
                        </button>
                      </div>
                    </div>

                    {/* Unit of Measure */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Unit of Measure *
                      </label>
                      <select
                        value={materialFormUnit}
                        onChange={(e) => setMaterialFormUnit(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono font-semibold text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer shadow-xs"
                      >
                        {UNIT_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1">
                    {/* Standard Unit Cost */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Standard Base Cost (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#526B91] font-mono text-xs">₹</span>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={materialFormUnitPrice}
                          onChange={(e) => setMaterialFormUnitPrice(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-7 pr-3 text-xs font-mono font-bold text-[#0B2148] focus:outline-none focus:border-blue-600 shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Minimum Safety Stock */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Minimum Safety Stock Level
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={materialFormMinStock}
                        onChange={(e) => setMaterialFormMinStock(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-blue-600 shadow-xs"
                      />
                    </div>

                    {/* Active Toggle */}
                    <div className="md:col-span-4 flex items-end">
                      <label className="w-full flex items-center gap-2.5 p-2 bg-white border border-slate-300 rounded-xl cursor-pointer hover:border-slate-400 transition-colors shadow-xs h-[38px]">
                        <input 
                          type="checkbox"
                          checked={materialFormIsActive}
                          onChange={(e) => setMaterialFormIsActive(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-800">
                          Active in BOM & Catalog
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Technical Notes & Application Scope */}
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Technical Notes & Specifications (Optional)</span>
                    <span className="text-[10px] text-[#526B91]">Shown in BOM component picker</span>
                  </label>
                  <textarea 
                    value={materialFormDescription}
                    onChange={(e) => setMaterialFormDescription(e.target.value)}
                    rows={2}
                    placeholder="e.g. 16S 100A continuous discharge, Bluetooth app support, includes NTC temperature sensors, CAN & RS485 communication..."
                    className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-blue-600 shadow-xs"
                  />
                </div>
              </form>

              {/* Sticky Action Footer */}
              <div className="flex items-center justify-between p-4 border-t border-[#D8E8FA] bg-white shrink-0">
                <div>
                  {materialSkuConflict ? (
                    <span className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Duplicate Part Number detected. Please fix SKU before saving.
                    </span>
                  ) : (
                    <span className="text-xs text-[#526B91]">
                      {selectedMaterial ? "Updating existing material mapping" : "Creating new master material mapping"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => setIsMaterialModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    form="material-sku-form"
                    disabled={saveMaterialMutation.isPending || !!materialSkuConflict || !materialFormSku.trim() || !materialFormName.trim()}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    {saveMaterialMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {selectedMaterial ? "Save Material Changes" : "Register Material SKU"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: ADD / EDIT CELL PART NUMBER MAPPING */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isCellModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCellModalOpen(false)} 
              className="absolute inset-0 bg-white backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-white dark:bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 text-slate-900 dark:text-[#0B2148]"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148]">
                    {selectedCell ? "Edit Cell Part Number" : "Add Cell Part Number"}
                  </h3>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Master Battery Cell SKU Specification
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCellModalOpen(false)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[#526B91] hover:text-[#526B91] dark:hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form id="cell-sku-form" onSubmit={handleCellFormSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cell Part Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                      Cell Part Number / SKU *
                    </label>
                    <input 
                      name="cellSku"
                      defaultValue={selectedCell?.cellSku}
                      required
                      placeholder="e.g. CELL-LFP-3200"
                      className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Cell Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                      Cell Specification / Name *
                    </label>
                    <input 
                      name="cellName"
                      defaultValue={selectedCell?.cellName}
                      required
                      placeholder="e.g. 3.2V 3200mAh Cylindrical Cell"
                      className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Chemistry */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                      Cell Chemistry *
                    </label>
                    <select
                      name="chemistry"
                      defaultValue={selectedCell?.chemistry || "LFP"}
                      className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {CHEMISTRY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                      Manufacturer / Supplier
                    </label>
                    <input 
                      name="supplier"
                      defaultValue={selectedCell?.supplier}
                      placeholder="e.g. EVE Energy / CATL"
                      className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Nominal Voltage */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                      Nominal Voltage (V) *
                    </label>
                    <input 
                      name="nominalVoltage"
                      type="number"
                      step="0.01"
                      min="0.1"
                      defaultValue={selectedCell?.nominalVoltage ?? 3.2}
                      required
                      className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Nominal Capacity */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                      Nominal Capacity (Ah) *
                    </label>
                    <input 
                      name="nominalCapacity"
                      type="number"
                      step="0.01"
                      min="0.1"
                      defaultValue={selectedCell?.nominalCapacity ?? 3.2}
                      required
                      className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Active Toggle */}
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
                      <input 
                        name="isActive"
                        type="checkbox"
                        defaultChecked={selectedCell ? selectedCell.isActive !== false : true}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-[#0B2148]">
                        Active Master Cell Part Number
                      </span>
                    </label>
                  </div>
                </div>
              </form>

              {/* Sticky Action Footer */}
              <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-white shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsCellModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="cell-sku-form"
                  disabled={saveCellMutation.isPending}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {saveCellMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {selectedCell ? "Save Changes" : "Create Cell SKU"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: CREATE MATERIAL CATEGORY MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCategoryModalOpen(false)} 
              className="absolute inset-0 bg-white backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-10 text-slate-900 dark:text-[#0B2148]"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148]">New Material Category</h3>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Register a new classification tag
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[#526B91] hover:text-[#526B91] dark:hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form id="category-create-form" onSubmit={handleCreateCategorySubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#0B2148]">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    required
                    placeholder="e.g. THERMAL_PAD, BUSBAR_INSULATOR"
                    className="w-full bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-900 dark:text-[#0B2148] focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-[#526B91]">
                    Names are automatically formatted to uppercase.
                  </p>
                </div>
              </form>

              {/* Sticky Action Footer */}
              <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-white shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="category-create-form"
                  disabled={createCategoryMutation.isPending || !newCategoryInput.trim()}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                >
                  {createCategoryMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Category
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: REGISTER / EDIT BOM MASTER TEMPLATE MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isBomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsBomModalOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              <form id="bom-master-form" onSubmit={handleBomFormSubmit} className="flex flex-col h-full max-h-[92vh]">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-purple-50/60 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                      <Component className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#0B2148]">
                          {selectedBom ? "Edit BOM Master Template" : "Register BOM Master Template"}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-700 border border-purple-200">
                          {bomFormItems.length} Material Types
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-[#526B91] border border-slate-200">
                          {totalBomPiecesCount} Parts Total
                        </span>
                      </div>
                      <p className="text-xs text-[#526B91] mt-0.5">
                        Multi-parameter component search, category filters, and kit quantity recipe per battery pack.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsBomModalOpen(false)} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-[#526B91] hover:text-[#0B2148] transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Top BOM Identification Code & Scope */}
                <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 shrink-0">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>BOM Drawing Code / BOM Number *</span>
                        <span className="text-[10px] text-[#526B91]">Unique Identifier</span>
                      </label>
                      <input 
                        type="text"
                        value={bomFormName}
                        onChange={(e) => setBomFormName(e.target.value)}
                        required
                        placeholder="e.g. BOM-KYRA-48V-100-REV1, BOM-KZ-72V-45AH"
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs font-mono font-bold text-purple-700 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-xs"
                      />
                    </div>

                    <div className="md:col-span-7 space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        BOM Description / Assembly Scope
                      </label>
                      <input 
                        type="text"
                        value={bomFormDescription}
                        onChange={(e) => setBomFormDescription(e.target.value)}
                        placeholder="e.g. Standard 48V 100Ah LFP assembly kit with Smart BMS, Busbars, Wire harness, and Enclosure"
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:border-purple-600 shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Two-Column Split Workspace */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100/60">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    
                    {/* LEFT PANEL: Component Catalog & Multi-Parameter Search */}
                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col shadow-xs space-y-3">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-600" />
                          <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                            1. Component Catalog Picker
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-[#526B91]">
                          <strong>{filteredCatalogMaterials.length}</strong> available
                        </span>
                      </div>

                      {/* Multi-Parameter Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bomCatalogSearch}
                          onChange={(e) => {
                            setBomCatalogSearch(e.target.value);
                            setBomCatalogPage(1);
                          }}
                          placeholder="Search SKU, name, code, parameter/specs, category..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 shadow-2xs"
                        />
                        {bomCatalogSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setBomCatalogSearch("");
                              setBomCatalogPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Category Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setBomCatalogCategoryFilter("ALL");
                            setBomCatalogPage(1);
                          }}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                            bomCatalogCategoryFilter === "ALL"
                              ? "bg-purple-600 text-white shadow-xs"
                              : "bg-slate-100 text-[#526B91] hover:bg-slate-200"
                          }`}
                        >
                          All ({ (materials || []).length })
                        </button>
                        {allAvailableCategories.map((cat: string) => {
                          const count = (materials || []).filter((m: any) => (m.category || "").toUpperCase() === cat.toUpperCase()).length;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setBomCatalogCategoryFilter(cat);
                                setBomCatalogPage(1);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-semibold text-[10px] uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                                bomCatalogCategoryFilter.toUpperCase() === cat.toUpperCase()
                                  ? "bg-purple-600 text-white shadow-xs"
                                  : "bg-slate-100 text-[#526B91] hover:bg-slate-200"
                              }`}
                            >
                              {cat} {count > 0 && `(${count})`}
                            </button>
                          );
                        })}
                      </div>

                      {/* Per-Page Selector & Range Indicator */}
                      <div className="flex items-center justify-between text-[11px] text-[#526B91] px-0.5">
                        <span>
                          {filteredCatalogMaterials.length === 0 ? (
                            "No materials"
                          ) : (
                            <>
                              Showing <strong>{((currentCatalogPage - 1) * (bomCatalogPerPage === "ALL" ? filteredCatalogMaterials.length : bomCatalogPerPage)) + 1}</strong>–
                              <strong>{Math.min(currentCatalogPage * (bomCatalogPerPage === "ALL" ? filteredCatalogMaterials.length : bomCatalogPerPage), filteredCatalogMaterials.length)}</strong> of <strong>{filteredCatalogMaterials.length}</strong>
                            </>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px]">Per Page:</span>
                          {[6, 12, 24, "ALL"].map((pp) => (
                            <button
                              key={String(pp)}
                              type="button"
                              onClick={() => {
                                setBomCatalogPerPage(pp as any);
                                setBomCatalogPage(1);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                                bomCatalogPerPage === pp
                                  ? "bg-purple-100 text-purple-700 border border-purple-300"
                                  : "bg-slate-100 text-[#526B91] hover:bg-slate-200"
                              }`}
                            >
                              {pp}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Catalog Cards List */}
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {paginatedCatalogMaterials.length === 0 ? (
                          <div className="p-8 text-center text-xs text-[#526B91] bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No component materials match your search parameters.
                          </div>
                        ) : (
                          paginatedCatalogMaterials.map((m: any) => {
                            const bomItem = bomFormItems.find(it => it.materialId === m.id);
                            const inBomQty = bomItem ? bomItem.quantity : 0;

                            return (
                              <div
                                key={m.id}
                                className={`p-3 rounded-xl border transition-all ${
                                  inBomQty > 0
                                    ? "bg-purple-50/50 border-purple-300 shadow-2xs"
                                    : "bg-white border-slate-200 hover:border-purple-200"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-mono font-bold text-xs text-purple-700">
                                        {m.sku}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-[#526B91]">
                                        {m.category}
                                      </span>
                                      {m.materialCode && (
                                        <span className="text-[10px] font-mono text-[#526B91]">
                                          Code: {m.materialCode}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold text-[#0B2148] truncate">
                                      {m.name}
                                    </p>
                                    {m.description && (
                                      <p className="text-[11px] text-[#526B91] line-clamp-2">
                                        {m.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Action / Stepper */}
                                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                                    <span className="text-[10px] font-mono font-bold text-[#526B91] px-1.5 py-0.5 rounded bg-slate-100">
                                      {m.unit || "PCS"}
                                    </span>
                                    {inBomQty > 0 ? (
                                      <div className="flex items-center gap-1 bg-white border border-purple-300 rounded-lg p-0.5 shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() => handleDecrementBomMaterial(m.id)}
                                          className="w-6 h-6 rounded flex items-center justify-center text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                                          title="Decrease quantity"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-8 text-center font-mono font-bold text-xs text-purple-700">
                                          {inBomQty}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleQuickAddBomMaterial(m)}
                                          className="w-6 h-6 rounded flex items-center justify-center text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                                          title="Increase quantity"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAddBomMaterial(m)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-2xs transition-all cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Catalog Pagination Footer */}
                      {catalogTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            disabled={currentCatalogPage <= 1}
                            onClick={() => setBomCatalogPage(prev => Math.max(1, prev - 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[#526B91] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-medium text-[11px]"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                          </button>
                          <span className="text-[11px] font-mono text-[#526B91]">
                            Page <strong>{currentCatalogPage}</strong> of <strong>{catalogTotalPages}</strong>
                          </span>
                          <button
                            type="button"
                            disabled={currentCatalogPage >= catalogTotalPages}
                            onClick={() => setBomCatalogPage(prev => Math.min(catalogTotalPages, prev + 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[#526B91] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-medium text-[11px]"
                          >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* RIGHT PANEL: Active BOM Recipe List & Quantity Management */}
                    <div className="lg:col-span-6 bg-white border border-purple-200/90 rounded-2xl p-4 flex flex-col shadow-xs space-y-3">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-purple-100">
                        <div className="flex items-center gap-2">
                          <Component className="w-4 h-4 text-purple-600" />
                          <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                            2. Active Assembly Recipe ({bomFormItems.length})
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleAddBomItemRow}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[11px] shadow-2xs transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            Add Custom Row
                          </button>
                          {bomFormItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setBomFormItems([])}
                              className="px-2 py-1 rounded-lg border border-slate-200 text-[#526B91] hover:text-red-600 text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Search Bar for Added Items */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bomAddedSearch}
                          onChange={(e) => {
                            setBomAddedSearch(e.target.value);
                            setBomAddedPage(1);
                          }}
                          placeholder="Search within added recipe components..."
                          className="w-full bg-purple-50/30 border border-purple-200 rounded-xl py-2 pl-9 pr-8 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-1 focus:ring-purple-600 shadow-2xs"
                        />
                        {bomAddedSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setBomAddedSearch("");
                              setBomAddedPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Added Items Per-Page Selector & Range */}
                      <div className="flex items-center justify-between text-[11px] text-[#526B91] px-0.5">
                        <span>
                          {filteredAddedBomItems.length === 0 ? (
                            "0 items"
                          ) : (
                            <>
                              Showing <strong>{((currentAddedPage - 1) * (bomAddedPerPage === "ALL" ? filteredAddedBomItems.length : bomAddedPerPage)) + 1}</strong>–
                              <strong>{Math.min(currentAddedPage * (bomAddedPerPage === "ALL" ? filteredAddedBomItems.length : bomAddedPerPage), filteredAddedBomItems.length)}</strong> of <strong>{filteredAddedBomItems.length}</strong>
                            </>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px]">Per Page:</span>
                          {[5, 10, 20, "ALL"].map((pp) => (
                            <button
                              key={String(pp)}
                              type="button"
                              onClick={() => {
                                setBomAddedPerPage(pp as any);
                                setBomAddedPage(1);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                                bomAddedPerPage === pp
                                  ? "bg-purple-100 text-purple-700 border border-purple-300"
                                  : "bg-slate-100 text-[#526B91] hover:bg-slate-200"
                              }`}
                            >
                              {pp}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Added Items List */}
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {paginatedAddedBomItems.length === 0 ? (
                          <div className="p-8 text-center space-y-2 bg-purple-50/30 rounded-xl border border-dashed border-purple-200">
                            <p className="text-xs text-[#526B91]">
                              {bomAddedSearch ? "No added components match your search filter." : "No components added to this BOM recipe yet."}
                            </p>
                            {!bomAddedSearch && (
                              <p className="text-[11px] text-purple-700 font-medium">
                                Pick components from the catalog on the left or click &quot;Add Custom Row&quot;.
                              </p>
                            )}
                          </div>
                        ) : (
                          paginatedAddedBomItems.map((item) => {
                            const originalIdx = item.originalIndex;
                            const mat = item.material;

                            return (
                              <div
                                key={originalIdx}
                                className="p-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-all shadow-2xs space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {originalIdx + 1}
                                    </span>
                                    <span className="font-mono font-bold text-xs text-purple-700">
                                      {mat?.sku || "Select Material"}
                                    </span>
                                    {mat?.category && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-[#526B91]">
                                        {mat.category}
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBomItemRow(originalIdx)}
                                    className="p-1 text-[#526B91] hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Remove component from BOM"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Material Selector Dropdown */}
                                <div>
                                  <select
                                    value={item.materialId}
                                    onChange={(e) => handleBomItemChange(originalIdx, "materialId", e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-purple-600 cursor-pointer"
                                  >
                                    {(materials || []).map((m: any) => (
                                      <option key={m.id} value={m.id}>
                                        [{m.sku}] {m.name} {m.materialCode ? `(${m.materialCode})` : ""} — {m.category} • {m.unit || "PCS"}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Parameter / Specs & Quantity Stepper */}
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                  <p className="text-[11px] text-[#526B91] truncate flex-1">
                                    {mat?.description || mat?.name || "Standard component"}
                                  </p>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] text-[#526B91] font-medium">Qty:</span>
                                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleBomItemStepQty(originalIdx, -1)}
                                        className="w-6 h-6 rounded flex items-center justify-center text-[#526B91] hover:text-[#0B2148] hover:bg-white transition-colors cursor-pointer"
                                        title="Decrease quantity"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => handleBomItemChange(originalIdx, "quantity", e.target.value)}
                                        className="w-12 text-center font-mono font-bold text-xs text-purple-700 bg-transparent focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleBomItemStepQty(originalIdx, 1)}
                                        className="w-6 h-6 rounded flex items-center justify-center text-[#526B91] hover:text-[#0B2148] hover:bg-white transition-colors cursor-pointer"
                                        title="Increase quantity"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <span className="text-[10px] font-mono text-[#526B91] min-w-7">
                                      {mat?.unit || "PCS"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Added Items Pagination Footer */}
                      {addedTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-2 border-t border-purple-100 text-xs">
                          <button
                            type="button"
                            disabled={currentAddedPage <= 1}
                            onClick={() => setBomAddedPage(prev => Math.max(1, prev - 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-200 text-[#526B91] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-50 cursor-pointer font-medium text-[11px]"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                          </button>
                          <span className="text-[11px] font-mono text-[#526B91]">
                            Page <strong>{currentAddedPage}</strong> of <strong>{addedTotalPages}</strong>
                          </span>
                          <button
                            type="button"
                            disabled={currentAddedPage >= addedTotalPages}
                            onClick={() => setBomAddedPage(prev => Math.min(addedTotalPages, prev + 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-200 text-[#526B91] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-50 cursor-pointer font-medium text-[11px]"
                          >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Sticky Action Footer */}
                <div className="flex items-center justify-between p-4 border-t border-[#D8E8FA] bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#526B91]">
                      Total Components: <strong className="text-purple-700">{bomFormItems.length}</strong>
                    </span>
                    <span className="text-xs font-mono text-[#526B91]">
                      Total Aggregate Units: <strong className="text-[#0B2148]">{totalBomPiecesCount}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button 
                      type="button" 
                      onClick={() => setIsBomModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={saveBomMutation.isPending || !bomFormName.trim() || bomFormItems.length === 0}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                    >
                      {saveBomMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {selectedBom ? "Update BOM Template" : "Register BOM Template"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 5: PREVIEW BOM SPECIFICATION MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewBomModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setPreviewBomModalItem(null)} 
              className="absolute inset-0 bg-white backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-5xl bg-white dark:bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-900 dark:text-[#0B2148]"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-purple-50/40 dark:bg-purple-950/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <Component className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#0B2148] flex items-center gap-2">
                      <span>BOM: {previewBomModalItem.name}</span>
                      <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold">
                        {previewBomModalItem.items?.length || 0} Materials
                      </span>
                    </h3>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      {previewBomModalItem.description || "Bill of Materials Specification Breakdown"}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setPreviewBomModalItem(null)} 
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-[#526B91] hover:text-[#526B91] dark:hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-[#526B91] font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-3.5 py-2.5 w-12">#</th>
                        <th className="px-3.5 py-2.5">Component / SKU</th>
                        <th className="px-3.5 py-2.5">Category</th>
                        <th className="px-3.5 py-2.5 text-center">Req. Qty / Pack</th>
                        <th className="px-3.5 py-2.5 text-right">In Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {(previewBomModalItem.items || []).map((it: any, idx: number) => {
                        const mat = it.material || (materials || []).find((m: any) => m.id === it.materialId);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-3.5 py-2.5 font-mono text-[#526B91]">{idx + 1}</td>
                            <td className="px-3.5 py-2.5">
                              <p className="font-bold text-slate-900 dark:text-[#0B2148]">{mat?.name || `Material #${it.materialId?.slice(0, 8)}`}</p>
                              <p className="text-[10px] font-mono text-[#526B91]">{mat?.sku || "SKU"}</p>
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#526B91] dark:text-[#0B2148] font-mono text-[10px] font-semibold">
                                {mat?.category || "PART"}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                              {it.quantity} {mat?.unit || "PCS"}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#526B91] dark:text-[#0B2148]">
                              {mat?.quantity !== undefined ? `${mat.quantity} ${mat.unit || "PCS"}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/40 dark:bg-white">
                <span className="text-[11px] text-[#526B91] font-mono">
                  Total Parts Required: {(previewBomModalItem.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0)} units
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      const bomToEdit = previewBomModalItem;
                      setPreviewBomModalItem(null);
                      handleOpenBomModal(bomToEdit);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit Template
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPreviewBomModalItem(null)}
                    className="px-4 py-1.5 rounded-xl text-xs font-medium text-[#526B91] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(deleteConfirmTarget)}
        title={
          deleteConfirmTarget?.title ||
          (deleteConfirmTarget?.type === "financialReset" || deleteConfirmTarget?.type === "defaultsReset"
            ? "Reset System Settings?"
            : `Delete ${deleteConfirmTarget?.recordType || "Record"}?`)
        }
        recordType={deleteConfirmTarget?.recordType || "Configuration"}
        recordIdentity={deleteConfirmTarget?.recordIdentity || ""}
        description={deleteConfirmTarget?.description || "This action cannot be undone."}
        warningText={deleteConfirmTarget?.warningText}
        hasDependencies={deleteConfirmTarget?.hasDependencies}
        isIrreversible={true}
        confirmButtonText={
          deleteConfirmTarget?.confirmButtonText ||
          (deleteConfirmTarget?.type === "financialReset" || deleteConfirmTarget?.type === "defaultsReset"
            ? "Yes, Reset to Defaults"
            : "Yes, Delete Record")
        }
        isPending={
          deletePaxTypeMutation.isPending ||
          deleteBomMutation.isPending ||
          deleteMaterialMutation.isPending ||
          deleteCellMutation.isPending ||
          deleteCategoryMutation.isPending ||
          resetFinancialMutation.isPending ||
          resetDefaultsMutation.isPending
        }
        onCancel={() => setDeleteConfirmTarget(null)}
        onConfirm={async () => {
          if (deleteConfirmTarget?.onConfirm) {
            await deleteConfirmTarget.onConfirm();
          }
          setDeleteConfirmTarget(null);
        }}
      />

      {/* ========================================================= */}
      {/* DEDICATED PRINT CONTAINER (Shown only when printing) */}
      {/* ========================================================= */}
      <div id="material-sku-print-container" className="hidden print:block p-8 bg-white text-black font-sans">
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">KYRA ZAM 2.0 — Material Master Catalog</h1>
              <p className="text-xs text-slate-600 mt-1">
                Non-Cell Component Specifications, Part Numbers, and Inventory Master
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <p>Printed: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              <p>Total Records: {filteredMaterials.length}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono text-slate-700 bg-slate-100 p-2 rounded">
            <span><strong>Category:</strong> {categoryFilter}</span>
            <span><strong>Type:</strong> {typeFilter}</span>
            {materialSearch && <span><strong>Keyword:</strong> &quot;{materialSearch}&quot;</span>}
          </div>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <th className="py-2 px-2 w-10 text-center">#</th>
              <th className="py-2 px-3">Part Number / SKU</th>
              <th className="py-2 px-3">Material Name</th>
              <th className="py-2 px-3">Internal Code</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-2 text-center">Type</th>
              <th className="py-2 px-2 text-center">UOM</th>
              <th className="py-2 px-3 text-right">Standard Cost</th>
              <th className="py-2 px-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredMaterials.map((mat: any, idx: number) => (
              <tr key={mat.id || idx} className="hover:bg-slate-50">
                <td className="py-2 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                <td className="py-2 px-3 font-mono font-bold text-slate-900">{mat.sku}</td>
                <td className="py-2 px-3 font-semibold text-slate-800">{mat.name}</td>
                <td className="py-2 px-3 font-mono text-slate-600">{mat.materialCode || "—"}</td>
                <td className="py-2 px-3 font-semibold text-slate-700">{mat.category}</td>
                <td className="py-2 px-2 text-center font-mono font-bold">{mat.materialType || "QTZ"}</td>
                <td className="py-2 px-2 text-center font-mono">{mat.unit || "PCS"}</td>
                <td className="py-2 px-3 text-right font-mono font-medium">
                  {mat.unitPrice ? `₹${Number(mat.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                </td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    mat.isActive !== false ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"
                  }`}>
                    {mat.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 pt-4 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between font-mono">
          <span>KYRA ZAM 2.0 ERP — Confidential Factory Master Data</span>
          <span>End of Catalog Listing</span>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #material-sku-print-container,
          #material-sku-print-container * {
            visibility: visible;
          }
          #material-sku-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
