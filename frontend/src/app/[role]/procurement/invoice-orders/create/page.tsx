"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck2,
  ArrowLeft,
  ArrowRight,
  Zap,
  Check,
  Plus,
  Trash2,
  Upload,
  X,
  Loader2,
  Building2,
  Calendar,
  Tag,
  DollarSign,
  Package,
  Layers,
  Paperclip,
  AlertCircle,
  FileText,
  Info,
  Search,
  ChevronDown,
  Copy,
  ImageIcon,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Edit
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import ConfirmDeleteDialog from "@/components/ui/ConfirmDeleteDialog";

interface InvoiceLineItem {
  id: string; // client temporary ID
  poItemId?: string | null;
  materialId?: string | null;
  productId?: string | null;
  name: string;
  partNumber?: string;
  brand?: string;
  productUin?: string;
  sku?: string;
  category?: string;
  unit: string;
  imageUrl?: string | null;
  invoiceQuantity: number;
  poOrderedQuantity?: number;
  poReceivedQuantity?: number;
  poPendingQuantity?: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  batchNumber?: string;
  serialNumber?: string;
  warehouseId?: string;
  warehouseLocationId?: string;
  specification?: string;
}

interface AttachedFile {
  fileName: string;
  fileReference: string;
  fileSize?: number;
  fileType?: string;
  documentType: string;
}

const COMMON_UNITS = ["PCS", "METER", "SET", "KG", "ROLL", "PAIR", "BOX", "LITER"];
const COMMON_CATEGORIES = [
  "BMS", "BUSBAR", "INSULATION", "WIRE", "ENCLOSURE",
  "HARDWARE", "ELECTRONICS", "RAW_MATERIAL", "CELLS", "PACKAGING", "OTHER"
];

const TAX_RATES = [0, 5, 12, 18, 28];

const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (INR)" },
  { code: "ZMW", symbol: "ZK", label: "Zambian Kwacha (ZMW)" },
  { code: "USD", symbol: "$", label: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", label: "Euro (EUR)" },
  { code: "GBP", symbol: "£", label: "British Pound (GBP)" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan (CNY)" },
  { code: "AED", symbol: "AED", label: "UAE Dirham (AED)" }
];

export default function CreateInvoiceOrderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleSlug = (params?.role as string) || "admin";
  const queryClient = useQueryClient();

  const poIdFromUrl = searchParams.get("poId") || "";
  const editId = searchParams.get("edit") || searchParams.get("id") || "";
  const isEditMode = Boolean(editId);

  useEffect(() => {
    if (roleSlug === "inventory-manager") {
      router.replace(`/${roleSlug}/procurement/invoice-orders/verification`);
    }
  }, [roleSlug, router]);

  // Fetch existing draft IO for edit mode
  const { data: editData, isLoading: isLoadingEdit } = useQuery({
    queryKey: ["procurement-io-edit", editId],
    queryFn: async () => {
      if (!editId) return null;
      const res = await api.get(`/crm/procurement/invoice-orders/${editId}`);
      return res.data;
    },
    enabled: Boolean(editId)
  });

  // Guard: redirect if order is not in editable status
  useEffect(() => {
    if (editData && !["DRAFT", "CORRECTION_REQUIRED"].includes(editData.status)) {
      toast.error(`Invoice Order ${editData.ioNumber} is in status "${editData.status}" and cannot be edited.`);
      router.replace(`/${roleSlug}/procurement/invoice-orders/${editId}`);
    }
  }, [editData, roleSlug, router, editId]);

  // Form State
  const [purchaseOrderId, setPurchaseOrderId] = useState(poIdFromUrl);
  const [directVendorId, setDirectVendorId] = useState("");
  const isDirect = purchaseOrderId === "DIRECT";
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [invoiceType, setInvoiceType] = useState<"FINAL_TAX_INVOICE" | "PROFORMA" | "CREDIT_NOTE" | "DEBIT_NOTE">("FINAL_TAX_INVOICE");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState("INR");
  const [paymentMode, setPaymentMode] = useState<"CREDIT" | "PAID" | "PARTIALLY_PAID">("CREDIT");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [remarks, setRemarks] = useState("");

  // Populate state when editData arrives
  useEffect(() => {
    if (editData) {
      if (editData.purchaseOrderId) {
        setPurchaseOrderId(editData.purchaseOrderId);
      } else if (editData.isDirect) {
        setPurchaseOrderId("DIRECT");
      }
      if (editData.vendorId) {
        setDirectVendorId(editData.vendorId);
      }
      if (editData.vendor) {
        setSelectedVendor(editData.vendor);
      }
      if (editData.supplierInvoiceNumber) {
        setSupplierInvoiceNumber(editData.supplierInvoiceNumber);
      }
      if (editData.invoiceType) {
        setInvoiceType(editData.invoiceType);
      }
      if (editData.invoiceDate) {
        try {
          setInvoiceDate(new Date(editData.invoiceDate).toISOString().split("T")[0]);
        } catch {
          setInvoiceDate(editData.invoiceDate);
        }
      }
      if (editData.currency) {
        setCurrency(editData.currency);
      }
      if (editData.paymentMode) {
        setPaymentMode(editData.paymentMode);
      }
      if (editData.paymentMethod) {
        setPaymentMethod(editData.paymentMethod);
      }
      if (editData.additionalCharges !== undefined && editData.additionalCharges !== null) {
        setAdditionalCharges(Number(editData.additionalCharges));
      }
      if (editData.remarks) {
        setRemarks(editData.remarks);
      }
      if (Array.isArray(editData.items) && editData.items.length > 0) {
        const mappedItems: InvoiceLineItem[] = editData.items.map((it: any) => ({
          id: it.id || `line-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          poItemId: it.poItemId || null,
          materialId: it.materialId || it.material?.id || null,
          productId: it.productId || it.product?.id || null,
          name: it.description || it.product?.name || it.material?.name || "Item",
          partNumber: it.product?.partNumber || it.material?.partNumber || it.material?.sku || "",
          brand: it.product?.brand || "OEM",
          productUin: it.product?.uin || "",
          sku: it.material?.sku || "",
          category: it.product?.category || it.material?.category || "RAW_MATERIAL",
          unit: it.unit || "PCS",
          imageUrl: it.product?.imageUrl || null,
          invoiceQuantity: Number(it.invoiceQuantity || 1),
          poOrderedQuantity: it.poItem?.quantityOrdered,
          poReceivedQuantity: it.poItem?.quantityReceived,
          unitPrice: Number(it.unitPrice || 0),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          batchNumber: it.batchNumber || "",
          serialNumber: it.serialNumber || "",
          warehouseId: it.warehouseId || "",
          warehouseLocationId: it.warehouseLocationId || "",
          specification: it.specification || ""
        }));
        setItems(mappedItems);
      }
      if (Array.isArray(editData.documents) && editData.documents.length > 0) {
        setDocuments(
          editData.documents.map((d: any) => ({
            fileName: d.fileName,
            fileReference: d.fileReference,
            fileSize: d.fileSize || undefined,
            fileType: d.fileType || undefined,
            documentType: d.documentType || "FINAL_TAX_INVOICE"
          }))
        );
      }
    }
  }, [editData]);

  if (roleSlug === "inventory-manager") {
    return null;
  }

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState<"details" | "items" | "review">("details");

  // Initial Payment form state
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Items State
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  // Attached Documents State
  const [documents, setDocuments] = useState<AttachedFile[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Catalog Search State (Step 2 flow)
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("ALL");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // PO Import Modal State
  const [isPOImportModalOpen, setIsPOImportModalOpen] = useState(false);
  const [selectedPOItemIds, setSelectedPOItemIds] = useState<string[]>([]);

  // Quick Create Brand Modal State
  const [isQuickBrandOpen, setIsQuickBrandOpen] = useState(false);
  const [quickBrandForm, setQuickBrandForm] = useState({
    name: "",
    code: "",
    description: "",
    country: "",
    website: ""
  });

  // Register New Product Modal State
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
  const [isEditNewBrandMode, setIsEditNewBrandMode] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Product Master State
  const [deleteProductTarget, setDeleteProductTarget] = useState<any | null>(null);

  const invoiceMonth = useMemo(() => {
    if (!invoiceDate) return "";
    try {
      const d = new Date(invoiceDate);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return "";
    }
  }, [invoiceDate]);

  const currencySymbol = useMemo(() => {
    return SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol || "₹";
  }, [currency]);

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

  // 0. Fetch Vendors Registry for Direct Mode
  const { data: vendorsList } = useQuery({
    queryKey: ["procurement-vendors-registry"],
    queryFn: async () => (await api.get("/sales/vendors")).data || []
  });

  // When directVendorId or vendorsList changes in DIRECT mode, sync selectedVendor
  useEffect(() => {
    if (purchaseOrderId === "DIRECT") {
      if (directVendorId) {
        const v = (vendorsList || []).find((ven: any) => ven.id === directVendorId);
        setSelectedVendor(v || null);
      } else {
        setSelectedVendor(null);
      }
    }
  }, [purchaseOrderId, directVendorId, vendorsList]);

  // 1. Fetch Approved Purchase Orders for selection
  const { data: poList, isLoading: isPOLoading } = useQuery({
    queryKey: ["procurement-pos-for-io"],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/purchase-orders", {
        params: { limit: 100 }
      });
      return (res.data?.purchaseOrders || res.data?.items || []).filter((p: any) =>
        ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(p.status)
      );
    }
  });

  // 2. Fetch specific PO Details when selected
  const { data: selectedPODetails, isLoading: isPODetailLoading } = useQuery({
    queryKey: ["po-detail-for-io", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return null;
      const res = await api.get(`/crm/procurement/purchase-orders/${purchaseOrderId}`);
      return res.data;
    },
    enabled: !!purchaseOrderId
  });

  // 3. Product Catalog Query (Exact flow from purchase-orders/create Stage 2)
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

  // 4. Brands List Query
  const { data: brandsData } = useQuery({
    queryKey: ["procurement-brands"],
    queryFn: async () => (await api.get("/crm/procurement/brands")).data || []
  });

  const brandsList: any[] = useMemo(() => {
    if (Array.isArray(brandsData)) return brandsData;
    if (brandsData?.brands && Array.isArray(brandsData.brands)) return brandsData.brands;
    return [];
  }, [brandsData]);

  // When PO changes, sync vendor, currency, and prefill
  useEffect(() => {
    if (selectedPODetails) {
      setSelectedVendor(selectedPODetails.vendor || null);
      setCurrency(selectedPODetails.currency || "INR");
      if (selectedPODetails.supplierInvoiceNumber && !supplierInvoiceNumber) {
        setSupplierInvoiceNumber(selectedPODetails.supplierInvoiceNumber);
      }
    }
  }, [selectedPODetails]);

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
        toast.warning(`Exact match found under ${match.brand}. You can reuse it directly in this Invoice.`);
      } else if (hasCrossBrandMatch && crossBrandMatches?.length > 0) {
        const match = crossBrandMatches[0];
        setDuplicateCheckStatus("CROSS_BRAND_EXISTS");
        setDuplicateMatchInfo({
          matchedProduct: match,
          crossBrandProducts: crossBrandMatches,
          message: `Same component exists under brand "${match.brand}" with Part Number "${match.partNumber}". Reusing canonical Part Number for "${brand || "new brand"}" with distinct brand UIN.`
        });
        // Core business rule: Same component always shares the same category Part Number across brands
        const canonicalPart = match.partNumber || res.data?.suggestedPartNumber;
        if (canonicalPart) {
          setNewProductForm((prev) => ({
            ...prev,
            partNumber: canonicalPart,
            category: match.category || prev.category,
            unit: match.unit || prev.unit,
            technicalSpecs: match.technicalSpecs || prev.technicalSpecs
          }));
          toast.info(`Standardized Part Number: Reusing canonical "${canonicalPart}" for brand "${brand || "new brand"}". Distinct UIN will be allocated.`);
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
          message: `Product "${selectedPartFamily.name}" (${selectedPartFamily.partNumber}) is already registered under brand "${existingBrandMatch.brand}" (UIN: ${existingBrandMatch.uin}). Saving will reuse this registered identity in the Invoice.`
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

  // Reset product creation form
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
    setNewProductForm((prev) => ({
      ...prev,
      name: family.name,
      partNumber: family.partNumber,
      category: family.category,
      unit: family.unit || "PCS",
      technicalSpecs: family.technicalSpecs || "",
      description: family.description || "",
      imageUrl: family.imageUrl || "",
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

  const handleReuseInInvoice = (prod: any) => {
    if (!prod) return;
    const isInInvoice = items.some((it) => it.productId === prod.id);
    if (isInInvoice) {
      toast.info(`Product "${prod.name}" is already in this Invoice Order.`);
    }
    const newItem: InvoiceLineItem = {
      id: `line-${prod.id}-${Date.now()}`,
      productId: prod.id,
      materialId: prod.materialId || undefined,
      name: prod.name,
      partNumber: prod.partNumber,
      brand: prod.brand,
      productUin: prod.uin,
      sku: prod.material?.sku || "",
      category: prod.category,
      unit: prod.unit || "PCS",
      imageUrl: prod.imageUrl || undefined,
      invoiceQuantity: Number(newProductForm.initialQty) || 1,
      unitPrice: Number(newProductForm.initialPrice) || Number(prod.material?.unitPrice) || 0,
      discount: 0,
      taxRate: 18,
      specification: prod.technicalSpecs || undefined,
      batchNumber: ""
    };
    setItems((prev) => [...prev, newItem]);
    setIsNewProductModalOpen(false);
    resetNewProductForm();
    toast.success(`Reused registered product "${prod.name}" (UIN: ${prod.uin}) in Invoice Order.`);
  };

  // Quick Create Brand Mutation
  const createBrandMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/procurement/brands", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-brands"] });
      const newBrand = res.data?.brand;
      if (newBrand) {
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
      const prod = res.data?.product || res.data;
      const isExisting = res.data?.isExisting;

      if (prod) {
        const newItem: InvoiceLineItem = {
          id: `line-${prod.id}-${Date.now()}`,
          productId: prod.id,
          materialId: prod.materialId || undefined,
          name: prod.name,
          partNumber: prod.partNumber,
          brand: prod.brand,
          productUin: prod.uin,
          sku: prod.material?.sku || "",
          category: prod.category,
          unit: prod.unit || "PCS",
          imageUrl: prod.imageUrl || undefined,
          invoiceQuantity: Number(newProductForm.initialQty) || 1,
          unitPrice: Number(newProductForm.initialPrice) || Number(prod.material?.unitPrice) || 0,
          discount: 0,
          taxRate: 18,
          specification: prod.technicalSpecs || undefined,
          batchNumber: ""
        };

        setItems((prev) => [...prev, newItem]);
        toast.success(
          isExisting 
            ? `Reused registered product "${prod.name}" (${prod.uin})`
            : `Product "${prod.name}" registered, saved to Factory Material SKUs (${prod.partNumber}), and added to Invoice Order`
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

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/procurement/products/${id}`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-products-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-brands"] });
      toast.success(res?.data?.message || "Product master permanently deleted");
      setDeleteProductTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete product master");
    }
  });

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

  // Select item from catalog search
  const handleSelectCatalogProduct = (prod: any) => {
    const existing = items.find((it) => it.productId === prod.id);
    if (existing) {
      toast.info(`"${prod.name}" is already in your order items list. Incrementing quantity.`);
      setItems((prev) =>
        prev.map((it) =>
          it.productId === prod.id ? { ...it, invoiceQuantity: Number(it.invoiceQuantity) + 1 } : it
        )
      );
      setIsSearchDropdownOpen(false);
      return;
    }

    const newItem: InvoiceLineItem = {
      id: `line-${prod.id}-${Date.now()}`,
      productId: prod.id,
      materialId: prod.materialId || undefined,
      name: prod.name,
      partNumber: prod.partNumber,
      brand: prod.brand,
      productUin: prod.uin,
      sku: prod.material?.sku || "",
      category: prod.category,
      unit: prod.unit || "PCS",
      imageUrl: prod.imageUrl || undefined,
      invoiceQuantity: 1,
      unitPrice: prod.material?.unitPrice || 0,
      discount: 0,
      taxRate: 18,
      specification: prod.technicalSpecs || undefined,
      batchNumber: ""
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`Added "${prod.name}" to invoice lines`);
    setIsSearchDropdownOpen(false);
  };

  // Import all lines from selected PO
  const handleImportAllPOLines = () => {
    if (!selectedPODetails?.items || selectedPODetails.items.length === 0) {
      toast.error("Selected PO has no items to import");
      return;
    }
    const imported: InvoiceLineItem[] = selectedPODetails.items.map((line: any) => {
      const remainingPending = Math.max(1, (line.quantityOrdered || 0) - (line.quantityReceived || 0));
      return {
        id: `po-line-${line.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        poItemId: line.id,
        materialId: line.materialId || line.material?.id || null,
        productId: line.productId || line.product?.id || null,
        name: line.product?.name || line.material?.name || line.description,
        partNumber: line.partNumber || line.product?.partNumber || line.material?.sku || "",
        brand: line.brand || line.product?.brand || "OEM",
        productUin: line.productUin || line.product?.uin || "",
        sku: line.material?.sku || "",
        category: line.product?.category || line.material?.category || "RAW_MATERIAL",
        unit: line.unit || line.product?.unit || line.material?.unit || "PCS",
        imageUrl: line.product?.imageUrl || null,
        invoiceQuantity: remainingPending,
        poOrderedQuantity: line.quantityOrdered,
        poReceivedQuantity: line.quantityReceived || 0,
        poPendingQuantity: remainingPending,
        unitPrice: Number(line.unitPrice || 0),
        discount: Number(line.discount || 0),
        taxRate: Number(line.taxRate || 18),
        batchNumber: line.batchNumber || "",
        specification: line.specification || ""
      };
    });

    setItems(imported);
    toast.success(`Imported ${imported.length} items from PO ${selectedPODetails.poNumber}`);
  };

  // Import selected lines from PO Modal
  const handleImportSelectedPOLines = () => {
    if (!selectedPODetails?.items || selectedPOItemIds.length === 0) {
      toast.error("Select at least one PO line to import");
      return;
    }

    const toImport = selectedPODetails.items.filter((l: any) => selectedPOItemIds.includes(l.id));
    const imported: InvoiceLineItem[] = toImport.map((line: any) => {
      const remainingPending = Math.max(1, (line.quantityOrdered || 0) - (line.quantityReceived || 0));
      return {
        id: `po-line-${line.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        poItemId: line.id,
        materialId: line.materialId || line.material?.id || null,
        productId: line.productId || line.product?.id || null,
        name: line.product?.name || line.material?.name || line.description,
        partNumber: line.partNumber || line.product?.partNumber || line.material?.sku || "",
        brand: line.brand || line.product?.brand || "OEM",
        productUin: line.productUin || line.product?.uin || "",
        sku: line.material?.sku || "",
        category: line.product?.category || line.material?.category || "RAW_MATERIAL",
        unit: line.unit || line.product?.unit || line.material?.unit || "PCS",
        imageUrl: line.product?.imageUrl || null,
        invoiceQuantity: remainingPending,
        poOrderedQuantity: line.quantityOrdered,
        poReceivedQuantity: line.quantityReceived || 0,
        poPendingQuantity: remainingPending,
        unitPrice: Number(line.unitPrice || 0),
        discount: Number(line.discount || 0),
        taxRate: Number(line.taxRate || 18),
        batchNumber: line.batchNumber || "",
        specification: line.specification || ""
      };
    });

    setItems((prev) => [...prev, ...imported]);
    setIsPOImportModalOpen(false);
    setSelectedPOItemIds([]);
    toast.success(`Added ${imported.length} selected lines from PO`);
  };

  // Duplicate an item line
  const handleDuplicateItem = (index: number) => {
    const target = items[index];
    if (!target) return;
    const duplicated: InvoiceLineItem = {
      ...target,
      id: `dup-${Date.now()}-${Math.random().toString(36).substring(7)}`
    };
    const next = [...items];
    next.splice(index + 1, 0, duplicated);
    setItems(next);
    toast.info("Line item duplicated");
  };

  // Remove an item line
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update item field
  const handleItemFieldChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Financial Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const lineSub = (Number(item.invoiceQuantity) || 0) * (Number(item.unitPrice) || 0);
      const discount = Math.min(lineSub, Number(item.discount || 0));
      const taxable = Math.max(0, lineSub - discount);
      const lineTax = (taxable * (Number(item.taxRate) || 0)) / 100;
      subtotal += lineSub;
      totalDiscount += discount;
      totalTax += lineTax;
    });

    const addCharges = Number(additionalCharges) || 0;
    const grandTotal = subtotal - totalDiscount + totalTax + addCharges;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      addCharges,
      grandTotal
    };
  }, [items, additionalCharges]);

  // Document upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/crm/procurement/products/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data?.url) {
        setDocuments((prev) => [
          ...prev,
          {
            fileName: file.name,
            fileReference: res.data.url,
            fileSize: file.size,
            fileType: file.type,
            documentType: docType
          }
        ]);
        toast.success(`Attached ${file.name}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload file");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Create Mutation
  const createIOMutation = useMutation({
    mutationFn: (submitNow: boolean) => {
      const isDirectMode = purchaseOrderId === "DIRECT" || !purchaseOrderId;
      if (!isDirectMode && !purchaseOrderId) throw new Error("Purchase Order reference is required");
      if (!selectedVendor?.id) throw new Error("Vendor is required. Please select a vendor.");
      if (!supplierInvoiceNumber.trim()) throw new Error("Vendor's Invoice Number is required");
      if (items.length === 0) throw new Error("At least one item line is required in the Invoice Order");

      const payload: any = {
        purchaseOrderId: isDirectMode ? undefined : purchaseOrderId,
        isDirect: isDirectMode,
        vendorId: selectedVendor.id,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        invoiceType,
        invoiceDate,
        currency,
        additionalCharges: calculations.addCharges,
        paymentMode,
        paymentMethod: paymentMode !== "CREDIT" ? paymentMethod : undefined,
        remarks: remarks.trim() || undefined,
        submitNow,
        items: items.map((it) => ({
          poItemId: it.poItemId || undefined,
          materialId: it.materialId || undefined,
          productId: it.productId || undefined,
          description: it.name,
          unit: it.unit,
          invoiceQuantity: Number(it.invoiceQuantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          batchNumber: it.batchNumber?.trim() || undefined,
          serialNumber: it.serialNumber?.trim() || undefined,
          specification: it.specification?.trim() || undefined
        })),
        documents
      };

      if ((paymentMode === "PAID" || paymentMode === "PARTIALLY_PAID") && initialPaymentAmount > 0) {
        payload.initialPayment = {
          amount: Number(initialPaymentAmount),
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined
        };
      }

      if (isEditMode) {
        return api.put(`/crm/procurement/invoice-orders/${editId}`, payload);
      }
      return api.post("/crm/procurement/invoice-orders", payload);
    },
    onSuccess: (res, submitNow) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      if (editId) {
        queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", editId] });
      }
      toast.success(
        isEditMode
          ? submitNow
            ? `Invoice Order ${res.data.ioNumber} updated and submitted for inward verification!`
            : `Invoice Order ${res.data.ioNumber} updated successfully!`
          : submitNow
            ? `Invoice Order ${res.data.ioNumber} created and submitted successfully!`
            : `Invoice Order ${res.data.ioNumber} saved as draft`
      );
      router.push(`/${roleSlug}/procurement/invoice-orders/${res.data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || (isEditMode ? "Failed to update Invoice Order" : "Failed to create Invoice Order"));
    }
  });

  if (isEditMode && isLoadingEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
        <span className="text-xs font-semibold text-[#526B91]">Loading draft invoice order for editing...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title={isEditMode ? `Edit Draft Invoice Order (${editData?.ioNumber || "Draft"})` : "Create Invoice Order"}
        description={
          isEditMode
            ? `Modify commercial invoice details, line items, and product assignments for draft invoice order ${editData?.ioNumber || ""}`
            : "Register supplier commercial tax invoices, match against authorized purchase orders or create direct invoices, and assign products with enterprise catalog integration"
        }
        icon={<FileCheck2 className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Procurement", href: `/${roleSlug}/procurement/purchase-orders` },
          { label: "Invoice Orders", href: `/${roleSlug}/procurement/invoice-orders` },
          ...(isEditMode && editData?.ioNumber ? [{ label: editData.ioNumber, href: `/${roleSlug}/procurement/invoice-orders/${editId}` }] : []),
          { label: isEditMode ? "Edit Draft" : "Create" }
        ]}
        actions={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D8E8FA] hover:bg-slate-50 text-[#526B91] rounded-xl text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        }
      />

      {/* Draft Edit Alert Banner */}
      {isEditMode && editData && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <Edit className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Editing Draft Invoice Order <strong className="font-mono">{editData.ioNumber}</strong> (Supplier Invoice: <strong className="font-mono">{editData.supplierInvoiceNumber}</strong>). You can update vendor information, commercial lines, and attached documents.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-200/60 text-amber-800 border border-amber-300">
            {editData.status}
          </span>
        </div>
      )}

      {/* ── 3-STEP TABS NAVIGATION ── */}
      <div className="flex border border-[#D8E8FA] bg-white rounded-2xl p-1.5 shadow-2xs gap-2">
        {/* Tab 1: Details */}
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "details"
              ? "bg-[#0878F9] text-white shadow-xs"
              : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Order & Invoice Details</span>
          {supplierInvoiceNumber && selectedVendor && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeTab === "details" ? "bg-white/20 text-white" : "bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA]"
            }`}>
              ✓ Ready
            </span>
          )}
        </button>

        {/* Tab 2: Products & Items */}
        <button
          type="button"
          onClick={() => {
            if (!isDirect && !purchaseOrderId) {
              toast.info("Please select a Purchase Order or choose Direct first.");
              return;
            }
            if (isDirect && !selectedVendor) {
              toast.info("Please select a Vendor for this direct invoice order first.");
              return;
            }
            if (!supplierInvoiceNumber.trim()) {
              toast.info("Please enter the vendor's invoice number first.");
              return;
            }
            setActiveTab("items");
          }}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "items"
              ? "bg-[#0878F9] text-white shadow-xs"
              : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>2. Products & Add Items</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
            activeTab === "items" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
          }`}>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </button>

        {/* Tab 3: Review & Summary */}
        <button
          type="button"
          onClick={() => {
            if (!isDirect && !purchaseOrderId) {
              toast.info("Please select a Purchase Order or choose Direct first.");
              return;
            }
            if (isDirect && !selectedVendor) {
              toast.info("Please select a Vendor for this direct invoice order first.");
              return;
            }
            if (!supplierInvoiceNumber.trim()) {
              toast.info("Please enter the vendor's invoice number first.");
              return;
            }
            if (items.length === 0) {
              toast.info("Please add at least one line item before reviewing.");
              return;
            }
            setActiveTab("review");
          }}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "review"
              ? "bg-[#0878F9] text-white shadow-xs"
              : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>3. Review & Summary</span>
          {items.length > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              activeTab === "review" ? "bg-white/20 text-white" : "bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA]"
            }`}>
              {currencySymbol}{calculations.grandTotal.toFixed(2)}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: ORDER & INVOICE DETAILS ──────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): PO Reference & Commercial Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: Order & Invoice Reference */}
            <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                <span>Purchase Order & Commercial Identity</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Purchase Order with Direct Option */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                    Purchase Order Reference <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={purchaseOrderId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPurchaseOrderId(val);
                      if (val === "DIRECT") {
                        if (directVendorId) {
                          const v = (vendorsList || []).find((ven: any) => ven.id === directVendorId);
                          setSelectedVendor(v || null);
                        } else {
                          setSelectedVendor(null);
                        }
                      }
                    }}
                    className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] font-semibold focus:ring-2 focus:ring-[#0878F9]/30"
                  >
                    <option value="">-- Select an approved Purchase Order --</option>
                    <option value="DIRECT" className="font-bold text-[#0878F9]">
                      ⚡ Direct Invoice Order (Without Purchase Order)
                    </option>
                    {(poList || []).map((po: any) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} — {po.vendor?.name} ({po.currency} {Number(po.grandTotal).toLocaleString()}) [{po.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Direct Mode Alert & Vendor Picker */}
                {isDirect && (
                  <>
                    <div className="sm:col-span-2 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
                      <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Direct Invoice Order Mode</div>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Creating this supplier invoice directly without an approved PO reference. Please choose the registered Vendor and operating currency below.
                        </p>
                      </div>
                    </div>

                    {/* Direct Vendor Selection */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                        Select Vendor <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={directVendorId}
                        onChange={(e) => {
                          setDirectVendorId(e.target.value);
                          const ven = (vendorsList || []).find((v: any) => v.id === e.target.value);
                          setSelectedVendor(ven || null);
                        }}
                        className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] font-semibold focus:ring-2 focus:ring-[#0878F9]/30"
                      >
                        <option value="">-- Choose Vendor from Registry --</option>
                        {(vendorsList || []).map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.name} {v.gstin ? `(${v.gstin})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Currency Selector for Direct Mode */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                        Operating Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] font-semibold focus:ring-2 focus:ring-[#0878F9]/30"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label} ({c.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Supplier Invoice Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                    Vendor's Tax Invoice Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-9041"
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] font-mono font-bold focus:ring-2 focus:ring-[#0878F9]/30"
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:ring-2 focus:ring-[#0878F9]/30"
                  />
                </div>

                {/* Document Type */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                    Invoice Document Type
                  </label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:ring-2 focus:ring-[#0878F9]/30"
                  >
                    <option value="FINAL_TAX_INVOICE">Final Tax Invoice (Standard Commercial Invoice)</option>
                    <option value="PROFORMA">Proforma Invoice</option>
                    <option value="CREDIT_NOTE">Credit Note</option>
                    <option value="DEBIT_NOTE">Debit Note</option>
                  </select>
                </div>
              </div>

              {/* Vendor Display Card */}
              {selectedVendor && (
                <div className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-wrap items-center justify-between gap-3 text-xs mt-2">
                  <div>
                    <div className="font-bold text-[#0B2148] flex items-center gap-2">
                      <span>{selectedVendor.name}</span>
                      {selectedVendor.gstin && (
                        <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#D8E8FA] text-blue-700">
                          GST: {selectedVendor.gstin}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#526B91] mt-0.5">
                      {selectedVendor.contact || "Primary Contact"} | {selectedVendor.phone || "No Phone"} | {selectedVendor.email || "No Email"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white text-[#0878F9] font-bold border border-[#D8E8FA]">
                      Currency: {currency} ({currencySymbol})
                    </span>
                    {!isDirect && selectedPODetails && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        PO Total: {currencySymbol} {Number(selectedPODetails.grandTotal).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Payment Terms & Settlement */}
            <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                <Tag className="w-4 h-4" />
                <span>Payment Terms & Settlement Details</span>
              </h3>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#526B91] uppercase block">
                  Commercial Payment Terms
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CREDIT", "PAID", "PARTIALLY_PAID"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode);
                        if (mode === "PAID") setInitialPaymentAmount(calculations.grandTotal);
                        else if (mode === "CREDIT") setInitialPaymentAmount(0);
                      }}
                      className={`py-2.5 px-3 rounded-xl border font-bold text-xs cursor-pointer transition-all flex items-center justify-center text-center ${
                        paymentMode === mode
                          ? "bg-[#0878F9] border-[#0878F9] text-white shadow-xs"
                          : "bg-[#F8FAFC] border-[#D8E8FA] text-[#526B91] hover:bg-slate-100"
                      }`}
                    >
                      {mode === "CREDIT" ? "Credit (Pay Later)" : mode === "PAID" ? "Full Immediate" : "Partial Advance"}
                    </button>
                  ))}
                </div>

                {/* Payment Details when not Credit */}
                {paymentMode !== "CREDIT" && (
                  <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl space-y-3 mt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full text-xs bg-white border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 font-semibold"
                        >
                          <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                          <option value="UPI">UPI</option>
                          <option value="CASH">Cash</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">
                          Paid Amount ({currencySymbol})
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={initialPaymentAmount}
                          onChange={(e) => setInitialPaymentAmount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-lg p-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">
                        UTR / Transaction Reference
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. UTR99441188"
                        className="w-full bg-white border border-[#D8E8FA] rounded-lg p-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Supporting Documents & Remarks */}
          <div className="space-y-6">
            {/* Card 3: Attachments */}
            <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                <Paperclip className="w-4 h-4" />
                <span>Supplier Tax Invoice Attachment</span>
              </h3>

              {/* Document Upload Button */}
              <div className="border-2 border-dashed border-[#D8E8FA] rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  id="invoice-doc-upload"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileUpload(e, "FINAL_TAX_INVOICE")}
                  className="hidden"
                  disabled={isUploadingDoc}
                />
                <label htmlFor="invoice-doc-upload" className="cursor-pointer block space-y-1">
                  {isUploadingDoc ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#0878F9] mx-auto" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#0878F9] mx-auto" />
                  )}
                  <div className="text-xs font-bold text-[#0B2148]">
                    {isUploadingDoc ? "Uploading..." : "Upload Vendor Tax Invoice"}
                  </div>
                  <div className="text-[10px] text-[#526B91]">PDF, PNG, JPG up to 15MB</div>
                </label>
              </div>

              {/* Uploaded Documents List */}
              {documents.length > 0 && (
                <div className="space-y-1.5">
                  {documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[#F8FAFC] border border-[#D8E8FA] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-[#0878F9] shrink-0" />
                        <span className="truncate text-[#0B2148] font-semibold">{doc.fileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 hover:text-red-500 text-slate-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 4: Internal Remarks */}
            <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-3 shadow-2xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#0878F9]">
                Remarks / Inward Gate Notes
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Gate delivery notes, freight remarks, packing list cross-ref..."
                className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:ring-2 focus:ring-[#0878F9]/30"
              />
            </div>

            {/* Next Step Button */}
            <button
              type="button"
              onClick={() => {
                if (!isDirect && !purchaseOrderId) {
                  toast.error("Please select a Purchase Order or choose Direct first.");
                  return;
                }
                if (isDirect && !selectedVendor) {
                  toast.error("Please select a Vendor for this direct invoice order.");
                  return;
                }
                if (!supplierInvoiceNumber.trim()) {
                  toast.error("Please enter the vendor's invoice number.");
                  return;
                }
                setActiveTab("items");
              }}
              className="w-full py-3.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Next: Add Items & Products ({items.length})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: PRODUCTS & ADD ITEMS (100% PO CREATE STAGE 2 FLOW) ───── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "items" && (
        <div className="space-y-6">
          {/* Order Context Summary Banner */}
          <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-bold text-[#0B2148] flex items-center gap-2">
                <span>Vendor:</span>
                <span className="text-[#0878F9] font-bold">{selectedVendor?.name || "Not Selected"}</span>
                {selectedVendor?.gstin && (
                  <span className="text-[10px] font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-blue-700">
                    GST: {selectedVendor.gstin}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono text-[#526B91]">
                <span>• Invoice #:</span>
                <span className="font-bold text-[#0B2148]">{supplierInvoiceNumber || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border font-bold ${
                  isDirect
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  {isDirect ? "⚡ Direct Invoice Order" : `PO: ${selectedPODetails?.poNumber || "Linked PO"}`}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  {currency} ({currencySymbol})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className="text-xs font-bold text-[#0878F9] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          </div>


              <div className="bg-white border border-[#D8E8FA] rounded-2xl p-5 shadow-2xs space-y-4">
                {/* Top Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0878F9] border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {items.length}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-[#0B2148]">Invoice Line Items ({items.length})</h3>
                        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-blue-700">
                          <span>{currency} ({currencySymbol})</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#526B91] mt-0.5">
                        Vendor: <span className="font-semibold text-slate-700">{selectedVendor?.name || "Selected Vendor"}</span> • Search catalog or register new product
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

                    {!isDirect && selectedPODetails && (
                      <>
                        <button
                          type="button"
                          onClick={handleImportAllPOLines}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EAF5FF] border border-[#0878F9]/30 text-[#0878F9] hover:bg-[#0878F9] hover:text-white font-bold text-xs transition-all cursor-pointer"
                          title="Import all remaining line items from this PO"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Import All PO Lines ({selectedPODetails.items?.length || 0})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPOItemIds([]);
                            setIsPOImportModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer"
                        >
                          <Package className="w-3.5 h-3.5 text-[#526B91]" />
                          <span>Select Lines</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Category & Search Bar (Exact Stage 2 Flow) */}
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
                            onClick={() => setCatalogSearch("")}
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
                              const isInInvoice = items.some((it) => it.productId === prod.id);
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
                                        {isInInvoice && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded shrink-0">
                                            In Invoice
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
                                        {currencySymbol}{prod.material?.unitPrice?.toFixed(2) || "0.00"}
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
                                      <span>{isInInvoice ? "Add Again" : "Add to Invoice"}</span>
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

                {/* Line Items Table (Exact Stage 2 Flow) */}
                <div className="bg-white border border-[#D8E8FA] rounded-2xl shadow-2xs overflow-hidden mt-4">
                  {/* Desktop Table View (>= 1024px) */}
                  <div className="hidden lg:block overflow-x-visible">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[#526B91] text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-2.5 w-[22%] font-bold">Product / Identity</th>
                          <th className="py-2.5 px-2 w-[11%] font-bold">UIN</th>
                          <th className="py-2.5 px-2 w-[10%] font-bold">Batch #</th>
                          <th className="py-2.5 px-1 w-[6%] font-bold text-center">Unit</th>
                          <th className="py-2.5 px-1 w-[6%] font-bold text-center">Qty *</th>
                          <th className="py-2.5 px-2 w-[11%] font-bold text-right">Price ({currencySymbol}) *</th>
                          <th className="py-2.5 px-1.5 w-[8%] font-bold text-right">Disc ({currencySymbol})</th>
                          <th className="py-2.5 px-1 w-[7%] font-bold text-center">Tax</th>
                          <th className="py-2.5 px-2 w-[12%] font-bold text-right">Total ({currencySymbol})</th>
                          <th className="py-2.5 px-1 w-[7%] font-bold text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAF2FC]">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-12 text-center text-[#526B91]">
                              <div className="max-w-md mx-auto space-y-3">
                                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                                <p className="font-bold text-slate-700">No items added to this Invoice Order yet.</p>
                                <p className="text-xs text-[#526B91]">
                                  Select a category and type a part name or part number in the search bar above, or register a new component master.
                                </p>
                                {!isDirect && selectedPODetails && (
                                  <div className="pt-2 flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={handleImportAllPOLines}
                                      className="px-4 py-2 bg-[#0878F9] text-white rounded-xl font-bold text-xs hover:bg-[#0667DB] cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                    >
                                      <Layers className="w-4 h-4" />
                                      <span>Import All PO Lines</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          items.map((item, idx) => {
                            const lineSub = Number(item.invoiceQuantity || 0) * Number(item.unitPrice || 0);
                            const discount = Math.min(lineSub, Number(item.discount || 0));
                            const taxable = Math.max(0, lineSub - discount);
                            const taxAmount = (taxable * Number(item.taxRate || 0)) / 100;
                            const lineTotal = taxable + taxAmount;

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                {/* 1. Product / Identity / Part No / Brand */}
                                <td className="py-2 px-2.5 align-middle">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                                      {item.imageUrl ? (
                                        <img src={getMediaUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#0B2148] truncate text-xs leading-tight" title={item.name}>{item.name}</p>
                                      <div className="flex items-center gap-1 text-[10px] text-[#526B91] font-mono truncate mt-0.5">
                                        <span className="font-bold text-[#0878F9]">{item.partNumber || "—"}</span>
                                        {item.brand && <span>• {item.brand}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* 2. UIN */}
                                <td className="py-2 px-2 align-middle font-mono text-[10px] text-blue-700 font-bold truncate">
                                  {item.productUin ? (
                                    <span className="bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 block truncate" title={item.productUin}>
                                      {item.productUin}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Auto UIN</span>
                                  )}
                                </td>

                                {/* 3. Batch Number */}
                                <td className="py-2 px-2 align-middle">
                                  <input
                                    type="text"
                                    value={item.batchNumber || ""}
                                    onChange={(e) => handleItemFieldChange(idx, "batchNumber", e.target.value)}
                                    placeholder="Batch #"
                                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2 py-1 text-xs font-mono focus:bg-white focus:border-[#0878F9] focus:outline-none"
                                  />
                                </td>

                                {/* 4. Unit */}
                                <td className="py-2 px-1 align-middle text-center">
                                  <select
                                    value={item.unit}
                                    onChange={(e) => handleItemFieldChange(idx, "unit", e.target.value)}
                                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1 px-0.5 text-[11px] font-bold text-center focus:bg-white focus:border-[#0878F9] focus:outline-none"
                                  >
                                    {COMMON_UNITS.map((u) => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </td>

                                {/* 5. Quantity */}
                                <td className="py-2 px-1 align-middle text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.invoiceQuantity}
                                    onChange={(e) => handleItemFieldChange(idx, "invoiceQuantity", Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1 px-1 text-center font-mono font-bold text-xs focus:bg-white focus:border-[#0878F9] focus:outline-none"
                                  />
                                </td>

                                {/* 6. Unit Price */}
                                <td className="py-2 px-2 align-middle text-right">
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={(e) => handleItemFieldChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1 px-1.5 text-right font-mono font-bold text-xs focus:bg-white focus:border-[#0878F9] focus:outline-none"
                                  />
                                </td>

                                {/* 7. Discount */}
                                <td className="py-2 px-1.5 align-middle text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.discount}
                                    onChange={(e) => handleItemFieldChange(idx, "discount", Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1 px-1 text-right font-mono text-xs focus:bg-white focus:border-[#0878F9] focus:outline-none"
                                  />
                                </td>

                                {/* 8. Tax % */}
                                <td className="py-2 px-1 align-middle text-center">
                                  <select
                                    value={item.taxRate}
                                    onChange={(e) => handleItemFieldChange(idx, "taxRate", parseFloat(e.target.value) || 0)}
                                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1 px-0.5 text-center font-mono font-bold text-xs focus:bg-white focus:border-[#0878F9] focus:outline-none"
                                  >
                                    {TAX_RATES.map((r) => (
                                      <option key={r} value={r}>{r}%</option>
                                    ))}
                                  </select>
                                </td>

                                {/* 9. Line Total */}
                                <td className="py-2 px-2 align-middle text-right font-mono font-bold text-[#0B2148] text-xs whitespace-nowrap">
                                  {currencySymbol}{lineTotal.toFixed(2)}
                                </td>

                                {/* 10. Actions */}
                                <td className="py-2 px-1 align-middle text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors inline-flex items-center justify-center"
                                    title="Remove Item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Table View (< 1024px) */}
                  <div className="lg:hidden divide-y divide-[#EAF2FC] p-3 space-y-3">
                    {items.length === 0 ? (
                      <div className="py-8 text-center text-[#526B91]">
                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No items added yet</p>
                      </div>
                    ) : (
                      items.map((item, idx) => {
                        const lineSub = Number(item.invoiceQuantity || 0) * Number(item.unitPrice || 0);
                        const discount = Math.min(lineSub, Number(item.discount || 0));
                        const taxable = Math.max(0, lineSub - discount);
                        const taxAmount = (taxable * Number(item.taxRate || 0)) / 100;
                        const lineTotal = taxable + taxAmount;

                        return (
                          <div key={item.id} className="p-3 bg-white border border-[#D8E8FA] rounded-xl space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-xs text-[#0B2148]">{item.name}</p>
                                <p className="text-[10px] font-mono text-[#0878F9]">{item.partNumber || "No Part #"}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-[#526B91] font-bold block mb-1">Qty</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.invoiceQuantity}
                                  onChange={(e) => handleItemFieldChange(idx, "invoiceQuantity", Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg p-1.5 text-center font-mono font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-[#526B91] font-bold block mb-1">Unit</label>
                                <select
                                  value={item.unit}
                                  onChange={(e) => handleItemFieldChange(idx, "unit", e.target.value)}
                                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg p-1.5 text-xs font-bold"
                                >
                                  {COMMON_UNITS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-[#526B91] font-bold block mb-1">Unit Price ({currencySymbol})</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemFieldChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg p-1.5 text-right font-mono font-bold text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-[#526B91] font-bold block mb-1">Tax %</label>
                                <select
                                  value={item.taxRate}
                                  onChange={(e) => handleItemFieldChange(idx, "taxRate", parseFloat(e.target.value) || 0)}
                                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg p-1.5 text-center font-mono font-bold text-xs"
                                >
                                  {TAX_RATES.map((r) => (
                                    <option key={r} value={r}>{r}%</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                              <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {item.productUin || "Auto UIN"}
                              </span>
                              <span className="font-mono font-bold text-[#0B2148]">
                                Total: {currencySymbol}{lineTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
          </div>

          {/* Bottom Action & Quick Summary Bar (Full Width) */}
          <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#526B91]">
                <span>Items:</span>
                <span className="font-bold text-[#0B2148] font-mono">{items.length}</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[#526B91]">
                <span>Subtotal:</span>
                <span className="font-bold text-[#0B2148] font-mono">{currencySymbol}{calculations.subtotal.toFixed(2)}</span>
              </div>
              {calculations.totalDiscount > 0 && (
                <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-mono">-{currencySymbol}{calculations.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 font-semibold text-[#526B91]">
                <span>GST / Tax:</span>
                <span className="font-bold text-[#0B2148] font-mono">+{currencySymbol}{calculations.totalTax.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-[#526B91]">
                <span>Freight / Charges:</span>
                <div className="w-24">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2 py-1 text-right font-mono font-bold text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-[#0B2148] pl-2 border-l border-[#D8E8FA]">
                <span>Estimated Total:</span>
                <span className="font-black text-[#0878F9] text-sm font-mono">{currencySymbol}{calculations.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className="px-4 py-2.5 bg-white border border-[#D8E8FA] hover:bg-slate-50 text-[#526B91] font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Details</span>
              </button>

              <button
                type="button"
                disabled={createIOMutation.isPending || items.length === 0}
                onClick={() => createIOMutation.mutate(false)}
                className="px-4 py-2.5 bg-white border border-[#D8E8FA] text-[#0B2148] hover:bg-slate-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isEditMode ? "Update Draft" : "Save as Draft"}</span>
              </button>

              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setActiveTab("review")}
                className="px-5 py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>Proceed to Review & Summary ({items.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: REVIEW & INWARD VERIFICATION ─────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "review" && (
        <div className="space-y-6">
          {/* Executive Overview Header Card (Pure KYRA Home Theme) */}
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0878F9]">
                    {isDirect ? "⚡ Direct Invoice Order" : `PO Ref: ${selectedPODetails?.poNumber || "Linked PO"}`}
                  </span>
                  <span className="text-xs font-mono font-bold bg-[#F4F9FF] border border-[#D8E8FA] px-2.5 py-1 rounded-lg text-[#0B2148]">
                    Invoice #: {supplierInvoiceNumber || "—"}
                  </span>
                  <span className="text-xs font-semibold bg-[#F4F9FF] text-[#0878F9] px-2.5 py-1 rounded-lg border border-[#D8E8FA]">
                    {invoiceType.replace(/_/g, " ")}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#0B2148] tracking-tight">
                  {selectedVendor?.name || "Selected Vendor"}
                </h2>
                <p className="text-xs text-[#526B91]">
                  Invoice Date: <span className="font-semibold text-[#0B2148]">{invoiceDate}</span>
                  {invoiceMonth && <> • Billing Month: <span className="font-semibold text-[#0878F9]">{invoiceMonth}</span></>}
                  {" "}• Operating Currency: <span className="font-semibold text-[#0B2148]">{currency} ({currencySymbol})</span>
                </p>
              </div>

              <div className="text-right p-3.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Payable Grand Total</div>
                <div className="text-2xl font-black font-mono text-[#0878F9] mt-0.5">
                  {currencySymbol}{calculations.grandTotal.toFixed(2)}
                </div>
                <div className="text-[11px] text-[#526B91] font-semibold mt-0.5">
                  Terms: {paymentMode === "CREDIT" ? "Credit (Pay Later)" : paymentMode === "PAID" ? "Full Immediate Settlement" : "Partial Advance Payment"}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Financial & Operational KPI Cards (Pure KYRA Home Theme) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Items & Units */}
            <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#526B91]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#526B91]">Line Items</span>
                <Package className="w-4 h-4 text-[#0878F9]" />
              </div>
              <div className="text-2xl font-black text-[#0B2148] font-mono">
                {items.length}
              </div>
              <div className="text-[11px] text-[#526B91] font-semibold">
                {items.reduce((acc, it) => acc + (Number(it.invoiceQuantity) || 0), 0)} total units registered
              </div>
            </div>

            {/* KPI 2: Subtotal & Discount */}
            <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#526B91]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#526B91]">Taxable Base</span>
                <DollarSign className="w-4 h-4 text-[#0878F9]" />
              </div>
              <div className="text-2xl font-black text-[#0B2148] font-mono">
                {currencySymbol}{(calculations.subtotal - calculations.totalDiscount).toFixed(2)}
              </div>
              <div className="text-[11px] text-[#526B91]">
                Gross: {currencySymbol}{calculations.subtotal.toFixed(2)} | Disc: -{currencySymbol}{calculations.totalDiscount.toFixed(2)}
              </div>
            </div>

            {/* KPI 3: Taxes & Freight */}
            <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#526B91]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#526B91]">GST & Charges</span>
                <Tag className="w-4 h-4 text-[#0878F9]" />
              </div>
              <div className="text-2xl font-black text-[#0B2148] font-mono">
                +{currencySymbol}{(calculations.totalTax + calculations.addCharges).toFixed(2)}
              </div>
              <div className="text-[11px] text-[#526B91]">
                Tax: {currencySymbol}{calculations.totalTax.toFixed(2)} | Freight: {currencySymbol}{calculations.addCharges.toFixed(2)}
              </div>
            </div>

            {/* KPI 4: Net Payable */}
            <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#526B91]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#526B91]">Net Payable</span>
                <CheckCircle2 className="w-4 h-4 text-[#0878F9]" />
              </div>
              <div className="text-2xl font-black text-[#0878F9] font-mono">
                {currencySymbol}{calculations.grandTotal.toFixed(2)}
              </div>
              <div className="text-[11px] text-[#526B91]">
                {invoiceMonth || "Current Period"} Settlement
              </div>
            </div>
          </div>

          {/* Main 2-Column Review Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Itemized Line Inspection & Vendor Dossier */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Line Items Summary Table */}
              <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                    <Package className="w-4 h-4" />
                    <span>Itemized Line Products ({items.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("items")}
                    className="text-xs font-bold text-[#0878F9] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit Line Items</span>
                  </button>
                </div>

                <div className="border border-[#D8E8FA] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[#526B91] font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3">Product / Identity</th>
                          <th className="py-2.5 px-2">UIN / Part #</th>
                          <th className="py-2.5 px-2 text-center">Batch #</th>
                          <th className="py-2.5 px-2 text-center">Qty</th>
                          <th className="py-2.5 px-2 text-right">Price</th>
                          <th className="py-2.5 px-2 text-center">Tax %</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAF2FC]">
                        {items.map((item, idx) => {
                          const lineSub = Number(item.invoiceQuantity || 0) * Number(item.unitPrice || 0);
                          const discount = Math.min(lineSub, Number(item.discount || 0));
                          const taxable = Math.max(0, lineSub - discount);
                          const taxAmount = (taxable * Number(item.taxRate || 0)) / 100;
                          const lineTotal = taxable + taxAmount;

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-[#0B2148]">{item.name}</div>
                                <div className="text-[10px] text-[#526B91]">{item.brand || "Standard"} • {item.category || "General"}</div>
                              </td>
                              <td className="py-2.5 px-2 font-mono text-[10px]">
                                {item.productUin && (
                                  <div className="text-[#0878F9] font-bold bg-[#F4F9FF] border border-[#D8E8FA] px-1.5 py-0.5 rounded inline-block">
                                    {item.productUin}
                                  </div>
                                )}
                                <div className="text-[#526B91]">{item.partNumber || "—"}</div>
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-[11px] text-[#0B2148]">
                                {item.batchNumber || "—"}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-[#0B2148]">
                                {item.invoiceQuantity} <span className="text-[10px] text-[#526B91] font-normal">{item.unit}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-semibold text-[#0B2148]">
                                {currencySymbol}{Number(item.unitPrice || 0).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-[11px] text-[#0B2148]">
                                {item.taxRate || 0}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0878F9]">
                                {currencySymbol}{lineTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Card 2: Commercial Vendor & Order Profile */}
              <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>Vendor & Commercial Identity</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className="text-xs font-bold text-[#0878F9] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit Details</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl space-y-1.5">
                    <div className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Supplier Legal Entity</div>
                    <div className="font-bold text-[#0B2148] text-sm">{selectedVendor?.name || "Not Specified"}</div>
                    {selectedVendor?.gstin && (
                      <div className="text-xs font-mono font-bold text-[#0878F9]">GSTIN: {selectedVendor.gstin}</div>
                    )}
                    <div className="text-[11px] text-[#526B91]">
                      {selectedVendor?.address || "Address on File"}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl space-y-2">
                    <div className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Commercial Parameters</div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Invoice Number:</span>
                      <span className="font-mono font-bold text-[#0B2148]">{supplierInvoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Invoice Date:</span>
                      <span className="font-semibold text-[#0B2148]">{invoiceDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Billing Month:</span>
                      <span className="font-semibold text-[#0878F9]">{invoiceMonth || "Current"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Order Origin:</span>
                      <span className="font-semibold text-[#0878F9]">
                        {isDirect ? "Direct Inward (No PO)" : `PO #${selectedPODetails?.poNumber || ""}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Payment Settlement, Documents & Inward Submission */}
            <div className="space-y-6">
              {/* Payment Terms Review Card */}
              <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                  <Tag className="w-4 h-4" />
                  <span>Settlement & Payment Terms</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[#526B91] font-semibold">Payment Mode:</span>
                      <span className="font-bold text-[#0878F9] bg-white px-2 py-0.5 rounded border border-[#D8E8FA]">
                        {paymentMode === "CREDIT" ? "Credit (Pay Later)" : paymentMode === "PAID" ? "Full Immediate Settlement" : "Partial Advance Payment"}
                      </span>
                    </div>

                    {paymentMode !== "CREDIT" && (
                      <>
                        <div className="flex justify-between pt-1 border-t border-[#D8E8FA]">
                          <span className="text-[#526B91]">Initial Paid Amount:</span>
                          <span className="font-mono font-bold text-[#0B2148]">
                            {currencySymbol}{Number(initialPaymentAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#526B91]">Payment Method:</span>
                          <span className="font-semibold text-[#0B2148]">{paymentMethod.replace(/_/g, " ")}</span>
                        </div>
                        {paymentReference && (
                          <div className="flex justify-between">
                            <span className="text-[#526B91]">Transaction Ref / UTR:</span>
                            <span className="font-mono font-bold text-[#0B2148]">{paymentReference}</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-between pt-1.5 border-t border-[#D8E8FA] font-bold">
                      <span className="text-[#0B2148]">Outstanding Payable:</span>
                      <span className="font-mono text-[#0878F9]">
                        {currencySymbol}{Math.max(0, calculations.grandTotal - (paymentMode !== "CREDIT" ? initialPaymentAmount : 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supporting Attachments & Remarks */}
              <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4" />
                  <span>Attachments & Gate Notes</span>
                </h3>

                <div className="text-xs space-y-2.5">
                  <div className="text-[#526B91] font-semibold">
                    Attached Files: <span className="text-[#0B2148] font-bold">{documents.length}</span>
                  </div>
                  {documents.length > 0 ? (
                    <div className="space-y-1">
                      {documents.map((doc, idx) => (
                        <div key={idx} className="p-2 bg-[#F8FAFC] border border-[#D8E8FA] rounded-lg flex items-center gap-2 text-[11px] truncate">
                          <FileText className="w-3.5 h-3.5 text-[#0878F9] shrink-0" />
                          <span className="truncate font-semibold text-[#0B2148]">{doc.fileName}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">No attachments uploaded</div>
                  )}

                  <div className="pt-2 border-t border-[#EAF2FC]">
                    <div className="text-[10px] font-bold text-[#526B91] uppercase mb-1">Gate / Inward Notes</div>
                    <div className="p-2.5 bg-[#F8FAFC] border border-[#D8E8FA] rounded-lg text-[11px] text-[#0B2148]">
                      {remarks || "No gate notes provided"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Verification Action Box (Pure KYRA Home Theme) */}
              <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-[#F4F9FF] space-y-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="font-bold text-xs text-[#0B2148] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0878F9]" />
                    <span>Inward Verification Handover</span>
                  </div>
                  <p className="text-[11px] text-[#526B91] leading-relaxed">
                    Submitting this Invoice Order will dispatch it directly to the Inventory Manager for blind physical receiving, QC inspection, and stock inward posting.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={createIOMutation.isPending || items.length === 0}
                    onClick={() => createIOMutation.mutate(true)}
                    className="w-full py-3 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {createIOMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{isEditMode ? "Update & Submit for Inward Verification" : "Submit for Inward Verification"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={createIOMutation.isPending || items.length === 0}
                    onClick={() => createIOMutation.mutate(false)}
                    className="w-full py-2.5 bg-white border border-[#D8E8FA] text-[#0B2148] hover:bg-slate-50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isEditMode ? "Update Draft" : "Save as Draft"}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("items")}
                      className="py-2 bg-white border border-[#D8E8FA] hover:bg-slate-50 text-[#526B91] font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Edit Items</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("details")}
                      className="py-2 bg-white border border-[#D8E8FA] hover:bg-slate-50 text-[#526B91] font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: SELECT INDIVIDUAL PO LINES ─────────────────────── */}
      <AnimatePresence>
        {isPOImportModalOpen && selectedPODetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#0878F9]" />
                  <h3 className="font-bold text-sm text-[#0B2148]">
                    Select Lines from PO #{selectedPODetails.poNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPOImportModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 flex-1">
                <p className="text-xs text-[#526B91]">
                  Check the items from this purchase order that you want to include in this supplier invoice:
                </p>

                <div className="divide-y divide-[#EAF2FC] border border-[#D8E8FA] rounded-xl overflow-hidden">
                  {(selectedPODetails.items || []).map((line: any) => {
                    const remaining = Math.max(1, (line.quantityOrdered || 0) - (line.quantityReceived || 0));
                    const isChecked = selectedPOItemIds.includes(line.id);

                    return (
                      <div
                        key={line.id}
                        onClick={() => {
                          setSelectedPOItemIds((prev) =>
                            prev.includes(line.id) ? prev.filter((id) => id !== line.id) : [...prev, line.id]
                          );
                        }}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isChecked ? "bg-blue-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-[#0878F9] focus:ring-[#0878F9]"
                          />
                          <div>
                            <p className="text-xs font-bold text-[#0B2148]">
                              {line.product?.name || line.material?.name || line.description}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[#526B91] mt-0.5">
                              <span className="font-bold text-[#0878F9]">{line.partNumber || line.product?.partNumber || "—"}</span>
                              <span>•</span>
                              <span>Ordered: {line.quantityOrdered}</span>
                              <span>•</span>
                              <span className="text-emerald-700 font-bold">Pending: {remaining} {line.unit || "PCS"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono text-xs">
                          <span className="font-bold text-slate-800">
                            {currencySymbol}{Number(line.unitPrice || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-[#D8E8FA] bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPOItemIds.length === selectedPODetails.items?.length) {
                      setSelectedPOItemIds([]);
                    } else {
                      setSelectedPOItemIds((selectedPODetails.items || []).map((l: any) => l.id));
                    }
                  }}
                  className="text-xs text-[#0878F9] font-bold hover:underline cursor-pointer"
                >
                  {selectedPOItemIds.length === selectedPODetails.items?.length ? "Deselect All" : "Select All"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPOImportModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSelectedPOLines}
                    disabled={selectedPOItemIds.length === 0}
                    className="px-4 py-1.5 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    Import Selected ({selectedPOItemIds.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: REGISTER NEW PRODUCT MASTER (EXACT FLOW FROM PO CREATE) ── */}
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
                    vendorId: selectedVendor?.id || undefined,
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
                          handleReuseInInvoice(duplicateMatchInfo.matchedProduct);
                        }}
                        className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Reuse Existing "{duplicateMatchInfo.matchedProduct.name}" in Invoice</span>
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

                  {/* Initial Invoice Quantity & Unit Price */}
                  <div className="p-3 bg-blue-50/50 border border-blue-200/60 rounded-xl grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-900 block">
                        Initial Invoice Quantity
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
                        Invoice Unit Price ({currency})
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
                    <span>Save & Add to Invoice</span>
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

      {/* ── MODAL: EDIT PRODUCT MASTER (WITH IMAGE UPLOAD & PREVIEW) ── */}
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

      {/* Global Product Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(deleteProductTarget)}
        title="Permanently Delete Product Master?"
        recordType="Product Master Catalog"
        recordIdentity={deleteProductTarget ? `${deleteProductTarget.name} (${deleteProductTarget.partNumber} • ${deleteProductTarget.brand})` : ""}
        description={`Are you sure you want to permanently delete product "${deleteProductTarget?.name}"? It will be permanently removed from the procurement catalog.`}
        warningText={`Permanent Deletion • Irreversible: Deleting this product master will permanently purge UIN ${deleteProductTarget?.uin} and its synchronized factory material. It will NO LONGER appear in this catalog or in invoice orders.`}
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
