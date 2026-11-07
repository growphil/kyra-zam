"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import {
  Search,
  Package,
  Layers,
  Check,
  X,
  Loader2,
  Tag,
  Sparkles,
  Building2,
  Info
} from "lucide-react";

export interface SelectedItemData {
  materialId?: string | null;
  productId?: string | null;
  poItemId?: string | null;
  name: string;
  partNumber?: string;
  brand?: string;
  productUin?: string;
  sku?: string;
  category?: string;
  unit: string;
  unitPrice: number;
  taxRate?: number;
  imageUrl?: string | null;
  specification?: string;
}

interface MaterialProductSelectorProps {
  onSelect: (item: SelectedItemData) => void;
  availablePOItems?: any[];
  placeholder?: string;
}

export default function MaterialProductSelector({
  onSelect,
  availablePOItems = [],
  placeholder = "Search by Product Name, Material, SKU, Part Number, UIN, Brand..."
}: MaterialProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Fetch Catalog Products
  const { data: catalogData, isLoading: isCatalogLoading } = useQuery({
    queryKey: ["procurement-products-selector", searchTerm],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/products", {
        params: { search: searchTerm.trim() || undefined, limit: 15 }
      });
      return res.data?.products || [];
    },
    enabled: isOpen && searchTerm.trim().length > 1
  });

  // 2. Fetch Raw Materials
  const { data: materialsData, isLoading: isMaterialsLoading } = useQuery({
    queryKey: ["inventory-materials-selector", searchTerm],
    queryFn: async () => {
      const res = await api.get("/inventory/materials");
      return res.data || [];
    },
    enabled: isOpen
  });

  // Filter materials based on search term
  const filteredMaterials = (materialsData || [])
    .filter((m: any) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.sku?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
      );
    })
    .slice(0, 15);

  // Filter available PO Items if passed
  const filteredPOItems = (availablePOItems || []).filter((item: any) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const name = item.product?.name || item.material?.name || item.description || "";
    const part = item.partNumber || item.product?.partNumber || "";
    return name.toLowerCase().includes(q) || part.toLowerCase().includes(q);
  });

  const handleSelectPOItem = (item: any) => {
    onSelect({
      poItemId: item.id,
      productId: item.productId || item.product?.id || null,
      materialId: item.materialId || item.material?.id || null,
      name: item.product?.name || item.material?.name || item.description,
      partNumber: item.partNumber || item.product?.partNumber || "",
      brand: item.brand || item.product?.brand || "",
      productUin: item.productUin || item.product?.uin || "",
      sku: item.material?.sku || "",
      category: item.product?.category || item.material?.category || "RAW_MATERIAL",
      unit: item.product?.unit || item.material?.unit || "PCS",
      unitPrice: Number(item.unitPrice || 0),
      taxRate: Number(item.taxRate || 18),
      imageUrl: item.imageUrl || item.product?.imageUrl || null,
      specification: item.specification || ""
    });
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleSelectProduct = (prod: any) => {
    onSelect({
      productId: prod.id,
      materialId: prod.materialId || null,
      name: prod.name,
      partNumber: prod.partNumber,
      brand: prod.brand,
      productUin: prod.uin,
      sku: prod.material?.sku || "",
      category: prod.category,
      unit: prod.unit || "PCS",
      unitPrice: Number(prod.material?.unitPrice || 0),
      taxRate: 18,
      imageUrl: prod.imageUrl || null,
      specification: prod.technicalSpecs || ""
    });
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleSelectMaterial = (mat: any) => {
    onSelect({
      materialId: mat.id,
      productId: null,
      name: mat.name,
      sku: mat.sku,
      category: mat.category,
      unit: mat.unit || "pcs",
      unitPrice: Number(mat.unitPrice || 0),
      taxRate: 18,
      specification: mat.description || ""
    });
    setSearchTerm("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#D8E8FA] rounded-xl text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:ring-2 focus:ring-[#0878F9]/30 focus:border-[#0878F9] transition-all"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-[#0B2148]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-[360px] overflow-y-auto bg-white border border-[#D8E8FA] rounded-2xl shadow-xl p-2 space-y-3">
          {/* Section 1: Lines from the selected Purchase Order */}
          {filteredPOItems.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0878F9] bg-[#EAF5FF] rounded-lg flex items-center justify-between mb-1">
                <span>Authorized Lines in PO</span>
                <span className="text-[9px] font-normal">{filteredPOItems.length} items</span>
              </div>
              <div className="space-y-1">
                {filteredPOItems.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPOItem(p)}
                    className="w-full text-left p-2 rounded-xl hover:bg-[#F4F9FF] border border-transparent hover:border-[#D8E8FA] transition-all flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#EAF5FF] flex items-center justify-center shrink-0 border border-[#D8E8FA]">
                        <Package className="w-3.5 h-3.5 text-[#0878F9]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0B2148] truncate">
                          {p.product?.name || p.material?.name || p.description}
                        </div>
                        <div className="text-[10px] text-[#526B91] flex items-center gap-2">
                          {p.partNumber && <span className="font-mono">Part: {p.partNumber}</span>}
                          {p.brand && <span>Brand: {p.brand}</span>}
                          <span>Ordered: {p.quantityOrdered}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-[#0B2148]">
                        ₹{Number(p.unitPrice).toLocaleString()}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                        PO Line
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Catalog Products */}
          {catalogData && catalogData.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#526B91] bg-slate-100 rounded-lg flex items-center justify-between mb-1">
                <span>Product Master Catalog</span>
                <span className="text-[9px] font-normal">{catalogData.length} items</span>
              </div>
              <div className="space-y-1">
                {catalogData.map((prod: any) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full text-left p-2 rounded-xl hover:bg-[#F4F9FF] border border-transparent hover:border-[#D8E8FA] transition-all flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {prod.imageUrl ? (
                        <img
                          src={getMediaUrl(prod.imageUrl)}
                          alt={prod.name}
                          className="w-7 h-7 rounded-lg object-cover border border-[#D8E8FA]"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0B2148] truncate">{prod.name}</div>
                        <div className="text-[10px] text-[#526B91] flex items-center gap-2">
                          <span className="font-mono">Part: {prod.partNumber}</span>
                          <span>Brand: {prod.brand}</span>
                          <span className="text-indigo-600 font-mono text-[9px]">{prod.uin}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-[#526B91] font-mono">
                        {prod.unit || "PCS"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Raw Materials */}
          {filteredMaterials.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#526B91] bg-slate-100 rounded-lg flex items-center justify-between mb-1">
                <span>Raw Materials Registry</span>
                <span className="text-[9px] font-normal">{filteredMaterials.length} items</span>
              </div>
              <div className="space-y-1">
                {filteredMaterials.map((mat: any) => (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleSelectMaterial(mat)}
                    className="w-full text-left p-2 rounded-xl hover:bg-[#F4F9FF] border border-transparent hover:border-[#D8E8FA] transition-all flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
                        <Layers className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0B2148] truncate">{mat.name}</div>
                        <div className="text-[10px] text-[#526B91] flex items-center gap-2 font-mono">
                          <span>SKU: {mat.sku}</span>
                          <span>Stock: {mat.quantity} {mat.unit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-[#0B2148]">
                        ₹{Number(mat.unitPrice || 0).toLocaleString()}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-[#526B91] font-mono">
                        {mat.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCatalogLoading && (
            <div className="flex items-center justify-center py-4 text-xs text-[#526B91] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0878F9]" />
              Searching catalog...
            </div>
          )}

          {filteredPOItems.length === 0 && (!catalogData || catalogData.length === 0) && filteredMaterials.length === 0 && !isCatalogLoading && (
            <div className="text-center py-4 text-xs text-[#526B91]">
              No matching products or materials found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

