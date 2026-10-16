"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function PurchaseRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const prId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Workflow Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectComments, setRejectComments] = useState("");

  // --- DATA FETCHING ---
  const { data: pr, isLoading } = useQuery({
    queryKey: ["procurement-pr-details", prId],
    queryFn: async () => (await api.get(`/crm/procurement/purchase-requests/${prId}`)).data
  });

  // --- MUTATIONS ---
  const submitPRMutation = useMutation({
    mutationFn: () => api.put(`/crm/procurement/purchase-requests/${prId}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details"] });
      toast.success("Purchase Request submitted for approval");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Submission failed")
  });

  const approvePRMutation = useMutation({
    mutationFn: (comments: string) => api.put(`/crm/procurement/purchase-requests/${prId}/approve`, { comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details"] });
      toast.success("Purchase Request APPROVED");
      setIsApproveOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Approval failed")
  });

  const rejectPRMutation = useMutation({
    mutationFn: (data: { reason: string; comments: string }) => api.put(`/crm/procurement/purchase-requests/${prId}/reject`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details"] });
      toast.success("Purchase Request REJECTED");
      setIsRejectOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Rejection failed")
  });

  const cancelPRMutation = useMutation({
    mutationFn: () => api.put(`/crm/procurement/purchase-requests/${prId}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-details"] });
      toast.success("Purchase Request cancelled");
    },
    onError: (err: any) => toast.error("Cancellation failed")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
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

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/procurement/purchase-requests`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-white font-bold text-sm bg-[#F4F9FF] border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Requests
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Indent request ID</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{pr.prNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                pr.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                pr.status === "REJECTED" ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                pr.status === "APPROVED" ? "bg-teal-500/15 text-teal-400 border border-teal-500/20" :
                pr.status === "PENDING_APPROVAL" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                "bg-slate-500/15 text-[#526B91] border border-slate-500/20"
              }`}>
                {pr.status}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">{pr.requestedBy?.name}</p>
                  <p className="text-xs text-[#526B91]">Requested By</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Source Channel</p>
                  <p className="mt-0.5 text-[#0B2148]">{pr.source}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Priority</p>
                  <p className="mt-0.5 text-[#0B2148]">{pr.priority}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Date Created</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(pr.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Required Target Date</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(pr.requiredDate).toLocaleDateString()}</p>
                </div>
              </div>

              {pr.reason && (
                <div className="border-t border-[#D8E8FA] pt-4">
                  <p className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Reason remarks</p>
                  <p className="text-xs text-[#0B2148] mt-1">{pr.reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-3">
            <h3 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Action Panel</h3>
            
            {pr.status === "DRAFT" && (
              <>
                <button 
                  onClick={() => submitPRMutation.mutate()}
                  className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all"
                >
                  Submit for Internal Approval
                </button>
                <button 
                  onClick={() => cancelPRMutation.mutate()}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold transition-all"
                >
                  Cancel Request
                </button>
              </>
            )}

            {pr.status === "PENDING_APPROVAL" && (
              <>
                <button 
                  onClick={() => setIsApproveOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all"
                >
                  Approve Request
                </button>
                <button 
                  onClick={() => setIsRejectOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all"
                >
                  Reject Request
                </button>
              </>
            )}

            {pr.status === "APPROVED" && (
              <button 
                onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders?prId=${pr.id}`)}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Generate Purchase Order
              </button>
            )}

            {pr.status === "ORDERED" && (
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 text-center text-xs font-bold">
                PR converted to Purchase Order
              </div>
            )}
          </div>
        </div>

        {/* Right Column requested items list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-lg font-display font-bold text-[#0B2148]">Purchase Request Line Items</h3>
            
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider">
                  <th className="pb-3">Material SKU / Name</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Current Stock</th>
                  <th className="pb-3">Qty Requested</th>
                  <th className="pb-3">Required Target Date</th>
                  <th className="pb-3">Specification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {pr.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <div className="font-bold text-white">{item.material?.name}</div>
                      <div className="text-[10px] text-[#526B91] font-mono mt-0.5">SKU: {item.material?.sku}</div>
                    </td>
                    <td className="py-4 text-[#526B91]">{item.material?.category}</td>
                    <td className="py-4 font-mono">{item.material?.quantity} {item.material?.unit}</td>
                    <td className="py-4 font-mono font-bold text-[#0B2148]">{item.requestedQuantity}</td>
                    <td className="py-4 text-[#526B91]">{new Date(item.requiredDate).toLocaleDateString()}</td>
                    <td className="py-4 text-[#526B91]">{item.specification || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Internal approval modals */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-[#0B2148]">Approve Indent Request</h3>
            <textarea 
              placeholder="Comments (optional)..."
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              rows={3}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-white"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsApproveOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => approvePRMutation.mutate(approveComments)}
                disabled={approvePRMutation.isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {isRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-red-500/20 bg-white max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-[#0B2148]">Reject Indent Request</h3>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Reason for Rejection (required) *"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-white"
              />
              <textarea 
                placeholder="Comments (optional)..."
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                rows={2}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-xs text-white"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsRejectOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
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
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
