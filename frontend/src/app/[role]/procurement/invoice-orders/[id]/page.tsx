"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import api, { getMediaUrl } from "@/lib/api";
import { toast } from "sonner";
import {
  FileCheck2,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Layers,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Boxes,
  Plus,
  Loader2,
  Send,
  Save,
  Trash2,
  Check,
  X,
  CreditCard,
  FileText,
  Upload,
  AlertCircle,
  ExternalLink,
  History,
  Info,
  Edit
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

interface VerificationLineInput {
  itemId: string;
  actualReceivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  batchNumber: string;
  serialNumber: string;
  warehouseId: string;
  warehouseLocationId: string;
  inspectionNotes: string;
}

export default function InvoiceOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const roleSlug = (params.role as string) || "admin";
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const userRoles = ((session?.user as any)?.roles || []) as string[];
  const currentUserId = (session?.user as any)?.id;
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const isAdmin = userRoles.includes("ADMIN") || isSuperAdmin;
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER") || roleSlug === "inventory-manager";
  const isAccountant = userRoles.includes("ACCOUNTANT") || isAdmin;

  // Tabs: "items" | "verification" | "approval" | "payments" | "documents" | "audit"
  const [activeTab, setActiveTab] = useState<"items" | "verification" | "payments" | "documents" | "audit">(
    isInventoryManager ? "verification" : "items"
  );

  // Verification State Form
  const [verificationInputs, setVerificationInputs] = useState<Record<string, VerificationLineInput>>({});
  const [verificationRemarks, setVerificationRemarks] = useState("");
  const [correctionRemarks, setCorrectionRemarks] = useState("");

  // Admin Approval / Rejection Dialog State
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Upload Document State
  const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);
  const [docTypeToUpload, setDocTypeToUpload] = useState("FINAL_TAX_INVOICE");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch IO Details
  const { data: io, isLoading, error } = useQuery({
    queryKey: ["procurement-io-detail", id],
    queryFn: async () => {
      const res = await api.get(`/crm/procurement/invoice-orders/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Fetch Warehouses & Locations for putaway
  const { data: warehouses } = useQuery({
    queryKey: ["inventory-warehouses-dropdown"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data || [],
  });

  // Initialize verification state when IO loads
  const initVerificationState = () => {
    if (!io?.items) return;
    const initialMap: Record<string, VerificationLineInput> = {};
    io.items.forEach((item: any) => {
      initialMap[item.id] = {
        itemId: item.id,
        actualReceivedQuantity: item.actualReceivedQuantity !== null && item.actualReceivedQuantity !== undefined ? item.actualReceivedQuantity : 0,
        acceptedQuantity: item.acceptedQuantity !== null && item.acceptedQuantity !== undefined ? item.acceptedQuantity : 0,
        rejectedQuantity: item.rejectedQuantity || 0,
        damagedQuantity: item.damagedQuantity || 0,
        batchNumber: item.batchNumber || "",
        serialNumber: item.serialNumber || "",
        warehouseId: item.warehouseId || warehouses?.[0]?.id || "",
        warehouseLocationId: item.warehouseLocationId || "",
        inspectionNotes: item.inspectionNotes || "",
      };
    });
    setVerificationInputs(initialMap);
  };

  // Submit Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: (isDraft: boolean) => {
      const itemsPayload = Object.values(verificationInputs);
      if (itemsPayload.length === 0) throw new Error("No items to verify");

      return api.post(`/crm/procurement/invoice-orders/${id}/verify`, {
        isDraft,
        remarks: verificationRemarks.trim() || undefined,
        items: itemsPayload,
      });
    },
    onSuccess: (_, isDraft) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success(
        isDraft ? "Verification draft saved" : "Physical verification submitted for Admin approval!"
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Verification submission failed");
    },
  });

  // Request Correction Mutation
  const correctionMutation = useMutation({
    mutationFn: (remarks: string) => {
      if (!remarks.trim()) throw new Error("Correction remarks are required");
      return api.post(`/crm/procurement/invoice-orders/${id}/request-correction`, {
        remarks: remarks.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success("Correction requested from creator");
      setIsCorrectionOpen(false);
      setCorrectionRemarks("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Correction request failed");
    },
  });

  // Admin Approve Mutation
  const approveMutation = useMutation({
    mutationFn: () => {
      return api.post(`/crm/procurement/invoice-orders/${id}/approve`, {
        remarks: approvalRemarks.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success("Invoice Order APPROVED by Administrator!");
      setIsApproveOpen(false);
      setApprovalRemarks("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Approval failed");
    },
  });

  // Admin Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!rejectionReason.trim()) throw new Error("Rejection reason is required");
      return api.post(`/crm/procurement/invoice-orders/${id}/reject`, {
        reason: rejectionReason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success("Invoice Order REJECTED");
      setIsRejectOpen(false);
      setRejectionReason("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Rejection failed");
    },
  });

  // Centralized Stock Posting Mutation
  const postStockMutation = useMutation({
    mutationFn: () => {
      return api.post(`/crm/procurement/invoice-orders/${id}/post-stock`, {});
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-materials"] });
      toast.success("Stock posted successfully! Inventory balances and movements ledger updated.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Stock posting failed");
    },
  });

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: () => {
      if (paymentAmount <= 0) throw new Error("Payment amount must be greater than 0");
      return api.post(`/crm/procurement/invoice-orders/${id}/payments`, {
        amount: Number(paymentAmount),
        paymentMethod,
        paymentReference: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success("Payment recorded successfully!");
      setIsPaymentOpen(false);
      setPaymentAmount(0);
      setPaymentRef("");
      setPaymentNotes("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Payment recording failed");
    },
  });

  // Upload Document Handler
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/crm/procurement/products/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.url) {
        await api.post(`/crm/procurement/invoice-orders/${id}/documents`, {
          documentType: docTypeToUpload,
          fileName: file.name,
          fileReference: res.data.url,
          fileSize: file.size,
          fileType: file.type,
        });

        queryClient.invalidateQueries({ queryKey: ["procurement-io-detail", id] });
        toast.success(`Attached ${file.name} to Invoice Order`);
        setIsDocUploadOpen(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
        <span className="text-xs text-[#526B91]">Loading Invoice Order details...</span>
      </div>
    );
  }

  if (error || !io) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <div className="text-sm font-bold text-[#0B2148]">Invoice Order not found</div>
        <button
          onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders`)}
          className="px-3 py-1.5 bg-[#0878F9] text-white rounded-xl text-xs font-semibold"
        >
          Return to Registry
        </button>
      </div>
    );
  }

  const isCreator = io.createdById === currentUserId;
  const canAdminApprove = isAdmin && !isCreator && ["INVENTORY_VERIFIED", "PENDING_ADMIN_APPROVAL"].includes(io.status);
  const canVerify = (isInventoryManager || isAdmin) && ["PENDING_INVENTORY", "DRAFT", "CORRECTION_REQUIRED", "PENDING_ADMIN_APPROVAL"].includes(io.status);
  const canPostStock = (isAdmin || isInventoryManager) && ["APPROVED", "READY_TO_STOCK", "QC_PENDING", "PARTIALLY_ACCEPTED"].includes(io.status);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title={`Invoice Order ${io.ioNumber}`}
        description={`Supplier Invoice: ${io.supplierInvoiceNumber} | PO: ${io.purchaseOrder?.poNumber} | Vendor: ${io.vendor?.name}`}
        icon={<FileCheck2 className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Procurement", href: `/${roleSlug}/procurement/purchase-orders` },
          { label: "Invoice Orders", href: `/${roleSlug}/procurement/invoice-orders` },
          { label: io.ioNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders${isInventoryManager ? "/verification" : ""}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D8E8FA] hover:bg-slate-50 text-[#526B91] rounded-xl text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {isInventoryManager ? "Receiving Queue" : "List"}</span>
            </button>

            {/* Edit Draft Button */}
            {["DRAFT", "CORRECTION_REQUIRED"].includes(io.status) && (
              <button
                onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/create?edit=${io.id}`)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                title="Edit and modify draft invoice order"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Draft Order</span>
              </button>
            )}

            {/* Quick Action: Stock Posting Button */}
            {canPostStock && (
              <button
                disabled={postStockMutation.isPending}
                onClick={() => postStockMutation.mutate()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {postStockMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />}
                <span>Post Stock to Inventory</span>
              </button>
            )}

            {/* Quick Action: Admin Approve / Reject */}
            {canAdminApprove && (
              <>
                <button
                  onClick={() => setIsApproveOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0878F9] hover:bg-[#0766D0] text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Authorize & Approve</span>
                </button>
                <button
                  onClick={() => setIsRejectOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>Reject</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Top Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status & Timing */}
        <div className="p-4 rounded-2xl border border-[#D8E8FA] bg-white space-y-2">
          <div className="text-[11px] font-semibold text-[#526B91]">Workflow Status</div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/30">
              {io.status}
            </span>
            <span className="text-[10px] text-[#526B91] font-mono">
              {io.invoiceType}
            </span>
          </div>
          <div className="text-[10px] text-[#526B91] pt-1 border-t border-slate-100">
            Created: {new Date(io.createdAt).toLocaleString()} by <span className="font-semibold text-[#0B2148]">{io.createdBy?.name}</span>
          </div>
        </div>

        {/* Commercials */}
        <div className="p-4 rounded-2xl border border-[#D8E8FA] bg-white space-y-2">
          <div className="text-[11px] font-semibold text-[#526B91]">Grand Total</div>
          <div className="text-xl font-bold font-mono text-[#0B2148]">
            {io.currency} {Number(io.grandTotal).toLocaleString()}
          </div>
          <div className="text-[10px] text-[#526B91] flex justify-between">
            <span>Subtotal: ₹{Number(io.subtotal).toLocaleString()}</span>
            <span>Tax: ₹{Number(io.tax).toLocaleString()}</span>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="p-4 rounded-2xl border border-[#D8E8FA] bg-white space-y-2">
          <div className="text-[11px] font-semibold text-[#526B91] flex items-center justify-between">
            <span>Payment Tracking</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              io.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}>
              {io.paymentStatus}
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-emerald-700">
            Paid: {io.currency} {Number(io.paidAmount).toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-600 font-mono">
            Outstanding: {io.currency} {Number(io.outstandingAmount).toLocaleString()}
          </div>
        </div>

        {/* Traceability: PO & GRN */}
        <div className="p-4 rounded-2xl border border-[#D8E8FA] bg-white space-y-2">
          <div className="text-[11px] font-semibold text-[#526B91]">Traceability Links</div>
          <div className="text-xs font-semibold text-[#0B2148]">
            PO: <span className="font-mono text-[#0878F9]">{io.purchaseOrder?.poNumber}</span>
          </div>
          <div className="text-xs text-[#526B91]">
            GRN: {io.goodsReceipt ? (
              <span className="font-mono font-bold text-emerald-700">{io.goodsReceipt.grnNumber} ({io.goodsReceipt.status})</span>
            ) : (
              <span className="text-slate-400">Created upon authorization</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[#D8E8FA] pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("items")}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            activeTab === "items" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:bg-slate-100"
          }`}
        >
          Invoice Line Items ({io.items?.length || 0})
        </button>

        <button
          onClick={() => {
            setActiveTab("verification");
            initVerificationState();
          }}
          className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
            activeTab === "verification" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:bg-slate-100"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Physical Verification Workbench</span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
            activeTab === "payments" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:bg-slate-100"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Payments ({io.payments?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
            activeTab === "documents" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:bg-slate-100"
          }`}
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Documents & Proofs ({io.documents?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
            activeTab === "audit" ? "bg-[#0878F9] text-white" : "text-[#526B91] hover:bg-slate-100"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Log ({io.auditLogs?.length || 0})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: INVOICE LINE ITEMS */}
      {activeTab === "items" && (
        <div className="rounded-2xl border border-[#D8E8FA] bg-white overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              <span>Invoiced Materials & Received Quantities</span>
            </h3>
            <span className="text-xs text-[#526B91]">
              Supplier Commercial Invoice #{io.supplierInvoiceNumber}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] bg-[#F8FAFC] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Material SKU / Description</th>
                  <th className="py-2.5 px-3 text-center">Invoiced Qty</th>
                  <th className="py-2.5 px-3 text-center">Actual Recv</th>
                  <th className="py-2.5 px-3 text-center">Accepted</th>
                  <th className="py-2.5 px-3 text-center">Rejected</th>
                  <th className="py-2.5 px-3 text-center">Damaged</th>
                  <th className="py-2.5 px-3 text-center">Shortage</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC]">
                {io.items.map((line: any) => (
                  <tr key={line.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#0B2148]">
                        {line.product?.name || line.material?.name || line.description}
                      </div>
                      <div className="text-[10px] text-[#526B91] flex items-center gap-2 mt-0.5">
                        {line.product?.partNumber && <span>Part: {line.product.partNumber}</span>}
                        {line.material?.sku && <span className="font-mono">SKU: {line.material.sku}</span>}
                        {line.batchNumber && <span className="font-mono bg-slate-100 px-1 rounded">Batch: {line.batchNumber}</span>}
                        <span className={`px-1 py-0.2 rounded font-bold ${
                          line.material?.materialType === "QTZ" ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {line.material?.materialType || "NQZ"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-bold font-mono">
                      {line.invoiceQuantity} {line.unit}
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-semibold text-[#0B2148]">
                      {line.actualReceivedQuantity}
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                      {line.acceptedQuantity}
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-red-600">
                      {line.rejectedQuantity}
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-amber-600">
                      {line.damagedQuantity}
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      {line.shortageQuantity > 0 ? (
                        <span className="text-red-600 font-bold">-{line.shortageQuantity}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      ₹{Number(line.unitPrice).toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-[#0B2148]">
                      ₹{Number(line.lineTotal).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PHYSICAL VERIFICATION WORKBENCH (INV VERIFY) */}
      {activeTab === "verification" && (() => {
        // Calculate match status across all lines
        const lineMatchStates = (io.items || []).map((line: any) => {
          const curr = verificationInputs[line.id] || {
            actualReceivedQuantity: line.actualReceivedQuantity ?? 0,
          };
          const entered = Number(curr.actualReceivedQuantity || 0);
          const expected = Number(line.invoiceQuantity);
          const hasCount = entered > 0;
          const isMatch = hasCount && entered === expected;
          return { lineId: line.id, entered, expected, hasCount, isMatch };
        });

        const allLinesMatch = lineMatchStates.length > 0 && lineMatchStates.every((s: any) => s.isMatch);
        const hasAnyMismatch = lineMatchStates.some((s: any) => s.hasCount && !s.isMatch);
        const hasPendingCounts = lineMatchStates.some((s: any) => !s.hasCount);

        return (
          <div className="space-y-5">
            {/* 1. Admin Uploaded Supplier Tax Invoice & Details Card */}
            <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E8FA] pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4F9FF] border border-[#D8E8FA] text-[#0878F9]">
                      Admin Registered Invoice
                    </span>
                    <span className="text-xs font-mono font-bold text-[#0B2148]">
                      #{io.supplierInvoiceNumber}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0B2148]">
                    {io.vendor?.name || "Vendor Name"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#526B91]">
                    <span>Invoice Date: <strong className="text-[#0B2148]">{io.invoiceDate}</strong></span>
                    <span>•</span>
                    <span>Order: <strong className="text-[#0878F9]">{io.purchaseOrder ? `PO #${io.purchaseOrder.poNumber}` : "⚡ Direct Invoice Order"}</strong></span>
                    <span>•</span>
                    <span>Registered By: <strong className="text-[#0B2148]">{io.createdBy?.name || "Admin"}</strong></span>
                  </div>
                </div>

                {/* Uploaded Invoice Document Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {io.documents && io.documents.length > 0 ? (
                    io.documents.map((doc: any, dIdx: number) => (
                      <a
                        key={dIdx}
                        href={getMediaUrl(doc.fileReference)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                        title="Open admin-uploaded supplier invoice"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View Admin Uploaded Invoice ({doc.fileName})</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-dashed border-[#D8E8FA]">
                      No digital file attached by Admin
                    </div>
                  )}
                </div>
              </div>

              {/* Blind Verification Guidance Banner */}
              <div className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-start gap-3 text-xs">
                <ShieldCheck className="w-5 h-5 text-[#0878F9] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-[#0B2148]">Blind Physical Count Protocol</div>
                  <p className="text-[#526B91] leading-relaxed">
                    Count the physical materials received at the gate. Enter the exact count for each product.
                    <strong className="text-[#0B2148]"> The physical count must match the Admin's registered invoice quantity. If there is a mismatch, inward verification is blocked.</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Physical Count Verification Table */}
            <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D8E8FA] pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                    <Boxes className="w-4 h-4" />
                    <span>Product Physical Count & Inward Verification ({io.items?.length || 0} Items)</span>
                  </h3>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Product identity and brand are shown. Enter counted physical quantity manually.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                    allLinesMatch
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : hasAnyMismatch
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-[#F4F9FF] text-[#0878F9] border-[#D8E8FA]"
                  }`}>
                    {allLinesMatch
                      ? "✓ All Quantities Matched"
                      : hasAnyMismatch
                      ? "❌ Quantity Mismatch Detected"
                      : "Pending Counts..."}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8E8FA] bg-[#F8FAFC] text-[#526B91] font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 w-[30%]">Product Name</th>
                      <th className="py-2.5 px-3 w-[20%]">Brand / Identity</th>
                      <th className="py-2.5 px-2 text-center w-[8%]">Unit</th>
                      <th className="py-2.5 px-2 w-[16%]">Batch #</th>
                      <th className="py-2.5 px-2 text-center w-[14%]">Counted Qty *</th>
                      <th className="py-2.5 px-3 text-center w-[12%]">Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8F1FC]">
                    {io.items.map((line: any) => {
                      const curr = verificationInputs[line.id] || {
                        itemId: line.id,
                        actualReceivedQuantity: line.actualReceivedQuantity ?? 0,
                        acceptedQuantity: line.actualReceivedQuantity ?? 0,
                        rejectedQuantity: 0,
                        damagedQuantity: 0,
                        batchNumber: line.batchNumber || "",
                        serialNumber: line.serialNumber || "",
                        warehouseId: line.warehouseId || warehouses?.[0]?.id || "",
                        warehouseLocationId: line.warehouseLocationId || "",
                        inspectionNotes: line.inspectionNotes || "",
                      };

                      const enteredQty = Number(curr.actualReceivedQuantity || 0);
                      const expectedQty = Number(line.invoiceQuantity);
                      const isCounted = enteredQty > 0;
                      const isMatched = isCounted && enteredQty === expectedQty;
                      const isMismatched = isCounted && enteredQty !== expectedQty;

                      return (
                        <tr key={line.id} className="hover:bg-[#F8FAFC] transition-colors">
                          {/* 1. Product Name */}
                          <td className="py-3 px-3 align-middle">
                            <div className="font-bold text-[#0B2148] text-xs">
                              {line.product?.name || line.description}
                            </div>
                            {line.specification && (
                              <div className="text-[10px] text-[#526B91] truncate max-w-xs mt-0.5">
                                {line.specification}
                              </div>
                            )}
                          </td>

                          {/* 2. Brand / Identity */}
                          <td className="py-3 px-3 align-middle">
                            <div className="font-semibold text-slate-800 text-xs">
                              {line.product?.brand || line.brand || "Standard Brand"}
                            </div>
                            <div className="text-[10px] text-[#526B91] font-mono mt-0.5">
                              {line.product?.category || line.category || "General"}
                            </div>
                          </td>

                          {/* 3. Unit */}
                          <td className="py-3 px-2 align-middle text-center font-bold text-slate-700">
                            {line.unit || "PCS"}
                          </td>

                          {/* 4. Batch Number */}
                          <td className="py-3 px-2 align-middle">
                            <input
                              type="text"
                              disabled={!canVerify}
                              value={curr.batchNumber || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVerificationInputs((prev) => ({
                                  ...prev,
                                  [line.id]: { ...curr, batchNumber: val },
                                }));
                              }}
                              placeholder="Lot / Batch #"
                              className="w-full px-2 py-1.5 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-lg font-mono focus:bg-white focus:border-[#0878F9] focus:outline-none"
                            />
                          </td>

                          {/* 5. Counted Quantity (Manual Entry) */}
                          <td className="py-3 px-2 align-middle text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={!canVerify}
                              value={curr.actualReceivedQuantity === 0 ? "" : curr.actualReceivedQuantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setVerificationInputs((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    ...curr,
                                    actualReceivedQuantity: val,
                                    acceptedQuantity: val,
                                    rejectedQuantity: 0,
                                    damagedQuantity: 0,
                                  },
                                }));
                              }}
                              placeholder="0"
                              className={`w-24 px-2.5 py-1.5 text-center font-mono font-bold text-xs rounded-lg border ${
                                isMatched
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 focus:bg-white"
                                  : isMismatched
                                  ? "bg-red-50 border-red-300 text-red-800 focus:bg-white"
                                  : "bg-[#F8FAFC] border-[#D8E8FA] text-[#0B2148] focus:bg-white focus:border-[#0878F9]"
                              } focus:outline-none`}
                            />
                          </td>

                          {/* 6. Match Status */}
                          <td className="py-3 px-3 align-middle text-center">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Matched</span>
                              </span>
                            ) : isMismatched ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold text-[10px]">
                                <X className="w-3.5 h-3.5 text-red-600" />
                                <span>Mismatch</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono italic">
                                Pending Count
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Status Warning / Success Banners */}
              {hasAnyMismatch && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Quantity Mismatch Detected — Inward Blocked:</strong>
                    <p className="text-[11px] text-red-700 mt-0.5">
                      The physical count you entered does not match the Admin registered invoice quantity on one or more items.
                      You cannot verify inward until the counts match or you request a correction from Admin.
                    </p>
                  </div>
                </div>
              )}

              {hasPendingCounts && !hasAnyMismatch && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Please count all items and enter their physical quantity to verify inward.</span>
                </div>
              )}

              {allLinesMatch && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">
                    ✓ All physical counts match the Admin invoice! You are authorized to verify inward stock.
                  </span>
                </div>
              )}

              {/* Verification Remarks Input */}
              {canVerify && (
                <div className="pt-3 border-t border-[#D8E8FA] space-y-1">
                  <label className="block text-[11px] font-semibold text-[#0B2148]">
                    Inward Verification Log Notes / Warehouse Remarks:
                  </label>
                  <textarea
                    value={verificationRemarks}
                    onChange={(e) => setVerificationRemarks(e.target.value)}
                    rows={2}
                    placeholder="Log gate check details, delivery seal numbers, vehicle info, physical condition..."
                    className="w-full p-2.5 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:bg-white focus:border-[#0878F9] focus:outline-none"
                  />
                </div>
              )}

              {/* Action Buttons */}
              {canVerify && (
                <div className="pt-3 border-t border-[#D8E8FA] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCorrectionOpen(true)}
                      className="px-3.5 py-2 bg-amber-50 text-amber-700 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer"
                    >
                      Request Correction from Admin
                    </button>
                    <button
                      type="button"
                      disabled={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate(true)}
                      className="px-3.5 py-2 bg-white border border-[#D8E8FA] text-[#0B2148] rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Save Draft
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!allLinesMatch || verifyMutation.isPending}
                    onClick={() => {
                      if (!allLinesMatch) {
                        toast.error("Physical count must match Admin invoice quantity on all items to verify inward.");
                        return;
                      }
                      verifyMutation.mutate(false);
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      allLinesMatch && !verifyMutation.isPending
                        ? "bg-[#0878F9] hover:bg-[#0667DB] text-white cursor-pointer"
                        : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60"
                    }`}
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>Verify Inward Stock (All Matched)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB CONTENT 3: PAYMENTS & FINANCIALS */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span>Supplier Payments & Financial Reconciliation</span>
              </h3>
              <p className="text-xs text-[#526B91]">
                Total: {io.currency} {Number(io.grandTotal).toLocaleString()} | Paid: {io.currency} {Number(io.paidAmount).toLocaleString()} | Outstanding: {io.currency} {Number(io.outstandingAmount).toLocaleString()}
              </p>
            </div>

            {isAccountant && (
              <button
                onClick={() => {
                  setPaymentAmount(Number(io.outstandingAmount) || 0);
                  setIsPaymentOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0878F9] text-white rounded-xl text-xs font-semibold hover:bg-[#0766D0] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}
          </div>

          {io.payments?.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#526B91]">
              No payments recorded against this invoice yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D8E8FA] bg-[#F8FAFC] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference / UTR</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC]">
                  {io.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-mono">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        ₹{Number(p.amount).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {p.paymentMethod}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#0878F9]">
                        {p.paymentReference || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-[#526B91]">
                        {p.recordedBy?.name}
                      </td>
                      <td className="py-2.5 px-3 text-[#526B91]">
                        {p.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: DOCUMENTS & ATTACHMENTS */}
      {activeTab === "documents" && (
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5">
                <Paperclip className="w-4 h-4" />
                <span>Invoice Documents & Commercial Proofs</span>
              </h3>
              <p className="text-xs text-[#526B91]">
                Proforma Invoices, Final Tax Invoices, Delivery Challans, and Gate Inspection Photos
              </p>
            </div>

            <button
              onClick={() => setIsDocUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0878F9] text-white rounded-xl text-xs font-semibold hover:bg-[#0766D0] transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Attach Document</span>
            </button>
          </div>

          {io.documents?.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#526B91]">
              No documents attached yet. Click "Attach Document" to upload vendor invoice or challan.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {io.documents.map((doc: any) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl border border-[#D8E8FA] bg-slate-50 flex items-center justify-between text-xs hover:border-[#0878F9] transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF5FF] flex items-center justify-center shrink-0 text-[#0878F9]">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-[#0B2148] truncate">{doc.fileName}</div>
                      <div className="text-[10px] text-[#526B91]">
                        {doc.documentType} | {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <a
                    href={getMediaUrl(doc.fileReference)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-[#EAF5FF] text-[#0878F9] rounded-lg transition-colors ml-2 shrink-0"
                    title="View Document"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 5: AUDIT LOG */}
      {activeTab === "audit" && (
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0878F9] flex items-center gap-1.5 border-b border-[#D8E8FA] pb-3">
            <History className="w-4 h-4" />
            <span>Immutable Audit Trail & Action History</span>
          </h3>

          <div className="space-y-3">
            {(io.auditLogs || []).map((log: any) => (
              <div key={log.id} className="p-3 rounded-xl border border-[#D8E8FA] bg-[#F8FAFC] flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-[#0B2148] font-mono">{log.action}</div>
                  <div className="text-[11px] text-[#526B91] mt-0.5">
                    Actor: <span className="font-semibold text-[#0B2148]">{log.actor?.name}</span> ({log.actor?.email})
                  </div>
                  {log.metadata && (
                    <pre className="text-[10px] text-slate-600 bg-white p-2 rounded border border-[#D8E8FA] mt-1.5 overflow-x-auto max-w-xl">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="text-[10px] text-[#526B91] font-mono shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: ADMIN APPROVE CONFIRMATION */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D8E8FA] shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <span>Authorize & Approve Invoice Order</span>
            </h3>
            <p className="text-xs text-[#526B91]">
              Authorizing IO <span className="font-bold text-[#0B2148]">{io.ioNumber}</span>. This will approve physical counts and generate Goods Receipt Notes. If components require Quality Threshold inspection (QTZ), they will be quarantined under QC_PENDING.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                Approval Remarks (Optional):
              </label>
              <textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                rows={2}
                placeholder="Authorization notes..."
                className="w-full p-2 text-xs border border-[#D8E8FA] rounded-xl text-[#0B2148]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsApproveOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                className="px-4 py-1.5 bg-[#0878F9] hover:bg-[#0766D0] text-white rounded-xl text-xs font-bold"
              >
                {approveMutation.isPending ? "Authorizing..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT CONFIRMATION */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
              <X className="w-5 h-5" />
              <span>Reject Invoice Order</span>
            </h3>
            <p className="text-xs text-[#526B91]">
              Rejecting this Invoice Order will prevent goods inwarding and require re-submission.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                Rejection Reason <span className="text-red-500">*</span>:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Specify reason for rejection..."
                className="w-full p-2 text-xs border border-red-200 rounded-xl text-[#0B2148]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                onClick={() => rejectMutation.mutate()}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CORRECTION REQUEST */}
      {isCorrectionOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Request Correction</span>
            </h3>
            <p className="text-xs text-[#526B91]">
              Route this IO back to the creator for quantity or document adjustments.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                Correction Instructions <span className="text-red-500">*</span>:
              </label>
              <textarea
                value={correctionRemarks}
                onChange={(e) => setCorrectionRemarks(e.target.value)}
                rows={3}
                placeholder="Explain what corrections are needed..."
                className="w-full p-2 text-xs border border-amber-300 rounded-xl text-[#0B2148]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCorrectionOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={correctionMutation.isPending || !correctionRemarks.trim()}
                onClick={() => correctionMutation.mutate(correctionRemarks)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {correctionMutation.isPending ? "Submitting..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD PAYMENT */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D8E8FA] shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#0878F9]" />
              <span>Record Supplier Payment</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                  Payment Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                  Reference / UTR / Cheque #
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UTR-2026-904128"
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                  Notes:
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Advance payment / 2nd milestone"
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recordPaymentMutation.isPending || paymentAmount <= 0}
                onClick={() => recordPaymentMutation.mutate()}
                className="px-4 py-1.5 bg-[#0878F9] hover:bg-[#0766D0] text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DOCUMENT UPLOAD */}
      {isDocUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#D8E8FA] shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#0878F9]" />
              <span>Attach Invoice Document</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                  Document Classification:
                </label>
                <select
                  value={docTypeToUpload}
                  onChange={(e) => setDocTypeToUpload(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl"
                >
                  <option value="FINAL_TAX_INVOICE">Final Tax Invoice (Commercial Bill)</option>
                  <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                  <option value="DELIVERY_CHALLAN">Delivery Challan / Lorry Receipt</option>
                  <option value="PHOTOGRAPH">Gate Inspection Photograph</option>
                  <option value="OTHER">Other Proof</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0B2148] mb-1">
                  Select File:
                </label>
                <input
                  type="file"
                  onChange={handleDocUpload}
                  disabled={isUploading}
                  className="w-full text-xs text-[#526B91] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#EAF5FF] file:text-[#0878F9] hover:file:bg-[#D8E8FA]"
                />
              </div>

              {isUploading && (
                <div className="flex items-center gap-2 text-xs text-[#0878F9]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading file to secure storage...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDocUploadOpen(false)}
                className="px-3 py-1.5 text-xs text-[#526B91] hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

