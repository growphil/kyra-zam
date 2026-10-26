"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus, 
  Trash2, 
  Copy, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  Building2, 
  Calendar, 
  Tag, 
  DollarSign, 
  ShieldCheck, 
  Sparkles, 
  Search, 
  Package, 
  Layers, 
  Paperclip, 
  FileCheck2, 
  Printer, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  ChevronDown,
  Info,
  Clock,
  Truck,
  Edit,
  Pencil
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";

// Type definitions
interface POItem {
  id: string; // client temporary ID
  productId?: string;
  materialId?: string;
  name: string;
  partNumber: string;
  manufacturerPartNumber?: string;
  brand: string;
  productUin?: string;
  batchNumber?: string;
  category: string;
  unit: string;
  imageUrl?: string;
  quantityOrdered: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  specification?: string;
  expectedDeliveryDate?: string;
}

interface AttachedDoc {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
}

const COMMON_UNITS = ["PCS", "METER", "SET", "KG", "ROLL", "PAIR", "BOX", "LITER"];
const COMMON_CATEGORIES = [
  "BMS",
  "BUSBAR",
  "INSULATION",
  "WIRE",
  "ENCLOSURE",
  "HARDWARE",
  "ELECTRONICS",
  "RAW_MATERIAL",
  "CELLS",
  "PACKAGING",
  "OTHER"
];
const TAX_RATES = [0, 5, 12, 18, 28];

const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", label: "INR (₹) - Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", label: "USD ($) - US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "EUR (€) - Euro", locale: "de-DE" },
  { code: "ZMW", symbol: "ZK", label: "ZMW (ZK) - Zambian Kwacha", locale: "en-ZM" },
  { code: "GBP", symbol: "£", label: "GBP (£) - British Pound", locale: "en-GB" },
  { code: "ZAR", symbol: "R", label: "ZAR (R) - South African Rand", locale: "en-ZA" }
];

const getCurrencySymbol = (currencyCode?: string): string => {
  const norm = (currencyCode || "INR").trim().toUpperCase();
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === norm);
  return found ? found.symbol : norm;
};

export default function CreatePurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleSlug = (params?.role as string) || "admin";
  const queryClient = useQueryClient();

  const prIdFromUrl = searchParams.get("prId") || "";

  // Wizard Stage: 1 = Order Details, 2 = Add Items, 3 = Review & Confirm, 4 = Complete
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | 4>(1);

  // -------------------------------------------------------------
  // STAGE 1: ORDER DETAILS STATE
  // -------------------------------------------------------------
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Days Net");
  const [deliveryTerms, setDeliveryTerms] = useState("EXW Pune Assembly Depot");
  const [currency, setCurrency] = useState("INR");
  const [pendingCurrencyChange, setPendingCurrencyChange] = useState<string | null>(null);
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);
  const [billingAddress, setBillingAddress] = useState("KYRA ZAM HQ & Plant Bay 1, Pune, Maharashtra 411014");
  const [deliveryAddress, setDeliveryAddress] = useState("KYRA ZAM Central Receiving Warehouse, Gate 2, Pune");
  const [quotationReference, setQuotationReference] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [paxTypeId, setPaxTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);

  // Quick Create Supplier Modal
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
    category: "RAW_MATERIAL",
    paymentTerms: "30 Days Net"
  });

  // -------------------------------------------------------------
  // STAGE 2: ADD ITEMS STATE
  // -------------------------------------------------------------
  const [items, setItems] = useState<POItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("ALL");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Quick Create Brand Modal State
  const [isQuickBrandOpen, setIsQuickBrandOpen] = useState(false);
  const [quickBrandForm, setQuickBrandForm] = useState({
    name: "",
    code: "",
    description: "",
    country: "",
    website: ""
  });

  // New Product Modal State
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    partNumber: "",
    manufacturerPartNumber: "",
    brand: "",
    brandId: "",
    category: "BMS",
    unit: "PCS",
    materialId: "",
    technicalSpecs: "",
    description: "",
    imageUrl: "",
    initialPrice: 0,
    initialQty: 1,
    isActive: true
  });

  // Find Existing Part Number Cross-Brand Workflow State (Part-Number-First)
  const [findPartSearch, setFindPartSearch] = useState("");
  const [findPartResults, setFindPartResults] = useState<any[]>([]); // Grouped by partNumber
  const [isSearchingFindPart, setIsSearchingFindPart] = useState(false);
  const [selectedPartFamily, setSelectedPartFamily] = useState<{
    partNumber: string;
    name: string;
    category: string;
    unit: string;
    technicalSpecs?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    materialId?: string | null;
    brands: Array<{
      productId: string;
      brand: string;
      brandId?: string | null;
      brandCode?: string | null;
      uin: string;
      imageUrl?: string | null;
      unitPrice?: number;
    }>;
  } | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Duplicate Check & Sequence Allocation State
  const [duplicateCheckStatus, setDuplicateCheckStatus] = useState<
    "IDLE" | "CHECKING" | "CLEAN" | "EXACT_EXISTS" | "CROSS_BRAND_EXISTS"
  >("IDLE");
  const [duplicateMatchInfo, setDuplicateMatchInfo] = useState<{
    matchedProduct?: any;
    crossBrandProducts?: any[];
    message?: string;
  } | null>(null);

  // Image Upload State in New Product Modal
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingPartNumber, setIsGeneratingPartNumber] = useState(false);
  const [categoryMeta, setCategoryMeta] = useState<{ count: number; sequence: string }>({ count: 0, sequence: "001" });
  const [brandMeta, setBrandMeta] = useState<{ count: number; brandSeq: string }>({ count: 0, brandSeq: "001" });
  const [isNewBrandMode, setIsNewBrandMode] = useState(false);
  const [isEditNewBrandMode, setIsEditNewBrandMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Product Modal State
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editProductForm, setEditProductForm] = useState({
    id: "",
    uin: "",
    name: "",
    partNumber: "",
    brand: "",
    brandId: "",
    category: "BMS",
    unit: "PCS",
    materialId: "",
    technicalSpecs: "",
    description: "",
    imageUrl: "",
    isActive: true
  });
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Import PR Modal
  const [isPRImportOpen, setIsPRImportOpen] = useState(false);
  const [selectedPRId, setSelectedPRId] = useState(prIdFromUrl);

  // -------------------------------------------------------------
  // STAGE 3: REVIEW, ATTACHMENTS & SUBMISSION
  // -------------------------------------------------------------
  const [attachments, setAttachments] = useState<AttachedDoc[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // STAGE 4: RESULT STATE
  // -------------------------------------------------------------
  const [createdOrderResult, setCreatedOrderResult] = useState<any>(null);

  // -------------------------------------------------------------
  // SERVER QUERIES
  // -------------------------------------------------------------
  // Next PO Number preview
  const { data: poNumberData } = useQuery({
    queryKey: ["procurement-next-po-number"],
    queryFn: async () => (await api.get("/crm/procurement/purchase-orders/next-number")).data
  });

  // Vendors list
  const { data: vendorsList } = useQuery({
    queryKey: ["procurement-vendors-registry"],
    queryFn: async () => (await api.get("/sales/vendors")).data || []
  });

  // Brands Master List
  const { data: brandsRaw } = useQuery({
    queryKey: ["procurement-brands"],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/brands");
      return res.data?.brands || (Array.isArray(res.data) ? res.data : []);
    }
  });

  const brandsList: any[] = useMemo(() => {
    if (Array.isArray(brandsRaw)) return brandsRaw;
    if (brandsRaw && Array.isArray((brandsRaw as any).brands)) return (brandsRaw as any).brands;
    return [];
  }, [brandsRaw]);

  // Production Models (Pax Types)
  const { data: paxTypesList } = useQuery({
    queryKey: ["procurement-pax-models"],
    queryFn: async () => (await api.get("/admin/pax-types")).data || []
  });

  // Product Catalog
  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ["procurement-products-catalog", catalogSearch, catalogCategoryFilter],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/products", {
        params: {
          search: catalogSearch,
          category: catalogCategoryFilter === "ALL" ? undefined : catalogCategoryFilter,
          limit: 50
        }
      });
      return res.data;
    }
  });

  // Raw Materials mapping
  const { data: rawMaterialsList } = useQuery({
    queryKey: ["procurement-raw-materials"],
    queryFn: async () => (await api.get("/inventory/materials")).data || []
  });

  // Purchase Requests for Import
  const { data: purchaseRequestsList } = useQuery({
    queryKey: ["procurement-approved-prs"],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/purchase-requests", {
        params: { status: "APPROVED", limit: 20 }
      });
      return res.data?.requests || [];
    }
  });

  // Prefill from PR ID if present in URL
  const { data: prDetails } = useQuery({
    queryKey: ["pr-source-details", prIdFromUrl],
    queryFn: async () => {
      if (!prIdFromUrl) return null;
      return (await api.get(`/crm/procurement/purchase-requests/${prIdFromUrl}`)).data;
    },
    enabled: !!prIdFromUrl
  });

  useEffect(() => {
    if (prDetails) {
      if (prDetails.requiredDate) {
        setExpectedDeliveryDate(prDetails.requiredDate.split("T")[0]);
      }
      if (prDetails.notes) {
        setNotes(`Converted from PR #${prDetails.prNumber}: ${prDetails.notes}`);
      }
      if (prDetails.items && prDetails.items.length > 0) {
        const prItems: POItem[] = prDetails.items.map((item: any, idx: number) => ({
          id: `pr-item-${idx}-${Date.now()}`,
          materialId: item.materialId,
          name: item.material?.name || "Raw Material Component",
          partNumber: item.material?.sku || "",
          brand: "OEM",
          category: item.material?.category || "RAW_MATERIAL",
          unit: item.material?.unit || "PCS",
          quantityOrdered: item.requestedQuantity || 1,
          unitPrice: item.material?.unitPrice || 0,
          discount: 0,
          taxRate: 18,
          specification: item.specification || ""
        }));
        setItems(prItems);
      }
    }
  }, [prDetails]);

  // Click outside to close inline search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selected Vendor Snapshot
  const selectedVendor = useMemo(() => {
    return (vendorsList || []).find((v: any) => v.id === vendorId);
  }, [vendorsList, vendorId]);

  // Structured UIN Live Preview Calculation (VEN3-BILLSEQ-BRAND3-BRANDSEQ-PARTNO)
  const liveUinPreview = useMemo(() => {
    if (duplicateCheckStatus === "EXACT_EXISTS" && duplicateMatchInfo?.matchedProduct?.uin) {
      return duplicateMatchInfo.matchedProduct.uin;
    }
    const rawVen = (selectedVendor?.name || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const ven3 = rawVen.length >= 3 ? rawVen.slice(0, 3) : (rawVen || "KYR").padEnd(3, "X");
    const billSeq = "001";
    const matchedBrand = (Array.isArray(brandsList) ? brandsList : []).find(
      (b: any) => b.id === newProductForm.brandId || b.name?.toUpperCase() === newProductForm.brand?.toUpperCase()
    );
    const rawBrand = matchedBrand?.code || (newProductForm.brand || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const brand3 = rawBrand.length >= 3 ? rawBrand.slice(0, 3) : (rawBrand || "BRD").padEnd(3, "X");
    const brandSeq = brandMeta.brandSeq || "001";
    const partNo = (newProductForm.partNumber || "").trim().toUpperCase() || "[AUTO-PARTNO]";
    return `${ven3}-${billSeq}-${brand3}-${brandSeq}-${partNo}`;
  }, [duplicateCheckStatus, duplicateMatchInfo, selectedVendor, newProductForm.brand, newProductForm.brandId, newProductForm.partNumber, brandMeta.brandSeq, brandsList]);

  // Generate Part Number (CAT-SECNO) from server after duplicate checking
  const fetchNextPartNumber = async (category: string, showToast = true) => {
    try {
      setIsGeneratingPartNumber(true);
      const res = await api.get("/crm/procurement/products/next-part-number", {
        params: { category }
      });
      const allocatedPartNumber = res.data?.partNumber || res.data?.nextPartNumber;
      if (allocatedPartNumber) {
        setNewProductForm((prev) => ({ ...prev, partNumber: allocatedPartNumber, category }));
        setCategoryMeta({
          count: res.data?.count ?? 0,
          sequence: res.data?.nextSequence || (allocatedPartNumber.split("-")[1] || "001")
        });
        if (showToast) {
          toast.success(`Allocated next sequence: ${allocatedPartNumber} (${res.data?.count ?? 0} existing items in ${category})`);
        }
        return allocatedPartNumber;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate part number sequence");
    } finally {
      setIsGeneratingPartNumber(false);
    }
    return null;
  };

  // Perform Catalog Duplicate Check & Sequence Allocation
  const checkDuplicateAndAllocate = async (opts?: {
    forceAllocate?: boolean;
    overrideBrand?: string;
    overrideBrandId?: string;
    overrideCategory?: string;
    overrideName?: string;
    overridePartNumber?: string;
  }) => {
    const name = (opts?.overrideName !== undefined ? opts.overrideName : newProductForm.name).trim();
    const partNumber = (opts?.overridePartNumber !== undefined ? opts.overridePartNumber : newProductForm.partNumber).trim();
    const brand = (opts?.overrideBrand !== undefined ? opts.overrideBrand : newProductForm.brand).trim();
    const brandId = opts?.overrideBrandId !== undefined ? opts.overrideBrandId : newProductForm.brandId;
    const category = opts?.overrideCategory !== undefined ? opts.overrideCategory : newProductForm.category;

    if (!name && !partNumber) {
      toast.info("Please enter a product name or search query first.");
      return;
    }

    try {
      setDuplicateCheckStatus("CHECKING");
      const res = await api.post("/crm/procurement/products/check-duplicate", {
        search: name || undefined,
        partNumber: partNumber || undefined,
        brand: brand || undefined,
        brandId: brandId || undefined
      });

      const { hasExactMatch, exactMatches, hasCrossBrandMatch, crossBrandMatches } = res.data || {};

      if (hasExactMatch && exactMatches?.length > 0) {
        const match = exactMatches[0];
        setDuplicateCheckStatus("EXACT_EXISTS");
        setDuplicateMatchInfo({
          matchedProduct: match,
          message: `Product "${match.name}" (${match.partNumber}) is already registered under brand "${match.brand}" (UIN: ${match.uin}).`
        });
        toast.warning(`Exact match found under ${match.brand}. You can reuse it directly in this PO.`);
      } else if (hasCrossBrandMatch && crossBrandMatches?.length > 0) {
        const match = crossBrandMatches[0];
        setDuplicateCheckStatus("CROSS_BRAND_EXISTS");
        setDuplicateMatchInfo({
          matchedProduct: match,
          crossBrandProducts: crossBrandMatches,
          message: `Part Number / Item exists under brand "${match.brand}" (${match.partNumber}). Registering for "${brand || "new brand"}" creates a separate brand identity & distinct UIN.`
        });
        if (opts?.forceAllocate && !partNumber) {
          await fetchNextPartNumber(category, true);
        }
      } else {
        setDuplicateCheckStatus("CLEAN");
        setDuplicateMatchInfo({
          message: "No duplicates found across catalog. Product identity verified unique."
        });
        if (opts?.forceAllocate || !partNumber) {
          await fetchNextPartNumber(category, true);
        }
      }
    } catch (err: any) {
      console.warn("Failed checking duplicates:", err);
      setDuplicateCheckStatus("IDLE");
      if (opts?.forceAllocate && !partNumber) {
        await fetchNextPartNumber(category, true);
      }
    }
  };

  // Real-time Brand handler: only enter brand name, brand sequence number is auto-aligned on count
  // Changing selected brand triggers a fresh duplicate check
  const handleBrandChange = async (brandName: string) => {
    const val = brandName.toUpperCase();
    const matched = (Array.isArray(brandsList) ? brandsList : []).find(
      (b: any) => b.name?.toUpperCase() === val
    );
    const existingCount = matched?._count?.products ?? 0;
    const computedSeq = String(matched?.nextSequence || existingCount + 1).padStart(3, "0");
    setBrandMeta({ count: existingCount, brandSeq: computedSeq });
    setNewProductForm((prev) => ({
      ...prev,
      brand: val,
      brandId: matched ? matched.id : ""
    }));

    if (val.trim().length >= 2 || matched?.id) {
      try {
        const res = await api.get("/crm/procurement/brands/next-sequence", {
          params: { brand: val, brandId: matched?.id }
        });
        if (res.data?.brandSeq) {
          setBrandMeta({
            count: res.data.count ?? 0,
            brandSeq: res.data.brandSeq
          });
        }
      } catch {
        // Fallback already computed locally
      }
    }

    // Check if brand is already registered under the selected part number family
    if (selectedPartFamily) {
      const existingBrandMatch = selectedPartFamily.brands?.find(
        (b: any) => b.brand?.toUpperCase() === val || (matched?.id && b.brandId === matched.id)
      );

      if (existingBrandMatch) {
        setDuplicateCheckStatus("EXACT_EXISTS");
        setDuplicateMatchInfo({
          matchedProduct: {
            ...existingBrandMatch,
            id: existingBrandMatch.productId,
            name: selectedPartFamily.name,
            partNumber: selectedPartFamily.partNumber,
            category: selectedPartFamily.category
          },
          message: `Product "${selectedPartFamily.name}" (${selectedPartFamily.partNumber}) is already registered under brand "${existingBrandMatch.brand}" (UIN: ${existingBrandMatch.uin}). Saving will reuse this registered identity in the PO.`
        });
      } else if (val.trim()) {
        setDuplicateCheckStatus("CROSS_BRAND_EXISTS");
        setDuplicateMatchInfo({
          crossBrandProducts: selectedPartFamily.brands,
          message: `Part Number "${selectedPartFamily.partNumber}" will be registered under brand "${val}" as a distinct product identity with a newly allocated UIN. Existing records (${selectedPartFamily.brands.map((b: any) => b.brand).join(", ")}) remain unchanged.`
        });
      } else {
        setDuplicateCheckStatus("IDLE");
        setDuplicateMatchInfo({
          crossBrandProducts: selectedPartFamily.brands,
          message: `Part Number "${selectedPartFamily.partNumber}" selected. Existing brands: ${selectedPartFamily.brands.map((b: any) => b.brand).join(", ")}. Please choose or enter a brand.`
        });
      }
    } else if (newProductForm.name.trim() || newProductForm.partNumber.trim()) {
      checkDuplicateAndAllocate({
        overrideBrand: val,
        overrideBrandId: matched?.id || "",
        forceAllocate: false
      });
    }
  };

  // Draft state restoration from localStorage
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("kyra_po_draft_state");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.vendorId && !vendorId) setVendorId(parsed.vendorId);
        if (parsed.orderDate) setOrderDate(parsed.orderDate);
        if (parsed.expectedDeliveryDate) setExpectedDeliveryDate(parsed.expectedDeliveryDate);
        if (parsed.paymentTerms) setPaymentTerms(parsed.paymentTerms);
        if (parsed.deliveryTerms) setDeliveryTerms(parsed.deliveryTerms);
        if (parsed.currency) setCurrency(parsed.currency);
        if (parsed.billingAddress) setBillingAddress(parsed.billingAddress);
        if (parsed.deliveryAddress) setDeliveryAddress(parsed.deliveryAddress);
        if (parsed.quotationReference) setQuotationReference(parsed.quotationReference);
        if (parsed.paxTypeId) setPaxTypeId(parsed.paxTypeId);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.additionalCharges !== undefined) setAdditionalCharges(parsed.additionalCharges);
        if (Array.isArray(parsed.items) && parsed.items.length > 0 && items.length === 0) {
          setItems(parsed.items);
        }
      }
    } catch (e) {
      console.warn("Failed to restore PO draft", e);
    }
  }, []);

  // Draft state auto-save to localStorage
  useEffect(() => {
    if (currentStage === 4) return;
    try {
      const draft = {
        vendorId,
        orderDate,
        expectedDeliveryDate,
        paymentTerms,
        deliveryTerms,
        currency,
        billingAddress,
        deliveryAddress,
        quotationReference,
        paxTypeId,
        notes,
        additionalCharges,
        items
      };
      localStorage.setItem("kyra_po_draft_state", JSON.stringify(draft));
    } catch (e) {
      console.warn("Failed to auto-save PO draft", e);
    }
  }, [
    vendorId,
    orderDate,
    expectedDeliveryDate,
    paymentTerms,
    deliveryTerms,
    currency,
    billingAddress,
    deliveryAddress,
    quotationReference,
    paxTypeId,
    notes,
    additionalCharges,
    items,
    currentStage
  ]);

  // -------------------------------------------------------------
  // FINANCIAL CALCULATIONS (Mirrored from Backend Logic)
  // -------------------------------------------------------------
  const summaryCalculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const lineSub = Number(item.quantityOrdered || 0) * Number(item.unitPrice || 0);
      const discount = Math.min(lineSub, Number(item.discount || 0));
      const taxable = Math.max(0, lineSub - discount);
      const taxAmount = (taxable * Number(item.taxRate || 0)) / 100;

      subtotal += lineSub;
      totalDiscount += discount;
      totalTax += taxAmount;
    });

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const grandTotal = taxableAmount + totalTax + Number(additionalCharges || 0);

    return {
      subtotal,
      totalDiscount,
      taxableAmount,
      totalTax,
      additionalCharges: Number(additionalCharges || 0),
      grandTotal,
      totalQuantity: items.reduce((acc, it) => acc + Number(it.quantityOrdered || 0), 0)
    };
  }, [items, additionalCharges]);

  // -------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------
  // Quick Create Supplier Mutation
  const createSupplierMutation = useMutation({
    mutationFn: (data: any) => api.post("/sales/vendors", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-vendors-registry"] });
      const newVendorId = res.data?.id;
      if (newVendorId) {
        setVendorId(newVendorId);
      }
      toast.success(`Supplier "${res.data?.name || "New Supplier"}" created and selected`);
      setIsQuickSupplierOpen(false);
      setQuickSupplierForm({
        name: "",
        contact: "",
        phone: "",
        email: "",
        address: "",
        category: "RAW_MATERIAL",
        paymentTerms: "30 Days Net"
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to register supplier");
    }
  });

  // Quick Create Brand Mutation
  const createBrandMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/procurement/brands", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-brands"] });
      const newBrand = res.data?.brand;
      if (newBrand) {
        // Re-evaluate identity status against the selected part-number family (new brand => new UIN)
        void handleBrandChange(newBrand.name);
        setNewProductForm((prev) => ({ ...prev, brand: newBrand.name, brandId: newBrand.id }));
        setEditProductForm((prev) => ({ ...prev, brand: newBrand.name, brandId: newBrand.id }));
      }
      toast.success(`Brand "${newBrand?.name}" registered and selected`);
      setIsQuickBrandOpen(false);
      setQuickBrandForm({ name: "", code: "", description: "", country: "", website: "" });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to register brand");
    }
  });

  // Register New Product Mutation
  const createProductMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/procurement/products", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-brands"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["factory-overview"] });
      const prod = res.data?.product;
      const isExisting = res.data?.isExisting;

      if (prod) {
        // Auto-add to current PO items without resetting draft!
        const newItem: POItem = {
          id: `prod-${prod.id}-${Date.now()}`,
          productId: prod.id,
          materialId: prod.materialId || undefined,
          name: prod.name,
          partNumber: prod.partNumber,
          manufacturerPartNumber: prod.manufacturerPartNumber || undefined,
          brand: prod.brand,
          productUin: prod.uin,
          category: prod.category,
          unit: prod.unit || "PCS",
          imageUrl: prod.imageUrl || undefined,
          quantityOrdered: Number(newProductForm.initialQty) || 1,
          unitPrice: Number(newProductForm.initialPrice) || 0,
          discount: 0,
          taxRate: 18,
          specification: prod.technicalSpecs || undefined
        };

        setItems((prev) => [...prev, newItem]);
        toast.success(
          isExisting 
            ? `Reused registered product "${prod.name}" (${prod.uin})`
            : `Product "${prod.name}" registered, saved to Factory Material SKUs (${prod.partNumber}), and added to PO`
        );
      }

      setIsNewProductModalOpen(false);
      resetNewProductForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to register product");
    }
  });

  // Edit/Update Product Master Mutation
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/crm/procurement/products/${id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-brands"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["factory-overview"] });
      const updated = res.data?.product;
      if (updated) {
        setItems((prev) =>
          prev.map((it) =>
            it.productId === updated.id
              ? {
                  ...it,
                  name: updated.name,
                  partNumber: updated.partNumber,
                  brand: updated.brand,
                  productUin: updated.uin,
                  category: updated.category,
                  unit: updated.unit || it.unit,
                  imageUrl: updated.imageUrl || undefined,
                  specification: updated.technicalSpecs || it.specification
                }
              : it
          )
        );
      }
      toast.success(res.data?.message || "Product master updated successfully");
      setIsEditProductModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update product master");
    }
  });

  // Delete Product Master State & Mutation
  const [deleteProductTarget, setDeleteProductTarget] = useState<any | null>(null);

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/procurement/products/${id}`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-products"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-materials"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factory-overview"] });
      toast.success(res?.data?.message || "Product master permanently deleted");
      setDeleteProductTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete product master");
    }
  });

  // Submit PO (Draft or Pending Approval)
  const createPOMutation = useMutation({
    mutationFn: async ({ submitForApproval }: { submitForApproval: boolean }) => {
      // 1. Create PO
      const isDraft = !submitForApproval;
      const payload = {
        isDraft,
        vendorId,
        purchaseRequestId: selectedPRId || undefined,
        quotationReference: quotationReference.trim() || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || quotationReference.trim() || undefined,
        paxTypeId: paxTypeId || undefined,
        expectedDeliveryDate,
        currency,
        additionalCharges: Number(additionalCharges) || 0,
        paymentTerms,
        deliveryTerms,
        billingAddress,
        deliveryAddress,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId || undefined,
          materialId: it.materialId || undefined,
          brand: it.brand || undefined,
          partNumber: it.partNumber || undefined,
          productUin: it.productUin || undefined,
          imageUrl: it.imageUrl || undefined,
          batchNumber: it.batchNumber?.trim() || undefined,
          description: it.name,
          quantityOrdered: Number(it.quantityOrdered),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          specification: it.specification || undefined,
          expectedDeliveryDate: it.expectedDeliveryDate || undefined
        })),
        attachments: attachments.map((att) => ({
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileSize: att.fileSize,
          fileType: att.fileType
        }))
      };

      const res = await api.post("/crm/procurement/purchase-orders", payload);
      const createdPO = res.data;

      // 2. If user chose Submit for Approval and the backend left it in DRAFT, trigger submit transition
      if (submitForApproval && createdPO?.id && createdPO.status === "DRAFT") {
        const submitRes = await api.put(`/crm/procurement/purchase-orders/${createdPO.id}/submit`);
        return submitRes.data;
      }

      return createdPO;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-list"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-next-po-number"] });
      // Clear saved draft on completion
      try {
        localStorage.removeItem("kyra_po_draft_state");
      } catch (e) {}
      setCreatedOrderResult(order);
      setCurrentStage(4);
      toast.success(
        order.status === "APPROVED" || order.status === "SENT"
          ? `Purchase Order ${order.poNumber} created and automatically approved!`
          : order.status === "PENDING_APPROVAL"
          ? `Purchase Order ${order.poNumber} submitted for approval!`
          : `Purchase Order ${order.poNumber} created as Draft.`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create Purchase Order");
    }
  });

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const resetNewProductForm = () => {
    setNewProductForm({
      name: "",
      partNumber: "",
      manufacturerPartNumber: "",
      brand: "",
      brandId: "",
      category: "BMS",
      unit: "PCS",
      materialId: "",
      technicalSpecs: "",
      description: "",
      imageUrl: "",
      initialPrice: 0,
      initialQty: 1,
      isActive: true
    });
    setCategoryMeta({ count: 0, sequence: "001" });
    setBrandMeta({ count: 0, brandSeq: "001" });
    setIsNewBrandMode(false);
    setFindPartSearch("");
    setFindPartResults([]);
    setSelectedPartFamily(null);
    setIsDraggingImage(false);
    setDuplicateCheckStatus("IDLE");
    setDuplicateMatchInfo(null);
  };

  const uploadProductImageFile = async (file: File) => {
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validMimes.includes(file.type)) {
      toast.error("Invalid file format. Please upload JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5 MB.");
      return;
    }

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/crm/procurement/products/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data?.url) {
        setNewProductForm((prev) => ({ ...prev, imageUrl: res.data.url }));
        toast.success("Product image uploaded successfully");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload product image");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProductImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadProductImageFile(file);
  };

  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadProductImageFile(file);
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImage(true);
  };

  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImage(false);
  };

  // Find Existing Part Number Cross-Brand Search (Part-Number-First)
  const handleSearchFindPart = async (query: string) => {
    setFindPartSearch(query);
    if (!query || query.trim().length === 0) {
      setFindPartResults([]);
      return;
    }
    try {
      setIsSearchingFindPart(true);
      const res = await api.get("/crm/procurement/products/part-numbers", {
        params: { search: query.trim(), limit: 50 }
      });
      setFindPartResults(res.data?.partNumbers || []);
    } catch (err: any) {
      console.warn("Failed searching existing part numbers:", err);
    } finally {
      setIsSearchingFindPart(false);
    }
  };

  const handleSelectPartFamily = (family: any) => {
    setSelectedPartFamily(family);
    // Populate part number, category, name, and reusable specifications WITHOUT locking the user to an existing brand
    setNewProductForm((prev) => ({
      ...prev,
      name: family.name,
      partNumber: family.partNumber,
      category: family.category,
      unit: family.unit || "PCS",
      technicalSpecs: family.technicalSpecs || "",
      description: family.description || "",
      imageUrl: family.imageUrl || "",
      // Factory Material is brand-specific: never inherit another brand's material record
      materialId: "",
      brand: "",
      brandId: ""
    }));

    setDuplicateCheckStatus("IDLE");
    setDuplicateMatchInfo({
      crossBrandProducts: family.brands,
      message: `Part Number "${family.partNumber}" selected. Existing registered brands: ${family.brands.map((b: any) => b.brand).join(", ")}. Please select or register a brand in Step 2.`
    });

    toast.info(`Selected Part Number ${family.partNumber}. Now choose or create the brand in Step 2.`);
  };

  const handleClearSelectedPartFamily = () => {
    setSelectedPartFamily(null);
    setNewProductForm((prev) => ({
      ...prev,
      name: "",
      partNumber: "",
      brand: "",
      brandId: "",
      technicalSpecs: "",
      description: "",
      imageUrl: "",
      materialId: ""
    }));
    setDuplicateCheckStatus("IDLE");
    setDuplicateMatchInfo(null);
    toast.info("Cleared selected part number. You can search again or allocate a new sequence.");
  };

  const handleReuseInPO = (prod: any) => {
    if (!prod) return;
    const isInPO = items.some((it) => it.productId === prod.id);
    if (isInPO) {
      toast.info(`Product "${prod.name}" is already in this PO.`);
    }
    const newItem: POItem = {
      id: `prod-${prod.id}-${Date.now()}`,
      productId: prod.id,
      materialId: prod.materialId || undefined,
      name: prod.name,
      partNumber: prod.partNumber,
      manufacturerPartNumber: prod.manufacturerPartNumber || undefined,
      brand: prod.brand,
      productUin: prod.uin,
      category: prod.category,
      unit: prod.unit || "PCS",
      imageUrl: prod.imageUrl || undefined,
      quantityOrdered: Number(newProductForm.initialQty) || 1,
      unitPrice: Number(newProductForm.initialPrice) || Number(prod.material?.unitPrice) || 0,
      discount: 0,
      taxRate: 18,
      specification: prod.technicalSpecs || undefined
    };
    setItems((prev) => [...prev, newItem]);
    setIsNewProductModalOpen(false);
    resetNewProductForm();
    toast.success(`Reused registered product "${prod.name}" (UIN: ${prod.uin}) in PO.`);
  };

  const handleOpenEditProduct = (prod: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditNewBrandMode(false);
    setEditProductForm({
      id: prod.id,
      uin: prod.uin,
      name: prod.name || "",
      partNumber: prod.partNumber || "",
      brand: prod.brand || "",
      brandId: prod.brandId || "",
      category: prod.category || "BMS",
      unit: prod.unit || "PCS",
      materialId: prod.materialId || "",
      technicalSpecs: prod.technicalSpecs || "",
      description: prod.description || "",
      imageUrl: prod.imageUrl || "",
      isActive: prod.isActive ?? true
    });
    setIsEditProductModalOpen(true);
  };

  const handleEditProductImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validMimes.includes(file.type)) {
      toast.error("Invalid file format. Please upload JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5 MB.");
      return;
    }

    setIsUploadingEditImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/crm/procurement/products/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data?.url) {
        setEditProductForm((prev) => ({ ...prev, imageUrl: res.data.url }));
        toast.success("Product image uploaded successfully");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload product image");
    } finally {
      setIsUploadingEditImage(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Attachment exceeds maximum limit of 15 MB.");
      return;
    }

    setIsUploadingAttachment(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Use existing storage/payment or general upload endpoint
      const res = await api.post("/finance/payments/upload-proof", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data?.url) {
        const newAtt: AttachedDoc = {
          fileName: file.name,
          fileUrl: res.data.url,
          fileSize: file.size,
          fileType: file.type
        };
        setAttachments((prev) => [...prev, newAtt]);
        toast.success(`Attached "${file.name}"`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload document");
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  };

  const handleSelectCatalogProduct = (prod: any) => {
    // Check if already in items list
    const existing = items.find((it) => it.productId === prod.id);
    if (existing) {
      toast.info(`"${prod.name}" is already in your order items list. Incrementing quantity.`);
      setItems((prev) =>
        prev.map((it) =>
          it.productId === prod.id ? { ...it, quantityOrdered: Number(it.quantityOrdered) + 1 } : it
        )
      );
      setIsSearchDropdownOpen(false);
      return;
    }

    const newItem: POItem = {
      id: `prod-${prod.id}-${Date.now()}`,
      productId: prod.id,
      materialId: prod.materialId || undefined,
      name: prod.name,
      partNumber: prod.partNumber,
      brand: prod.brand,
      productUin: prod.uin,
      category: prod.category,
      unit: prod.unit || "PCS",
      imageUrl: prod.imageUrl || undefined,
      quantityOrdered: 1,
      unitPrice: prod.material?.unitPrice || 0,
      discount: 0,
      taxRate: 18,
      specification: prod.technicalSpecs || undefined,
      batchNumber: ""
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`Added "${prod.name}" to PO items`);
    setIsSearchDropdownOpen(false);
  };

  const handleDuplicateItem = (index: number) => {
    const target = items[index];
    if (!target) return;
    const duplicated: POItem = {
      ...target,
      id: `dup-${Date.now()}-${Math.random()}`
    };
    const next = [...items];
    next.splice(index + 1, 0, duplicated);
    setItems(next);
    toast.info("Line duplicated");
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof POItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleImportPR = (pr: any) => {
    if (!pr?.items || pr.items.length === 0) {
      toast.error("Selected PR has no items");
      return;
    }

    const importedItems: POItem[] = pr.items.map((it: any, idx: number) => ({
      id: `imported-pr-${it.id}-${idx}-${Date.now()}`,
      materialId: it.materialId,
      name: it.material?.name || "Raw Material",
      partNumber: it.material?.sku || "",
      brand: "OEM",
      category: it.material?.category || "RAW_MATERIAL",
      unit: it.material?.unit || "PCS",
      quantityOrdered: it.requestedQuantity || 1,
      unitPrice: it.material?.unitPrice || 0,
      discount: 0,
      taxRate: 18,
      specification: it.specification || undefined,
      batchNumber: it.batchNumber || ""
    }));

    setSelectedPRId(pr.id);
    setExpectedDeliveryDate(pr.requiredDate ? pr.requiredDate.split("T")[0] : expectedDeliveryDate);
    setItems((prev) => [...prev, ...importedItems]);
    setIsPRImportOpen(false);
    toast.success(`Imported ${importedItems.length} items from PR #${pr.prNumber}`);
  };

  // Validation before leaving Stage 1
  const handleProceedToStage2 = () => {
    if (!vendorId) {
      toast.error("Please select a supplier before continuing.");
      return;
    }
    if (!expectedDeliveryDate) {
      toast.error("Please specify the expected delivery date.");
      return;
    }
    setCurrentStage(2);
  };

  // Validation before leaving Stage 2
  const handleProceedToStage3 = () => {
    if (items.length === 0) {
      toast.error("Please add at least one item to the Purchase Order.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name || !it.name.trim()) {
        toast.error(`Item #${i + 1} is missing a description/name.`);
        return;
      }
      if (Number(it.quantityOrdered) <= 0) {
        toast.error(`Item #${i + 1} (${it.name}) must have a quantity greater than 0.`);
        return;
      }
      if (Number(it.unitPrice) < 0) {
        toast.error(`Item #${i + 1} (${it.name}) unit price cannot be negative.`);
        return;
      }
    }
    setCurrentStage(3);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header & Navigation ─────────────────────────────────── */}
      <PageHeader
        title="Create Purchase Order"
        subtitle="Issue authoritative vendor commitments, record brand-aware item identities, and route for approval."
        icon={<FileText className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            {(items.length > 0 || vendorId) && currentStage < 4 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear this draft Purchase Order? All entered lines and vendor details will be reset.")) {
                    try {
                      localStorage.removeItem("kyra_po_draft_state");
                    } catch (e) {}
                    setItems([]);
                    setVendorId("");
                    setQuotationReference("");
                    setNotes("");
                    setAttachments([]);
                    toast.info("Draft Purchase Order cleared.");
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Draft</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders`)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#D8E8FA] bg-white text-[#526B91] hover:text-[#0B2148] text-xs font-semibold hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cancel & Exit</span>
            </button>
          </div>
        }
      />

      {/* ── Compact 4-Stage Workflow Progress Stepper ──────────────────────── */}
      <div className="bg-white border border-[#D8E8FA] rounded-xl px-3 py-2 shadow-2xs">
        <div className="grid grid-cols-4 gap-2 relative items-center">
          {[
            { stage: 1, label: "Order Details", desc: "Supplier, Dates & Terms" },
            { stage: 2, label: "Add Items", desc: "Products, Pricing & Qty" },
            { stage: 3, label: "Review & Confirm", desc: "Summary, Docs & Approval" },
            { stage: 4, label: "Complete", desc: "Generated PO Order" }
          ].map((step) => {
            const isCompleted = currentStage > step.stage;
            const isCurrent = currentStage === step.stage;

            return (
              <div 
                key={step.stage}
                onClick={() => {
                  if (step.stage < currentStage) setCurrentStage(step.stage as any);
                }}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
                  isCurrent
                    ? "bg-[#EAF5FF] border border-[#0878F9]/40 shadow-xs"
                    : isCompleted
                    ? "bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100"
                    : "opacity-50"
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                  isCurrent
                    ? "bg-[#0878F9] text-white shadow-xs"
                    : isCompleted
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-[#526B91]"
                }`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.stage}
                </div>
                <div className="min-w-0 hidden md:block">
                  <p className={`text-xs font-bold truncate leading-tight ${isCurrent ? "text-[#0878F9]" : "text-[#0B2148]"}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-[#526B91] truncate leading-none mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STAGE 1: ORDER DETAILS ─────────────────────────────────── */}
      {currentStage === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Top Info Banner with Server Generated PO Preview */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                  Server-Generated PO Reference
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-base font-extrabold text-[#0B2148]">
                    {poNumberData?.nextPoNumber || "PO-000001 (Pending)"}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-semibold border border-blue-200">
                    Auto-Sequential
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-[#526B91] flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Created: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</span>
            </div>
          </div>

          {/* Form Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Supplier & Commercial Details */}
            <div className="lg:col-span-8 space-y-6">
              {/* Supplier Selection Card */}
              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAF2FC] pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0878F9]" />
                    <h3 className="text-sm font-bold text-[#0B2148]">Supplier Selection</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickSupplierOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0878F9] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Quick-Create Supplier</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Choose Supplier / Vendor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3.5 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
                  >
                    <option value="">-- Select Registered Supplier --</option>
                    {(vendorsList || []).map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.contact ? `(Contact: ${v.contact})` : ""} {v.category ? `• ${v.category}` : ""}
                      </option>
                    ))}
                  </select>

                  {/* Supplier Details Snapshot Card */}
                  {selectedVendor ? (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0B2148]">{selectedVendor.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                          Active Vendor
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#526B91]">
                        <p><span className="font-semibold text-slate-700">Contact Person:</span> {selectedVendor.contact || "—"}</p>
                        <p><span className="font-semibold text-slate-700">Phone:</span> {selectedVendor.phone || "—"}</p>
                        <p><span className="font-semibold text-slate-700">Email:</span> {selectedVendor.email || "—"}</p>
                        <p><span className="font-semibold text-slate-700">Address:</span> {selectedVendor.address || "—"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#526B91] italic">
                      Select a supplier to preview verified directory contacts, shipping address and payment agreements.
                    </p>
                  )}
                </div>
              </div>

              {/* Order Dates & Logistics */}
              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[#EAF2FC] pb-3">
                  <Truck className="w-4 h-4 text-[#0878F9]" />
                  <h3 className="text-sm font-bold text-[#0B2148]">Schedule & Delivery Terms</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      PO Order Date
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Expected Delivery Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      required
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Payment Terms
                    </label>
                    <input
                      type="text"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder="e.g. 100% Advance, 30 Days Net"
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Delivery / Shipping Terms
                    </label>
                    <input
                      type="text"
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      placeholder="e.g. EXW Pune, FOB Nhava Sheva Port"
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Billing Address Snapshot
                    </label>
                    <textarea
                      rows={2}
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Delivery / Receiving Warehouse Address
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: References & Operating Currency */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[#EAF2FC] pb-3">
                  <Tag className="w-4 h-4 text-[#0878F9]" />
                  <h3 className="text-sm font-bold text-[#0B2148]">References & Currency</h3>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Operating Currency</span>
                      <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                        Active: {currencySymbol}
                      </span>
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => {
                        const newCurr = e.target.value;
                        if (items.length > 0 && newCurr !== currency) {
                          setPendingCurrencyChange(newCurr);
                        } else {
                          setCurrency(newCurr);
                        }
                      }}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[#526B91]">
                      Calculates line totals, discounts, and taxes using {currency} ({currencySymbol}).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Supplier Quotation Ref #
                    </label>
                    <input
                      type="text"
                      value={quotationReference}
                      onChange={(e) => setQuotationReference(e.target.value)}
                      placeholder="e.g. QTN-VEND-2026-88"
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Supplier Invoice # (Admin Invoice Ref)
                    </label>
                    <input
                      type="text"
                      value={supplierInvoiceNumber}
                      onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-2026-0045"
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Link Production Model (Pax Type)
                    </label>
                    <select
                      value={paxTypeId}
                      onChange={(e) => setPaxTypeId(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="">-- None / General Inventory --</option>
                      {(paxTypesList || []).map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.cellCount} Cells)</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Internal Notes & Remarks
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Inspection certificate mandatory upon dispatch..."
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between p-4 bg-white border border-[#D8E8FA] rounded-2xl shadow-2xs">
            <span className="text-xs text-[#526B91]">
              Stage 1 of 4 • Set supplier and dates before adding items
            </span>
            <button
              type="button"
              onClick={handleProceedToStage2}
              className="flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Next: Add Items & Products</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── STAGE 2: ADD ITEMS TABLE & PRODUCT REGISTRATION ────────── */}
      {currentStage === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Product Category & Search Quick-Add Card */}
          <div className="bg-white border border-[#D8E8FA] rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0878F9] border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0">
                  {items.length}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[#0B2148]">Order Line Items ({items.length})</h3>
                    <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-blue-700">
                      <span>{currency} ({currencySymbol})</span>
                      <button
                        type="button"
                        onClick={() => {
                          const other = SUPPORTED_CURRENCIES.find((c) => c.code !== currency)?.code || "USD";
                          setPendingCurrencyChange(other);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-900 underline font-sans font-semibold ml-0.5 cursor-pointer"
                        title="Change operating currency"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#526B91] mt-0.5">
                    Vendor: <span className="font-semibold text-slate-700">{selectedVendor?.name || "Selected Vendor"}</span> • All amounts in <span className="font-bold text-slate-800">{currency} ({currencySymbol})</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetNewProductForm();
                    setIsNewProductModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register New Product</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPRImportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-[#526B91]" />
                  <span>Import from PR</span>
                </button>
              </div>
            </div>

            {/* Inline Category & Search Bar */}
            <div className="pt-2 border-t border-[#EAF2FC]">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                {/* Category Dropdown */}
                <div className="md:col-span-4 lg:col-span-3">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1.5">
                    Filter by Category
                  </label>
                  <div className="relative">
                    <select
                      value={catalogCategoryFilter}
                      onChange={(e) => {
                        setCatalogCategoryFilter(e.target.value);
                        setIsSearchDropdownOpen(true);
                      }}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer appearance-none pr-8"
                    >
                      <option value="ALL">All Product Categories</option>
                      {COMMON_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#526B91] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Part Name / Part Number Search Input with Dropdown */}
                <div className="md:col-span-8 lg:col-span-9 relative" ref={searchContainerRef}>
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1.5">
                    Search Part Name or Part Number
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onFocus={() => setIsSearchDropdownOpen(true)}
                      onChange={(e) => {
                        setCatalogSearch(e.target.value);
                        setIsSearchDropdownOpen(true);
                      }}
                      placeholder="Type part name, part number, brand, or UIN (e.g. BMS, STM32, JK-BD6A)..."
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 pl-10 pr-10 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-[#0878F9] placeholder:text-slate-400"
                    />
                    {catalogSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogSearch("");
                        }}
                        className="p-1 hover:bg-slate-200 rounded-full text-[#526B91] absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Results Box */}
                  {isSearchDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl z-40 max-h-[380px] overflow-y-auto divide-y divide-[#EAF2FC] p-2">
                      <div className="px-3 py-2 flex items-center justify-between bg-[#F4F9FF] rounded-xl mb-1 text-[11px] font-semibold text-[#526B91]">
                        <span>
                          {loadingCatalog
                            ? "Searching Product Master..."
                            : `Found ${catalogData?.products?.length || 0} product(s) in catalog`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsSearchDropdownOpen(false)}
                          className="text-[#526B91] hover:text-[#0B2148] text-[10px] uppercase font-bold"
                        >
                          Close ✕
                        </button>
                      </div>

                      {loadingCatalog ? (
                        <div className="py-8 flex flex-col items-center justify-center text-[#526B91]">
                          <Loader2 className="w-5 h-5 animate-spin text-[#0878F9] mb-2" />
                          <span className="text-xs">Searching Product Catalog...</span>
                        </div>
                      ) : (catalogData?.products || []).length === 0 ? (
                        <div className="py-6 px-4 text-center text-[#526B91] space-y-2">
                          <Package className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-bold text-slate-700">
                            No product found matching "{catalogSearch}"
                          </p>
                          <p className="text-[11px] text-[#526B91]">
                            Register this component as a new product master with its technical specifications and image.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSearchDropdownOpen(false);
                              resetNewProductForm();
                              const targetCat = catalogCategoryFilter !== "ALL" ? catalogCategoryFilter : "BMS";
                              setNewProductForm((prev) => ({
                                ...prev,
                                name: catalogSearch,
                                category: targetCat
                              }));
                              setIsNewProductModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer mt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Register "{catalogSearch || "New Product"}"</span>
                          </button>
                        </div>
                      ) : (
                        (catalogData?.products || []).map((prod: any) => {
                          const isInPO = items.some((it) => it.productId === prod.id);
                          return (
                            <div
                              key={prod.id}
                              className="p-2.5 flex items-center justify-between gap-3 hover:bg-[#F4F9FF]/80 rounded-xl transition-colors cursor-pointer group"
                              onClick={() => handleSelectCatalogProduct(prod)}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                  {prod.imageUrl ? (
                                    <img src={getMediaUrl(prod.imageUrl)} alt={prod.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors truncate">
                                      {prod.name}
                                    </p>
                                    {isInPO && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded shrink-0">
                                        In PO
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[#526B91]">
                                    <span className="font-bold text-[#0878F9] bg-[#EAF5FF] px-1.5 py-0.5 rounded border border-blue-200">
                                      {prod.partNumber}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-sans font-semibold">
                                      {prod.brand}
                                    </span>
                                    <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                                      {prod.uin}
                                    </span>
                                    <span className="text-slate-500 font-sans">
                                      • {prod.category} • {prod.unit || "PCS"}
                                    </span>
                                  </div>
                                  {prod.technicalSpecs && (
                                    <p className="text-[10px] text-[#526B91] truncate">{prod.technicalSpecs}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <div className="text-right font-mono text-xs hidden sm:block mr-1">
                                  <span className="font-bold text-slate-800">
                                    ₹{prod.material?.unitPrice?.toFixed(2) || "0.00"}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditProduct(prod, e)}
                                  className="px-2.5 py-1.5 rounded-xl border border-[#D8E8FA] hover:border-[#0878F9] bg-white text-[#0878F9] hover:bg-blue-50 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="Edit Product Master & Image"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteProductTarget(prod);
                                  }}
                                  className="p-1.5 rounded-xl border border-red-200 hover:border-red-500 bg-white text-red-500 hover:bg-red-50 font-bold text-xs transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                                  title="Permanently Delete Product Master"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSelectCatalogProduct(prod)}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isInPO ? "Add Again" : "Add to PO"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="bg-white border border-[#D8E8FA] rounded-2xl shadow-2xs overflow-hidden">
            {/* Desktop Table View (>= 1024px) - fits standard 1366px desktop with zero horizontal scroll */}
            <div className="hidden lg:block overflow-x-visible">
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[#526B91]">
                    <th className="py-2.5 px-3 w-[27%] font-bold">Product / Identity / Brand</th>
                    <th className="py-2.5 px-2 w-[11%] font-bold">UIN</th>
                    <th className="py-2.5 px-2 w-[12%] font-bold">Batch Number</th>
                    <th className="py-2.5 px-1.5 w-[5%] font-bold text-center">Unit</th>
                    <th className="py-2.5 px-1.5 w-[7%] font-bold text-center">Qty *</th>
                    <th className="py-2.5 px-2 w-[10%] font-bold text-right">Unit Price ({currencySymbol}) *</th>
                    <th className="py-2.5 px-1.5 w-[7%] font-bold text-right">Disc ({currencySymbol})</th>
                    <th className="py-2.5 px-1.5 w-[7%] font-bold text-center">Tax</th>
                    <th className="py-2.5 px-2.5 w-[10%] font-bold text-right">Total ({currencySymbol})</th>
                    <th className="py-2.5 px-1.5 w-[4%] font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAF2FC]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[#526B91]">
                        <div className="max-w-md mx-auto space-y-3">
                          <Package className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="font-bold text-slate-700">No items added to this Purchase Order yet.</p>
                          <p className="text-xs text-[#526B91]">
                            Select a category and type a part name or part number in the search bar above to instantly add items, or register a new product master.
                          </p>
                          <div className="pt-2 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                resetNewProductForm();
                                setIsNewProductModalOpen(true);
                              }}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Register New Product</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const lineSub = Number(item.quantityOrdered || 0) * Number(item.unitPrice || 0);
                      const discount = Math.min(lineSub, Number(item.discount || 0));
                      const taxable = Math.max(0, lineSub - discount);
                      const taxAmount = (taxable * Number(item.taxRate || 0)) / 100;
                      const lineTotal = taxable + taxAmount;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* 1. Product / Identity / Part No / Brand */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                {item.imageUrl ? (
                                  <img 
                                    src={getMediaUrl(item.imageUrl)} 
                                    alt={item.name} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs text-[#0B2148] leading-tight break-words line-clamp-2" title={item.name}>
                                  {item.name}
                                </p>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5 font-mono text-[10px]">
                                  <span className="font-bold text-[#0878F9] bg-[#EAF5FF] px-1.5 py-0.2 rounded border border-blue-200">
                                    {item.partNumber || "—"}
                                  </span>
                                  <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-700 font-sans font-semibold rounded">
                                    {item.brand || "OEM"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. UIN (Truncated with tooltip & copy) */}
                          <td className="py-2.5 px-2 align-middle">
                            {item.productUin ? (
                              <div className="flex items-center gap-1 max-w-full" title={`Full Product UIN: ${item.productUin}`}>
                                <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded truncate max-w-[85px] block">
                                  {item.productUin}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.productUin!);
                                    toast.success("Product UIN copied");
                                  }}
                                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-slate-100 shrink-0 cursor-pointer"
                                  title="Copy UIN"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#526B91] italic">Auto at GRN</span>
                            )}
                          </td>

                          {/* 3. Batch Number */}
                          <td className="py-2.5 px-2 align-middle">
                            {(!item.batchNumber || item.batchNumber.trim() === "") ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value=""
                                  onChange={(e) => handleItemFieldChange(idx, "batchNumber", e.target.value)}
                                  placeholder="Pending at Receipt"
                                  className="w-full bg-amber-50/70 border border-amber-200/90 rounded-md py-1 px-1.5 text-[11px] font-medium text-amber-900 placeholder:text-amber-700/80 focus:outline-none focus:border-[#0878F9] focus:bg-white"
                                  title="Batch pending until delivery. Click or type to enter if known beforehand."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const autoBatch = `LOT-${new Date().getFullYear()}-${String(idx + 1).padStart(3, "0")}`;
                                    handleItemFieldChange(idx, "batchNumber", autoBatch);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-[#0878F9] hover:bg-blue-50 shrink-0 cursor-pointer"
                                  title="Assign New Lot Reference"
                                >
                                  <Sparkles className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={item.batchNumber}
                                  onChange={(e) => handleItemFieldChange(idx, "batchNumber", e.target.value.toUpperCase())}
                                  className="w-full bg-white border border-blue-200 rounded-md py-1 px-1.5 text-[11px] font-mono font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                                  placeholder="Batch No..."
                                />
                                <button
                                  type="button"
                                  onClick={() => handleItemFieldChange(idx, "batchNumber", "")}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                                  title="Reset to 'Pending at Receipt'"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 4. Unit */}
                          <td className="py-2.5 px-1.5 text-center font-mono text-[11px] text-[#526B91] align-middle">
                            {item.unit || "PCS"}
                          </td>

                          {/* 5. Quantity */}
                          <td className="py-2.5 px-1.5 align-middle">
                            <input
                              type="number"
                              min="1"
                              value={item.quantityOrdered}
                              onChange={(e) => handleItemFieldChange(idx, "quantityOrdered", Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1 text-center font-bold text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            />
                          </td>

                          {/* 6. Unit Price */}
                          <td className="py-2.5 px-2 align-middle">
                            <div className="relative flex items-center">
                              <span className="absolute left-1.5 text-[10px] font-bold text-slate-400 pointer-events-none select-none">
                                {currencySymbol}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleItemFieldChange(idx, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 pl-4 pr-1 text-right font-mono font-bold text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                              />
                            </div>
                          </td>

                          {/* 7. Discount */}
                          <td className="py-2.5 px-1.5 align-middle">
                            <div className="relative flex items-center">
                              <span className="absolute left-1 text-[10px] font-bold text-slate-400 pointer-events-none select-none">
                                {currencySymbol}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.discount}
                                onChange={(e) => handleItemFieldChange(idx, "discount", Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 pl-3.5 pr-1 text-right font-mono text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                              />
                            </div>
                          </td>

                          {/* 8. Tax Rate */}
                          <td className="py-2.5 px-1.5 align-middle">
                            <select
                              value={item.taxRate}
                              onChange={(e) => handleItemFieldChange(idx, "taxRate", parseFloat(e.target.value))}
                              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            >
                              {TAX_RATES.map((rate) => (
                                <option key={rate} value={rate}>{rate}%</option>
                              ))}
                            </select>
                          </td>

                          {/* 9. Line Total */}
                          <td className="py-2.5 px-2.5 text-right font-mono font-bold text-xs text-[#0B2148] align-middle whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 mr-0.5">{currencySymbol}</span>
                            {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 10. Actions */}
                          <td className="py-2.5 px-1.5 text-center align-middle">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(idx)}
                                title="Duplicate Line"
                                className="p-1 text-[#526B91] hover:text-[#0878F9] rounded hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                title="Remove Line"
                                className="p-1 text-[#526B91] hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
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

            {/* Mobile / Tablet Responsive Cards Layout (< 1024px) */}
            <div className="block lg:hidden divide-y divide-[#EAF2FC]">
              {items.length === 0 ? (
                <div className="py-8 text-center text-[#526B91] p-4">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700 text-xs">No items added to this Purchase Order yet.</p>
                </div>
              ) : (
                items.map((item, idx) => {
                  const lineSub = Number(item.quantityOrdered || 0) * Number(item.unitPrice || 0);
                  const discount = Math.min(lineSub, Number(item.discount || 0));
                  const taxable = Math.max(0, lineSub - discount);
                  const taxAmount = (taxable * Number(item.taxRate || 0)) / 100;
                  const lineTotal = taxable + taxAmount;

                  return (
                    <div key={item.id} className="p-3.5 space-y-3 bg-white hover:bg-slate-50/50">
                      {/* Top Row: Info & Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={getMediaUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-[#0B2148] truncate">{item.name}</p>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] mt-0.5">
                              <span className="font-bold text-[#0878F9]">{item.partNumber}</span>
                              <span>•</span>
                              <span>{item.brand}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(idx)}
                            className="p-1 text-slate-500 hover:text-blue-600 cursor-pointer"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Grid: UIN & Batch */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Product UIN</label>
                          <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded truncate block">
                            {item.productUin || "Auto at GRN"}
                          </span>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Batch / Lot</label>
                          <input
                            type="text"
                            value={item.batchNumber || ""}
                            onChange={(e) => handleItemFieldChange(idx, "batchNumber", e.target.value.toUpperCase())}
                            placeholder="Pending at Receipt"
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1.5 text-[11px] font-mono text-[#0B2148] placeholder:text-amber-700/80"
                          />
                        </div>
                      </div>

                      {/* Numbers Grid: Qty, Unit Price, Disc, Tax */}
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Qty ({item.unit || "PCS"})</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantityOrdered}
                            onChange={(e) => handleItemFieldChange(idx, "quantityOrdered", Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1 text-center font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Price ({currencySymbol})</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemFieldChange(idx, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1 text-right font-mono font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Disc ({currencySymbol})</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discount}
                            onChange={(e) => handleItemFieldChange(idx, "discount", Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1 text-right font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Tax</label>
                          <select
                            value={item.taxRate}
                            onChange={(e) => handleItemFieldChange(idx, "taxRate", parseFloat(e.target.value))}
                            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-md py-1 px-1 text-xs font-mono"
                          >
                            {TAX_RATES.map((r) => (
                              <option key={r} value={r}>{r}%</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500 font-semibold">Line Total:</span>
                        <span className="font-mono font-bold text-xs text-[#0B2148]">
                          {currencySymbol} {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Subtotal Ribbon */}
            {items.length > 0 && (
              <div className="p-3.5 bg-[#F4F9FF] border-t border-[#D8E8FA] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-4 text-[#526B91]">
                  <span>Total Ordered Quantity: <strong className="text-[#0B2148]">{summaryCalculations.totalQuantity}</strong></span>
                  <span>Items Count: <strong className="text-[#0B2148]">{items.length}</strong></span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <span>Items Subtotal: <strong>{currencySymbol} {summaryCalculations.subtotal.toFixed(2)}</strong></span>
                  {summaryCalculations.totalDiscount > 0 && (
                    <span className="text-emerald-700">Disc: <strong>-{currencySymbol} {summaryCalculations.totalDiscount.toFixed(2)}</strong></span>
                  )}
                  <span>Total Tax: <strong>{currencySymbol} {summaryCalculations.totalTax.toFixed(2)}</strong></span>
                  <span className="text-sm font-bold text-[#0878F9] bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    Estimated Total: {currencySymbol} {summaryCalculations.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between p-4 bg-white border border-[#D8E8FA] rounded-2xl shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentStage(1)}
              className="flex items-center gap-2 border border-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Order Details</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToStage3}
              className="flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>Next: Review & Confirm</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── STAGE 3: REVIEW & CONFIRM ──────────────────────────────── */}
      {currentStage === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Supplier & Order Specs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Supplier Snapshot Card */}
              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAF2FC] pb-2.5">
                  <span className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#0878F9]" />
                    Supplier Information
                  </span>
                  <span className="font-mono text-xs font-bold text-[#0878F9]">
                    {poNumberData?.nextPoNumber || "PO-REF"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#526B91]">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{selectedVendor?.name}</p>
                    <p className="mt-1">Contact: {selectedVendor?.contact || "—"}</p>
                    <p>Phone: {selectedVendor?.phone || "—"}</p>
                    <p>Email: {selectedVendor?.email || "—"}</p>
                  </div>
                  <div>
                    <p><span className="font-semibold text-slate-700">Payment Terms:</span> {paymentTerms}</p>
                    <p><span className="font-semibold text-slate-700">Delivery Terms:</span> {deliveryTerms}</p>
                    <p><span className="font-semibold text-slate-700">Expected Delivery:</span> {expectedDeliveryDate}</p>
                    {quotationReference && (
                      <p><span className="font-semibold text-slate-700">Quote Ref:</span> {quotationReference}</p>
                    )}
                    {supplierInvoiceNumber && (
                      <p><span className="font-semibold text-slate-700">Invoice #:</span> {supplierInvoiceNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Recap Table */}
              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAF2FC] pb-2.5">
                  <span className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#0878F9]" />
                    Committed Products ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStage(2)}
                    className="text-xs text-[#0878F9] hover:underline font-semibold cursor-pointer"
                  >
                    Edit Items
                  </button>
                </div>
                <div className="divide-y divide-[#EAF2FC]">
                  {items.map((it, idx) => {
                    const lineSub = Number(it.quantityOrdered || 0) * Number(it.unitPrice || 0);
                    const lineTotal = lineSub - Number(it.discount || 0) + ((lineSub - Number(it.discount || 0)) * Number(it.taxRate || 0)) / 100;

                    return (
                      <div key={it.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {it.imageUrl ? (
                              <img src={getMediaUrl(it.imageUrl)} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#0B2148] truncate">{it.name}</p>
                            <p className="font-mono text-[11px] text-[#526B91]">
                              {it.partNumber} • {it.brand} {it.productUin ? `• ${it.productUin}` : ""}
                            </p>
                            <div className="mt-0.5">
                              {it.batchNumber ? (
                                <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                  Batch: {it.batchNumber}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded">
                                  Batch: Pending at Receipt
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0 pl-3">
                          <p className="font-bold text-[#0B2148]">
                            {it.quantityOrdered} {it.unit} × {currencySymbol} {it.unitPrice}
                          </p>
                          <p className="text-[11px] text-[#526B91]">
                            Total: {currencySymbol} {lineTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attachments Section */}
              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAF2FC] pb-2.5">
                  <span className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-[#0878F9]" />
                    Supplier Quotations & Technical Attachments
                  </span>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={isUploadingAttachment}
                    className="flex items-center gap-1 text-xs font-semibold text-[#0878F9] hover:underline cursor-pointer"
                  >
                    {isUploadingAttachment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Upload Attachment</span>
                  </button>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentUpload}
                  />
                </div>

                {attachments.length === 0 ? (
                  <p className="text-xs text-[#526B91] italic py-2">
                    No attachments uploaded. You can attach quotation PDFs or engineering datasheets.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-[#0878F9] shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{att.fileName}</span>
                          {att.fileSize && (
                            <span className="text-[10px] text-[#526B91]">({(att.fileSize / 1024).toFixed(1)} KB)</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Authoritative Financial Breakdown Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-gradient-to-b from-white to-[#F4F9FF] border border-[#D8E8FA] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="border-b border-[#EAF2FC] pb-3">
                  <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Commercial & Financial Summary
                  </h3>
                  <p className="text-[11px] text-[#526B91] mt-0.5">
                    Pre-calculated in currency <strong className="text-slate-800">{currency} ({currencySymbol})</strong>
                  </p>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Items Gross Subtotal:</span>
                    <span>{currencySymbol} {summaryCalculations.subtotal.toFixed(2)}</span>
                  </div>

                  {summaryCalculations.totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span>Total Discount Allowed:</span>
                      <span>- {currencySymbol} {summaryCalculations.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-700 border-t border-dashed border-slate-200 pt-2">
                    <span>Taxable Amount:</span>
                    <span>{currencySymbol} {summaryCalculations.taxableAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span>Applicable Tax Total:</span>
                    <span>{currencySymbol} {summaryCalculations.totalTax.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 pt-1">
                    <span>Freight / Shipping Charges:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">{currencySymbol}</span>
                      <input
                        type="number"
                        min="0"
                        value={additionalCharges}
                        onChange={(e) => setAdditionalCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-24 bg-white border border-slate-300 rounded py-1 px-2 text-right text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      />
                    </div>
                  </div>

                  <div className="border-t-2 border-[#0B2148] pt-3 flex items-center justify-between text-sm">
                    <span className="font-sans font-bold text-[#0B2148]">Grand Total:</span>
                    <span className="font-extrabold text-base text-[#0878F9]">
                      {currencySymbol} {summaryCalculations.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                </div>

                {/* Submission Options Card */}
                <div className="pt-4 border-t border-[#D8E8FA] space-y-3">
                  <button
                    type="button"
                    disabled={createPOMutation.isPending}
                    onClick={() => createPOMutation.mutate({ submitForApproval: true })}
                    className="w-full py-3 px-4 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {createPOMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Submit PO for Admin Approval</span>
                  </button>

                  <button
                    type="button"
                    disabled={createPOMutation.isPending}
                    onClick={() => createPOMutation.mutate({ submitForApproval: false })}
                    className="w-full py-2.5 px-4 bg-white border border-[#D8E8FA] text-[#0B2148] hover:bg-slate-50 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>Save as Draft PO</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between p-4 bg-white border border-[#D8E8FA] rounded-2xl shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentStage(2)}
              className="flex items-center gap-2 border border-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Edit Items</span>
            </button>

            <span className="text-xs text-[#526B91]">
              Ready to submit • Financial amounts validated on server
            </span>
          </div>
        </motion.div>
      )}

      {/* ── STAGE 4: COMPLETE / SUCCESS ────────────────────────────── */}
      {currentStage === 4 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto bg-white border border-[#D8E8FA] rounded-3xl p-8 shadow-sm text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-extrabold text-[#0B2148]">
              Purchase Order Successfully Issued
            </h2>
            <p className="text-xs text-[#526B91]">
              The purchase commitment record has been stored in PostgreSQL with complete brand-aware product links and financial audit tracking.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">PO Number</p>
              <p className="font-mono font-bold text-[#0878F9] text-sm mt-0.5">{createdOrderResult?.poNumber || "PO-000000"}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Status</p>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                createdOrderResult?.status === "PENDING_APPROVAL" 
                  ? "bg-amber-100 text-amber-800" 
                  : "bg-blue-100 text-blue-800"
              }`}>
                {createdOrderResult?.status || "DRAFT"}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Items Count</p>
              <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{items.length} Products</p>
            </div>
            <div>
              <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Grand Total</p>
              <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                {currencySymbol} {summaryCalculations.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders/${createdOrderResult?.id || ""}`)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>View Order Details</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print PO Confirmation</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setItems([]);
                setVendorId("");
                setNotes("");
                setAttachments([]);
                setCreatedOrderResult(null);
                setCurrentStage(1);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B2148] font-bold text-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Another PO</span>
            </button>
          </div>
        </motion.div>
      )}



      {/* ── MODAL 5: EDIT PRODUCT MASTER (WITH IMAGE UPLOAD & PREVIEW) ── */}
      <AnimatePresence>
        {isEditProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditProductModalOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0878F9] text-white flex items-center justify-center shadow-xs">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#0B2148]">Edit Product Master</h3>
                      <span className="font-mono text-[10px] font-bold text-[#0878F9] bg-[#E8F1FC] px-2 py-0.5 rounded-full border border-blue-200">
                        {editProductForm.uin}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526B91]">
                      Update product master specifications, part number, brand, and master image.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditProductModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[#526B91] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <form
                id="edit-product-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editProductForm.name || !editProductForm.partNumber || !editProductForm.brand) {
                    toast.error("Product name, part number, and brand are required.");
                    return;
                  }
                  updateProductMutation.mutate({
                    id: editProductForm.id,
                    data: {
                      name: editProductForm.name,
                      partNumber: editProductForm.partNumber,
                      brand: editProductForm.brand,
                      category: editProductForm.category,
                      unit: editProductForm.unit,
                      materialId: editProductForm.materialId || null,
                      technicalSpecs: editProductForm.technicalSpecs || null,
                      description: editProductForm.description || null,
                      imageUrl: editProductForm.imageUrl || null,
                      isActive: editProductForm.isActive
                    }
                  });
                }}
                className="p-5 space-y-4 overflow-y-auto flex-1"
              >
                {/* Product Image Upload Section */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      Product Master Image (JPEG, PNG, WebP • Max 5 MB)
                    </label>
                    {editProductForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditProductForm((prev) => ({ ...prev, imageUrl: "" }))}
                        className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                      {editProductForm.imageUrl ? (
                        <img 
                          src={getMediaUrl(editProductForm.imageUrl)} 
                          alt="Product preview" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-[9px] mt-1">No Image</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleEditProductImageFileChange}
                      />
                      <button
                        type="button"
                        disabled={isUploadingEditImage}
                        onClick={() => editFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer shadow-2xs"
                      >
                        {isUploadingEditImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>{editProductForm.imageUrl ? "Replace Product Image" : "Upload Product Image"}</span>
                      </button>
                      <p className="text-[10px] text-[#526B91]">
                        Uploaded images belong to the product master record and will be reflected across current and future orders.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Identity Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Internal Part Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BMS-JK-BD6A20S10P"
                      value={editProductForm.partNumber}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, partNumber: e.target.value.toUpperCase() }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-mono font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Brand / Manufacturer <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsEditNewBrandMode(!isEditNewBrandMode)}
                        className="text-[11px] font-bold text-[#0878F9] hover:underline cursor-pointer"
                      >
                        {isEditNewBrandMode ? "← Select Saved" : "+ Enter New Brand"}
                      </button>
                    </div>

                    {!isEditNewBrandMode ? (
                      <select
                        required
                        value={editProductForm.brand}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__NEW__") {
                            setIsEditNewBrandMode(true);
                            setEditProductForm((prev) => ({ ...prev, brand: "", brandId: "" }));
                          } else {
                            const matched = (Array.isArray(brandsList) ? brandsList : []).find(
                              (b: any) => b.name?.toUpperCase() === val.toUpperCase()
                            );
                            setEditProductForm((prev) => ({
                              ...prev,
                              brand: val,
                              brandId: matched ? matched.id : prev.brandId
                            }));
                          }
                        }}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      >
                        <option value="">-- Select Saved Brand ({brandsList.length} registered) --</option>
                        {(Array.isArray(brandsList) ? brandsList : []).map((b: any) => (
                          <option key={b.id} value={b.name}>
                            {b.name} ({b._count?.products ?? 0} products)
                          </option>
                        ))}
                        <option value="__NEW__">+ Enter New Brand Name...</option>
                      </select>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Enter brand name (e.g. JK BMS, DALY, CATL, EVE)..."
                          value={editProductForm.brand}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            const matched = (Array.isArray(brandsList) ? brandsList : []).find(
                              (b: any) => b.name?.toUpperCase() === val
                            );
                            setEditProductForm((prev) => ({
                              ...prev,
                              brand: val,
                              brandId: matched ? matched.id : prev.brandId
                            }));
                          }}
                          className="w-full bg-[#F4F9FF] border border-blue-400 rounded-xl py-2 pl-3 pr-24 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                        />
                        <button
                          type="button"
                          onClick={() => setIsEditNewBrandMode(false)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-[10px] font-semibold text-slate-700 rounded-lg cursor-pointer shadow-2xs"
                        >
                          Pick saved ▾
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Product Name / Commercial Identity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Smart Active Balancer BMS 8S-20S 100A with Bluetooth & CAN"
                      value={editProductForm.name}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Category
                    </label>
                    <select
                      value={editProductForm.category}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      {COMMON_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Unit of Measure
                    </label>
                    <select
                      value={editProductForm.unit}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, unit: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Technical Specifications & Parameters
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Current rating: 100A, Peak: 200A, Cell chemistry: LiFePO4 / NMC, Comm: CANBus 2.0B"
                      value={editProductForm.technicalSpecs}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, technicalSpecs: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Product Description & Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Optional engineering notes, quality criteria, or supplier terms..."
                      value={editProductForm.description}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="edit-is-active"
                      checked={editProductForm.isActive}
                      onChange={(e) => setEditProductForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-[#0878F9] rounded border-[#D8E8FA] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="edit-is-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Product is Active in Catalog
                    </label>
                  </div>
                </div>

                <div className="p-4 border-t border-[#D8E8FA] flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditProductModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateProductMutation.isPending || isUploadingEditImage}
                    className="px-5 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {updateProductMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: REGISTER NEW PRODUCT MASTER (WITH IMAGE UPLOAD) ── */}
      <AnimatePresence>
        {isNewProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewProductModalOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-5xl max-h-[92vh] bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#0B2148]">Register New Product Master</h3>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                        Enterprise Product Master
                      </span>
                    </div>
                    <p className="text-[11px] text-[#526B91]">
                      Brand-aware product identity registry with automatic collision-resistant UIN allocation. Automatically saved to Factory Settings Material SKUs.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[#526B91] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content - Desktop 2-Column Grid */}
              <form
                id="new-product-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newProductForm.name?.trim() || !newProductForm.brand?.trim()) {
                    toast.error("Product name and brand are required.");
                    return;
                  }
                  createProductMutation.mutate({
                    name: newProductForm.name.trim(),
                    partNumber: newProductForm.partNumber?.trim() || undefined,
                    brand: newProductForm.brand.trim(),
                    brandId: newProductForm.brandId || undefined,
                    vendorId: vendorId || undefined,
                    category: newProductForm.category,
                    unit: newProductForm.unit,
                    materialId: newProductForm.materialId || undefined,
                    technicalSpecs: newProductForm.technicalSpecs || undefined,
                    description: newProductForm.description || undefined,
                    imageUrl: newProductForm.imageUrl || undefined,
                    isActive: newProductForm.isActive ?? true
                  });
                }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto flex-1 max-h-[calc(92vh-130px)]"
              >
                {/* ── LEFT COLUMN: PART SEARCH, IMAGE DROPZONE & UIN PREVIEW (lg:col-span-5) ── */}
                <div className="lg:col-span-5 space-y-4">
                  {/* 1. FIND EXISTING PART NUMBER WORKFLOW (Part-Number-First) */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-[#0878F9]" />
                        Find Existing Part Number
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        Part-Number-First Search
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={findPartSearch}
                        onChange={(e) => handleSearchFindPart(e.target.value)}
                        placeholder="Search part # (e.g. BMS-002) or component family..."
                        className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-8 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      />
                      {findPartSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setFindPartSearch("");
                            setFindPartResults([]);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Results / Candidates List (Grouped by Part Number) */}
                    {isSearchingFindPart && (
                      <div className="py-3 flex items-center justify-center gap-2 text-xs text-[#526B91]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0878F9]" />
                        <span>Searching registered part numbers across all brands...</span>
                      </div>
                    )}

                    {!isSearchingFindPart && findPartResults.length > 0 && (
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs space-y-1">
                        {findPartResults.map((family) => {
                          const isSelected = selectedPartFamily?.partNumber === family.partNumber;
                          return (
                            <div
                              key={family.partNumber}
                              onClick={() => handleSelectPartFamily(family)}
                              className={`p-2.5 rounded-xl flex flex-col gap-1.5 cursor-pointer transition-all text-xs ${
                                isSelected
                                  ? "bg-blue-50/90 border border-blue-300 shadow-2xs"
                                  : "hover:bg-slate-50 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono font-bold text-xs text-[#0878F9] bg-[#EAF5FF] border border-blue-200 px-2 py-0.5 rounded-md">
                                    {family.partNumber}
                                  </span>
                                  <p className="font-bold text-[#0B2148] truncate">{family.name}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 transition-colors ${
                                  isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                                }`}>
                                  {isSelected ? "Selected ✓" : "Select Part Number ➔"}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="text-[#526B91]">
                                  {family.category} • {family.unit || "PCS"}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-600 font-medium">Registered Brands:</span>
                                {family.brands.map((b: any) => (
                                  <span
                                    key={b.uin}
                                    className="px-1.5 py-0.2 bg-white border border-slate-200 text-slate-700 font-sans font-semibold rounded text-[9px]"
                                    title={`Brand: ${b.brand} (UIN: ${b.uin})`}
                                  >
                                    {b.brand}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Selected Part Family Display & Reference Card */}
                    {selectedPartFamily && (
                      <div className="p-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-300 rounded-xl space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-xs text-white bg-[#0878F9] px-2 py-0.5 rounded shrink-0">
                              {selectedPartFamily.partNumber}
                            </span>
                            <span className="font-bold text-blue-950 truncate">
                              {selectedPartFamily.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearSelectedPartFamily}
                            className="text-[10px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer underline shrink-0"
                          >
                            Deselect ✕
                          </button>
                        </div>

                        {/* Associated Brands Reference */}
                        <div className="p-2 bg-white/80 rounded-lg border border-blue-100 space-y-1 text-[10px]">
                          <span className="font-bold text-slate-700 uppercase tracking-wider block">
                            Registered Brands for this Part Number ({selectedPartFamily.brands.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {selectedPartFamily.brands.map((b: any) => (
                              <span
                                key={b.uin}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[9px] font-bold rounded"
                              >
                                <span className="font-sans font-bold">{b.brand}</span>
                                <span className="text-blue-600 font-normal">({b.uin.slice(-11)})</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 leading-relaxed font-medium">
                          <strong>Step 2 Required:</strong> Part number specifications have been prefilled. In the right column, choose an existing brand or enter a new brand (e.g. DALY) to register a separate product identity and generate a new UIN.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. PRODUCT MASTER IMAGE DRAG & DROP DROPZONE */}
                  <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#0878F9]" />
                        Product Master Image
                      </label>
                      <span className="text-[10px] font-semibold text-[#526B91]">
                        JPEG, PNG, WebP • Max 5 MB
                      </span>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleProductImageFileChange}
                    />

                    {newProductForm.imageUrl ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center">
                            <img
                              src={getMediaUrl(newProductForm.imageUrl)}
                              alt="Product preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              ✓ Image Stored & Verified
                            </span>
                            <p className="text-[10px] text-[#526B91]">
                              Stored in asset storage. Reused on Product Catalog, PO, Invoice and GRN.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isUploadingImage}
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewProductForm((p) => ({ ...p, imageUrl: "" }))}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleImageDragOver}
                        onDragLeave={handleImageDragLeave}
                        onDrop={handleImageDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          isDraggingImage
                            ? "border-[#0878F9] bg-blue-50/70"
                            : "border-slate-300 bg-white hover:bg-slate-50/80"
                        }`}
                      >
                        {isUploadingImage ? (
                          <div className="space-y-1">
                            <Loader2 className="w-6 h-6 animate-spin text-[#0878F9] mx-auto" />
                            <p className="text-xs font-semibold text-slate-700">Uploading image...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-7 h-7 text-slate-400 mb-1" />
                            <p className="text-xs font-bold text-slate-700">
                              Drag & drop product image here, or browse
                            </p>
                            <p className="text-[10px] text-[#526B91] mt-0.5">
                              JPEG, PNG, WebP up to 5 MB
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. STRUCTURED UIN LIVE BREAKDOWN */}
                  <div className="p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/90 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#0878F9]" />
                        Canonical UIN Preview
                      </span>
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                        Provisional (Server-Confirmed on Save)
                      </span>
                    </div>
                    <div className="font-mono text-xs font-extrabold text-[#0B2148] bg-white px-3.5 py-2 rounded-xl border border-blue-200/80 tracking-wide break-all shadow-xs">
                      {liveUinPreview}
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-[9px] text-center font-mono text-[#526B91] pt-1">
                      <div className="p-1 bg-white/70 rounded border border-blue-100">
                        <span className="block font-bold text-slate-700">VEN3</span>
                        <span>{selectedVendor ? (selectedVendor.name || "").slice(0, 3).toUpperCase() : "KYR"}</span>
                      </div>
                      <div className="p-1 bg-white/70 rounded border border-blue-100">
                        <span className="block font-bold text-slate-700">BILLSEQ</span>
                        <span>001</span>
                      </div>
                      <div className="p-1 bg-white/70 rounded border border-blue-100">
                        <span className="block font-bold text-slate-700">BRAND3</span>
                        <span>{newProductForm.brand ? newProductForm.brand.slice(0, 3).toUpperCase() : "BRD"}</span>
                      </div>
                      <div className="p-1 bg-white/70 rounded border border-blue-100">
                        <span className="block font-bold text-slate-700">SEQ</span>
                        <span>{brandMeta.brandSeq}</span>
                      </div>
                      <div className="p-1 bg-white/70 rounded border border-blue-100">
                        <span className="block font-bold text-slate-700">PARTNO</span>
                        <span className="truncate block">{newProductForm.partNumber || "AUTO"}</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-[#526B91] italic text-center pt-0.5">
                      Provisional preview. Server validates identity uniqueness and commits authoritative identifiers on save.
                    </p>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: SPECIFICATIONS & REGISTRATION (lg:col-span-7) ── */}
                <div className="lg:col-span-7 space-y-3.5">
                  {/* Category Selection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {categoryMeta.count} product(s) in {newProductForm.category}
                      </span>
                    </div>
                    <select
                      value={newProductForm.category}
                      disabled={!!selectedPartFamily}
                      title={selectedPartFamily ? "Category is inherited from the selected part number. Deselect it to change." : undefined}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setNewProductForm((prev) => ({ ...prev, category: newCat, partNumber: "" }));
                        setDuplicateCheckStatus("IDLE");
                        setDuplicateMatchInfo(null);
                      }}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {COMMON_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Product Name / Commercial Identity */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Product Name / Commercial Identity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Smart Active Balancer BMS 8S-20S 100A with Bluetooth & CAN"
                      value={newProductForm.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewProductForm((prev) => ({ ...prev, name: val }));
                        if (duplicateCheckStatus !== "IDLE" && !selectedPartFamily) {
                          setDuplicateCheckStatus("IDLE");
                          setDuplicateMatchInfo(null);
                        }
                      }}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  {/* Brand / Manufacturer */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Brand / Manufacturer Name <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          🏷️ Brand Seq: #{brandMeta.brandSeq}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsQuickBrandOpen(true)}
                          className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          + New Brand Master
                        </button>
                      </div>
                    </div>

                    {!isNewBrandMode ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <select
                            required
                            value={newProductForm.brand}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "__NEW__") {
                                setIsNewBrandMode(true);
                                handleBrandChange("");
                              } else {
                                handleBrandChange(val);
                              }
                            }}
                            className="flex-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                          >
                            <option value="">-- Select Saved Brand ({brandsList.length} registered) --</option>
                            {(Array.isArray(brandsList) ? brandsList : []).map((b: any) => (
                              <option key={b.id} value={b.name}>
                                {b.name} ({b._count?.products ?? 0} products)
                              </option>
                            ))}
                            <option value="__NEW__">+ Enter New Brand Name...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewBrandMode(true);
                              handleBrandChange("");
                            }}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-xl cursor-pointer"
                          >
                            + Custom
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            autoFocus
                            placeholder="Enter brand name (e.g. JK BMS, DALY, CATL, EVE)..."
                            value={newProductForm.brand}
                            onChange={(e) => handleBrandChange(e.target.value)}
                            className="w-full bg-[#F4F9FF] border border-blue-400 rounded-xl py-2 pl-3 pr-28 text-xs font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                          />
                          <button
                            type="button"
                            onClick={() => setIsNewBrandMode(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-[10px] font-semibold text-slate-700 rounded-lg cursor-pointer"
                          >
                            Pick saved ▾
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dynamic Catalog Identity & Duplicate Status Banner */}
                  {duplicateCheckStatus === "EXACT_EXISTS" && duplicateMatchInfo?.matchedProduct && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-900">
                            Same Product & Brand Already Exists
                          </span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white border border-amber-300 rounded text-amber-800">
                          {duplicateMatchInfo.matchedProduct.brand}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        {duplicateMatchInfo.message || `Product already registered under this brand.`}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          handleReuseInPO(duplicateMatchInfo.matchedProduct);
                        }}
                        className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Reuse Existing "{duplicateMatchInfo.matchedProduct.name}" in PO</span>
                      </button>
                    </div>
                  )}

                  {duplicateCheckStatus === "CROSS_BRAND_EXISTS" && selectedPartFamily && !duplicateMatchInfo?.matchedProduct && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#0878F9] shrink-0" />
                        <span className="text-xs font-bold text-blue-950">
                          New Brand Identity for Existing Part Number
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        Part Number <span className="font-mono font-bold text-[#0878F9]">{selectedPartFamily.partNumber}</span> will be registered under brand <span className="font-bold">{newProductForm.brand}</span> with a newly generated UIN. Existing records ({selectedPartFamily.brands.map((b) => b.brand).join(", ")}) remain unchanged.
                      </p>
                    </div>
                  )}

                  {duplicateCheckStatus === "CROSS_BRAND_EXISTS" && duplicateMatchInfo?.matchedProduct && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#0878F9] shrink-0" />
                        <span className="text-xs font-bold text-blue-950">
                          Cross-Brand Product Identity
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        Part Number <span className="font-mono font-bold text-[#0878F9]">{duplicateMatchInfo.matchedProduct.partNumber}</span> exists under brand <span className="font-bold">{duplicateMatchInfo.matchedProduct.brand}</span>. Registering under brand <span className="font-bold">{newProductForm.brand || "new brand"}</span> creates a distinct product identity and new UIN.
                      </p>
                    </div>
                  )}

                  {duplicateCheckStatus === "CLEAN" && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Identity Verified: No duplicates found across catalog. Sequence allocated safely.</span>
                    </div>
                  )}

                  {/* Internal Part Number (CAT-SECNO) - Allocated after duplicate check */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Internal Part Number <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {newProductForm.partNumber ? (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ⚡ {newProductForm.partNumber}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Allocated After Duplicate Check
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          readOnly
                          placeholder={isGeneratingPartNumber ? "Allocating sequence..." : "Run duplicate check or click Allocate Sequence"}
                          value={newProductForm.partNumber}
                          className="w-full bg-slate-100/90 border border-slate-300 rounded-xl py-2 pl-3 pr-8 text-xs font-mono font-extrabold text-[#0878F9] focus:outline-none cursor-default select-all"
                        />
                        {isGeneratingPartNumber && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0878F9] absolute right-3 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!!selectedPartFamily || isGeneratingPartNumber || (!newProductForm.name.trim() && !newProductForm.partNumber.trim())}
                        onClick={() => checkDuplicateAndAllocate({ forceAllocate: true })}
                        className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        title="Check catalog across all brands and allocate next sequence"
                      >
                        {isGeneratingPartNumber ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{newProductForm.partNumber ? "Re-Verify Sequence" : "Check & Allocate"}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-[#526B91]">
                      Sequence is allocated per category ({newProductForm.category}-SECNO) concurrency-safe without reusing historically deleted numbers.
                    </p>
                  </div>

                  {/* Unit of Measure & Active Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Unit of Measure
                      </label>
                      <select
                        value={newProductForm.unit}
                        onChange={(e) => setNewProductForm((prev) => ({ ...prev, unit: e.target.value }))}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-semibold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Catalog Status
                      </label>
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="product-is-active"
                          checked={newProductForm.isActive}
                          onChange={(e) => setNewProductForm((p) => ({ ...p, isActive: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="product-is-active" className="text-xs font-medium text-slate-700 cursor-pointer">
                          Active in Product Catalog
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Technical Specifications */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Technical Specifications & Parameters (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 100A continuous discharge, 2A balance current, RS485/CAN/UART communication..."
                      value={newProductForm.technicalSpecs}
                      onChange={(e) => setNewProductForm((prev) => ({ ...prev, technicalSpecs: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  {/* Description / Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Description / Handling Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Premium active balancer module. Store in anti-static enclosure."
                      value={newProductForm.description}
                      onChange={(e) => setNewProductForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  {/* Initial PO Quantity & Unit Price */}
                  <div className="p-3 bg-blue-50/50 border border-blue-200/60 rounded-xl grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-900 block">
                        Initial PO Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newProductForm.initialQty}
                        onChange={(e) => setNewProductForm((prev) => ({ ...prev, initialQty: parseInt(e.target.value) || 1 }))}
                        className="w-full bg-white border border-blue-300 rounded-lg py-1.5 px-2.5 text-xs font-bold text-[#0B2148]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-900 block">
                        PO Unit Price ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newProductForm.initialPrice}
                        onChange={(e) => setNewProductForm((prev) => ({ ...prev, initialPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-white border border-blue-300 rounded-lg py-1.5 px-2.5 text-xs font-bold text-[#0B2148]"
                      />
                    </div>
                  </div>
                </div>
              </form>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#D8E8FA] bg-white flex items-center justify-between">
                <span className="text-[11px] text-[#526B91]">
                  Same part number under different brands receives distinct UINs. Material SKUs auto-synchronized.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProductModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#526B91] hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="new-product-form"
                    disabled={createProductMutation.isPending}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {createProductMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save & Add to PO</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: QUICK CREATE BRAND ─────────────────────────────── */}
      <AnimatePresence>
        {isQuickBrandOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQuickBrandOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-md bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="p-4 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-[#0B2148]">Register New Brand</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickBrandOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-[#526B91] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!quickBrandForm.name.trim()) {
                    toast.error("Brand name is required.");
                    return;
                  }
                  createBrandMutation.mutate({
                    name: quickBrandForm.name.trim(),
                    code: quickBrandForm.code.trim() || undefined,
                    description: quickBrandForm.description.trim() || undefined,
                    country: quickBrandForm.country.trim() || undefined,
                    website: quickBrandForm.website.trim() || undefined,
                    isActive: true
                  });
                }}
                className="p-5 space-y-3.5 text-xs"
              >
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Brand / Manufacturer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JK BMS, DALY, CATL, EVE"
                    value={quickBrandForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const autoCode = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
                      setQuickBrandForm((p) => ({
                        ...p,
                        name,
                        code: p.code ? p.code : autoCode
                      }));
                    }}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 block">Brand Code</label>
                      <span className="text-[10px] text-[#526B91]">3-4 Chars</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. JKM, DAL"
                      value={quickBrandForm.code}
                      onChange={(e) => setQuickBrandForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-mono font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Country / Origin</label>
                    <input
                      type="text"
                      placeholder="e.g. China, Germany, India"
                      value={quickBrandForm.country}
                      onChange={(e) => setQuickBrandForm((p) => ({ ...p, country: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Website URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={quickBrandForm.website}
                    onChange={(e) => setQuickBrandForm((p) => ({ ...p, website: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Official OEM supplier for Active Balancers and Protection Boards"
                    value={quickBrandForm.description}
                    onChange={(e) => setQuickBrandForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickBrandOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#526B91] hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createBrandMutation.isPending}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {createBrandMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save & Select Brand</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: QUICK CREATE SUPPLIER ─────────────────────────── */}
      <AnimatePresence>
        {isQuickSupplierOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQuickSupplierOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-lg bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="p-4 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0878F9]" />
                  <h3 className="text-sm font-bold text-[#0B2148]">Quick-Create Supplier</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-[#526B91]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!quickSupplierForm.name.trim()) {
                    toast.error("Supplier name is required");
                    return;
                  }
                  createSupplierMutation.mutate(quickSupplierForm);
                }}
                className="p-5 space-y-3.5 text-xs"
              >
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Power Components Ltd"
                    value={quickSupplierForm.name}
                    onChange={(e) => setQuickSupplierForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Sharma"
                      value={quickSupplierForm.contact}
                      onChange={(e) => setQuickSupplierForm((p) => ({ ...p, contact: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 block">Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={quickSupplierForm.phone}
                      onChange={(e) => setQuickSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Email</label>
                  <input
                    type="email"
                    placeholder="e.g. sales@apexpower.com"
                    value={quickSupplierForm.email}
                    onChange={(e) => setQuickSupplierForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Plant / Dispatch Address</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Plot 42, Bhosari Industrial Area, Pune"
                    value={quickSupplierForm.address}
                    onChange={(e) => setQuickSupplierForm((p) => ({ ...p, address: e.target.value }))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickSupplierOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#526B91] hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSupplierMutation.isPending}
                    className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    {createSupplierMutation.isPending ? "Registering..." : "Save & Select"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 4: IMPORT FROM PURCHASE REQUEST ──────────────────── */}
      <AnimatePresence>
        {isPRImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPRImportOpen(false)}
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-2xl bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="p-4 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0878F9]" />
                  <h3 className="text-sm font-bold text-[#0B2148]">Import Approved Purchase Request Items</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPRImportOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-[#526B91]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-[#EAF2FC]">
                {(purchaseRequestsList || []).length === 0 ? (
                  <p className="text-xs text-[#526B91] text-center py-8">
                    No approved Purchase Requests pending order creation.
                  </p>
                ) : (
                  (purchaseRequestsList || []).map((pr: any) => (
                    <div key={pr.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#0878F9]">{pr.prNumber}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                            APPROVED
                          </span>
                        </div>
                        <p className="text-[11px] text-[#526B91] mt-0.5">
                          Requester: {pr.requestedBy?.name || "Staff"} • {pr.items?.length || 0} items • Required by: {pr.requiredDate?.split("T")[0]}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImportPR(pr)}
                        className="px-3.5 py-1.5 bg-[#0878F9] hover:bg-[#0667DB] text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer"
                      >
                        Import Items
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CONFIRM CURRENCY CHANGE ──────────────────────── */}
      <AnimatePresence>
        {pendingCurrencyChange && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingCurrencyChange(null)}
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-md bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0B2148]">Change PO Operating Currency?</h3>
                  <p className="text-xs text-[#526B91]">
                    You have <strong className="text-[#0B2148]">{items.length} line item(s)</strong> in this purchase order.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-700">
                <p>
                  Changing currency from <strong className="font-mono text-blue-700">{currency} ({currencySymbol})</strong> to <strong className="font-mono text-emerald-700">{pendingCurrencyChange} ({getCurrencySymbol(pendingCurrencyChange)})</strong> will update the display and calculation symbols on all items.
                </p>
                <p className="text-amber-800 text-[11px] font-semibold bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠️ Unit prices and discounts will NOT be converted automatically. Please review line pricing if exchange rates differ.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAF2FC]">
                <button
                  type="button"
                  onClick={() => setPendingCurrencyChange(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrency(pendingCurrencyChange);
                    setPendingCurrencyChange(null);
                    toast.success(`Operating currency changed to ${pendingCurrencyChange}`);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Product Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(deleteProductTarget)}
        title="Permanently Delete Product Master?"
        recordType="Product Master Catalog"
        recordIdentity={deleteProductTarget ? `${deleteProductTarget.name} (${deleteProductTarget.partNumber} • ${deleteProductTarget.brand})` : ""}
        description={`Are you sure you want to permanently delete product "${deleteProductTarget?.name}"? It will be permanently removed from the procurement catalog.`}
        warningText={`Permanent Deletion • Irreversible: Deleting this product master will permanently purge UIN ${deleteProductTarget?.uin} and its synchronized factory material. It will NO LONGER appear in this catalog or in purchase orders.`}
        isIrreversible={true}
        hasDependencies={false}
        confirmButtonText="Permanently Delete Product"
        isPending={deleteProductMutation.isPending}
        onCancel={() => setDeleteProductTarget(null)}
        onConfirm={async () => {
          if (deleteProductTarget?.id) {
            await deleteProductMutation.mutateAsync(deleteProductTarget.id);
          }
        }}
      />
    </div>
  );
}
