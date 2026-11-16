"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl } from "@/lib/api";
import {
  Receipt,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Download,
  ShieldCheck,
  Building2,
  User,
  Calendar,
  Layers,
  IndianRupee,
  Activity,
  AlertCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const expenseId = params.id as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;
  const userRoles: string[] = (session?.user as any)?.roles || [];

  const isSuperadmin = userRoles.includes("SUPERADMIN") || userRoles.includes("ULTRA_ADMIN");
  const isAccountant = userRoles.includes("ACCOUNTANT") && !isSuperadmin;

  // Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // 1. Fetch expense details
  const { data: expense, isLoading, refetch } = useQuery({
    queryKey: ["expense-detail", expenseId],
    queryFn: async () => (await api.get(`/expenses/${expenseId}`)).data
  });

  // Approval Mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isSuperadmin
        ? `/expenses/${expenseId}/approve`
        : `/expenses/${expenseId}/accountant-approve`;
      return (await api.post(endpoint, { notes: approvalNotes })).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Expense successfully approved.");
      setIsApproveOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-recent"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-ledger"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to approve expense.");
    }
  });

  // Rejection Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isSuperadmin
        ? `/expenses/${expenseId}/reject`
        : `/expenses/${expenseId}/accountant-reject`;
      return (await api.post(endpoint, { reason: rejectionReason })).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Expense rejected.");
      setIsRejectOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-recent"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to reject expense.");
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading expense details...</p>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-slate-800">Expense voucher not found</p>
        <button
          onClick={() => router.push(`/${roleSlug}/expenses`)}
          className="text-xs text-blue-600 hover:underline font-bold"
        >
          Return to Expenses
        </button>
      </div>
    );
  }

  const isPending = expense.status === "PENDING_VERIFICATION";
  const isSelfSubmitted = expense.submittedById === currentUserId;
  const canSuperadminAction = isSuperadmin && isPending && !isSelfSubmitted;
  const canAccountantAction = isAccountant && isPending && !isSelfSubmitted && (expense.submittedBy?.roles || []).includes("ADMIN");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AUTO_APPROVED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">AUTO APPROVED</span>;
      case "APPROVED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">APPROVED</span>;
      case "PENDING_VERIFICATION":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">PENDING VERIFICATION</span>;
      case "REJECTED":
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">REJECTED</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] pb-16">
      <PageHeader
        title={`Expense ${expense.expenseNumber}`}
        subtitle={`Submitted on ${new Date(expense.createdAt).toLocaleDateString()} by ${expense.submittedBy?.name || "User"}`}
        icon={<Receipt className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/${roleSlug}/expenses`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Approval Controls */}
            {(canSuperadminAction || canAccountantAction) && (
              <>
                <button
                  onClick={() => setIsRejectOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => setIsApproveOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve Expense
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Main Status & Amount Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-slate-900">{expense.title}</h2>
            {getStatusBadge(expense.status)}
          </div>
          <p className="text-xs text-slate-500">
            Category: <strong className="text-slate-800">{expense.category?.name}</strong> • Department: <strong className="text-slate-800">{expense.department || "General"}</strong>
          </p>
        </div>

        <div className="text-left md:text-right border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
          <span className="text-xs text-slate-400 font-semibold uppercase">Voucher Total</span>
          <p className="text-2xl font-black text-slate-900">
            {expense.currency} {Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Method: <span className="font-semibold text-slate-700">{expense.paymentMethod}</span>
          </p>
        </div>
      </div>

      {/* Rejection Alert Banner if rejected */}
      {expense.status === "REJECTED" && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Expense Rejected</p>
            <p className="text-rose-800">
              <strong>Reason:</strong> {expense.rejectionReason || "No rejection reason provided."}
            </p>
            <p className="text-[11px] text-rose-700">
              Rejected by {expense.rejectedBy?.name || "Authorized Reviewer"} on {expense.rejectedAt ? new Date(expense.rejectedAt).toLocaleString() : "N/A"}.
            </p>
          </div>
        </div>
      )}

      {/* Official Ledger Badge if approved */}
      {expense.ledgerEntry && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">Recorded in Official Expense Ledger</p>
              <p className="text-emerald-800">
                Ledger Ref: <strong className="font-mono text-emerald-950">{expense.ledgerEntry.ledgerNumber}</strong> • Approved By: <strong>{expense.ledgerEntry.approvedByName}</strong> ({expense.ledgerEntry.approvalMethod})
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/${roleSlug}/expenses/ledger`)}
            className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition-all shrink-0"
          >
            Open in Ledger
          </button>
        </div>
      )}

      {/* Grid: Details, Vendor info, Attachments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Information Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Voucher Information</h3>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Expense Date</span>
              <span className="font-semibold text-slate-800">{new Date(expense.expenseDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Submitted By</span>
              <span className="font-semibold text-slate-800">{expense.submittedBy?.name} ({expense.submittedBy?.email})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Department</span>
              <span className="font-semibold text-slate-800">{expense.department || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Cost Centre</span>
              <span className="font-semibold text-slate-800">{expense.costCentre || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Approval Threshold Snapshot</span>
              <span className="font-semibold text-slate-800">
                {expense.thresholdCurrency || "ZMW"} {Number(expense.thresholdSnapshot || 5000).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-500">Description / Business Purpose:</span>
            <p className="text-xs text-slate-800 mt-1 p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
              {expense.description}
            </p>
          </div>
        </div>

        {/* Vendor & Payment Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Vendor & Settlement Details</h3>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Vendor / Payee</span>
              <span className="font-semibold text-slate-800">{expense.vendorName || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Vendor Contact</span>
              <span className="font-semibold text-slate-800">{expense.vendorContact || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Supplier Invoice Number</span>
              <span className="font-semibold text-slate-800">{expense.invoiceNumber || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Payment Status</span>
              <span className="font-bold text-slate-800">{expense.paymentStatus}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Payment Reference / UTR</span>
              <span className="font-semibold text-slate-800">{expense.paymentReference || "N/A"}</span>
            </div>
          </div>

          {/* Attached Files Card */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-500">Attached Receipts & Invoices ({expense.attachments?.length || 0}):</span>
            <div className="space-y-2 mt-2">
              {expense.attachments?.map((att: any) => {
                const apiBase = getApiBaseUrl();
                const fileUrl = att.fileUrl.startsWith("http") ? att.fileUrl : `${apiBase}${att.fileUrl}`;
                return (
                  <div key={att.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">{att.fileName}</p>
                        <p className="text-[10px] text-slate-400">{(att.fileSize / 1024).toFixed(1)} KB • {att.documentType}</p>
                      </div>
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
              {(!expense.attachments || expense.attachments.length === 0) && (
                <p className="text-xs text-slate-400 italic">No supporting document proof was attached.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approvals & Audit Trail Timeline */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Approval History & Audit Trail</h3>

        <div className="space-y-3">
          {expense.auditLogs?.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <Activity className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">{log.action.replace(/_/g, " ")}</span>
                  <span className="text-[11px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Actor: <strong className="text-slate-800">{log.actor?.name}</strong> ({log.actor?.roles?.[0]})
                </p>
                {log.metadata?.reason && (
                  <p className="text-rose-700 text-[11px] mt-1 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                    Reason: {log.metadata.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(!expense.auditLogs || expense.auditLogs.length === 0) && (
            <p className="text-xs text-slate-400 text-center py-4">No audit log entries recorded.</p>
          )}
        </div>
      </div>

      {/* APPROVE MODAL */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Approve Expense Voucher</h4>
                <p className="text-xs text-slate-500">Record in official financial expense ledger</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to approve expense <strong>{expense.expenseNumber}</strong> for <strong>{expense.currency} {Number(expense.amount).toLocaleString()}</strong>? This action will generate an official ledger entry and cannot be undone directly.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approval Notes (Optional)</label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Verified against supplier delivery receipt."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsApproveOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all disabled:opacity-50"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Reject Expense Voucher</h4>
                <p className="text-xs text-slate-500">Provide required rejection justification</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify the discrepancy, missing documentation, or reason for rejecting this voucher..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                onClick={() => rejectMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
