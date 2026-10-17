"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl, downloadAuthenticatedFile } from "@/lib/api";
import { 
  FileText, 
  Search, 
  Plus, 
  X, 
  Loader2, 
  Calendar, 
  User, 
  ArrowUpRight,
  Clock,
  Trash,
  FileDown,
  Eye,
  Copy,
  Sparkles,
  Check,
  Building2,
  Mail,
  Phone,
  ShieldAlert,
  HelpCircle,
  Percent,
  DollarSign,
  Package,
  Layers,
  ChevronDown,
  Calculator,
  Share2,
  Send,
  CheckCircle2,
  MapPin,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Pencil,
  Filter,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle,
  Cpu,
  Battery,
  Factory
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const PAYMENT_TERMS_PRESETS = [
  "50% Advance",
  "Full Payment"
];

const TAX_RATE_OPTIONS = [
  { label: "0% GST (Exempt)", value: 0 },
  { label: "5% GST", value: 5 },
  { label: "12% GST", value: 12 },
  { label: "18% GST (Standard)", value: 18 },
  { label: "28% GST", value: 28 }
];

export default function QuotationsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Search, Filter & Pagination State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Approval & Share & View Modal State
  const [selectedQuoteForApproval, setSelectedQuoteForApproval] = useState<any>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");

  const [selectedQuoteForShare, setSelectedQuoteForShare] = useState<any>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [selectedQuoteForView, setSelectedQuoteForView] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Sales Executive Edit Proposal State
  const [selectedQuoteForEdit, setSelectedQuoteForEdit] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [editApprovalComments, setEditApprovalComments] = useState("");

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [freightCharges, setFreightCharges] = useState<number>(0);
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);

  const [paymentTermsType, setPaymentTermsType] = useState("50% Advance");
  const [customPaymentTerms, setCustomPaymentTerms] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("Delivery within 14 business days after payment confirmation.");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [assignedSalesUserId, setAssignedSalesUserId] = useState("");

  const [items, setItems] = useState<any[]>([
    { productRef: "", materialId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "", notes: "" }
  ]);

  // Form Validation Errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- DATA FETCHING ---
  const { data: dashboardData } = useQuery({
    queryKey: ["quotations-dashboard"],
    queryFn: async () => (await api.get("/crm/quotations/dashboard")).data
  });

  const { data: listData, isLoading, isRefetching } = useQuery({
    queryKey: ["quotations-list", search, status, page, limit],
    queryFn: async () => {
      const res = await api.get("/crm/quotations", {
        params: { search, status, page, limit }
      });
      return res.data;
    }
  });

  const { data: fullViewQuotation, isLoading: isViewLoading } = useQuery({
    queryKey: ["quotation-view-modal", selectedQuoteForView?.id],
    queryFn: async () => {
      if (!selectedQuoteForView?.id) return null;
      const res = await api.get(`/crm/quotations/${selectedQuoteForView.id}`);
      return res.data;
    },
    enabled: !!selectedQuoteForView?.id && isViewModalOpen
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["crm-customers-dropdown"],
    queryFn: async () => (await api.get("/crm/customers", { params: { limit: 200 } })).data?.customers || []
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads-dropdown"],
    queryFn: async () => (await api.get("/crm/leads", { params: { limit: 100 } })).data?.leads || []
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["crm-materials-dropdown"],
    queryFn: async () => (await api.get("/inventory/materials", { params: { limit: 200 } })).data?.materials || []
  });

  const { data: paxTypes = [] } = useQuery({
    queryKey: ["crm-pax-types-dropdown"],
    queryFn: async () => (await api.get("/admin/pax-types")).data || []
  });

  const { data: users = [] } = useQuery({
    queryKey: ["crm-system-users"],
    queryFn: async () => (await api.get("/crm/users")).data || []
  });

  // Filter only users with SALES_EXECUTIVE role as Assignee Sales Agents
  const salesAgents = useMemo(() => {
    const list = users.filter((u: any) => 
      u.roles?.includes("SALES_EXECUTIVE") || u.role === "SALES_EXECUTIVE"
    );
    // If no explicit SALES_EXECUTIVE is found, fallback to users with MARKETING_MANAGER or all users to prevent blank dropdown
    return list.length > 0 ? list : users;
  }, [users]);

  // Helper to create a line item from a company production model
  const createItemFromPax = (pax: any, qty: number = 1) => {
    const estUnitPrice = Number(pax.unitPrice) > 0 ? Number(pax.unitPrice) : (pax.cellCount ? pax.cellCount * 2200 : 35000);
    return {
      productRef: pax.name,
      materialId: null,
      description: `${pax.name} Battery Pack (${pax.cellCount}S)`,
      quantity: qty,
      unitPrice: estUnitPrice,
      discount: 0,
      taxRate: 18,
      specification: `${pax.cellCount}S (~${(pax.cellCount * 3.2).toFixed(1)}V Nominal) • ${pax.ahMin}-${pax.ahMax} Ah Capacity • IR ${pax.irMin}-${pax.irMax} mΩ • Grade ${pax.allowedGrades?.join("/") || "A"}`,
      notes: "Standard factory production model with BMS, wiring harness, and warranty."
    };
  };

  // Filtered Customers for Searchable Dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 8);
    const q = customerSearchQuery.toLowerCase().trim();
    return customers.filter((c: any) => 
      c.customerCode?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  }, [customers, customerSearchQuery]);

  const selectedCustomerObj = useMemo(() => {
    return customers.find((c: any) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // --- PRICING CALCULATION HELPERS ---
  const calculateLineItem = (item: any) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const discPct = Math.min(100, Math.max(0, Number(item.discount) || 0));
    const taxRate = Math.max(0, Number(item.taxRate) || 0);

    const lineSubtotal = qty * price;
    const discountAmount = lineSubtotal * (discPct / 100);
    const taxableAmount = Math.max(0, lineSubtotal - discountAmount);
    const taxAmount = taxableAmount * (taxRate / 100);
    const lineTotal = taxableAmount + taxAmount;

    return {
      lineSubtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      lineTotal
    };
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let taxTotal = 0;

    items.forEach(item => {
      const calc = calculateLineItem(item);
      subtotal += calc.lineSubtotal;
      discountTotal += calc.discountAmount;
      taxableTotal += calc.taxableAmount;
      taxTotal += calc.taxAmount;
    });

    const freight = Math.max(0, Number(freightCharges) || 0);
    const additional = Math.max(0, Number(additionalCharges) || 0);
    const grandTotal = taxableTotal + taxTotal + freight + additional;

    return {
      subtotal,
      discount: discountTotal,
      taxable: taxableTotal,
      tax: taxTotal,
      freight,
      additional,
      grandTotal
    };
  };

  const totals = calculateTotals();

  const formatINR = (val: number) => {
    return "₹ " + Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // --- MUTATIONS ---
  const createQuotationMutation = useMutation({
    mutationFn: async (payload: any) => {
      let finalCustomerId = payload.customerId;
      if (payload.leadId && !finalCustomerId) {
        // Auto convert lead to customer first
        const selectedLead = leads.find((l: any) => l.id === payload.leadId);
        if (selectedLead) {
          if (selectedLead.convertedCustomerId) {
            finalCustomerId = selectedLead.convertedCustomerId;
          } else {
            const convertRes = await api.post(`/crm/leads/${payload.leadId}/convert`, { bypassDuplicateCheck: true });
            finalCustomerId = convertRes.data.customer.id;
          }
        }
      }
      const res = await api.post("/crm/quotations", { ...payload, customerId: finalCustomerId });
      return res;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-dashboard"] });
      toast.success(`Quotation ${res.data?.quotationNumber || ""} generated and waiting for approval.`);
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create quotation");
    }
  });

  const approveQuotationMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) => 
      api.put(`/crm/quotations/${id}/approve`, { comments: comments || "Approved by Sales Executive" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["quotation-view-modal"] });
      toast.success("Quotation approved successfully.");
      setIsApproveModalOpen(false);
      setSelectedQuoteForApproval(null);
      setApprovalComments("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to approve quotation");
    }
  });

  const updateQuotationMutation = useMutation({
    mutationFn: async ({ id, payload, andApprove, comments }: { id: string; payload: any; andApprove?: boolean; comments?: string }) => {
      const res = await api.put(`/crm/quotations/${id}`, payload);
      if (andApprove) {
        await api.put(`/crm/quotations/${id}/approve`, { comments: comments || "Approved after review & adjustments" });
      }
      return res.data;
    },
    onSuccess: (data: any, vars: any) => {
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["quotation-view-modal"] });
      if (vars.andApprove) {
        toast.success(`Quotation ${data.quotationNumber || ""} updated and APPROVED successfully!`);
      } else {
        toast.success(`Quotation ${data.quotationNumber || ""} changes saved successfully.`);
      }
      setIsEditModalOpen(false);
      setSelectedQuoteForEdit(null);
      setEditFormData(null);
      setEditApprovalComments("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update quotation");
    }
  });

  const handleOpenEdit = async (quote: any) => {
    setIsEditLoading(true);
    try {
      const res = await api.get(`/crm/quotations/${quote.id}`);
      const fullQuote = res.data;
      setSelectedQuoteForEdit(fullQuote);
      setEditFormData({
        id: fullQuote.id,
        quotationNumber: fullQuote.quotationNumber,
        customerId: fullQuote.customerId,
        customerName: fullQuote.customerNameSnapshot,
        customerCode: fullQuote.customer?.customerCode || "",
        assignedSalesUserId: fullQuote.assignedSalesUserId || "",
        validUntil: fullQuote.validUntil ? fullQuote.validUntil.split("T")[0] : "",
        currency: fullQuote.currency || "INR",
        paymentTerms: fullQuote.paymentTerms || "Full Advance",
        deliveryTerms: fullQuote.deliveryTerms || "Standard Delivery",
        additionalCharges: Number(fullQuote.additionalCharges || 0),
        freightCharges: Number(fullQuote.freight || 0),
        notes: fullQuote.notes || "",
        internalNotes: fullQuote.internalNotes || "",
        customerNotes: fullQuote.customerNotes || "",
        items: (fullQuote.items || []).map((it: any) => ({
          materialId: it.materialId || "",
          productRef: it.productRef || it.material?.sku || "",
          description: it.description || it.material?.name || "",
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          taxRate: Number(it.taxRate) || 18,
          specification: it.specification || "",
          notes: it.notes || ""
        }))
      });
      setIsEditModalOpen(true);
    } catch (err) {
      toast.error("Failed to load quotation details for editing");
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleEditItemChange = (index: number, field: string, value: any) => {
    if (!editFormData) return;
    const updatedItems = [...editFormData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === "materialId") {
      const targetPax = paxTypes.find((p: any) => p.id === value);
      if (targetPax) {
        updatedItems[index].productRef = targetPax.name;
        updatedItems[index].description = `${targetPax.name} Battery Pack (${targetPax.cellCount}S)`;
        updatedItems[index].specification = `${targetPax.cellCount}S (~${(targetPax.cellCount * 3.2).toFixed(1)}V) • ${targetPax.ahMin}-${targetPax.ahMax} Ah • IR ${targetPax.irMin}-${targetPax.irMax} mΩ • Grade ${targetPax.allowedGrades?.join("/") || "A"}`;
        if (!updatedItems[index].unitPrice || updatedItems[index].unitPrice === 0) {
          updatedItems[index].unitPrice = targetPax.cellCount ? targetPax.cellCount * 2200 : 35000;
        }
      } else {
        const mat = materials.find((m: any) => m.id === value);
        if (mat) {
          updatedItems[index].description = mat.name;
          updatedItems[index].productRef = mat.sku || mat.name;
          if (mat.unitPrice && (!updatedItems[index].unitPrice || updatedItems[index].unitPrice === 0)) {
            updatedItems[index].unitPrice = Number(mat.unitPrice);
          }
        }
      }
    }
    setEditFormData({ ...editFormData, items: updatedItems });
  };

  const handleEditAddItem = () => {
    if (!editFormData) return;
    const activePax = paxTypes.find((p: any) => p.isProductionActive) || paxTypes[0];
    const newItem = activePax 
      ? createItemFromPax(activePax, 1)
      : { materialId: "", productRef: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "", notes: "" };
    setEditFormData({
      ...editFormData,
      items: [
        ...editFormData.items,
        newItem
      ]
    });
  };

  const handleEditRemoveItem = (index: number) => {
    if (!editFormData || editFormData.items.length <= 1) {
      toast.error("Quotation must contain at least 1 line item");
      return;
    }
    const updatedItems = editFormData.items.filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, items: updatedItems });
  };

  const calculateEditTotals = () => {
    if (!editFormData?.items) return { subtotal: 0, discount: 0, taxable: 0, tax: 0, freight: 0, additional: 0, grandTotal: 0 };
    let subtotal = 0;
    let discountTotal = 0;
    let taxableTotal = 0;
    let taxTotal = 0;

    editFormData.items.forEach((item: any) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      const discPct = Math.min(100, Math.max(0, Number(item.discount) || 0));
      const taxRate = Math.max(0, Number(item.taxRate) || 0);

      const lineSubtotal = qty * price;
      const discountAmount = lineSubtotal * (discPct / 100);
      const taxableAmount = Math.max(0, lineSubtotal - discountAmount);
      const taxAmount = taxableAmount * (taxRate / 100);

      subtotal += lineSubtotal;
      discountTotal += discountAmount;
      taxableTotal += taxableAmount;
      taxTotal += taxAmount;
    });

    const additional = Math.max(0, Number(editFormData.additionalCharges) || 0);
    const freight = Math.max(0, Number(editFormData.freightCharges) || 0);
    const grandTotal = taxableTotal + taxTotal + freight + additional;

    return {
      subtotal,
      discount: discountTotal,
      taxable: taxableTotal,
      tax: taxTotal,
      freight,
      additional,
      grandTotal
    };
  };

  const handleSaveEdit = (andApprove: boolean = false) => {
    if (!editFormData) return;
    if (!editFormData.validUntil) {
      toast.error("Validity date is required");
      return;
    }
    if (editFormData.items.some((it: any) => !it.materialId && !it.description)) {
      toast.error("All line items must have a product material or description");
      return;
    }

    const payload = {
      assignedSalesUserId: editFormData.assignedSalesUserId || undefined,
      validUntil: editFormData.validUntil,
      currency: editFormData.currency,
      paymentTerms: editFormData.paymentTerms,
      deliveryTerms: editFormData.deliveryTerms,
      additionalCharges: Number(editFormData.additionalCharges || 0),
      freight: Number(editFormData.freightCharges || 0),
      notes: editFormData.notes?.trim() || null,
      internalNotes: editFormData.internalNotes?.trim() || null,
      customerNotes: editFormData.customerNotes?.trim() || null,
      items: editFormData.items.map((item: any) => ({
        materialId: item.materialId || null,
        productRef: item.productRef || null,
        description: item.description?.trim() || "Item",
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        discount: Math.min(100, Math.max(0, Number(item.discount) || 0)),
        taxRate: Math.max(0, Number(item.taxRate) || 0),
        specification: item.specification?.trim() || null,
        notes: item.notes?.trim() || null
      }))
    };

    updateQuotationMutation.mutate({
      id: editFormData.id,
      payload,
      andApprove,
      comments: editApprovalComments || "Approved with review changes"
    });
  };

  // --- SHARE ACTION HELPERS ---
  const handleDownloadPdf = async (quoteId: string, quoteNumber: string) => {
    try {
      toast.info(`Preparing PDF for ${quoteNumber}...`);
      await downloadAuthenticatedFile(`/crm/quotations/${quoteId}/pdf`, `quotation-${quoteNumber}.pdf`);
      toast.success(`Downloaded PDF for ${quoteNumber}`);
    } catch {
      toast.error(`Failed to download PDF for ${quoteNumber}`);
    }
  };

  const handleCopyLink = (quoteId: string, quoteNumber: string) => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/${roleSlug}/sales/quotations/${quoteId}` : "";
    navigator.clipboard.writeText(url);
    toast.success(`Direct link for ${quoteNumber} copied to clipboard!`);
  };

  const handleShareWhatsApp = (quote: any) => {
    const phone = quote.customerPhoneSnapshot?.replace(/\D/g, "") || "";
    const message = `Hello ${quote.customerNameSnapshot},\n\nPlease find your Commercial Quotation ${quote.quotationNumber} from KYRA ZAM for ${formatINR(Number(quote.grandTotal))}.\nValidity: ${new Date(quote.validUntil).toLocaleDateString('en-IN')}.\nPayment Terms: ${quote.paymentTerms}.\n\nThank you,\nKYRA ZAM Sales Team`;
    const encoded = encodeURIComponent(message);
    const waUrl = phone ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  const handleShareEmail = (quote: any) => {
    const email = quote.customerEmailSnapshot || "";
    const subject = encodeURIComponent(`Commercial Quotation ${quote.quotationNumber} - KYRA ZAM`);
    const body = encodeURIComponent(
      `Dear ${quote.customerNameSnapshot},\n\nWe are pleased to share our official Commercial Quotation (${quote.quotationNumber}) for your requirement.\n\nProposal Details:\n- Quotation Number: ${quote.quotationNumber}\n- Total Amount: ${formatINR(Number(quote.grandTotal))}\n- Valid Until: ${new Date(quote.validUntil).toLocaleDateString('en-IN')}\n- Payment Terms: ${quote.paymentTerms}\n- Delivery Terms: ${quote.deliveryTerms}\n\nPlease let us know if you require any clarifications or wish to proceed.\n\nWarm regards,\nKYRA ZAM Commercial Team`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const renderStatusBadge = (status: string, validUntil?: string) => {
    const isExp = validUntil && new Date(validUntil).getTime() < Date.now() && !["ACCEPTED", "CANCELLED"].includes(status);
    if (isExp) {
      return (
        <StatusBadge status="EXPIRED" customLabel="Expired" variant="danger" size="sm" />
      );
    }
    return <StatusBadge status={status} size="sm" />;
  };

  const resetForm = () => {
    setSelectedCustomerId("");
    setCustomerSearchQuery("");
    setIsCustomerSearchOpen(false);
    setSelectedLeadId("");
    setValidUntil("");
    setFreightCharges(0);
    setAdditionalCharges(0);
    setPaymentTermsType("50% Advance");
    setCustomPaymentTerms("");
    setDeliveryNotes("Delivery within 14 business days after payment confirmation.");
    setNotes("");
    setInternalNotes("");
    setCustomerNotes("");
    setAssignedSalesUserId("");
    setValidationErrors({});
    const activePax = paxTypes.find((p: any) => p.isProductionActive) || paxTypes[0];
    if (activePax) {
      setItems([createItemFromPax(activePax, 1)]);
    } else {
      setItems([
        { productRef: "", materialId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "", notes: "" }
      ]);
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    let firstFieldId = "";

    if (!selectedCustomerId) {
      errs.customer = "Please select a customer profile.";
      if (!firstFieldId) firstFieldId = "customer-search-input";
    }

    if (!validUntil) {
      errs.validUntil = "Validity expiry date is required.";
      if (!firstFieldId) firstFieldId = "valid-until-input";
    } else {
      const selectedDate = new Date(validUntil);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        errs.validUntil = "Validity expiry date cannot be in the past.";
        if (!firstFieldId) firstFieldId = "valid-until-input";
      }
    }

    if (!deliveryNotes.trim()) {
      errs.deliveryNotes = "Delivery notes are required.";
      if (!firstFieldId) firstFieldId = "delivery-notes";
    }

    if (items.length === 0) {
      errs.items = "At least one line item is required.";
    } else {
      items.forEach((item, idx) => {
        if (!item.description?.trim()) {
          errs[`item_${idx}_description`] = "Description is required.";
          if (!firstFieldId) firstFieldId = `item-${idx}-description`;
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
          errs[`item_${idx}_quantity`] = "Quantity must be greater than 0.";
          if (!firstFieldId) firstFieldId = `item-${idx}-quantity`;
        }
        if (item.unitPrice === undefined || Number(item.unitPrice) < 0) {
          errs[`item_${idx}_unitPrice`] = "Unit price must be non-negative.";
          if (!firstFieldId) firstFieldId = `item-${idx}-unitPrice`;
        }
      });
    }

    setValidationErrors(errs);

    if (firstFieldId) {
      const el = document.getElementById(firstFieldId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please resolve the highlighted validation errors before submitting.");
      return;
    }

    const finalPaymentTerms = paymentTermsType;

    createQuotationMutation.mutate({
      customerId: selectedCustomerId,
      leadId: null,
      validUntil,
      freight: 0,
      additionalCharges: 0,
      paymentTerms: finalPaymentTerms,
      deliveryTerms: deliveryNotes.trim(),
      notes: notes.trim() || null,
      internalNotes: internalNotes.trim() || null,
      customerNotes: customerNotes.trim() || null,
      assignedSalesUserId: assignedSalesUserId || null,
      items: items.map(item => ({
        productRef: item.productRef?.trim() || null,
        materialId: item.materialId || null,
        description: item.description.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        discount: Math.min(100, Math.max(0, Number(item.discount) || 0)),
        taxRate: Math.max(0, Number(item.taxRate) || 0),
        specification: item.specification?.trim() || null,
        notes: item.notes?.trim() || null
      }))
    });
  };

  const quotes = listData?.quotations || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const stats = dashboardData?.stats || {};

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPage(1);
    toast.success("Filters reset successfully");
  };

  const getAvatarInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      if (start === 1) {
        end = maxVisiblePages;
      } else if (end === totalPages) {
        start = totalPages - maxVisiblePages + 1;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const startRange = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="Quotations"
        description="Commercial proposal management, pricing validation, customer linkage, and quotation generation."
        icon={<FileText className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            {totalCount} total
          </span>
        }
        actions={
          <button 
            id="generate-quotation-btn"
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Generate Quotation
          </button>
        }
      />

      {/* 2. KPI Summary Cards with Interactive Filter Triggers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Total Quotations */}
        <div 
          onClick={() => { setStatus(""); setPage(1); }}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30 ${
            status === "" 
              ? "bg-[#EAF5FF] border-[#0878F9] ring-2 ring-[#0878F9]/20 shadow-xs" 
              : "bg-white border-[#D8E8FA] shadow-xs hover:border-blue-300 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${status === "" ? "text-[#0878F9]" : "text-[#526B91]"}`}>
              All Proposals
            </span>
            <span className={`p-2 rounded-xl group-hover:scale-105 transition-transform ${status === "" ? "bg-[#0878F9] text-white" : "bg-[#EAF5FF] text-[#0878F9]"}`}>
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-display font-bold text-[#0B2148]">{stats.total || 0}</span>
            <p className="text-[11px] text-[#526B91] mt-0.5">Total registered files</p>
          </div>
        </div>

        {/* KPI 2: Pending Approval */}
        <div 
          onClick={() => { setStatus("PENDING_APPROVAL"); setPage(1); }}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 ${
            status === "PENDING_APPROVAL" 
              ? "bg-[#FFFBEB] border-amber-400 ring-2 ring-amber-500/20 shadow-xs" 
              : "bg-white border-[#D8E8FA] shadow-xs hover:border-amber-300 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${status === "PENDING_APPROVAL" ? "text-amber-800" : "text-[#526B91]"}`}>
                Waiting Approval
              </span>
              {Number(stats.pending || 0) > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <span className={`p-2 rounded-xl group-hover:scale-105 transition-transform ${status === "PENDING_APPROVAL" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600"}`}>
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-display font-bold text-amber-600">{stats.pending || 0}</span>
            <p className="text-[11px] text-[#526B91] mt-0.5">Awaiting Sales Exec review</p>
          </div>
        </div>

        {/* KPI 3: Accepted */}
        <div 
          onClick={() => { setStatus("ACCEPTED"); setPage(1); }}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
            status === "ACCEPTED" 
              ? "bg-[#F0FDF4] border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs" 
              : "bg-white border-[#D8E8FA] shadow-xs hover:border-emerald-300 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${status === "ACCEPTED" ? "text-emerald-800" : "text-[#526B91]"}`}>
              Won Proposals
            </span>
            <span className={`p-2 rounded-xl group-hover:scale-105 transition-transform ${status === "ACCEPTED" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600"}`}>
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-display font-bold text-emerald-600">{stats.accepted || 0}</span>
            <p className="text-[11px] text-[#526B91] mt-0.5">Accepted by customer</p>
          </div>
        </div>

        {/* KPI 4: Accepted Pipeline Value */}
        <div 
          onClick={() => { setStatus("APPROVED"); setPage(1); }}
          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/30 ${
            status === "APPROVED" 
              ? "bg-[#FAF5FF] border-purple-400 ring-2 ring-purple-500/20 shadow-xs" 
              : "bg-white border-[#D8E8FA] shadow-xs hover:border-purple-300 hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${status === "APPROVED" ? "text-purple-800" : "text-[#526B91]"}`}>
              Pipeline Value
            </span>
            <span className={`p-2 rounded-xl group-hover:scale-105 transition-transform ${status === "APPROVED" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-600"}`}>
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-display font-bold text-[#0B2148] font-mono">
              ₹ {parseFloat((stats.totalAcceptedValue || 0).toString()).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <p className="text-[11px] text-[#526B91] mt-0.5">Cumulative accepted value</p>
          </div>
        </div>
      </div>

      {/* 3. Search + Tab Filter Toolbar */}
      <div className="space-y-3">
        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { label: "All Proposals", value: "", count: stats.total || 0 },
            { label: "Waiting for Approval", value: "PENDING_APPROVAL", count: stats.pending || 0 },
            { label: "Approved", value: "APPROVED", count: stats.approved || 0 },
            { label: "Sent", value: "SENT", count: stats.sent || 0 },
            { label: "Accepted", value: "ACCEPTED", count: stats.accepted || 0 },
            { label: "Rejected", value: "REJECTED", count: stats.rejected || 0 },
            { label: "Draft", value: "DRAFT", count: stats.draft || 0 },
          ].map((tab) => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => { setStatus(tab.value); setPage(1); }}
                className={`px-3 py-2 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30 ${
                  isActive
                    ? "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9]/40 shadow-xs"
                    : "bg-white text-[#526B91] border-[#D8E8FA] hover:bg-[#F4F9FF] hover:text-[#0B2148] hover:border-[#B3D7FF]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-[#0878F9] text-white" : "bg-slate-100 text-[#526B91]"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-[#D8E8FA] shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                type="text" 
                placeholder="Search by quote number, customer name, email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full h-10 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-3.5 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 transition-all"
              />
            </div>

            {status && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-10 flex items-center gap-1.5 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="text-xs text-[#526B91] font-medium shrink-0 flex items-center gap-1">
            <span>Showing</span>
            <span className="font-semibold text-[#0B2148]">{startRange}–{endRange}</span>
            <span>of</span>
            <span className="font-semibold text-[#0B2148]">{totalCount}</span>
            <span>proposals</span>
          </div>
        </div>
      </div>

      {/* 4. Data Table Container */}
      <div className="bg-white border border-[#D8E8FA] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading || isRefetching ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-[#0878F9] animate-spin" />
              <span className="text-xs text-[#526B91] font-medium">Loading quotations...</span>
            </div>
          ) : quotes.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[860px] lg:min-w-0 table-auto">
              <thead>
                <tr className="border-b border-[#D8E8FA] bg-[#F4F9FF]/80 text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="py-3 px-3 sm:px-3.5 w-[140px]">Quotation ID</th>
                  <th className="py-3 px-3 sm:px-3.5 min-w-[170px] max-w-[210px]">Customer Account</th>
                  <th className="py-3 px-3 sm:px-3.5 w-[120px] whitespace-nowrap">Proposal Date</th>
                  <th className="py-3 px-3 sm:px-3.5 w-[110px] whitespace-nowrap">Valid Until</th>
                  <th className="py-3 px-3 sm:px-3.5 w-[125px] text-right whitespace-nowrap">Grand Total</th>
                  <th className="py-3 px-3 sm:px-3.5 w-[125px]">Sales Owner</th>
                  <th className="py-3 px-3 sm:px-3.5 w-[145px] text-center">Status</th>
                  <th className="py-3 px-3 sm:px-3.5 w-[90px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E8FA]/60 text-xs">
                {quotes.map((q: any) => {
                  const ownerName = q.assignedSalesUser?.name || "Unassigned";
                  const isExpiringSoon = new Date(q.validUntil).getTime() < Date.now();
                  const customerCode = q.customer?.customerCode || "";
                  const isPending = q.status === "PENDING_APPROVAL";
                  
                  return (
                    <tr key={q.id} className="hover:bg-[#F4F9FF]/70 transition-colors group">
                      
                      {/* Quotation Number */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-[#0878F9] bg-[#EAF5FF] px-2 py-0.5 rounded border border-blue-200/80">
                            {q.quotationNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(q.quotationNumber, "Quotation Number")}
                            className="text-[#526B91] hover:text-[#0B2148] p-1 rounded hover:bg-[#F4F9FF] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30"
                            title="Copy quotation number"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Customer Snapshot details */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle max-w-[210px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#EAF5FF] border border-blue-200 text-[#0878F9] flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getAvatarInitials(q.customerNameSnapshot || "Customer")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-[#0B2148] group-hover:text-[#0878F9] transition-colors truncate max-w-[150px]" title={q.customerNameSnapshot}>
                                {q.customerNameSnapshot}
                              </span>
                              {customerCode && (
                                <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA] shrink-0">
                                  {customerCode}
                                </span>
                              )}
                            </div>
                            {q.customerEmailSnapshot && (
                              <div className="text-[11px] text-[#526B91] truncate max-w-[160px]" title={q.customerEmailSnapshot}>
                                {q.customerEmailSnapshot}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Proposal date */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle whitespace-nowrap font-medium text-[#526B91]">
                        {new Date(q.quotationDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                      </td>

                      {/* Valid Until */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle whitespace-nowrap font-medium">
                        <span className={isExpiringSoon && q.status !== "ACCEPTED" ? "text-amber-600 font-semibold" : "text-[#526B91]"}>
                          {new Date(q.validUntil).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle text-right whitespace-nowrap font-mono font-bold text-[#0B2148] text-xs">
                        ₹ {parseFloat(q.grandTotal.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Owner Agent */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle text-[#0B2148]">
                        {ownerName !== "Unassigned" ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center text-[9px] font-bold shrink-0">
                              {getAvatarInitials(ownerName)}
                            </div>
                            <span className="truncate max-w-[90px] font-medium" title={ownerName}>{ownerName}</span>
                          </div>
                        ) : (
                          <span className="text-[#526B91] italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle text-center whitespace-nowrap">
                        {renderStatusBadge(q.status, q.validUntil)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 sm:py-3 px-3 sm:px-3.5 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* 1. View Button (Always available, compact) */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuoteForView(q);
                              setIsViewModalOpen(true);
                            }}
                            className="h-7 px-2 text-xs font-semibold bg-white hover:bg-[#F4F9FF] text-[#0B2148] hover:text-[#0878F9] rounded-lg border border-[#D8E8FA] hover:border-[#0878F9]/40 transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30"
                            title="View Complete Quotation"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#526B91]" />
                            <span>View</span>
                          </button>

                          {/* 2. Edit Button (For Sales Executive / Admin on PENDING_APPROVAL or DRAFT) */}
                          {["sales-executive", "admin", "superadmin"].includes(roleSlug) && (isPending || ["DRAFT", "REJECTED"].includes(q.status)) && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(q)}
                              className="w-7 h-7 flex items-center justify-center text-xs font-semibold bg-[#EAF5FF] hover:bg-blue-100 text-[#0878F9] rounded-lg border border-blue-200 transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30 shrink-0"
                              title="Edit Proposal Details"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#0878F9]" />
                            </button>
                          )}

                          {/* 3. Approve Button (For Sales Executive / Admin when WAITING FOR APPROVAL) */}
                          {["sales-executive", "admin", "superadmin"].includes(roleSlug) && isPending && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedQuoteForApproval(q);
                                setIsApproveModalOpen(true);
                              }}
                              className="w-7 h-7 flex items-center justify-center text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all cursor-pointer shadow-xs shadow-emerald-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 shrink-0"
                              title="Approve Proposal"
                            >
                              <Check className="w-3.5 h-3.5 text-white" />
                            </button>
                          )}

                          {/* 4. Share Button (Available ONLY when APPROVED, SENT, or ACCEPTED) */}
                          {["APPROVED", "SENT", "ACCEPTED"].includes(q.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedQuoteForShare(q);
                                setIsShareModalOpen(true);
                              }}
                              className="w-7 h-7 flex items-center justify-center text-xs font-semibold bg-[#0878F9] hover:bg-[#0667DB] active:bg-[#0557B8] text-white rounded-lg transition-all cursor-pointer shadow-xs shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30 shrink-0"
                              title="Share Quotation"
                            >
                              <Share2 className="w-3.5 h-3.5 text-white" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 bg-[#EAF5FF] rounded-2xl flex items-center justify-center text-[#0878F9] mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#0B2148] text-sm">No Quotations Found</h3>
              <p className="text-xs mt-1 text-[#526B91] max-w-sm">
                No proposals match your active filters or search criteria.
              </p>
              {status && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#EAF5FF] hover:bg-blue-100 text-[#0878F9] text-xs font-semibold transition-all cursor-pointer border border-blue-200"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Pagination Area */}
        <div className="py-3.5 px-5 border-t border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#F4F9FF]/60">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#526B91] font-medium">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-[#D8E8FA] text-[#0B2148] font-medium rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#0878F9] cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button 
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-[#526B91] hover:text-[#0B2148] disabled:opacity-40 disabled:hover:text-[#526B91] rounded-lg hover:bg-white transition-colors text-xs font-semibold cursor-pointer"
            >
              Previous
            </button>

            {getPageNumbers().map(p => (
              <button
                type="button"
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[32px] h-8 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  page === p
                    ? "bg-[#0878F9] text-white shadow-xs"
                    : "text-[#526B91] hover:bg-white hover:text-[#0B2148]"
                }`}
              >
                {p}
              </button>
            ))}

            <button 
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-[#526B91] hover:text-[#0B2148] disabled:opacity-40 disabled:hover:text-[#526B91] rounded-lg hover:bg-white transition-colors text-xs font-semibold cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Create Quotation Dialog Drawer */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-white backdrop-blur-sm">
            {/* Backdrop click close */}
            <div className="absolute inset-0" onClick={() => setIsCreateOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl p-6 sm:p-8 z-10 overflow-y-auto text-slate-900"
            >
              {/* Drawer Header */}
              <div className="flex justify-between items-center pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Create Commercial Quotation
                  </h2>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Generate compliant, tax-calculated commercial proposals for verified customer profiles.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-[#526B91] hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex-1 py-6 space-y-6">
                
                {/* 1. CUSTOMER SELECTION */}
                <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Customer Information
                    </h3>
                    <span className="text-[10px] font-semibold text-[#526B91]">* Required</span>
                  </div>

                  {/* Searchable Customer Picker */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Select Customer *</span>
                      {selectedCustomerObj && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId("");
                            setCustomerSearchQuery("");
                            setIsCustomerSearchOpen(true);
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                        >
                          Change Customer
                        </button>
                      )}
                    </label>

                    {selectedCustomerObj ? (
                      /* Selected Customer Summary Card */
                      <div className="p-3.5 bg-white border-2 border-blue-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{selectedCustomerObj.name}</span>
                            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                              {selectedCustomerObj.customerCode}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#526B91]">
                              {selectedCustomerObj.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#526B91]">
                            {selectedCustomerObj.contactPerson && (
                              <span className="flex items-center gap-1 text-slate-700">
                                <User className="w-3.5 h-3.5 text-[#526B91]" />
                                {selectedCustomerObj.contactPerson}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-[#526B91]" />
                              {selectedCustomerObj.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-[#526B91]" />
                              {selectedCustomerObj.email}
                            </span>
                          </div>
                          {selectedCustomerObj.billingAddress && (
                            <p className="text-[11px] text-[#526B91] truncate">
                              Address: {selectedCustomerObj.billingAddress}, {selectedCustomerObj.city}, {selectedCustomerObj.state}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId("");
                            setCustomerSearchQuery("");
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors self-start sm:self-center cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      /* Interactive Searchable Dropdown */
                      <div className="relative" ref={customerDropdownRef}>
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
                          <input
                            id="customer-search-input"
                            type="text"
                            placeholder="Search customer by ID (e.g. KY-001), name, company, phone, email..."
                            value={customerSearchQuery}
                            onFocus={() => setIsCustomerSearchOpen(true)}
                            onChange={(e) => {
                              setCustomerSearchQuery(e.target.value);
                              setIsCustomerSearchOpen(true);
                              if (validationErrors.customer) {
                                setValidationErrors(prev => ({ ...prev, customer: "" }));
                              }
                            }}
                            className={`w-full bg-white border ${validationErrors.customer ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300'} rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-[#526B91]`}
                          />
                        </div>

                        {/* Dropdown Options Popover */}
                        {isCustomerSearchOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.map((c: any) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerId(c.id);
                                    setIsCustomerSearchOpen(false);
                                    setCustomerSearchQuery("");
                                    setValidationErrors(prev => ({ ...prev, customer: "" }));
                                  }}
                                  className="w-full text-left p-3 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-slate-900">{c.name}</span>
                                      <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                                        {c.customerCode}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-[#526B91] mt-0.5 truncate">
                                      <span>{c.email}</span>
                                      <span>•</span>
                                      <span>{c.phone}</span>
                                      {c.city && <span>• {c.city}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 flex-shrink-0">
                                    Select
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center text-xs text-[#526B91]">
                                {customerSearchQuery ? (
                                  <div>
                                    <p className="font-medium text-slate-700">No customers found matching &quot;{customerSearchQuery}&quot;</p>
                                    <p className="text-[11px] text-[#526B91] mt-1">Try searching by Customer ID (e.g. KY-001), phone, or company name.</p>
                                  </div>
                                ) : (
                                  <p>Start typing customer name, ID (e.g. KY-001), phone, or email.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {validationErrors.customer && (
                      <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {validationErrors.customer}
                      </p>
                    )}
                  </div>

                  {/* Validity Expiry Date */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Validity Expiry Date *
                    </label>
                    <input 
                      id="valid-until-input"
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={validUntil}
                      onChange={(e) => {
                        setValidUntil(e.target.value);
                        if (validationErrors.validUntil) {
                          setValidationErrors(prev => ({ ...prev, validUntil: "" }));
                        }
                      }}
                      className={`w-full bg-white border ${validationErrors.validUntil ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300'} rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs`}
                    />
                    {validationErrors.validUntil && (
                      <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {validationErrors.validUntil}
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. COMMERCIAL TERMS & LOGISTICS */}
                <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Commercial Terms & Delivery Logistics
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Payment Terms Dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                        Payment Terms *
                      </label>
                      <select
                        id="payment-terms-select"
                        value={paymentTermsType}
                        onChange={(e) => {
                          setPaymentTermsType(e.target.value);
                          if (validationErrors.paymentTerms) {
                            setValidationErrors(prev => ({ ...prev, paymentTerms: "" }));
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                      >
                        {PAYMENT_TERMS_PRESETS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Delivery Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                        Delivery Notes *
                      </label>
                      <textarea
                        id="delivery-notes"
                        required
                        rows={paymentTermsType === "Custom" ? 3 : 2}
                        placeholder="e.g. Delivery within 14 business days after payment confirmation. Customer pickup from factory."
                        value={deliveryNotes}
                        onChange={(e) => {
                          setDeliveryNotes(e.target.value);
                          if (validationErrors.deliveryNotes) {
                            setValidationErrors(prev => ({ ...prev, deliveryNotes: "" }));
                          }
                        }}
                        className={`w-full bg-white border ${validationErrors.deliveryNotes ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300'} rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none shadow-xs`}
                      />
                      {validationErrors.deliveryNotes && (
                        <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {validationErrors.deliveryNotes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. COMPANY PRODUCT SELECTION & LIVE PRICING */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-600" />
                        Company Product Selection & Pricing ({items.length})
                      </h3>
                      <p className="text-[11px] text-[#526B91] mt-0.5">
                        Select company battery models to auto-populate specifications, base rates, and calculate total amounts.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {paxTypes.length > 0 && (
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const matchedPax = paxTypes.find((p: any) => p.id === val);
                            if (matchedPax) {
                              setItems([...items, createItemFromPax(matchedPax, 1)]);
                            }
                            e.target.value = "";
                          }}
                          defaultValue=""
                          className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl px-3 py-1.5 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="" disabled>+ Add Company Product...</option>
                          {paxTypes.map((pax: any) => (
                            <option key={pax.id} value={pax.id}>
                              {pax.name} ({pax.cellCount}S • {pax.ahMin}-{pax.ahMax} Ah){pax.isProductionActive ? " ★ Active" : ""}
                            </option>
                          ))}
                        </select>
                      )}

                      <button 
                        id="add-item-row-btn"
                        type="button"
                        onClick={() => {
                          const activePax = paxTypes.find((p: any) => p.isProductionActive) || paxTypes[0];
                          if (activePax) {
                            setItems([...items, createItemFromPax(activePax, 1)]);
                          } else {
                            setItems([...items, { productRef: "", materialId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "", notes: "" }]);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Product
                      </button>
                    </div>
                  </div>

                  {/* Quick-Add Model Chips */}
                  {paxTypes.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider whitespace-nowrap">
                        Quick Add Models:
                      </span>
                      {paxTypes.slice(0, 5).map((pax: any) => (
                        <button
                          key={pax.id}
                          type="button"
                          onClick={() => setItems([...items, createItemFromPax(pax, 1)])}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-700 hover:text-blue-700 text-[11px] font-mono font-semibold transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3 text-[#526B91]" />
                          <span>{pax.name}</span>
                          <span className="text-[9px] text-[#526B91] font-sans">({pax.cellCount}S)</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                    {items.map((item, idx) => {
                      const calc = calculateLineItem(item);
                      const matchedPax = paxTypes.find((p: any) => p.name === item.productRef || p.id === item.paxTypeId);

                      return (
                        <div key={idx} className="p-4 sm:p-5 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3.5 relative shadow-xs hover:border-slate-300 transition-all">
                          {/* Row Header with Product Identification */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              
                              {matchedPax ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                                    {matchedPax.name}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-mono font-bold border border-blue-200">
                                    <Battery className="w-2.5 h-2.5" />
                                    {matchedPax.cellCount}S (~{(matchedPax.cellCount * 3.2).toFixed(1)}V)
                                  </span>
                                  <span className="text-[10px] text-[#526B91] font-mono">
                                    {matchedPax.ahMin}-{matchedPax.ahMax} Ah
                                  </span>
                                  {matchedPax.isProductionActive && (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                      Active Model
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-700">
                                  Product #{idx + 1}
                                </span>
                              )}
                            </div>

                            {items.length > 1 ? (
                              <button 
                                type="button"
                                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                className="inline-flex items-center gap-1 text-[#526B91] hover:text-rose-600 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 text-xs font-medium cursor-pointer"
                                title="Remove item"
                              >
                                <Trash className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#526B91] italic">Primary Product</span>
                            )}
                          </div>

                          {/* Company Model Switcher & Description */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            {/* Product Model Selector */}
                            <div className="md:col-span-4 space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">
                                Select Company Model
                              </label>
                              <select
                                value={matchedPax ? matchedPax.id : (paxTypes.find((p: any) => p.name === item.productRef)?.id || "")}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const targetPax = paxTypes.find((p: any) => p.id === selectedId);
                                  const newItems = [...items];
                                  if (targetPax) {
                                    newItems[idx] = {
                                      ...newItems[idx],
                                      ...createItemFromPax(targetPax, newItems[idx].quantity || 1)
                                    };
                                  }
                                  setItems(newItems);
                                }}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium cursor-pointer shadow-xs"
                              >
                                <option value="">-- Choose Company Model --</option>
                                {paxTypes.map((p: any) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.cellCount}S • {p.ahMin}-{p.ahMax} Ah)
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Line Item Label / Description */}
                            <div className="md:col-span-8 space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">
                                Quotation Product Description *
                              </label>
                              <input 
                                id={`item-${idx}-description`}
                                type="text"
                                required
                                placeholder="Description / Product Label"
                                value={item.description}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].description = e.target.value;
                                  setItems(newItems);
                                  if (validationErrors[`item_${idx}_description`]) {
                                    setValidationErrors(prev => ({ ...prev, [`item_${idx}_description`]: "" }));
                                  }
                                }}
                                className={`w-full bg-white border ${validationErrors[`item_${idx}_description`] ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-300'} rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs font-medium`}
                              />
                              {validationErrors[`item_${idx}_description`] && (
                                <p className="text-[10px] text-rose-600 font-semibold">{validationErrors[`item_${idx}_description`]}</p>
                              )}
                            </div>
                          </div>

                          {/* Pricing, Quantity, Discount, Tax Rate */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Quantity *</label>
                              <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...items];
                                    const currentQty = Number(newItems[idx].quantity) || 1;
                                    if (currentQty > 1) {
                                      newItems[idx].quantity = currentQty - 1;
                                      setItems(newItems);
                                    }
                                  }}
                                  className="px-2.5 py-2 text-[#526B91] hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  -
                                </button>
                                <input 
                                  id={`item-${idx}-quantity`}
                                  type="number"
                                  required
                                  min={1}
                                  step="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newItems = [...items];
                                    const val = parseInt(e.target.value, 10);
                                    newItems[idx].quantity = isNaN(val) || val < 1 ? 1 : val;
                                    setItems(newItems);
                                  }}
                                  className="w-full bg-transparent text-center text-xs text-slate-900 focus:outline-none font-mono font-bold"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...items];
                                    const currentQty = Number(newItems[idx].quantity) || 1;
                                    newItems[idx].quantity = currentQty + 1;
                                    setItems(newItems);
                                  }}
                                  className="px-2.5 py-2 text-[#526B91] hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Unit Price (₹) *</label>
                              <input 
                                id={`item-${idx}-unitPrice`}
                                type="number"
                                required
                                min={0}
                                step="1"
                                placeholder="0.00"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  const val = parseFloat(e.target.value);
                                  newItems[idx].unitPrice = isNaN(val) || val < 0 ? 0 : val;
                                  setItems(newItems);
                                }}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold shadow-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Discount (%)</label>
                              <input 
                                type="number"
                                min={0}
                                max={100}
                                step="0.5"
                                placeholder="0"
                                value={item.discount}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  const val = parseFloat(e.target.value);
                                  newItems[idx].discount = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
                                  setItems(newItems);
                                }}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono shadow-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Tax Rate (%) *</label>
                              <select
                                value={item.taxRate}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].taxRate = Number(e.target.value);
                                  setItems(newItems);
                                }}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                              >
                                {TAX_RATE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Live Calculated Model Amount Bar */}
                          <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#526B91] text-[11px]">
                              <span>Subtotal ({item.quantity} × {formatINR(item.unitPrice)}): <strong className="font-mono text-slate-900">{formatINR(calc.lineSubtotal)}</strong></span>
                              {calc.discountAmount > 0 && (
                                <span className="text-emerald-700">Disc ({item.discount}%): <strong className="font-mono">-{formatINR(calc.discountAmount)}</strong></span>
                              )}
                              <span>Taxable: <strong className="font-mono text-slate-900">{formatINR(calc.taxableAmount)}</strong></span>
                              <span>GST ({item.taxRate}%): <strong className="font-mono text-slate-900">+{formatINR(calc.taxAmount)}</strong></span>
                            </div>

                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <span className="text-xs text-[#526B91]">Model Amount:</span>
                              <span className="font-mono text-blue-700 font-extrabold text-base bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                                {formatINR(calc.lineTotal)}
                              </span>
                            </div>
                          </div>

                          {/* Technical Specifications & Item Notes */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Technical Specifications</label>
                              <input 
                                type="text"
                                placeholder="e.g. 16S (~51.2V) • 100Ah • LFP • Grade A+"
                                value={item.specification || ""}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].specification = e.target.value;
                                  setItems(newItems);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Item Specific Notes</label>
                              <input 
                                type="text"
                                placeholder="e.g. 3-year standard manufacturer warranty included"
                                value={item.notes || ""}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].notes = e.target.value;
                                  setItems(newItems);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                              />
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. SALES AGENT & SPECIAL NOTES */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Assignee Sales Agent
                    </label>
                    <select
                      value={assignedSalesUserId}
                      onChange={(e) => setAssignedSalesUserId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer shadow-xs"
                    >
                      <option value="">Select Sales Agent</option>
                      {salesAgents.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Special Payment / Bank Terms Notes
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. Bank: HDFC Bank, IFSC: HDFC0001234, Account: 50200012345678"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors shadow-xs"
                    />
                  </div>
                </div>

                {/* 5. INTERNAL NOTES VS CUSTOMER NOTES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Internal Notes */}
                  <div className="space-y-1.5 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                        Internal Notes
                      </label>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        🔒 Hidden from Customer & PDF
                      </span>
                    </div>
                    <textarea 
                      placeholder="Pricing margins, priority constraints, manager approvals..."
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 resize-none shadow-xs"
                    />
                  </div>

                  {/* Customer Facing Notes */}
                  <div className="space-y-1.5 bg-blue-50/50 p-3.5 rounded-xl border border-blue-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                        Customer Facing Notes
                      </label>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                        📄 Printed on Quotation PDF
                      </span>
                    </div>
                    <textarea 
                      placeholder="Thank you for choosing Kyra Zam. Valid proposal subject to standard terms."
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none shadow-xs"
                    />
                  </div>
                </div>

                {/* 6. TRANSPARENT PRICING & FINANCIAL CALCULATION SUMMARY */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs shadow-xs">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-blue-600" />
                      Quotation Price Calculation Summary
                    </span>
                    <span className="font-mono text-[#526B91] font-semibold">{items.length} Item(s)</span>
                  </div>

                  <div className="flex justify-between text-[#526B91]">
                    <span>Line Items Subtotal:</span>
                    <span className="font-mono font-bold text-slate-900">{formatINR(totals.subtotal)}</span>
                  </div>

                  {totals.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Total Discount Deductions:</span>
                      <span className="font-mono font-bold">- {formatINR(totals.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#526B91]">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-bold text-slate-900">{formatINR(totals.taxable)}</span>
                  </div>

                  <div className="flex justify-between text-[#526B91]">
                    <span>Tax Amount (GST Cumulative):</span>
                    <span className="font-mono font-bold text-slate-900">+ {formatINR(totals.tax)}</span>
                  </div>

                  {totals.freight > 0 && (
                    <div className="flex justify-between text-[#526B91]">
                      <span>Freight Charges:</span>
                      <span className="font-mono font-bold text-slate-900">+ {formatINR(totals.freight)}</span>
                    </div>
                  )}

                  {totals.additional > 0 && (
                    <div className="flex justify-between text-[#526B91]">
                      <span>Additional Charges:</span>
                      <span className="font-mono font-bold text-slate-900">+ {formatINR(totals.additional)}</span>
                    </div>
                  )}

                  <div className="mt-2 pt-3 border-t border-slate-200 flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-900 font-display font-bold text-xs uppercase tracking-wider block">ESTIMATED GRAND TOTAL</span>
                      <span className="text-[10px] text-[#526B91] font-medium">Inclusive of taxes & commercial charges</span>
                    </div>
                    <span className="font-mono text-xl text-blue-700 font-extrabold">{formatINR(totals.grandTotal)}</span>
                  </div>
                </div>

                {/* 7. FORM SUBMISSION ACTIONS */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button 
                    id="submit-quotation-btn"
                    type="submit" 
                    disabled={createQuotationMutation.isPending}
                    className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {createQuotationMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Proposal...
                      </>
                    ) : (
                      "Save & Generate Proposal"
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. APPROVE CONFIRMATION MODAL */}
      <AnimatePresence>
        {isApproveModalOpen && selectedQuoteForApproval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Approve Quotation</h3>
                    <p className="text-xs text-[#526B91]">Sales Executive Verification & Signoff</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="p-1.5 text-[#526B91] hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700">Approve this quotation?</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#526B91] block text-[10px] uppercase font-bold">Quotation Number</span>
                    <span className="font-mono font-bold text-blue-700 text-sm">{selectedQuoteForApproval.quotationNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#526B91] block text-[10px] uppercase font-bold">Customer</span>
                    <span className="font-semibold text-slate-900 block truncate">{selectedQuoteForApproval.customerNameSnapshot}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="text-[#526B91] font-medium">Total Amount:</span>
                    <span className="font-mono text-lg font-extrabold text-slate-900">
                      ₹ {parseFloat(selectedQuoteForApproval.grandTotal.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Approval Notes / Comments (Optional)
                </label>
                <textarea
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="e.g. Commercial terms and margins verified by Sales Executive."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={approveQuotationMutation.isPending}
                  onClick={() => {
                    approveQuotationMutation.mutate({
                      id: selectedQuoteForApproval.id,
                      comments: approvalComments
                    });
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {approveQuotationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm Approval
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. SHARE MODAL */}
      <AnimatePresence>
        {isShareModalOpen && selectedQuoteForShare && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Share Approved Quotation</h3>
                    <p className="text-xs text-[#526B91]">{selectedQuoteForShare.quotationNumber} — {selectedQuoteForShare.customerNameSnapshot}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1.5 text-[#526B91] hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-800">Approved Commercial Proposal</span>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Total Value: <span className="font-mono font-bold">₹ {parseFloat(selectedQuoteForShare.grandTotal.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* 1. Download PDF */}
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedQuoteForShare.id, selectedQuoteForShare.quotationNumber)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg group-hover:scale-105 transition-transform">
                      <FileDown className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Download Official PDF</span>
                      <span className="text-[11px] text-[#526B91]">Commercial document generated by backend engine</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#526B91] group-hover:text-blue-600 transition-colors" />
                </button>

                {/* 2. Send via Email */}
                <button
                  type="button"
                  onClick={() => handleShareEmail(selectedQuoteForShare)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-purple-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:scale-105 transition-transform">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Send via Email</span>
                      <span className="text-[11px] text-[#526B91]">Open prefilled email client with proposal breakdown</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#526B91] group-hover:text-purple-600 transition-colors" />
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. COMPLETE VIEW QUOTATION MODAL */}
      <AnimatePresence>
        {isViewModalOpen && selectedQuoteForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900">
                      {selectedQuoteForView.quotationNumber}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded">
                      Rev {selectedQuoteForView.version || 1}
                    </span>
                  </div>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Proposal Date: {new Date(selectedQuoteForView.quotationDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {renderStatusBadge(fullViewQuotation?.status || selectedQuoteForView.status, selectedQuoteForView.validUntil)}
                  <button
                    type="button"
                    onClick={() => {
                      setIsViewModalOpen(false);
                      setSelectedQuoteForView(null);
                    }}
                    className="p-2 text-[#526B91] hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {isViewLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <span className="text-xs text-[#526B91]">Loading quotation details...</span>
                </div>
              ) : (
                <>
                  {/* Customer Snapshot & Addresses Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/75 p-5 rounded-2xl border border-slate-200/80">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Customer Information</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{selectedQuoteForView.customerNameSnapshot}</span>
                        {selectedQuoteForView.customer?.customerCode && (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                            {selectedQuoteForView.customer.customerCode}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#526B91] space-y-1 pt-1">
                        {selectedQuoteForView.customerEmailSnapshot && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#526B91]" />
                            <span>{selectedQuoteForView.customerEmailSnapshot}</span>
                          </div>
                        )}
                        {selectedQuoteForView.customerPhoneSnapshot && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#526B91]" />
                            <span>{selectedQuoteForView.customerPhoneSnapshot}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block mb-1">Billing Address</span>
                        <p className="text-[#526B91] text-[11px] leading-relaxed">
                          {selectedQuoteForView.billingAddressSnapshot || "N/A"}<br />
                          {selectedQuoteForView.citySnapshot}, {selectedQuoteForView.stateSnapshot} - {selectedQuoteForView.postalCodeSnapshot}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block mb-1">Shipping Address</span>
                        <p className="text-[#526B91] text-[11px] leading-relaxed">
                          {selectedQuoteForView.shippingAddressSnapshot || "N/A"}<br />
                          {selectedQuoteForView.citySnapshot}, {selectedQuoteForView.stateSnapshot} - {selectedQuoteForView.postalCodeSnapshot}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div>
                    <span className="text-xs font-bold text-slate-900 mb-2 block uppercase tracking-wider">Line Items</span>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-[#526B91]">
                          <tr>
                            <th className="py-2.5 px-4">Item & Description</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-center">Disc %</th>
                            <th className="py-2.5 px-3 text-center">Tax %</th>
                            <th className="py-2.5 px-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(fullViewQuotation?.items || []).map((item: any, idx: number) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{item.productRef || item.description}</div>
                                {item.productRef && item.description !== item.productRef && (
                                  <div className="text-[11px] text-[#526B91]">{item.description}</div>
                                )}
                                {item.specification && (
                                  <div className="text-[10px] text-[#526B91] italic mt-0.5">{item.specification}</div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-slate-700">{item.quantity}</td>
                              <td className="py-3 px-3 text-right font-mono">₹ {parseFloat(item.unitPrice.toString()).toFixed(2)}</td>
                              <td className="py-3 px-3 text-center">{parseFloat(item.discount.toString())}%</td>
                              <td className="py-3 px-3 text-center">{parseFloat(item.taxRate.toString())}%</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                ₹ {parseFloat(item.lineTotal.toString()).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pricing Breakdown & Commercial Terms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Commercial Terms */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                      <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block mb-1">Commercial Terms</span>
                      <div>
                        <span className="text-[#526B91] font-medium">Payment Terms:</span>
                        <p className="font-semibold text-slate-900">{selectedQuoteForView.paymentTerms || "Full Advance"}</p>
                      </div>
                      <div>
                        <span className="text-[#526B91] font-medium">Delivery Terms:</span>
                        <p className="font-semibold text-slate-900">{selectedQuoteForView.deliveryTerms || "Standard Delivery"}</p>
                      </div>
                      <div>
                        <span className="text-[#526B91] font-medium">Validity Expiry:</span>
                        <p className="font-semibold text-slate-900">
                          {new Date(selectedQuoteForView.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      {selectedQuoteForView.notes && (
                        <div>
                          <span className="text-[#526B91] font-medium">Notes:</span>
                          <p className="text-slate-700 text-[11px]">{selectedQuoteForView.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Financial Breakdown */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 font-medium">
                      <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block mb-1">Financial Summary</span>
                      <div className="flex justify-between text-[#526B91]">
                        <span>Subtotal:</span>
                        <span className="font-mono text-slate-900">₹ {parseFloat(selectedQuoteForView.subtotal.toString()).toFixed(2)}</span>
                      </div>
                      {Number(selectedQuoteForView.discount) > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount:</span>
                          <span className="font-mono">- ₹ {parseFloat(selectedQuoteForView.discount.toString()).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[#526B91]">
                        <span>Tax Amount (GST):</span>
                        <span className="font-mono text-slate-900">+ ₹ {parseFloat(selectedQuoteForView.tax.toString()).toFixed(2)}</span>
                      </div>
                      {Number(selectedQuoteForView.additionalCharges) > 0 && (
                        <div className="flex justify-between text-[#526B91]">
                          <span>Freight & Additional:</span>
                          <span className="font-mono text-slate-900">+ ₹ {parseFloat(selectedQuoteForView.additionalCharges.toString()).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-sm font-bold text-slate-900">
                        <span>Grand Total:</span>
                        <span className="font-mono text-base text-blue-700 font-extrabold">
                          ₹ {parseFloat(selectedQuoteForView.grandTotal.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Approval Record Status Timeline */}
                  {fullViewQuotation?.approvals && fullViewQuotation.approvals.length > 0 && (
                    <div className="bg-slate-50/75 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                      <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Approval History</span>
                      {fullViewQuotation.approvals.map((appr: any, idx: number) => (
                        <div key={appr.id || idx} className="flex items-start justify-between gap-3 text-[11px] pt-1 border-t border-slate-200/60 first:border-0 first:pt-0">
                          <div>
                            <span className="font-bold text-slate-800">
                              {appr.status === "APPROVED" ? "✓ Approved by " : appr.status === "REJECTED" ? "✕ Rejected by " : "Requested by "}
                              {appr.decidedBy?.name || appr.requestedBy?.name || "Reviewer"}
                            </span>
                            {appr.comments && <p className="text-[#526B91] italic mt-0.5">"{appr.comments}"</p>}
                            {appr.reason && <p className="text-rose-600 mt-0.5">Reason: {appr.reason}</p>}
                          </div>
                          <span className="text-[#526B91] text-[10px] whitespace-nowrap">
                            {new Date(appr.updatedAt || appr.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => router.push(`/${roleSlug}/sales/quotations/${selectedQuoteForView.id}`)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Full Detail Page</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Edit Button (if Sales Executive & waiting for approval or draft) */}
                      {["sales-executive", "admin", "superadmin"].includes(roleSlug) && ["PENDING_APPROVAL", "DRAFT", "REJECTED"].includes(fullViewQuotation?.status || selectedQuoteForView.status) && (
                        <button
                          type="button"
                          onClick={() => {
                            const targetQuote = fullViewQuotation || selectedQuoteForView;
                            setIsViewModalOpen(false);
                            setSelectedQuoteForView(null);
                            handleOpenEdit(targetQuote);
                          }}
                          className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition-all border border-blue-200 cursor-pointer flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit Proposal</span>
                        </button>
                      )}

                      {/* Share Button (if approved) */}
                      {["APPROVED", "SENT", "ACCEPTED"].includes(fullViewQuotation?.status || selectedQuoteForView.status) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsViewModalOpen(false);
                            setSelectedQuoteForShare(selectedQuoteForView);
                            setIsShareModalOpen(true);
                          }}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl text-xs transition-all shadow-sm shadow-blue-500/20 cursor-pointer flex items-center gap-1.5 border border-blue-600 hover:border-blue-700"
                        >
                          <Share2 className="w-3.5 h-3.5 text-white" />
                          <span className="text-[#0B2148] font-semibold">Share Quotation</span>
                        </button>
                      )}

                      {/* Approve Button (if Sales Executive & waiting for approval) */}
                      {["sales-executive", "admin", "superadmin"].includes(roleSlug) && (fullViewQuotation?.status || selectedQuoteForView.status) === "PENDING_APPROVAL" && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsViewModalOpen(false);
                            setSelectedQuoteForApproval(selectedQuoteForView);
                            setIsApproveModalOpen(true);
                          }}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Quotation</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsViewModalOpen(false);
                          setSelectedQuoteForView(null);
                        }}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. SALES EXECUTIVE EDIT PROPOSAL MODAL */}
      <AnimatePresence>
        {isEditModalOpen && editFormData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 max-h-[92vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                        Edit Quotation Proposal
                      </h2>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {editFormData.quotationNumber}
                      </span>
                    </div>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      Review and adjust commercial line items, discounts, terms, and charges.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Live Total Badge */}
                  <div className="px-3.5 py-1.5 rounded-xl bg-white text-white flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Live Total:</span>
                    <span className="font-mono font-bold text-sm text-blue-400">
                      ₹ {calculateEditTotals().grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setSelectedQuoteForEdit(null);
                      setEditFormData(null);
                    }}
                    className="p-2 text-[#526B91] hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer Banner */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-[#526B91]" />
                  <span className="text-[#526B91]">Customer:</span>
                  <span className="font-bold text-slate-900">{editFormData.customerName}</span>
                  {editFormData.customerCode && (
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      {editFormData.customerCode}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Waiting for Sales Executive Approval</span>
                </div>
              </div>

              {/* Section 1: Validity & Commercial Terms */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. Validity & Commercial Terms</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Validity Date */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Validity Expiry Date *</label>
                    <input
                      type="date"
                      required
                      value={editFormData.validUntil}
                      onChange={(e) => setEditFormData({ ...editFormData, validUntil: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer font-medium"
                    />
                  </div>

                  {/* Payment Terms */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Payment Terms</label>
                    <select
                      value={PAYMENT_TERMS_PRESETS.includes(editFormData.paymentTerms) ? editFormData.paymentTerms : PAYMENT_TERMS_PRESETS[0]}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer font-medium"
                    >
                      {PAYMENT_TERMS_PRESETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery Terms */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Delivery Terms</label>
                    <input
                      type="text"
                      value={editFormData.deliveryTerms}
                      onChange={(e) => setEditFormData({ ...editFormData, deliveryTerms: e.target.value })}
                      placeholder="e.g. Ex-Works / 14 Days"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Assigned Sales Rep */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Sales Representative</label>
                    <select
                      value={editFormData.assignedSalesUserId}
                      onChange={(e) => setEditFormData({ ...editFormData, assignedSalesUserId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer font-medium"
                    >
                      <option value="">Unassigned</option>
                      {salesAgents.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} (Sales Executive)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Line Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    <span>2. Product Line Items ({editFormData.items?.length || 0})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleEditAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Row</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {editFormData.items?.map((item: any, idx: number) => {
                    const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                    const discAmount = lineSubtotal * ((Number(item.discount) || 0) / 100);
                    const lineTotal = (lineSubtotal - discAmount) * (1 + (Number(item.taxRate) || 0) / 100);

                    return (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative group hover:border-slate-300 transition-colors">
                        <div className="grid grid-cols-12 gap-3 items-end">
                          {/* Material Selector */}
                          <div className="col-span-12 md:col-span-4 space-y-1">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Company Product / Model *</label>
                            <select
                              required
                              value={item.materialId || (paxTypes.find((p: any) => p.name === item.productRef)?.id || "")}
                              onChange={(e) => handleEditItemChange(idx, "materialId", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                            >
                              <option value="">Select Product / Model</option>
                              {paxTypes.length > 0 && (
                                <optgroup label="Company Battery Models">
                                  {paxTypes.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.cellCount}S • {p.ahMin}-{p.ahMax} Ah)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {materials.length > 0 && (
                                <optgroup label="Inventory Materials">
                                  {materials.map((m: any) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.sku}) {m.unitPrice ? `• ₹${m.unitPrice}` : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="col-span-4 md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Qty *</label>
                            <input
                              type="number"
                              required
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleEditItemChange(idx, "quantity", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold text-center"
                            />
                          </div>

                          {/* Unit Price */}
                          <div className="col-span-4 md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Unit Price (INR) *</label>
                            <input
                              type="number"
                              required
                              min={0}
                              value={item.unitPrice}
                              onChange={(e) => handleEditItemChange(idx, "unitPrice", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono font-bold text-right"
                            />
                          </div>

                          {/* Discount % */}
                          <div className="col-span-2 md:col-span-1 space-y-1">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Disc %</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.discount}
                              onChange={(e) => handleEditItemChange(idx, "discount", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono text-center"
                            />
                          </div>

                          {/* GST Tax Rate */}
                          <div className="col-span-2 md:col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Tax GST</label>
                            <select
                              value={item.taxRate}
                              onChange={(e) => handleEditItemChange(idx, "taxRate", Number(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                            >
                              {TAX_RATE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Line Total & Remove */}
                          <div className="col-span-12 md:col-span-1 flex items-center justify-between md:justify-end gap-2 pt-1">
                            <span className="md:hidden text-[11px] font-bold text-slate-700 font-mono">
                              Total: ₹{lineTotal.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditRemoveItem(idx)}
                              disabled={editFormData.items.length === 1}
                              className="p-2 text-[#526B91] hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Line Specs & Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 text-xs">
                          <input
                            type="text"
                            placeholder="Custom specification / sizing / grade..."
                            value={item.specification}
                            onChange={(e) => handleEditItemChange(idx, "specification", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Line item note..."
                            value={item.notes}
                            onChange={(e) => handleEditItemChange(idx, "notes", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Financial Summary & Charges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Additional Charges / Freight */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Additional Charges & Logistics</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Freight Charges (INR)</label>
                      <input
                        type="number"
                        min={0}
                        value={editFormData.freightCharges}
                        onChange={(e) => setEditFormData({ ...editFormData, freightCharges: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Other Charges (INR)</label>
                      <input
                        type="number"
                        min={0}
                        value={editFormData.additionalCharges}
                        onChange={(e) => setEditFormData({ ...editFormData, additionalCharges: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Notes / Customer Remarks</label>
                    <textarea
                      rows={2}
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      placeholder="Proposal terms or customer notes..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>

                {/* Live Calculated Financial Breakdown */}
                {(() => {
                  const editTotals = calculateEditTotals();
                  return (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs font-medium">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Calculated Financial Total</h4>
                      <div className="flex justify-between text-[#526B91]">
                        <span>Items Subtotal:</span>
                        <span className="font-mono text-slate-900 font-semibold">₹ {editTotals.subtotal.toFixed(2)}</span>
                      </div>
                      {editTotals.discount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Total Discount:</span>
                          <span className="font-mono font-semibold">- ₹ {editTotals.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-[#526B91]">
                        <span>Taxable Amount:</span>
                        <span className="font-mono text-slate-900">₹ {editTotals.taxable.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[#526B91]">
                        <span>GST Tax Total:</span>
                        <span className="font-mono text-slate-900">+ ₹ {editTotals.tax.toFixed(2)}</span>
                      </div>
                      {(editTotals.freight > 0 || editTotals.additional > 0) && (
                        <div className="flex justify-between text-[#526B91]">
                          <span>Freight & Charges:</span>
                          <span className="font-mono text-slate-900">+ ₹ {(editTotals.freight + editTotals.additional).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-sm font-bold text-slate-900">
                        <span>Grand Total:</span>
                        <span className="font-mono text-lg text-blue-700 font-extrabold">
                          ₹ {editTotals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Section 4: Approval Comments for Direct Approval */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Optional Approval Notes (For Save & Approve)</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Verified pricing and approved for customer sharing..."
                  value={editApprovalComments}
                  onChange={(e) => setEditApprovalComments(e.target.value)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Footer Modal Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedQuoteForEdit(null);
                    setEditFormData(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2.5">
                  {/* Save Draft Changes */}
                  <button
                    type="button"
                    disabled={updateQuotationMutation.isPending}
                    onClick={() => handleSaveEdit(false)}
                    className="px-5 py-2.5 bg-white hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {updateQuotationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save Changes</span>
                  </button>

                  {/* Save & Approve Immediately */}
                  <button
                    type="button"
                    disabled={updateQuotationMutation.isPending}
                    onClick={() => handleSaveEdit(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {updateQuotationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Save & Approve Proposal</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
