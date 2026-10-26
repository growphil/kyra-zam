"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import api, { getMediaUrl } from "@/lib/api";
import { 
  FileText, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Bookmark,
  MapPin,
  Archive,
  Download,
  Paperclip,
  ShieldCheck,
  Package,
  Layers,
  Phone,
  Mail,
  Receipt,
  FileCheck2,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const userRoles = ((session?.user as any)?.roles || []) as string[];
  const currentUserId = (session?.user as any)?.id;
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const isAdmin = userRoles.includes("ADMIN") || isSuperAdmin;
  const isPurchaseManager = userRoles.includes("PURCHASE_MANAGER");
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER");
  const canApprove = isAdmin;
  const canEdit = (isAdmin || isPurchaseManager);

  // Workflow Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectComments, setRejectComments] = useState("");

  // --- DATA FETCHING ---
  const { data: po, isLoading } = useQuery({
    queryKey: ["procurement-po-details", poId],
    queryFn: async () => (await api.get(`/crm/procurement/purchase-orders/${poId}`)).data
  });

  // --- MUTATIONS ---
  const submitForApprovalMutation = useMutation({
    mutationFn: () => api.put(`/crm/procurement/purchase-orders/${poId}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-details", poId] });
      toast.success("Purchase Order submitted for approval");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Submission failed")
  });

  const approveMutation = useMutation({
    mutationFn: (comments: string) => api.put(`/crm/procurement/purchase-orders/${poId}/approve`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-details", poId] });
      setIsApproveOpen(false);
      setApproveComments("");
      toast.success("Purchase Order successfully approved");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Approval failed")
  });

  const rejectMutation = useMutation({
    mutationFn: ({ reason, comments }: { reason: string; comments?: string }) => 
      api.put(`/crm/procurement/purchase-orders/${poId}/reject`, { reason, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-details", poId] });
      setIsRejectOpen(false);
      setRejectReason("");
      setRejectComments("");
      toast.success("Purchase Order rejected");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Rejection failed")
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/procurement/purchase-orders/${poId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-details", poId] });
      toast.success("Purchase Order status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Status update failed")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Purchase Order Not Found</p>
      </div>
    );
  }

  const isSelfCreated = po.createdById === currentUserId;
  const selfApprovalRestricted = isSelfCreated && !isSuperAdmin;

  return (
    <div className="space-y-6 text-[#0B2148] pb-12">
      
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders`)}
            className="flex items-center gap-2 text-[#526B91] hover:text-[#0B2148] font-bold text-xs bg-white border border-[#D8E8FA] px-3.5 py-2 rounded-xl transition-all shadow-sm hover:border-[#0878F9]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
          <div className="h-4 w-px bg-[#D8E8FA]" />
          <div>
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Purchase Order</span>
            <h1 className="text-xl font-bold font-mono text-[#0B2148]">{po.poNumber}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
            po.status === "RECEIVED" || po.status === "CLOSED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            po.status === "CANCELLED" || po.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
            po.status === "APPROVED" || po.status === "SENT" ? "bg-blue-50 text-[#0878F9] border-blue-200" :
            po.status === "PARTIALLY_RECEIVED" ? "bg-purple-50 text-purple-700 border-purple-200" :
            po.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700 border-amber-200" :
            "bg-slate-100 text-slate-700 border-slate-200"
          }`}>
            {po.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Overview & Actions */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Main Card */}
          <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-5">
            <div>
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Vendor Details</span>
              <div className="flex items-start gap-3 mt-2">
                <div className="w-10 h-10 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-center shrink-0 text-[#0878F9]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-[#0B2148] truncate">{po.vendor?.name}</h2>
                  <p className="text-xs text-[#526B91] font-mono mt-0.5">Code: {po.vendor?.code}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              {po.vendor?.email && (
                <div className="flex items-center gap-2 text-[#526B91]">
                  <Mail className="w-3.5 h-3.5 text-[#0878F9] shrink-0" />
                  <span className="truncate">{po.vendor.email}</span>
                </div>
              )}
              {po.vendor?.phone && (
                <div className="flex items-center gap-2 text-[#526B91]">
                  <Phone className="w-3.5 h-3.5 text-[#0878F9] shrink-0" />
                  <span>{po.vendor.phone}</span>
                </div>
              )}
              {po.vendor?.taxId && (
                <div className="flex items-center gap-2 text-[#526B91]">
                  <Receipt className="w-3.5 h-3.5 text-[#0878F9] shrink-0" />
                  <span className="font-mono">GSTIN: {po.vendor.taxId}</span>
                </div>
              )}
            </div>

            {/* References */}
            <div className="space-y-2 border-t border-[#D8E8FA] pt-4 text-xs">
              {po.quotationReference && (
                <div>
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Quotation Ref</span>
                  <p className="font-medium text-[#0B2148] mt-0.5 font-mono">{po.quotationReference}</p>
                </div>
              )}
              {po.projectRef && (
                <div>
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Project Ref</span>
                  <p className="font-medium text-[#0B2148] mt-0.5 font-mono">{po.projectRef}</p>
                </div>
              )}
              {po.purchaseRequest && (
                <div>
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Source PR</span>
                  <p className="font-medium text-[#0878F9] mt-0.5 font-mono flex items-center gap-1">
                    <Bookmark className="w-3 h-3" />
                    {po.purchaseRequest.prNumber}
                  </p>
                </div>
              )}
              {po.createdBy && (
                <div>
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Created By</span>
                  <p className="font-medium text-[#0B2148] mt-0.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-[#526B91]" />
                    {po.createdBy.name || po.createdBy.email}
                  </p>
                </div>
              )}
            </div>

            {/* Address Snapshots */}
            <div className="border-t border-[#D8E8FA] pt-4 space-y-3">
              <div>
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#0878F9]" />
                  Delivery Target Address
                </p>
                <p className="text-xs text-[#0B2148] mt-1 bg-[#F4F9FF] p-2.5 rounded-lg border border-[#D8E8FA]/60 leading-relaxed">
                  {po.deliveryAddress || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#526B91]" />
                  Billing Address
                </p>
                <p className="text-xs text-[#526B91] mt-1 bg-[#F4F9FF] p-2.5 rounded-lg border border-[#D8E8FA]/60 leading-relaxed">
                  {po.billingAddress || "N/A"}
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-xs border-t border-[#D8E8FA] pt-4">
              <div>
                <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Date Created</p>
                <p className="mt-0.5 text-[#0B2148] font-semibold">{new Date(po.orderDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Expected Delivery</p>
                <p className="mt-0.5 text-[#0878F9] font-bold">{new Date(po.expectedDeliveryDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
              Workflow Actions
            </h3>
            
            {po.status === "DRAFT" && canEdit && (
              <>
                <button 
                  onClick={() => submitForApprovalMutation.mutate()}
                  disabled={submitForApprovalMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0768D6] transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#0878F9]/20"
                >
                  {submitForApprovalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                  Submit for Internal Approval
                </button>
                <button 
                  onClick={() => updateStatusMutation.mutate("CANCELLED")}
                  disabled={updateStatusMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-bold transition-all"
                >
                  Cancel Order
                </button>
              </>
            )}

            {po.status === "PENDING_APPROVAL" && (
              <>
                {canApprove ? (
                  <>
                    {selfApprovalRestricted ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          Segregation of Duties
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-700">
                          You created this Purchase Order. Under company governance policy, an independent Administrator or Superadmin must approve it.
                        </p>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsApproveOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Approve Order
                      </button>
                    )}
                    <button 
                      onClick={() => setIsRejectOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-sm shadow-red-600/20"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Order
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-[#526B91] italic text-center py-2">
                    Pending approval from an authorized Administrator.
                  </p>
                )}
              </>
            )}

            {po.status === "APPROVED" && canEdit && (
              <button 
                onClick={() => updateStatusMutation.mutate("SENT")}
                disabled={updateStatusMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0768D6] transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as SENT to Vendor
              </button>
            )}

            {(po.status === "APPROVED" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") && (
              <button 
                onClick={() => router.push(`/${roleSlug}/procurement/goods-receipts?poId=${po.id}`)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20"
              >
                <Archive className="w-4 h-4" />
                Spawn Goods Receipt
              </button>
            )}

            {/* Invoices link */}
            {(po.status === "APPROVED" || po.status === "SENT" || po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") && (
              <button 
                onClick={() => router.push(`/${roleSlug}/procurement/purchase-invoices?poId=${po.id}`)}
                className="w-full py-2.5 rounded-xl bg-white border border-[#D8E8FA] hover:border-[#0878F9] text-[#0878F9] text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                Record Supplier Invoice
              </button>
            )}
          </div>

          {/* Attachments Card */}
          {po.attachments && po.attachments.length > 0 && (
            <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA] flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#0878F9]" />
                Attachments ({po.attachments.length})
              </h3>
              <div className="space-y-2">
                {po.attachments.map((att: any) => (
                  <div key={att.id} className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0B2148] truncate">{att.originalName}</p>
                      <p className="text-[10px] text-[#526B91] mt-0.5">
                        {(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
                      </p>
                    </div>
                    <a 
                      href={att.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 text-[#0878F9] hover:bg-white rounded-lg transition-all shrink-0"
                      title="Download / View"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval History Timeline */}
          {po.approvals && po.approvals.length > 0 && (
            <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0878F9]" />
                Approval History
              </h3>
              <div className="space-y-3 text-xs">
                {po.approvals.map((appr: any) => (
                  <div key={appr.id} className="p-3 rounded-xl border border-[#D8E8FA] bg-[#F4F9FF] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        appr.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                        appr.status === "REJECTED" ? "bg-red-100 text-red-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {appr.status}
                      </span>
                      <span className="text-[10px] text-[#526B91]">
                        {new Date(appr.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {appr.decidedBy && (
                      <p className="text-[11px] text-[#0B2148] font-medium">
                        Decided by: <span className="font-bold">{appr.decidedBy.name || appr.decidedBy.email}</span>
                      </p>
                    )}
                    {appr.comments && (
                      <p className="text-[11px] text-[#526B91] italic bg-white p-2 rounded-lg border border-[#D8E8FA]">
                        "{appr.comments}"
                      </p>
                    )}
                    {appr.reason && (
                      <p className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                        Reason: {appr.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column requested items list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0B2148]">Purchase Order Items</h3>
                <p className="text-xs text-[#526B91] mt-0.5">List of verified products and technical lines committed in this order</p>
              </div>
              <span className="text-xs font-bold text-[#0878F9] bg-[#F4F9FF] border border-[#D8E8FA] px-3 py-1 rounded-lg">
                {po.items?.length || 0} line items
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider text-[11px] bg-[#F4F9FF]">
                    <th className="py-3 px-3">Product / Specification</th>
                    <th className="py-3 px-2">Brand / Part No</th>
                    <th className="py-3 px-2 text-right">Ordered</th>
                    <th className="py-3 px-2 text-right">Received</th>
                    <th className="py-3 px-2 text-right text-[#0878F9]">Pending</th>
                    <th className="py-3 px-2 text-right">Unit Price</th>
                    <th className="py-3 px-2 text-right">Tax</th>
                    <th className="py-3 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC]">
                  {po.items?.map((item: any) => {
                    const displayName = item.product?.name || item.material?.name || item.description || "Custom Item";
                    const displayBrand = item.brand || item.product?.brand || "Generic";
                    const displayPartNo = item.partNumber || item.product?.partNumber || item.material?.sku || "N/A";
                    const displayUin = item.productUin || item.product?.uin;
                    const imgUrl = item.imageUrl || item.product?.imageUrl;

                    return (
                      <tr key={item.id} className="hover:bg-[#F4F9FF]/50 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-[#D8E8FA] overflow-hidden flex items-center justify-center shrink-0">
                              {imgUrl ? (
                                <img src={getMediaUrl(imgUrl)} alt={displayName} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#0B2148] leading-tight">{displayName}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {displayUin && (
                                  <span className="font-mono text-[9px] font-bold text-[#0878F9] bg-[#E8F1FC] px-1.5 py-0.5 rounded">
                                    {displayUin}
                                  </span>
                                )}
                                {(item as any).batchNumber ? (
                                  <span className="font-mono text-[9px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                    Batch: {(item as any).batchNumber}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                                    Pending at Receipt
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-2">
                          <p className="font-semibold text-[#0B2148]">{displayBrand}</p>
                          <p className="text-[10px] font-mono text-[#526B91]">{displayPartNo}</p>
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono font-semibold text-[#0B2148]">
                          {item.quantityOrdered}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono text-emerald-600 font-semibold">
                          {item.quantityReceived}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono font-bold text-[#0878F9]">
                          {item.quantityPending}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono text-[#0B2148]">
                          {po.currency} {Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono text-[#526B91]">
                          {item.taxRate}%
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-[#0B2148] font-mono">
                          {po.currency} {Number(item.lineTotal).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing calculations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
                Commercial & Delivery Terms
              </h4>
              <div className="space-y-3 text-xs text-[#0B2148]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Delivery Terms</p>
                  <p className="mt-0.5 font-semibold text-[#0B2148]">{po.deliveryTerms || "Standard Terms"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Payment Terms</p>
                  <p className="mt-0.5 font-semibold text-[#0B2148]">{po.paymentTerms || "Standard Net 30"}</p>
                </div>
                {po.notes && (
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Order Notes</p>
                    <p className="mt-0.5 text-[#526B91] leading-relaxed bg-[#F4F9FF] p-2.5 rounded-lg border border-[#D8E8FA]/60">
                      {po.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-[#D8E8FA] bg-white shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
                Financial Summary
              </h4>
              <div className="space-y-2.5 text-xs text-[#526B91]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold text-[#0B2148]">
                    {po.currency} {Number(po.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Discounts:</span>
                  <span className="font-mono text-emerald-600 font-semibold">
                    - {po.currency} {Number(po.discount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (GST):</span>
                  <span className="font-mono font-semibold text-[#0B2148]">
                    {po.currency} {Number(po.tax).toFixed(2)}
                  </span>
                </div>
                {Number(po.additionalCharges || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Shipping & Charges:</span>
                    <span className="font-mono font-semibold text-[#0B2148]">
                      {po.currency} {Number(po.additionalCharges).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-[#0B2148] pt-3 border-t border-[#D8E8FA]">
                  <span>Grand Total:</span>
                  <span className="font-mono text-[#0878F9] text-base">
                    {po.currency} {Number(po.grandTotal).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* APPROVE MODAL */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#D8E8FA] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#0B2148] text-base">Approve Purchase Order</h3>
                <p className="text-xs text-[#526B91]">PO #{po.poNumber}</p>
              </div>
            </div>

            <p className="text-xs text-[#526B91] leading-relaxed">
              Are you sure you want to approve this purchase order for <span className="font-bold text-[#0B2148]">{po.currency} {Number(po.grandTotal).toFixed(2)}</span>? Once approved, it will be authorized for vendor dispatch and goods receipts.
            </p>

            <div>
              <label className="text-[11px] font-bold text-[#0B2148] uppercase tracking-wider block mb-1">
                Approval Remarks (Optional)
              </label>
              <textarea 
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                placeholder="e.g. Budget verified against Q4 operational allocation"
                className="w-full p-3 rounded-xl border border-[#D8E8FA] text-xs focus:outline-none focus:border-[#0878F9] min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsApproveOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-[#F4F9FF]"
              >
                Cancel
              </button>
              <button 
                onClick={() => approveMutation.mutate(approveComments)}
                disabled={approveMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm shadow-emerald-600/20"
              >
                {approveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#D8E8FA] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-[#0B2148] text-base">Reject Purchase Order</h3>
                <p className="text-xs text-[#526B91]">PO #{po.poNumber}</p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#0B2148] uppercase tracking-wider block mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Unit price exceeds approved vendor quotation"
                className="w-full px-3 py-2 rounded-xl border border-[#D8E8FA] text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#0B2148] uppercase tracking-wider block mb-1">
                Additional Comments
              </label>
              <textarea 
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                placeholder="Details to help procurement team revise the purchase order"
                className="w-full p-3 rounded-xl border border-[#D8E8FA] text-xs focus:outline-none focus:border-red-500 min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsRejectOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-[#F4F9FF]"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!rejectReason.trim()) {
                    toast.error("Please provide a rejection reason");
                    return;
                  }
                  rejectMutation.mutate({ reason: rejectReason, comments: rejectComments });
                }}
                disabled={rejectMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm shadow-red-600/20"
              >
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
