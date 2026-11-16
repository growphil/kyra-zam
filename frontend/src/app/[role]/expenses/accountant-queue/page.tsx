"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl } from "@/lib/api";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ExternalLink,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Receipt
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function AccountantVerificationQueuePage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;

  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["expenses-accountant-pending"],
    queryFn: async () => (await api.get("/expenses/accountant-pending")).data
  });

  const pendingExpenses = data?.pendingExpenses || [];
  const count = data?.count || 0;

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) =>
      (await api.post(`/expenses/${id}/accountant-approve`, { notes })).data,
    onSuccess: (res) => {
      toast.success(res.message || "Expense verified and approved.");
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-ledger"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to approve expense.");
    }
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/expenses/${id}/accountant-reject`, { reason })).data,
    onSuccess: (res) => {
      toast.success(res.message || "Expense rejected.");
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to reject expense.");
    }
  });

  const closeModal = () => {
    setSelectedExpense(null);
    setActionType(null);
    setNotes("");
    setReason("");
  };

  return (
    <div className="space-y-6 max-w-[1500px] pb-16">
      <PageHeader
        title="Admin Expense Verification Desk"
        subtitle="Independent Accountant audit queue for operational expenses created by System Administrators"
        icon={<ShieldCheck className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => router.push(`/${roleSlug}/expenses`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
        }
      />

      {/* Info Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold">Accounting Governance Policy</p>
          <p className="text-amber-800">
            Admin-created expenses always require independent review by an authorized Accountant before posting to the official expense ledger. Verify the attached supplier invoice, payment proof, and tax receipt before granting approval.
          </p>
        </div>
      </div>

      {/* Pending Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800">Pending Admin Submissions ({pendingExpenses.length})</h3>
          <span className="text-xs text-slate-500">Awaiting Accountant Audit</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="p-3">Expense ID</th>
                <th className="p-3">Admin Submitter</th>
                <th className="p-3">Title & Category</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Date</th>
                <th className="p-3">Attached Proof</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingExpenses.map((exp: any) => {
                const isSelf = exp.submittedById === currentUserId;
                return (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">{exp.expenseNumber}</td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{exp.submittedBy?.name}</p>
                      <p className="text-[10px] text-slate-400">{exp.submittedBy?.email}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{exp.title}</p>
                      <p className="text-[11px] text-slate-500">{exp.category?.name}</p>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {exp.currency} {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-slate-600">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {exp.attachments && exp.attachments.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {exp.attachments.map((att: any, i: number) => {
                            const apiBase = getApiBaseUrl();
                            const fileUrl = att.fileUrl.startsWith("http") ? att.fileUrl : `${apiBase}${att.fileUrl}`;
                            return (
                              <a
                                key={att.id || i}
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600 font-bold text-[10px] flex items-center gap-1 hover:bg-blue-100"
                              >
                                <span>Proof #{i + 1}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No proof</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {isSelf ? (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md font-bold border border-amber-200">
                          Self-Submitted
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedExpense(exp);
                              setActionType("REJECT");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs border border-rose-200 cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExpense(exp);
                              setActionType("APPROVE");
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs cursor-pointer shadow-xs"
                          >
                            Verify & Approve
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pendingExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    All admin-submitted expenses have been audited and processed!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVE MODAL */}
      {selectedExpense && actionType === "APPROVE" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Approve Admin Expense</h4>
                <p className="text-xs text-slate-500">Post verified voucher to official ledger</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 text-xs space-y-1">
              <p><strong>Expense ID:</strong> {selectedExpense.expenseNumber}</p>
              <p><strong>Amount:</strong> {selectedExpense.currency} {Number(selectedExpense.amount).toLocaleString()}</p>
              <p><strong>Admin Submitter:</strong> {selectedExpense.submittedBy?.name}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Accountant Audit Notes (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Verified against supplier tax invoice & receipt."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: selectedExpense.id, notes })}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all disabled:opacity-50"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm & Post Ledger"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {selectedExpense && actionType === "REJECT" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Reject Admin Expense</h4>
                <p className="text-xs text-slate-500">Document mandatory reason for audit trail</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the discrepancy or missing proof..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending || !reason.trim()}
                onClick={() => rejectMutation.mutate({ id: selectedExpense.id, reason })}
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
