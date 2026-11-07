"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import api from "@/lib/api";
import { 
  ClipboardList, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  Check,
  X,
  FileText,
  ShieldCheck,
  RotateCcw,
  Boxes,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const prId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const userRoles = ((session?.user as any)?.roles || []) as string[];
  const currentUserId = (session?.user as any)?.id;
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const isAdmin = userRoles.includes("ADMIN") || isSuperAdmin;

  // Workflow Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  const [correctionRemarks, setCorrectionRemarks] = useState("");

  // --- DATA FETCHING ---
  const { data: pr, isLoading } = useQuery({
    queryKey: ["procurement-pr-details", prId],
    queryFn: async () => (await api.get(`/crm/procurement/purchase-requests/${prId}`)).data
  });

  // --- MUTATIONS ---
  const submitPRMutation = useMutation({
    mutationFn: () => api.put(`/crm/procurement/purchase-requests/${prId}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details", prId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-list"] });
      toast.success("Purchase Request submitted for internal approval");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Submission failed")
  });

  const approvePRMutation = useMutation({
    mutationFn: (comments: string) => api.put(`/crm/procurement/purchase-requests/${prId}/approve`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details", prId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-list"] });
      toast.success("Purchase Request APPROVED");
      setIsApproveOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Approval failed")
  });

  const rejectPRMutation = useMutation({
    mutationFn: (data: { reason: string; comments: string }) => api.put(`/crm/procurement/purchase-requests/${prId}/reject`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details", prId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-list"] });
      toast.success("Purchase Request REJECTED");
      setIsRejectOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Rejection failed")
  });

  const returnCorrectionMutation = useMutation({
    mutationFn: (comments: string) => api.put(`/crm/procurement/purchase-requests/${prId}/request-correction`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details", prId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-list"] });
      toast.success("Purchase Request returned for correction");
      setIsCorrectionOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to return for correction")
  });

  const cancelPRMutation = useMutation({
    mutationFn: () => api.put(`/crm/procurement/purchase-requests/${prId}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details", prId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-list"] });
      toast.success("Purchase Request cancelled");
    },
    onError: (err: any) => toast.error("Cancellation failed")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-[#0878F9] animate-spin" />
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Purchase Request File Not Found</p>
      </div>
    );
  }

  const isCreator = pr.requestedById === currentUserId;
  const selfApprovalRestricted = isCreator && !isSuperAdmin;
  const isCorrectionRequired = pr.notes && pr.notes.includes("[CORRECTION_REQUIRED]");

  return (
    <div className="space-y-4 text-[#0B2148] pb-12">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/procurement/purchase-requests`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-[#0B2148] font-bold text-xs bg-white border border-[#D8E8FA] px-3.5 py-2 rounded-xl transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Requests
        </button>
      </div>

      {/* Correction Notice Banner */}
      {isCorrectionRequired && pr.status === "DRAFT" && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 shadow-xs">
          <RotateCcw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold uppercase tracking-wider text-amber-800">Action Required: Correction Requested by Approver</span>
            <p className="leading-relaxed">{pr.notes.replace("[CORRECTION_REQUIRED]:", "").trim()}</p>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white shadow-xs space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Indent ID</span>
                <h2 className="text-2xl font-bold text-[#0B2148] mt-0.5 font-mono">{pr.prNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                pr.status === "COMPLETED" || pr.status === "ORDERED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                pr.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                pr.status === "APPROVED" ? "bg-teal-50 text-teal-700 border-teal-200" :
                pr.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-slate-100 text-slate-700 border-slate-200"
              }`}>
                {pr.status}
              </span>
            </div>

            <div className="space-y-4 text-xs text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-[#0878F9] mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">{pr.requestedBy?.name || "Employee"}</p>
                  <p className="text-[11px] text-[#526B91]">{pr.requestedBy?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Source Channel</p>
                  <p className="mt-0.5 text-[#0B2148] font-semibold">{pr.source}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Priority</p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                    pr.priority === "URGENT" ? "bg-red-100 text-red-700" :
                    pr.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {pr.priority}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs border-t border-[#D8E8FA] pt-3">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Date Created</p>
                  <p className="mt-0.5 text-[#0B2148] font-semibold">{new Date(pr.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Target Delivery Date</p>
                  <p className="mt-0.5 text-[#0878F9] font-bold">{new Date(pr.requiredDate).toLocaleDateString()}</p>
                </div>
              </div>

              {pr.reason && (
                <div className="border-t border-[#D8E8FA] pt-3">
                  <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Purchase Justification</p>
                  <p className="text-xs text-[#0B2148] mt-1 bg-[#F4F9FF] p-2.5 rounded-xl border border-[#D8E8FA]/60 leading-relaxed">
                    {pr.reason}
                  </p>
                </div>
              )}

              <div className="border-t border-[#D8E8FA] pt-3">
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Product Identification Standard</p>
                <div className="mt-1 flex items-center justify-between text-xs bg-[#F4F9FF] p-2.5 rounded-xl border border-[#D8E8FA]">
                  <span className="font-mono font-bold text-[#0878F9]">Part-Number Based</span>
                  <span className="text-[10px] text-[#526B91] font-semibold">No UIN at PR stage</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
              Workflow Actions
            </h3>
            
            {pr.status === "DRAFT" && (
              <>
                <button 
                  onClick={() => submitPRMutation.mutate()}
                  disabled={submitPRMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0768D6] transition-all shadow-xs"
                >
                  Submit for Internal Approval
                </button>
                <button 
                  onClick={() => cancelPRMutation.mutate()}
                  disabled={cancelPRMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-bold transition-all"
                >
                  Cancel Request
                </button>
              </>
            )}

            {pr.status === "PENDING_APPROVAL" && (
              <>
                {selfApprovalRestricted ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      Segregation of Duties
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-700">
                      You created this Purchase Request. Under company governance policy, an independent Administrator or Superadmin must approve it.
                    </p>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => setIsApproveOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Approve Request
                    </button>
                    <button 
                      onClick={() => setIsCorrectionOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Return for Correction
                    </button>
                    <button 
                      onClick={() => setIsRejectOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all shadow-xs"
                    >
                      Reject Request
                    </button>
                  </>
                )}
              </>
            )}

            {pr.status === "APPROVED" && (
              <button 
                onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders/create?prId=${pr.id}`)}
                className="w-full py-2.5 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0768D6] transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <FileText className="w-4 h-4" />
                Generate Purchase Order
              </button>
            )}

            {pr.status === "ORDERED" && (
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-center text-xs font-bold">
                PR converted to Purchase Order
              </div>
            )}
          </div>
        </div>

        {/* Right Column requested items list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
              <div>
                <h3 className="text-sm font-bold text-[#0B2148] flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#0878F9]" />
                  Requested Part Number Items ({pr.items?.length || 0})
                </h3>
                <p className="text-[11px] text-[#526B91] mt-0.5">
                  Products are tracked by <strong>Internal Part Number (P/N)</strong>. Commercial vendor UINs are assigned when converted to a PO.
                </p>
              </div>
              <span className="text-[10px] font-bold text-[#0878F9] bg-[#EAF5FF] border border-[#BFDBFE] px-2.5 py-1 rounded-lg">
                Part-Number Indent
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Part Number (P/N) & Description</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Live Stock</th>
                    <th className="pb-3">Qty Requested</th>
                    <th className="pb-3">Required Target Date</th>
                    <th className="pb-3">Specification / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                  {pr.items?.map((item: any) => {
                    const currentStock = Number(item.material?.quantity ?? 0);
                    const isLow = currentStock < Number(item.requestedQuantity);
                    return (
                      <tr key={item.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3.5 pr-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-xs text-[#0878F9] bg-[#EAF5FF] px-2.5 py-0.5 rounded border border-[#BFDBFE]">
                              Part #: {item.material?.sku || "P/N"}
                            </span>
                          </div>
                          <div className="font-bold text-[#0B2148] text-xs">{item.material?.name || "Raw Material Component"}</div>
                          {item.material?.description && item.material.description !== item.material.name && (
                            <div className="text-[11px] text-[#526B91] mt-0.5 line-clamp-1">{item.material.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 text-[#526B91] font-medium">{item.material?.category}</td>
                        <td className="py-3.5">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isLow ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {currentStock} {item.material?.unit}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono font-bold text-[#0878F9] text-sm">
                          {item.requestedQuantity} <span className="text-[10px] font-normal text-[#526B91]">{item.material?.unit}</span>
                        </td>
                        <td className="py-3.5 text-[#526B91]">{new Date(item.requiredDate).toLocaleDateString()}</td>
                        <td className="py-3.5 text-[#526B91]">{item.specification || item.notes || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Internal approval modal */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0B2148]">Approve Purchase Indent</h3>
            <p className="text-xs text-[#526B91]">
              Authorizing PR {pr.prNumber}. Once approved, this indent becomes eligible for Purchase Order generation.
            </p>
            <textarea 
              placeholder="Approval comments (optional)..."
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              rows={3}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsApproveOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-white border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => approvePRMutation.mutate(approveComments)}
                disabled={approvePRMutation.isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                {approvePRMutation.isPending ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return for correction modal */}
      {isCorrectionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs">
          <div className="p-6 rounded-3xl border border-amber-200 bg-white max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0B2148]">Return for Correction</h3>
            <p className="text-xs text-[#526B91]">
              The requester will be notified to adjust quantities, technical specifications, or justification before resubmitting.
            </p>
            <textarea 
              placeholder="Specify requested changes / correction remarks (required)..."
              value={correctionRemarks}
              onChange={(e) => setCorrectionRemarks(e.target.value)}
              rows={3}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsCorrectionOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-white border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  if (!correctionRemarks.trim()) {
                    toast.error("Correction remarks are required");
                    return;
                  }
                  returnCorrectionMutation.mutate(correctionRemarks);
                }}
                disabled={returnCorrectionMutation.isPending}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
              >
                {returnCorrectionMutation.isPending ? "Submitting..." : "Send Back for Correction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs">
          <div className="p-6 rounded-3xl border border-red-200 bg-white max-w-md w-full mx-4 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0B2148]">Reject Purchase Indent</h3>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Reason for Rejection (required) *"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-red-500"
              />
              <textarea 
                placeholder="Additional audit comments (optional)..."
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                rows={2}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsRejectOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-white border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  if (!rejectReason) {
                    toast.error("Reason is required");
                    return;
                  }
                  rejectPRMutation.mutate({ reason: rejectReason, comments: rejectComments });
                }}
                disabled={rejectPRMutation.isPending}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
              >
                {rejectPRMutation.isPending ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
