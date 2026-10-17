"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl, downloadAuthenticatedFile } from "@/lib/api";
import { 
  FileText, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle,
  AlertTriangle,
  FileDown,
  RefreshCw,
  Send,
  Check,
  X,
  Plus,
  Trash,
  GitBranch,
  ShieldCheck,
  MapPin,
  Pencil,
  Share2,
  Copy,
  ExternalLink,
  MessageSquare,
  Clock,
  CheckCircle2,
  Download,
  ChevronRight,
  MoreVertical,
  ChevronDown,
  Info,
  DollarSign,
  PackageCheck
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "@/components/ui/StatusBadge";

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Workflow Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isAcceptOpen, setIsAcceptOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  const [acceptComments, setAcceptComments] = useState("");

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertDeliveryDate, setConvertDeliveryDate] = useState("");
  const [convertPriority, setConvertPriority] = useState("NORMAL");

  // Revision Snapshot viewer state
  const [selectedRevision, setSelectedRevision] = useState<any>(null);

  // Edit proposals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  // Close more menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatINR = (val: number) => {
    return "₹ " + Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : "";
    navigator.clipboard.writeText(url);
    toast.success(`Direct link for ${quotation?.quotationNumber || 'quotation'} copied to clipboard!`);
  };

  const handleShareWhatsApp = () => {
    if (!quotation) return;
    const phone = quotation.customerPhoneSnapshot?.replace(/\D/g, "") || "";
    const message = `Hello ${quotation.customerNameSnapshot},\n\nPlease find your Commercial Quotation ${quotation.quotationNumber} from KYRA ZAM for ${formatINR(Number(quotation.grandTotal))}.\nValidity: ${new Date(quotation.validUntil).toLocaleDateString('en-IN')}.\nPayment Terms: ${quotation.paymentTerms}.\n\nThank you,\nKYRA ZAM Sales Team`;
    const encoded = encodeURIComponent(message);
    const waUrl = phone ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
  };

  const handleShareEmail = () => {
    if (!quotation) return;
    const email = quotation.customerEmailSnapshot || "";
    const subject = encodeURIComponent(`Commercial Quotation ${quotation.quotationNumber} - KYRA ZAM`);
    const body = encodeURIComponent(
      `Dear ${quotation.customerNameSnapshot},\n\nWe are pleased to share our official Commercial Quotation (${quotation.quotationNumber}) for your requirement.\n\nProposal Details:\n- Quotation Number: ${quotation.quotationNumber}\n- Total Amount: ${formatINR(Number(quotation.grandTotal))}\n- Valid Until: ${new Date(quotation.validUntil).toLocaleDateString('en-IN')}\n- Payment Terms: ${quotation.paymentTerms}\n- Delivery Terms: ${quotation.deliveryTerms}\n\nPlease let us know if you require any clarifications or wish to proceed.\n\nWarm regards,\nKYRA ZAM Commercial Team`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  // --- DATA FETCHING ---
  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation-details", quotationId],
    queryFn: async () => {
      const res = await api.get(`/crm/quotations/${quotationId}`);
      // Initialize edit state
      setEditForm({
        assignedSalesUserId: res.data.assignedSalesUserId || "",
        validUntil: res.data.validUntil ? res.data.validUntil.split("T")[0] : "",
        currency: res.data.currency || "INR",
        additionalCharges: Number(res.data.additionalCharges || 0),
        paymentTerms: res.data.paymentTerms || "50% Advance",
        deliveryTerms: res.data.deliveryTerms || "Standard Delivery",
        notes: res.data.notes || "",
        internalNotes: res.data.internalNotes || "",
        customerNotes: res.data.customerNotes || "",
        items: (res.data.items || []).map((item: any) => ({
          productRef: item.productRef || "",
          materialId: item.materialId || "",
          description: item.description || "Item",
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          taxRate: Number(item.taxRate) || 18,
          specification: item.specification || "",
          notes: item.notes || ""
        }))
      });
      return res.data;
    }
  });

  const { data: users } = useQuery({
    queryKey: ["crm-system-users"],
    queryFn: async () => (await api.get("/crm/users")).data
  });

  const { data: materials } = useQuery({
    queryKey: ["crm-materials-dropdown"],
    queryFn: async () => (await api.get("/inventory", { params: { limit: 100 } })).data?.materials || []
  });

  // --- MUTATIONS ---
  const submitApprovalMutation = useMutation({
    mutationFn: () => api.put(`/crm/quotations/${quotationId}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Submitted for internal approval successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Submission failed")
  });

  const approveMutation = useMutation({
    mutationFn: (comments: string) => api.put(`/crm/quotations/${quotationId}/approve`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Proposal approved successfully");
      setIsApproveOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Approval failed")
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { reason: string; comments: string }) => api.put(`/crm/quotations/${quotationId}/reject`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Proposal rejected successfully");
      setIsRejectOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Rejection failed")
  });

  const sendMutation = useMutation({
    mutationFn: () => api.put(`/crm/quotations/${quotationId}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Proposal marked as SENT to customer");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to mark sent")
  });

  const acceptMutation = useMutation({
    mutationFn: (comments: string) => api.put(`/crm/quotations/${quotationId}/accept`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Customer acceptance recorded!");
      setIsAcceptOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Acceptance failed")
  });

  const rejectCustomerMutation = useMutation({
    mutationFn: () => api.put(`/crm/quotations/${quotationId}/reject-customer`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Customer rejection recorded");
    },
    onError: (err: any) => toast.error("Rejection recording failed")
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/crm/quotations/${quotationId}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Proposal cancelled");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Cancellation failed")
  });

  const reviseMutation = useMutation({
    mutationFn: () => api.post(`/crm/quotations/${quotationId}/revise`, {}),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("New revision proposal version created");
      if (res.data?.id && res.data.id !== quotationId) {
        router.push(`/${roleSlug}/sales/quotations/${res.data.id}`);
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Revision initialization failed")
  });

  const updateDraftMutation = useMutation({
    mutationFn: (data: any) => api.put(`/crm/quotations/${quotationId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Draft updated successfully");
      setIsEditOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Update failed")
  });

  const convertQuotationMutation = useMutation({
    mutationFn: (data: { requiredDeliveryDate: string; priority: string }) => 
      api.post(`/crm/sales-orders/convert/${quotationId}`, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["quotation-details"] });
      queryClient.invalidateQueries({ queryKey: ["quotations-list"] });
      toast.success("Converted to Sales Order successfully!");
      router.push(`/${roleSlug}/sales/orders/${res.data.id}`);
    },
    onError: (err: any) => {
      if (err.response?.status === 409 && err.response?.data?.salesOrderId) {
        toast.error("Already converted! Redirecting...");
        router.push(`/${roleSlug}/sales/orders/${err.response.data.salesOrderId}`);
      } else {
        toast.error(err.response?.data?.error || "Conversion failed");
      }
    }
  });

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
        <span className="text-xs text-[#526B91] font-medium">Loading quotation details...</span>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-[#D8E8FA] text-center max-w-lg mx-auto shadow-xs">
        <AlertTriangle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
        <h3 className="font-bold text-[#0B2148] text-base">Quotation Not Found</h3>
        <p className="text-xs text-[#526B91] mt-1">The requested quotation proposal could not be retrieved.</p>
        <button
          onClick={() => router.push(`/${roleSlug}/sales/quotations`)}
          className="mt-4 px-4 py-2 rounded-xl bg-[#0878F9] text-white text-xs font-semibold hover:bg-[#0667DB] cursor-pointer"
        >
          Back to Quotations
        </button>
      </div>
    );
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateDraftMutation.mutate(editForm);
  };

  const handleSaveAndApprove = async () => {
    try {
      await updateDraftMutation.mutateAsync(editForm);
      await approveMutation.mutateAsync("Approved after review and adjustments");
    } catch (err) {
      // Handled in mutation callbacks
    }
  };

  const handleEditItemChange = (idx: number, field: string, val: any) => {
    const items = [...editForm.items];
    items[idx][field] = val;
    if (field === "materialId" && val) {
      const m = materials?.find((x: any) => x.id === val);
      if (m) {
        items[idx].description = m.name;
        items[idx].productRef = m.sku;
        items[idx].unitPrice = m.unitPrice || 0;
      }
    }
    setEditForm({ ...editForm, items });
  };

  const handleEditAddItem = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, { productRef: "", materialId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "", notes: "" }]
    });
  };

  const handleEditRemoveItem = (idx: number) => {
    if (editForm.items.length === 1) return;
    setEditForm({
      ...editForm,
      items: editForm.items.filter((_: any, i: number) => i !== idx)
    });
  };

  const downloadPdf = async () => {
    try {
      await downloadAuthenticatedFile(`/crm/quotations/${quotationId}/pdf`, `quotation-${quotation?.quotationNumber || quotationId}.pdf`);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  const isExpired = new Date() > new Date(quotation.validUntil) && !["ACCEPTED", "CANCELLED"].includes(quotation.status);
  const isSalesExecOrAdmin = ["sales-executive", "admin", "superadmin"].includes(roleSlug);
  const isMarketingOrSales = ["sales-executive", "marketing-manager", "admin", "superadmin"].includes(roleSlug);

  // Determine Authoritative Primary Action
  const getPrimaryAction = () => {
    if (!quotation) return null;

    if (isExpired && isMarketingOrSales) {
      return {
        label: "Create Revision",
        icon: <RefreshCw className="w-3.5 h-3.5" />,
        onClick: () => reviseMutation.mutate(),
        isLoading: reviseMutation.isPending,
        className: "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs"
      };
    }

    switch (quotation.status) {
      case "DRAFT":
        return {
          label: "Submit for Approval",
          icon: <Send className="w-3.5 h-3.5" />,
          onClick: () => submitApprovalMutation.mutate(),
          isLoading: submitApprovalMutation.isPending,
          className: "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs"
        };
      case "PENDING_APPROVAL":
        if (isSalesExecOrAdmin) {
          return {
            label: "Approve Quotation",
            icon: <Check className="w-3.5 h-3.5" />,
            onClick: () => setIsApproveOpen(true),
            className: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20"
          };
        }
        return null;
      case "APPROVED":
        if (isMarketingOrSales) {
          return {
            label: "Mark Sent to Customer",
            icon: <Send className="w-3.5 h-3.5" />,
            onClick: () => sendMutation.mutate(),
            isLoading: sendMutation.isPending,
            className: "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs"
          };
        }
        return null;
      case "SENT":
        if (isMarketingOrSales) {
          return {
            label: "Record Customer Acceptance",
            icon: <Check className="w-3.5 h-3.5" />,
            onClick: () => setIsAcceptOpen(true),
            className: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20"
          };
        }
        return null;
      case "ACCEPTED":
        if (quotation.salesOrder) {
          return {
            label: "View Sales Order",
            icon: <ExternalLink className="w-3.5 h-3.5" />,
            onClick: () => router.push(`/${roleSlug}/sales/orders/${quotation.salesOrder.id}`),
            className: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20"
          };
        }
        if (isMarketingOrSales) {
          return {
            label: "Convert to Sales Order",
            icon: <CheckCircle className="w-3.5 h-3.5" />,
            onClick: () => setIsConvertOpen(true),
            className: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20"
          };
        }
        return null;
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();
  const ownerName = quotation.assignedSalesUser?.name || "Unassigned";

  // Check if secondary menu has items
  const canEdit = quotation.status === "DRAFT" || (quotation.status === "PENDING_APPROVAL" && isSalesExecOrAdmin);
  const canReject = quotation.status === "PENDING_APPROVAL" && isSalesExecOrAdmin;
  const canRejectCustomer = quotation.status === "SENT" && isMarketingOrSales;
  const canRevise = ["APPROVED", "SENT", "REJECTED"].includes(quotation.status) && isMarketingOrSales;
  const canCancel = quotation.status === "DRAFT";
  const hasSecondaryMenu = canEdit || canReject || canRejectCustomer || canRevise || canCancel;

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header & Workflow Action Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#D8E8FA] shadow-xs flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        
        {/* Left: Navigation & Quotation Identifier */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            type="button"
            onClick={() => router.push(`/${roleSlug}/sales/quotations`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D8E8FA] bg-white hover:bg-[#F4F9FF] text-[#0B2148] hover:text-[#0878F9] font-semibold text-xs transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quotations</span>
          </button>

          <div className="h-4 w-px bg-[#D8E8FA] hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm sm:text-base text-[#0B2148]">
              {quotation.quotationNumber}
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EAF5FF] text-[#0878F9] border border-blue-200/80">
              Rev {quotation.version}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="text-[#526B91] hover:text-[#0B2148] p-1 rounded hover:bg-[#F4F9FF] transition-colors cursor-pointer"
              title="Copy link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <StatusBadge 
            status={isExpired ? "EXPIRED" : quotation.status} 
            customLabel={isExpired ? "Expired" : undefined}
            variant={isExpired ? "danger" : undefined}
            size="sm" 
          />
        </div>

        {/* Right: Authoritative Action Group */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          
          {/* Share Button (when permitted) */}
          {["APPROVED", "SENT", "ACCEPTED"].includes(quotation.status) && (
            <button 
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="h-8 px-3 rounded-xl border border-blue-200 bg-[#EAF5FF] hover:bg-blue-100 text-[#0878F9] font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          )}

          {/* Download PDF Button */}
          <button 
            type="button"
            onClick={downloadPdf}
            className="h-8 px-3 rounded-xl bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] hover:text-[#0878F9] font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30"
          >
            <FileDown className="w-3.5 h-3.5 text-[#0878F9]" />
            <span>PDF</span>
          </button>

          {/* Primary Action Button */}
          {primaryAction && (
            <button 
              type="button"
              disabled={primaryAction.isLoading}
              onClick={primaryAction.onClick}
              className={`h-8 px-3.5 rounded-xl font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 ${primaryAction.className}`}
            >
              {primaryAction.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {/* Contextual More Actions Menu */}
          {hasSecondaryMenu && (
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="h-8 px-2 rounded-xl bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] transition-all cursor-pointer inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0878F9]/30"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#D8E8FA] rounded-xl shadow-xl py-1 z-30 text-xs">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); setIsEditOpen(true); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#F4F9FF] text-[#0B2148] hover:text-[#0878F9] font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#0878F9]" />
                      <span>Edit Proposal</span>
                    </button>
                  )}

                  {canReject && (
                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); setIsRejectOpen(true); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-700 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reject Quotation</span>
                    </button>
                  )}

                  {canRejectCustomer && (
                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); rejectCustomerMutation.mutate(); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-700 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      <span>Record Customer Rejection</span>
                    </button>
                  )}

                  {canRevise && (
                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); reviseMutation.mutate(); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#F4F9FF] text-[#0B2148] hover:text-[#0878F9] font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#0878F9]" />
                      <span>Create New Revision</span>
                    </button>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => { setIsMoreMenuOpen(false); cancelMutation.mutate(); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-700 font-medium flex items-center gap-2 cursor-pointer border-t border-slate-100"
                    >
                      <Trash className="w-3.5 h-3.5 text-rose-600" />
                      <span>Cancel Proposal</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Quotation Meta Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Card 1: Customer Info */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#D8E8FA] shadow-xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EAF5FF] border border-blue-200 text-[#0878F9] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Customer Account</span>
            <p className="font-semibold text-xs text-[#0B2148] truncate mt-0.5" title={quotation.customerNameSnapshot}>
              {quotation.customerNameSnapshot}
            </p>
            {quotation.customer?.customerCode && (
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA] inline-block mt-1">
                {quotation.customer.customerCode}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Sales Owner */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#D8E8FA] shadow-xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EAF5FF] border border-blue-200 text-[#0878F9] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Sales Owner</span>
            <p className="font-semibold text-xs text-[#0B2148] truncate mt-0.5">
              {ownerName}
            </p>
            <span className="text-[10px] text-[#526B91] block mt-0.5">
              {quotation.assignedSalesUser?.email || "Commercial Account"}
            </span>
          </div>
        </div>

        {/* Card 3: Key Dates */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#D8E8FA] shadow-xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EAF5FF] border border-blue-200 text-[#0878F9] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Proposal Dates</span>
            <p className="text-xs font-semibold text-[#0B2148] mt-0.5">
              {new Date(quotation.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <span className={`text-[10px] block mt-0.5 ${isExpired ? "text-rose-600 font-bold" : "text-[#526B91]"}`}>
              Valid: {new Date(quotation.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Card 4: Financial Grand Total */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#D8E8FA] shadow-xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EAF5FF] border border-blue-200 text-[#0878F9] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Grand Total ({quotation.currency || "INR"})</span>
            <p className="font-mono font-bold text-sm text-[#0878F9] mt-0.5 truncate">
              {formatINR(Number(quotation.grandTotal))}
            </p>
            <span className="text-[10px] text-[#526B91] block mt-0.5 truncate">
              {quotation.paymentTerms || "Standard Terms"}
            </span>
          </div>
        </div>

      </div>

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left 2-Columns: Line Items & Commercial Terms */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Line Items Card */}
          <div className="bg-white rounded-2xl border border-[#D8E8FA] shadow-xs overflow-hidden">
            <div className="py-3 px-4 border-b border-[#D8E8FA] bg-[#F4F9FF]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0878F9]" />
                <h3 className="font-bold text-xs text-[#0B2148] uppercase tracking-wider">Quotation Line Items</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF5FF] text-[#0878F9] border border-blue-200/80">
                {quotation.items?.length || 0} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-[#D8E8FA] bg-[#F4F9FF]/40 text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3.5 w-[35px]">#</th>
                    <th className="py-2.5 px-3.5">Product & Specification</th>
                    <th className="py-2.5 px-3.5 w-[70px] text-center">Qty</th>
                    <th className="py-2.5 px-3.5 w-[110px] text-right">Unit Price</th>
                    <th className="py-2.5 px-3.5 w-[90px] text-right">Disc</th>
                    <th className="py-2.5 px-3.5 w-[90px] text-center">GST %</th>
                    <th className="py-2.5 px-3.5 w-[120px] text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E8FA]/50 text-[#0B2148]">
                  {quotation.items?.map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-[#F4F9FF]/50 transition-colors">
                      <td className="py-3 px-3.5 text-[#526B91] font-mono text-[11px] align-top">{idx + 1}</td>
                      <td className="py-3 px-3.5 align-top">
                        <p className="font-semibold text-xs text-[#0B2148]">{item.description}</p>
                        {item.productRef && (
                          <span className="text-[10px] text-[#526B91] font-mono block mt-0.5">
                            SKU / Ref: {item.productRef}
                          </span>
                        )}
                        {item.specification && (
                          <span className="text-[10px] text-[#526B91] block mt-0.5 leading-relaxed">
                            {item.specification}
                          </span>
                        )}
                        {item.notes && (
                          <span className="text-[10px] text-slate-500 italic block mt-0.5">
                            Note: {item.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-center align-top">{item.quantity}</td>
                      <td className="py-3 px-3.5 font-mono text-right align-top">{formatINR(Number(item.unitPrice))}</td>
                      <td className="py-3 px-3.5 font-mono text-right text-rose-600 align-top">
                        {Number(item.discount) > 0 ? `-${formatINR(Number(item.discount))}` : "—"}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-center text-[#526B91] align-top">{item.taxRate}%</td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-[#0B2148] align-top">
                        {formatINR(Number(item.lineTotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commercial Terms & Addresses Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-3.5">
            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
              Commercial Terms & Dispatch Protocol
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div className="p-3 bg-[#F4F9FF]/60 rounded-xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Payment Terms</span>
                  <p className="font-semibold text-xs text-[#0B2148] mt-0.5">{quotation.paymentTerms || "Standard Terms"}</p>
                </div>

                <div className="p-3 bg-[#F4F9FF]/60 rounded-xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Delivery Terms</span>
                  <p className="font-semibold text-xs text-[#0B2148] mt-0.5">{quotation.deliveryTerms || "Standard Delivery"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#F4F9FF]/60 rounded-xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#0878F9]" /> Billing Address
                  </span>
                  <p className="text-[11px] text-[#0B2148] mt-0.5 leading-relaxed">
                    {quotation.billingAddressSnapshot || "Registered billing address"}
                  </p>
                </div>

                <div className="p-3 bg-[#F4F9FF]/60 rounded-xl border border-[#D8E8FA]">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#0878F9]" /> Shipping Address
                  </span>
                  <p className="text-[11px] text-[#0B2148] mt-0.5 leading-relaxed">
                    {quotation.shippingAddressSnapshot || "Registered shipping address"}
                  </p>
                </div>
              </div>
            </div>

            {(quotation.notes || quotation.customerNotes || quotation.internalNotes) && (
              <div className="pt-2 border-t border-[#D8E8FA] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {quotation.notes && (
                  <div>
                    <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Proposal Notes</span>
                    <p className="text-[11px] text-[#0B2148] mt-0.5">{quotation.notes}</p>
                  </div>
                )}
                {quotation.customerNotes && (
                  <div>
                    <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Customer Notes</span>
                    <p className="text-[11px] text-[#0B2148] mt-0.5">{quotation.customerNotes}</p>
                  </div>
                )}
                {quotation.internalNotes && (
                  <div>
                    <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Internal Notes</span>
                    <p className="text-[11px] text-[#526B91] italic mt-0.5">{quotation.internalNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 1-Column: Financial Summary, Lifecycle Status, and Revisions */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Financial Summary Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
              Financial Calculation Summary
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#526B91]">
                <span>Items Subtotal:</span>
                <span className="font-mono font-semibold text-[#0B2148]">{formatINR(Number(quotation.subtotal))}</span>
              </div>

              {Number(quotation.discount) > 0 && (
                <div className="flex justify-between items-center text-[#526B91]">
                  <span>Total Discounts:</span>
                  <span className="font-mono font-semibold text-rose-600">-{formatINR(Number(quotation.discount))}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-[#526B91]">
                <span>Taxable Amount:</span>
                <span className="font-mono font-semibold text-[#0B2148]">
                  {formatINR(Math.max(0, Number(quotation.subtotal) - Number(quotation.discount)))}
                </span>
              </div>

              <div className="flex justify-between items-center text-[#526B91]">
                <span>GST Tax Total:</span>
                <span className="font-mono font-semibold text-[#0B2148]">{formatINR(Number(quotation.tax))}</span>
              </div>

              {Number(quotation.additionalCharges) > 0 && (
                <div className="flex justify-between items-center text-[#526B91]">
                  <span>Freight & Extra:</span>
                  <span className="font-mono font-semibold text-[#0B2148]">{formatINR(Number(quotation.additionalCharges))}</span>
                </div>
              )}

              <div className="pt-2.5 border-t border-[#D8E8FA] flex justify-between items-center">
                <span className="font-bold text-xs text-[#0B2148] uppercase tracking-wider">Grand Total:</span>
                <span className="font-mono font-bold text-base text-[#0878F9]">{formatINR(Number(quotation.grandTotal))}</span>
              </div>
            </div>
          </div>

          {/* Workflow Stage & Status Timeline Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider pb-2 border-b border-[#D8E8FA] flex items-center justify-between">
              <span>Workflow State Machine</span>
              <span className="text-[10px] text-[#526B91] font-mono">Stage Indicator</span>
            </h4>

            {/* Stepper Stages */}
            <div className="space-y-2.5 text-xs">
              {[
                { stage: "Draft Created", active: true, done: ["PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED"].includes(quotation.status) },
                { stage: "Internal Approval", active: quotation.status === "PENDING_APPROVAL", done: ["APPROVED", "SENT", "ACCEPTED"].includes(quotation.status) },
                { stage: "Dispatched / Sent", active: quotation.status === "SENT", done: ["ACCEPTED"].includes(quotation.status) },
                { stage: "Customer Accepted", active: quotation.status === "ACCEPTED", done: !!quotation.salesOrder },
                { stage: "Sales Order Active", active: !!quotation.salesOrder, done: !!quotation.salesOrder }
              ].map((st, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    st.done 
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300" 
                      : st.active 
                      ? "bg-[#0878F9] text-white shadow-xs" 
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}>
                    {st.done ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-xs ${st.active ? "font-bold text-[#0878F9]" : st.done ? "font-medium text-[#0B2148]" : "text-[#526B91]"}`}>
                    {st.stage}
                  </span>
                </div>
              ))}
            </div>

            {/* Stage Guidance Note */}
            {quotation.status === "PENDING_APPROVAL" && !isSalesExecOrAdmin && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                <span className="font-bold block mb-0.5">Awaiting Sales Executive Review</span>
                This proposal must be approved by an authorized Sales Executive before client delivery.
              </div>
            )}
          </div>

          {/* Controlled Revisions Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider pb-2 border-b border-[#D8E8FA] flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-[#0878F9]" />
              <span>Controlled Revision History</span>
            </h4>

            {quotation.revisions?.length > 0 ? (
              <div className="space-y-2">
                {quotation.revisions.map((rev: any) => (
                  <div 
                    key={rev.id} 
                    className="p-2.5 rounded-xl border border-[#D8E8FA] bg-[#F4F9FF]/50 flex items-center justify-between hover:bg-[#F4F9FF] transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#0B2148]">Revision {rev.version}</p>
                      <p className="text-[10px] text-[#526B91] mt-0.5">
                        {rev.createdBy?.name || "System"} • {new Date(rev.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <button 
                      type="button"
                      onClick={() => setSelectedRevision(rev)}
                      className="px-2 py-1 bg-white border border-[#D8E8FA] hover:border-[#0878F9]/40 rounded-lg text-[10px] font-bold text-[#0878F9] hover:bg-[#EAF5FF] transition-colors cursor-pointer"
                    >
                      Snapshot
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#526B91]">This is initial revision 1 on record.</p>
            )}
          </div>

        </div>
      </div>

      {/* Internal approval validation dialog */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white p-6 rounded-2xl border border-[#D8E8FA] shadow-2xl max-w-md w-full mx-auto space-y-4 text-[#0B2148]">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#D8E8FA]">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0B2148]">Approve Quotation Proposal</h3>
                <p className="text-xs text-[#526B91]">{quotation.quotationNumber}</p>
              </div>
            </div>

            <p className="text-xs text-[#526B91]">
              Confirming approval will authorize this quotation for client presentation and pricing release.
            </p>

            <textarea 
              placeholder="Approval comments or audit notes (optional)..."
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              rows={3}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white resize-none"
            />

            <div className="flex gap-2 justify-end pt-1">
              <button 
                type="button"
                onClick={() => setIsApproveOpen(false)} 
                className="px-4 py-2 rounded-xl text-[#526B91] bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => approveMutation.mutate(approveComments)}
                disabled={approveMutation.isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm Approval</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection dialog */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full mx-auto space-y-4 text-[#0B2148]">
            <div className="flex items-center gap-2.5 pb-2 border-b border-rose-100">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0B2148]">Reject Quotation Proposal</h3>
                <p className="text-xs text-[#526B91]">{quotation.quotationNumber}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <input 
                type="text" 
                placeholder="Reason for Rejection (required) *"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-rose-500 focus:bg-white"
              />
              <textarea 
                placeholder="Additional audit comments (optional)..."
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                rows={2}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button 
                type="button"
                onClick={() => setIsRejectOpen(false)} 
                className="px-4 py-2 rounded-xl text-[#526B91] bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (!rejectReason) {
                    toast.error("Reason is required");
                    return;
                  }
                  rejectMutation.mutate({ reason: rejectReason, comments: rejectComments });
                }}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {rejectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isShareOpen && quotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full mx-4 space-y-5 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Share Quotation</h3>
                  <p className="text-xs text-[#526B91]">{quotation.quotationNumber} • {quotation.customerNameSnapshot}</p>
                </div>
              </div>
              <button onClick={() => setIsShareOpen(false)} className="p-1 rounded-lg text-[#526B91] hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between text-[#526B91]">
                <span>Customer:</span>
                <span className="font-semibold text-slate-900">{quotation.customerNameSnapshot}</span>
              </div>
              <div className="flex justify-between text-[#526B91]">
                <span>Total Amount:</span>
                <span className="font-semibold text-blue-600">{formatINR(Number(quotation.grandTotal))}</span>
              </div>
              <div className="flex justify-between text-[#526B91]">
                <span>Validity:</span>
                <span className="font-semibold text-slate-900">{new Date(quotation.validUntil).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <a
                href={`${getApiBaseUrl()}/crm/quotations/${quotation.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-800 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">Download Official PDF</p>
                    <p className="text-[10px] text-[#526B91]">Official Kyra Zam formatted commercial PDF</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#526B91] group-hover:text-blue-600 transition-colors" />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-800 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Copy className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">Copy Direct Link</p>
                    <p className="text-[10px] text-[#526B91]">Copy quotation reference link to clipboard</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#526B91] group-hover:text-blue-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-800 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">Share via WhatsApp</p>
                    <p className="text-[10px] text-[#526B91]">Send formatted quote details to {quotation.customerPhoneSnapshot || 'customer'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#526B91] group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={handleShareEmail}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 text-slate-800 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">Share via Email</p>
                    <p className="text-[10px] text-[#526B91]">Compose email to {quotation.customerEmailSnapshot || 'customer'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#526B91] group-hover:text-violet-600 transition-colors" />
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsShareOpen(false)}
                className="px-5 py-2 rounded-xl text-[#526B91] bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAcceptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full mx-4 space-y-4 text-slate-900">
            <h3 className="text-base font-bold text-slate-900">Record Customer Acceptance</h3>
            <textarea 
              placeholder="Comments or approval notes..."
              value={acceptComments}
              onChange={(e) => setAcceptComments(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsAcceptOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer">Cancel</button>
              <button 
                onClick={() => acceptMutation.mutate(acceptComments)}
                disabled={acceptMutation.isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-sm"
              >
                Record Acceptance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot revision details viewer */}
      {selectedRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full mx-auto space-y-4 max-h-[85vh] overflow-y-auto text-slate-900">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Revision {selectedRevision.version} details</h3>
              <button onClick={() => setSelectedRevision(null)} className="text-[#526B91] hover:text-slate-700 p-1 cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs text-[#526B91]">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p>Status: <span className="font-bold text-slate-900">{selectedRevision.snapshot.status}</span></p>
                <p>Terms: {selectedRevision.snapshot.paymentTerms} | {selectedRevision.snapshot.deliveryTerms}</p>
                <p>Expiry: {new Date(selectedRevision.snapshot.validUntil).toLocaleDateString()}</p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-900">Items list snapshot:</p>
                {selectedRevision.snapshot.items?.map((it: any, i: number) => (
                  <div key={i} className="p-2 border border-slate-200 bg-slate-50 rounded-lg flex justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{it.description}</p>
                      {it.productRef && <p className="text-[10px] text-[#526B91] font-mono mt-0.5">Ref: {it.productRef}</p>}
                      <p className="text-[10px] text-[#526B91]">Qty: {it.quantity} × Price: {it.unitPrice} (Tax: {it.taxRate}%)</p>
                    </div>
                    <span className="font-bold text-slate-900 font-mono">INR {it.lineTotal?.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-100 font-bold text-slate-900 flex justify-between">
                <span>Grand Total snapshot:</span>
                <span className="font-mono text-blue-600 text-sm">INR {selectedRevision.snapshot.grandTotal?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isConvertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full mx-4 space-y-4 text-slate-900">
            <h3 className="text-base font-bold text-slate-900">Convert to Sales Order</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Required Delivery Date *</label>
                <input 
                  type="date"
                  required
                  value={convertDeliveryDate}
                  onChange={(e) => setConvertDeliveryDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Order Priority *</label>
                <select 
                  value={convertPriority}
                  onChange={(e) => setConvertPriority(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsConvertOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer">Cancel</button>
              <button 
                onClick={() => {
                  if (!convertDeliveryDate) {
                    toast.error("Delivery date is required");
                    return;
                  }
                  convertQuotationMutation.mutate({ requiredDeliveryDate: convertDeliveryDate, priority: convertPriority });
                }}
                disabled={convertQuotationMutation.isPending}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-sm"
              >
                {convertQuotationMutation.isPending ? "Converting..." : "Confirm Convert"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Edit Modal */}
      <AnimatePresence>
        {isEditOpen && editForm && (
          <div className="fixed inset-0 z-50 flex justify-end bg-white backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setIsEditOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl p-8 z-10 overflow-y-auto text-slate-900"
            >
              <div className="flex justify-between items-center pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900">Modify Quotation Draft</h2>
                  <p className="text-xs text-[#526B91] mt-1">Update commercial draft specifications, payment terms, or line items.</p>
                </div>
                <button 
                  onClick={() => setIsEditOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-[#526B91] hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="flex-1 py-6 space-y-6">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Validity Expiry Date *</label>
                    <input 
                      type="date"
                      required
                      value={editForm.validUntil}
                      onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Assigned Owner (Sales Rep)</label>
                    <select
                      value={editForm.assignedSalesUserId}
                      onChange={(e) => setEditForm({ ...editForm, assignedSalesUserId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {users?.filter((u: any) => u.roles?.includes("SALES_EXECUTIVE") || u.role === "SALES_EXECUTIVE").map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} (Sales Executive)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Terms and owner */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Payment Terms *</label>
                    <input 
                      type="text"
                      required
                      value={editForm.paymentTerms}
                      onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Delivery Terms *</label>
                    <input 
                      type="text"
                      required
                      value={editForm.deliveryTerms}
                      onChange={(e) => setEditForm({ ...editForm, deliveryTerms: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Additional Freight Charges (INR)</label>
                    <input 
                      type="number"
                      required
                      min={0}
                      value={editForm.additionalCharges}
                      onChange={(e) => setEditForm({ ...editForm, additionalCharges: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Proposal / Customer Notes */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Proposal Notes</label>
                    <textarea 
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Internal Notes</label>
                    <textarea 
                      value={editForm.internalNotes}
                      onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Customer Notes</label>
                    <textarea 
                      value={editForm.customerNotes}
                      onChange={(e) => setEditForm({ ...editForm, customerNotes: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Line Items</h3>
                    <button 
                      type="button"
                      onClick={handleEditAddItem}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom Item Row
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editForm.items?.map((item: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl items-end relative group">
                        
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Product Material *</label>
                          <select
                            required
                            value={item.materialId}
                            onChange={(e) => handleEditItemChange(idx, "materialId", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="">Select Material</option>
                            {materials?.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                          </select>
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Qty *</label>
                          <input 
                            type="number"
                            required
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleEditItemChange(idx, "quantity", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Unit Price (INR) *</label>
                          <input 
                            type="number"
                            required
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) => handleEditItemChange(idx, "unitPrice", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Disc (INR)</label>
                          <input 
                            type="number"
                            required
                            min={0}
                            value={item.discount}
                            onChange={(e) => handleEditItemChange(idx, "discount", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Tax GST % *</label>
                          <input 
                            type="number"
                            required
                            min={0}
                            max={100}
                            value={item.taxRate}
                            onChange={(e) => handleEditItemChange(idx, "taxRate", Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="col-span-1 flex justify-center pb-1.5">
                          <button 
                            type="button"
                            onClick={() => handleEditRemoveItem(idx)}
                            disabled={editForm.items.length === 1}
                            className="p-2 text-[#526B91] hover:text-rose-600 disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="col-span-12 grid grid-cols-2 gap-3 mt-1 pt-2 border-t border-slate-200">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Line Item Custom Specification / Details</label>
                            <input 
                              type="text"
                              value={item.specification}
                              onChange={(e) => handleEditItemChange(idx, "specification", e.target.value)}
                              placeholder="e.g. Dimensions, packing requirements..."
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Notes</label>
                            <input 
                              type="text"
                              value={item.notes}
                              onChange={(e) => handleEditItemChange(idx, "notes", e.target.value)}
                              placeholder="e.g. Deliver with cells..."
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-end pt-8 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-6 py-2.5 rounded-xl text-[#526B91] bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={updateDraftMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-800 text-white text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    {updateDraftMutation.isPending ? "Saving..." : "Save Proposal Changes"}
                  </button>
                  {quotation.status === "PENDING_APPROVAL" && ["sales-executive", "admin", "superadmin"].includes(roleSlug) && (
                    <button 
                      type="button"
                      disabled={updateDraftMutation.isPending || approveMutation.isPending}
                      onClick={handleSaveAndApprove}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Save & Approve Proposal
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
