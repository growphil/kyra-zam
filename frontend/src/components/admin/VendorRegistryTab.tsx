"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Truck, 
  Plus, 
  X, 
  Loader2, 
  Save, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  XCircle,
  User,
  Edit,
  Tag,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  FolderPlus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";

const ITEMS_PER_PAGE = 10;

const DEFAULT_VENDOR_CATEGORIES = [
  "CELLS",
  "BMS",
  "RAW_MATERIAL",
  "BUSBAR",
  "ELECTRONICS",
  "ENCLOSURE",
  "HARDWARE",
  "INSULATION",
  "EQUIPMENT",
  "PACKAGING",
  "LOGISTICS",
  "SERVICES"
];

export default function VendorRegistryTab() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  
  // Form Categories state
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  // Category Manager Modal state
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryManagerSearch, setCategoryManagerSearch] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<any>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Deactivation confirmation dialog state
  const [deactivatingVendor, setDeactivatingVendor] = useState<any>(null);

  // --- VENDORS QUERY ---
  const { data: vendors, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => (await api.get("/admin/vendors")).data,
    staleTime: 30000,
  });

  // --- VENDOR CATEGORIES QUERY ---
  const { data: vendorCategoriesData, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["admin-vendor-categories"],
    queryFn: async () => (await api.get("/admin/vendor-categories")).data,
    staleTime: 30000,
  });

  // --- CREATE VENDOR CATEGORY MUTATION ---
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => (await api.post("/admin/vendor-categories", { name })).data,
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-categories"] });
      toast.success(`Category "${newCat?.name || "New"}" added successfully`);
      setNewCategoryName("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to create category");
    }
  });

  // --- DELETE VENDOR CATEGORY MUTATION ---
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/vendor-categories/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success("Vendor category deleted successfully");
      setDeletingCategory(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete category");
      setDeletingCategory(null);
    }
  });

  // --- CREATE / UPDATE VENDOR MUTATION ---
  const saveVendorMutation = useMutation({
    mutationFn: async (payload: { id?: string; data: any }) => {
      if (payload.id) {
        return (await api.patch(`/admin/vendors/${payload.id}`, payload.data)).data;
      }
      return (await api.post("/admin/vendors", payload.data)).data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(variables.id ? "Vendor profile updated successfully" : "Vendor registered successfully");
      setIsModalOpen(false);
      setSelectedVendor(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to save vendor record");
    }
  });

  // --- TOGGLE VENDOR STATUS MUTATION ---
  const toggleVendorMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      api.patch(`/admin/vendors/${id}`, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      toast.success(variables.isActive ? "Vendor reactivated successfully" : "Vendor deactivated successfully");
      setDeactivatingVendor(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to update vendor status");
    }
  });

  const handleOpenModal = (vendor: any = null) => {
    setSelectedVendor(vendor);
    const initialCats: string[] = Array.isArray(vendor?.categories) && vendor.categories.length > 0
      ? vendor.categories
      : vendor?.category
      ? [vendor.category]
      : [];
    setFormCategories(initialCats);
    setCustomCategoryInput("");
    setIsModalOpen(true);
  };

  const handleToggleFormCategory = (catName: string) => {
    const formatted = catName.trim().toUpperCase();
    setFormCategories(prev =>
      prev.includes(formatted) ? prev.filter(c => c !== formatted) : [...prev, formatted]
    );
  };

  const handleAddCustomFormCategory = () => {
    const trimmed = customCategoryInput.trim().toUpperCase();
    if (!trimmed) return;
    if (!formCategories.includes(trimmed)) {
      setFormCategories(prev => [...prev, trimmed]);
    }
    const existsInMaster = (vendorCategoriesData || []).some((c: any) => c.name?.toUpperCase() === trimmed);
    if (!existsInMaster) {
      createCategoryMutation.mutate(trimmed);
    }
    setCustomCategoryInput("");
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string || "").trim();
    const contact = (formData.get("contact") as string || "").trim();
    const phone = (formData.get("phone") as string || "").trim();
    const address = (formData.get("address") as string || "").trim();

    const data: any = {
      name: (formData.get("name") as string || "").trim(),
      contact: contact || undefined,
      phone: phone || undefined,
      email: email ? email : undefined,
      address: address || undefined,
      category: formCategories[0] || undefined,
      categories: formCategories,
    };

    saveVendorMutation.mutate({
      id: selectedVendor?.id,
      data
    });
  };

  // All distinct selectable categories combining defaults, master DB list, and vendor records
  const allSelectableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_VENDOR_CATEGORIES);
    (vendorCategoriesData || []).forEach((c: any) => {
      if (c.name) set.add(c.name.trim().toUpperCase());
    });
    (vendors || []).forEach((v: any) => {
      if (v.category) set.add(v.category.trim().toUpperCase());
      if (Array.isArray(v.categories)) {
        v.categories.forEach((cat: string) => {
          if (cat) set.add(cat.trim().toUpperCase());
        });
      }
    });
    return Array.from(set).sort();
  }, [vendorCategoriesData, vendors]);

  // Derive all valid configured category values dynamically with vendor counts
  const availableCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    allSelectableCategories.forEach((cat) => {
      catMap.set(cat, 0);
    });
    (vendors || []).forEach((v: any) => {
      const vendorCats = new Set<string>();
      if (v.category) vendorCats.add(v.category.trim().toUpperCase());
      if (Array.isArray(v.categories)) {
        v.categories.forEach((cat: string) => {
          if (cat) vendorCats.add(cat.trim().toUpperCase());
        });
      }
      vendorCats.forEach((cat) => {
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      });
    });
    return Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [allSelectableCategories, vendors]);

  const unassignedCount = useMemo(() => {
    return (vendors || []).filter((v: any) => (!v.categories || v.categories.length === 0) && !v.category).length;
  }, [vendors]);

  // Combined Filtering: Category + Status + Keyword Search
  const filteredVendors = useMemo(() => {
    return (vendors || []).filter((v: any) => {
      // 1. Status Filter
      if (statusFilter === "ACTIVE" && v.isActive === false) return false;
      if (statusFilter === "INACTIVE" && v.isActive !== false) return false;

      // 2. Category Filter
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "UNASSIGNED") {
          if (v.categories && v.categories.length > 0) return false;
        } else {
          const match = (v.categories || []).some(
            (c: string) => c.toLowerCase() === selectedCategory.toLowerCase()
          );
          if (!match) return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = v.name?.toLowerCase().includes(q);
        const matchesContact = (v.contactPerson || v.contact)?.toLowerCase().includes(q);
        const matchesEmail = v.email?.toLowerCase().includes(q);
        const matchesPhone = v.phone?.toLowerCase().includes(q);
        const matchesAddress = v.address?.toLowerCase().includes(q);
        const matchesId = v.id?.toLowerCase().includes(q);
        const matchesCat = (v.categories || []).some((c: string) => c.toLowerCase().includes(q));

        if (!matchesName && !matchesContact && !matchesEmail && !matchesPhone && !matchesAddress && !matchesId && !matchesCat) {
          return false;
        }
      }

      return true;
    });
  }, [vendors, statusFilter, selectedCategory, searchQuery]);

  // Bounded Pagination Calculations
  const totalItems = filteredVendors.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedVendors = filteredVendors.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const activeCount = (vendors || []).filter((v: any) => v.isActive !== false).length;
  const inactiveCount = (vendors || []).filter((v: any) => v.isActive === false).length;

  return (
    <div className="space-y-5 text-[#0B2148]">
      {/* 1. KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {[
          { 
            label: "Total Registered Vendors", 
            value: vendors?.length || 0, 
            icon: Truck, 
            color: "text-[#0878F9]", 
            bg: "bg-[#EAF5FF] border-[#BFDBFE]",
            sub: `${availableCategories.length} categories active`
          },
          { 
            label: "Active Suppliers", 
            value: activeCount, 
            icon: CheckCircle2, 
            color: "text-[#166534]", 
            bg: "bg-[#DCFCE7] border-[#BBF7D0]",
            sub: "Operational procurement links"
          },
          { 
            label: "Inactive / Suspended", 
            value: inactiveCount, 
            icon: XCircle, 
            color: "text-[#991B1B]", 
            bg: "bg-[#FEE2E2] border-[#FECACA]",
            sub: inactiveCount > 0 ? "Excluded from new POs" : "Zero suspended accounts"
          },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-white p-4 sm:p-4.5 rounded-2xl border border-[#D8E8FA] shadow-2xs flex items-center gap-4 hover:border-[#0878F9]/40 transition-all"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${stat.bg} ${stat.color} shrink-0`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-[#0B2148] tracking-tight">{stat.value}</p>
              <p className="text-[11px] text-[#526B91] font-medium mt-0.5">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 2. Main Vendor Directory Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#D8E8FA] overflow-hidden shadow-2xs"
      >
        {/* Panel Header & Filter Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-[#D8E8FA] space-y-3.5 bg-[#F4F9FF]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9] shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0B2148] flex items-center gap-2">
                  <span>Vendor & Supplier Registry</span>
                  {isFetching && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0878F9]" />}
                </h3>
                <p className="text-xs text-[#526B91] font-medium">
                  Maintain battery cell manufacturers, raw material vendors, and contact directories.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setIsCategoryManagerOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-white hover:bg-[#EAF5FF] text-[#0878F9] border border-[#BFDBFE] px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-2xs cursor-pointer shrink-0"
                title="Manage Vendor Categories"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Categories ({allSelectableCategories.length})</span>
              </button>

              <button 
                type="button"
                onClick={() => handleOpenModal(null)}
                className="flex items-center justify-center gap-1.5 bg-[#0878F9] hover:bg-[#0667DB] px-4 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Vendor</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Keyword Search + Category Filter + Status Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative lg:col-span-5">
              <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search vendor name, contact, phone, email, address..."
                className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-8 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-[#0B2148] text-xs p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown (Derived from actual vendor data model) */}
            <div className="relative lg:col-span-4">
              <div className="flex items-center gap-1.5 w-full">
                <Tag className="w-3.5 h-3.5 text-[#526B91] shrink-0 hidden sm:inline" />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
                >
                  <option value="ALL">All Categories ({vendors?.length || 0})</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                  {unassignedCount > 0 && (
                    <option value="UNASSIGNED">Unassigned / No POs ({unassignedCount})</option>
                  )}
                </select>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="lg:col-span-3 flex items-center justify-end">
              <div className="inline-flex bg-white p-0.5 rounded-xl border border-[#D8E8FA] shadow-2xs w-full sm:w-auto">
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((st) => {
                  const isActive = statusFilter === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setStatusFilter(st);
                        setCurrentPage(1);
                      }}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive 
                          ? "bg-[#EAF5FF] text-[#0878F9] border border-[#BFDBFE] shadow-2xs" 
                          : "text-[#526B91] hover:text-[#0B2148]"
                      }`}
                    >
                      {st === "ALL" ? "All" : st === "ACTIVE" ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick-Filter Horizontal Categories Strip */}
          <div className="pt-2 border-t border-[#D8E8FA]/70 flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#0878F9]" />
              <span>Category:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === "ALL"
                  ? "bg-[#0878F9] text-white shadow-xs font-bold"
                  : "bg-white text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] border border-[#D8E8FA]"
              }`}
            >
              All ({vendors?.length || 0})
            </button>

            {availableCategories.map((cat) => {
              const isSelected = selectedCategory.toUpperCase() === cat.name.toUpperCase();
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(isSelected ? "ALL" : cat.name);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-[#0878F9] text-white shadow-xs font-bold"
                      : "bg-white text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] border border-[#D8E8FA]"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected
                      ? "bg-white/20 text-white font-bold"
                      : "bg-slate-100 text-[#526B91]"
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}

            {unassignedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(selectedCategory === "UNASSIGNED" ? "ALL" : "UNASSIGNED");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === "UNASSIGNED"
                    ? "bg-amber-600 text-white shadow-xs font-bold"
                    : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                <span>Unassigned</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-200/80 text-amber-900 font-bold">
                  {unassignedCount}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCategoryManagerOpen(true)}
              className="text-[#0878F9] hover:underline text-[11px] font-bold shrink-0 ml-1 cursor-pointer flex items-center gap-1"
            >
              <FolderPlus className="w-3 h-3" />
              <span>+ Manage</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-[#526B91]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0878F9]" />
            <p className="text-xs font-semibold">Loading supplier catalog...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-red-700">
              Failed to load vendor directory
            </p>
            <p className="text-[11px] text-[#526B91]">
              {(error as any)?.message || "Network communication error"}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0878F9] text-white rounded-lg text-xs font-bold hover:bg-[#0667DB] cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91] w-12 text-center">S.No</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Supplier & Organization</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Supplied Categories</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Contact Person</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Communication</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Facility Address</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91] text-center">Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#526B91] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC]">
                  {paginatedVendors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-14 text-center text-[#526B91]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Filter className="w-8 h-8 text-slate-300" />
                          <p className="text-sm font-semibold text-[#0B2148]">No vendors matched your filter criteria</p>
                          <p className="text-xs text-[#526B91]">
                            {searchQuery || selectedCategory !== "ALL" || statusFilter !== "ALL"
                              ? "Try adjusting your search keywords, category selector, or status filter."
                              : "No suppliers registered in the database yet. Click \"Add Vendor\" above."}
                          </p>
                          {(searchQuery || selectedCategory !== "ALL" || statusFilter !== "ALL") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery("");
                                setSelectedCategory("ALL");
                                setStatusFilter("ALL");
                                setCurrentPage(1);
                              }}
                              className="mt-2 text-xs font-bold text-[#0878F9] hover:underline cursor-pointer"
                            >
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedVendors.map((vendor: any, idx: number) => {
                      const rowNum = startIndex + idx + 1;
                      const hasCategories = Array.isArray(vendor.categories) && vendor.categories.length > 0;

                      return (
                        <tr key={vendor.id} className="hover:bg-[#F4F9FF]/80 transition-colors group">
                          {/* S.No */}
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-xs text-[#526B91]">
                            {rowNum}
                          </td>

                          {/* Vendor Name */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#EAF5FF] border border-[#BFDBFE] rounded-lg flex items-center justify-center text-[#0878F9] shrink-0 group-hover:border-[#0878F9] transition-all">
                                <Truck className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors truncate">
                                  {vendor.name}
                                </p>
                                <p className="text-[10px] text-[#526B91] font-mono">
                                  ID: {vendor.id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Supplied Categories Badges */}
                          <td className="px-5 py-3.5">
                            {hasCategories ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {vendor.categories.map((cat: string) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCategory(cat);
                                      setCurrentPage(1);
                                    }}
                                    title={`Click to filter by ${cat}`}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-blue-50 text-[#0878F9] border border-blue-200 hover:bg-[#0878F9] hover:text-white transition-all cursor-pointer"
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenModal(vendor)}
                                className="text-[11px] text-[#526B91] hover:text-[#0878F9] italic hover:underline cursor-pointer"
                                title="Click to assign categories to this vendor"
                              >
                                + Assign Category
                              </button>
                            )}
                          </td>

                          {/* Contact Person */}
                          <td className="px-5 py-3.5">
                            <p className="text-xs text-[#0B2148] font-medium">
                              {vendor.contactPerson || vendor.contact || "—"}
                            </p>
                          </td>

                          {/* Communication */}
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              {vendor.email && (
                                <p className="text-[11px] text-[#526B91] flex items-center gap-1.5 font-mono">
                                  <Mail className="w-3 h-3 text-[#526B91] shrink-0" />
                                  <span className="truncate max-w-[160px]">{vendor.email}</span>
                                </p>
                              )}
                              {vendor.phone && (
                                <p className="text-[11px] text-[#526B91] flex items-center gap-1.5 font-mono">
                                  <Phone className="w-3 h-3 text-[#526B91] shrink-0" />
                                  <span>{vendor.phone}</span>
                                </p>
                              )}
                              {!vendor.email && !vendor.phone && (
                                <span className="text-[11px] text-[#526B91]">No contact details</span>
                              )}
                            </div>
                          </td>

                          {/* Facility Address */}
                          <td className="px-5 py-3.5">
                            <p className="text-xs text-[#526B91] max-w-xs truncate" title={vendor.address || undefined}>
                              {vendor.address || "—"}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              vendor.isActive !== false 
                                ? "bg-[#DCFCE7] border border-[#BBF7D0] text-[#166534]" 
                                : "bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B]"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${vendor.isActive !== false ? "bg-[#166534]" : "bg-[#991B1B]"}`} />
                              {vendor.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>

                          {/* Actions: Edit + Status Toggle */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenModal(vendor)}
                                className="p-1.5 text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] rounded-lg transition-colors cursor-pointer"
                                title="Edit Vendor Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {vendor.isActive === false ? (
                                <button
                                  type="button"
                                  onClick={() => toggleVendorMutation.mutate({ id: vendor.id, isActive: true })}
                                  disabled={toggleVendorMutation.isPending}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#DCFCE7] hover:bg-[#BBF7D0] border border-[#BBF7D0] text-[#166534] transition-all cursor-pointer shadow-2xs"
                                  title="Activate Supplier"
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeactivatingVendor(vendor)}
                                  disabled={toggleVendorMutation.isPending}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEE2E2] hover:bg-[#FECACA] border border-[#FECACA] text-[#991B1B] transition-all cursor-pointer shadow-2xs"
                                  title="Deactivate Supplier"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F4F9FF]">
                <p className="text-xs text-[#526B91]">
                  Showing <span className="font-bold text-[#0B2148]">{startIndex + 1}</span> to{" "}
                  <span className="font-bold text-[#0B2148]">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> of{" "}
                  <span className="font-bold text-[#0B2148]">{totalItems}</span> vendors
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#D8E8FA] bg-white text-[#526B91] hover:text-[#0B2148] disabled:opacity-40 cursor-pointer shadow-2xs"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-white border border-[#D8E8FA] text-[#0B2148]">
                    {safePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-[#D8E8FA] bg-white text-[#526B91] hover:text-[#0B2148] disabled:opacity-40 cursor-pointer shadow-2xs"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* 3. Register / Edit Vendor Modal (Bounded Viewport Dimensions & Sticky Footer) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              <form onSubmit={handleFormSubmit} className="flex flex-col h-full max-h-[88vh]">
                {/* Fixed Header */}
                <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9] shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B2148]">
                        {selectedVendor ? "Edit Vendor Details" : "Register New Vendor"}
                      </h3>
                      <p className="text-[11px] font-semibold text-[#526B91] uppercase tracking-wider mt-0.5">
                        Supplier & Partner Master Directory
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)} 
                    className="p-1.5 hover:bg-[#EAF5FF] rounded-lg text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Form Body */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                      Vendor / Company Name *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        name="name" 
                        required 
                        defaultValue={selectedVendor?.name || ""}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-1 focus:ring-[#0878F9] outline-none text-xs font-semibold" 
                        placeholder="e.g. Apex Lithium Tech India Pvt Ltd" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                      Contact Person
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        name="contact" 
                        defaultValue={selectedVendor?.contactPerson || selectedVendor?.contact || ""}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-1 focus:ring-[#0878F9] outline-none text-xs" 
                        placeholder="e.g. Suresh Menon" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          name="email" 
                          type="email"
                          defaultValue={selectedVendor?.email || ""}
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-1 focus:ring-[#0878F9] outline-none text-xs" 
                          placeholder="sales@vendor.com" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          name="phone" 
                          defaultValue={selectedVendor?.phone || ""}
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-1 focus:ring-[#0878F9] outline-none text-xs" 
                          placeholder="+91 98201 11223" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                      Facility / Office Address
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#526B91] absolute left-3 top-2.5" />
                      <textarea 
                        name="address" 
                        rows={2}
                        defaultValue={selectedVendor?.address || ""}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-1 focus:ring-[#0878F9] outline-none text-xs resize-none" 
                        placeholder="Plot 42, Electronic City Phase 1, Bengaluru 560100..." 
                      />
                    </div>
                  </div>

                  {/* Vendor Categories Selection */}
                  <div className="space-y-2 pt-2 border-t border-[#E8F1FC]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#0878F9]" />
                        <span>Vendor Categories *</span>
                        <span className="text-[10px] font-normal text-[#526B91] lowercase tracking-normal">
                          (select all goods / services supplied)
                        </span>
                      </label>
                      <span className="text-[11px] font-mono font-bold text-[#0878F9] bg-[#EAF5FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
                        {formCategories.length} Selected
                      </span>
                    </div>

                    <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl space-y-2.5">
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {allSelectableCategories.map((cat) => {
                          const isSelected = formCategories.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => handleToggleFormCategory(cat)}
                              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[#0878F9] text-white shadow-xs font-bold"
                                  : "bg-white text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] border border-slate-200"
                              }`}
                            >
                              <CheckCircle2 className={`w-3 h-3 ${isSelected ? "text-white" : "opacity-0"}`} />
                              <span>{cat}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Category Quick Adder */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#D8E8FA]/70">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={customCategoryInput}
                            onChange={(e) => setCustomCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddCustomFormCategory();
                              }
                            }}
                            placeholder="Type new category & press Add or Enter..."
                            className="w-full bg-white border border-[#D8E8FA] rounded-lg py-1.5 pl-3 pr-2 text-xs text-[#0B2148] placeholder-[#94A3B8] focus:border-[#0878F9] outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCustomFormCategory}
                          disabled={!customCategoryInput.trim()}
                          className="px-3 py-1.5 bg-white hover:bg-[#EAF5FF] text-[#0878F9] border border-[#BFDBFE] rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedVendor?.categories && selectedVendor.categories.length > 0 && (
                    <div className="p-3 bg-blue-50/50 border border-blue-200/60 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">
                        Current Associated Categories
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedVendor.categories.map((c: string) => (
                          <span key={c} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-[#0878F9] border border-blue-200">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Visible Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-[#D8E8FA] flex items-center justify-end gap-2.5 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2 rounded-xl border border-[#D8E8FA] text-[#0B2148] hover:bg-[#EAF5FF] hover:text-[#0878F9] font-bold text-xs transition-all cursor-pointer bg-white shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saveVendorMutation.isPending} 
                    className="flex items-center justify-center gap-1.5 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 px-5 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                  >
                    {saveVendorMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{selectedVendor ? "Save Changes" : "Register Vendor"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Shared Accessible Deactivation Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(deactivatingVendor)}
        onClose={() => setDeactivatingVendor(null)}
        onConfirm={async () => {
          if (deactivatingVendor) {
            await toggleVendorMutation.mutateAsync({ id: deactivatingVendor.id, isActive: false });
          }
        }}
        title="Deactivate Supplier Account"
        recordType="Vendor Partner"
        recordIdentity={deactivatingVendor ? `${deactivatingVendor.name} (ID: ${deactivatingVendor.id?.slice(0, 8)})` : ""}
        description={`Are you sure you want to suspend active procurement transactions with ${deactivatingVendor?.name}?`}
        warningText="Deactivating this supplier will prevent purchase managers from selecting them for new purchase orders, goods receipts, or asset requisitions. All historical transactions, PO numbers, and bills will remain fully intact for audit compliance."
        hasDependencies={true}
        isIrreversible={false}
        isPending={toggleVendorMutation.isPending}
        confirmButtonText="Deactivate Supplier"
        cancelButtonText="Keep Active"
      />

      {/* 5. Vendor Categories Master Manager Modal */}
      <AnimatePresence>
        {isCategoryManagerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCategoryManagerOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              {/* Header */}
              <div className="p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9] shrink-0">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0B2148]">
                      Vendor Category Master
                    </h3>
                    <p className="text-[11px] font-semibold text-[#526B91] uppercase tracking-wider mt-0.5">
                      Maintain & Organize Supplier Classifications
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(false)} 
                  className="p-1.5 hover:bg-[#EAF5FF] rounded-lg text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Add Category Form */}
                <div className="p-3.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl space-y-2">
                  <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                    Register New Vendor Category
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newCategoryName.trim()) {
                              createCategoryMutation.mutate(newCategoryName.trim().toUpperCase());
                            }
                          }
                        }}
                        placeholder="e.g. SOLAR_INVERTERS, PACKAGING..."
                        className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-xs text-[#0B2148] placeholder-[#94A3B8] focus:border-[#0878F9] outline-none font-semibold"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                      onClick={() => {
                        if (newCategoryName.trim()) {
                          createCategoryMutation.mutate(newCategoryName.trim().toUpperCase());
                        }
                      }}
                      className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                    >
                      {createCategoryMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Add Category</span>
                    </button>
                  </div>
                </div>

                {/* Search Categories */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={categoryManagerSearch}
                    onChange={(e) => setCategoryManagerSearch(e.target.value)}
                    placeholder="Search category name..."
                    className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-3 text-xs text-[#0B2148] placeholder-[#94A3B8] focus:border-[#0878F9] outline-none"
                  />
                </div>

                {/* Categories Table / List */}
                <div className="border border-[#D8E8FA] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[#526B91] font-bold text-[10px] uppercase">
                        <th className="px-4 py-2.5">Category Name</th>
                        <th className="px-4 py-2.5 text-center">Assigned Vendors</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8F1FC]">
                      {availableCategories
                        .filter((c) => c.name.toLowerCase().includes(categoryManagerSearch.toLowerCase().trim()))
                        .map((cat) => {
                          const dbRecord = (vendorCategoriesData || []).find(
                            (item: any) => item.name?.toUpperCase() === cat.name.toUpperCase()
                          );

                          return (
                            <tr key={cat.name} className="hover:bg-[#F4F9FF]/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-[#0B2148]">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-[#0878F9]" />
                                  <span className="font-mono font-bold">{cat.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  cat.count > 0 
                                    ? "bg-blue-50 text-[#0878F9] border border-blue-200" 
                                    : "bg-slate-100 text-[#526B91]"
                                }`}>
                                  {cat.count} {cat.count === 1 ? "vendor" : "vendors"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {dbRecord ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (cat.count > 0) {
                                        toast.error(`Cannot delete "${cat.name}" because it is currently assigned to ${cat.count} vendor(s). Please reassign them first.`);
                                        return;
                                      }
                                      setDeletingCategory(dbRecord);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title={cat.count > 0 ? "Category has assigned vendors" : "Delete category"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Preset</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-[#D8E8FA] flex items-center justify-between shrink-0">
                <span className="text-xs text-[#526B91]">
                  Total <span className="font-bold text-[#0B2148]">{availableCategories.length}</span> categories configured
                </span>
                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#D8E8FA] text-[#0B2148] hover:bg-[#EAF5FF] hover:text-[#0878F9] font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Category Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={async () => {
          if (deletingCategory) {
            await deleteCategoryMutation.mutateAsync(deletingCategory.id);
          }
        }}
        title="Delete Vendor Category"
        recordType="Category"
        recordIdentity={deletingCategory ? deletingCategory.name : ""}
        description={`Are you sure you want to delete vendor category "${deletingCategory?.name}"?`}
        warningText="This category will be permanently removed from the vendor master directory. Any newly registered vendors will no longer be able to select it."
        hasDependencies={false}
        isIrreversible={true}
        isPending={deleteCategoryMutation.isPending}
        confirmButtonText="Delete Category"
        cancelButtonText="Cancel"
      />
    </div>
  );
}
