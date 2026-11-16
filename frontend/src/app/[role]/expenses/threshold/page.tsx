"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Sliders,
  ShieldCheck,
  History,
  ArrowLeft,
  CheckCircle2,
  Lock,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  Info
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function ExpenseThresholdSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userRoles: string[] = (session?.user as any)?.roles || [];

  const isSuperadmin = userRoles.includes("SUPERADMIN") || userRoles.includes("ULTRA_ADMIN");
  const isAccountant = userRoles.includes("ACCOUNTANT") && !isSuperadmin;

  // Form state
  const [newAmount, setNewAmount] = useState("");
  const [currency, setCurrency] = useState("ZMW");
  const [changeReason, setChangeReason] = useState("");

  // 1. Fetch active threshold
  const { data: thresholdData, isLoading, refetch: refetchThreshold } = useQuery({
    queryKey: ["expenses-threshold-settings"],
    queryFn: async () => (await api.get("/expenses/settings/threshold")).data
  });

  // 2. Fetch threshold history
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["expenses-threshold-history"],
    queryFn: async () => (await api.get("/expenses/settings/threshold/history")).data
  });

  const active = thresholdData?.activeThreshold;
  const history = historyData?.history || [];

  // Update threshold mutation (Superadmin only)
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => (await api.put("/expenses/settings/threshold", payload)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Approval threshold successfully updated.");
      setNewAmount("");
      setChangeReason("");
      refetchThreshold();
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to update threshold.");
    }
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmount);
    if (!val || val <= 0) return toast.error("Please enter a valid threshold amount greater than 0");
    if (!changeReason.trim() || changeReason.trim().length < 3) {
      return toast.error("Please provide a descriptive change reason (at least 3 characters)");
    }

    updateMutation.mutate({
      amount: val,
      currency,
      changeReason: changeReason.trim()
    });
  };

  return (
    <div className="space-y-6 max-w-[1300px] pb-16">
      <PageHeader
        title="Expense Approval Threshold Settings"
        subtitle="Configure the automatic approval limit for Accountant operational expenditures"
        icon={<Sliders className="w-5 h-5 text-[#0878F9]" />}
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

      {/* Policy Notice Card */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold">Enterprise Financial Policy</p>
          <p className="text-blue-800 leading-relaxed">
            Expenses submitted by an <strong>Accountant</strong> that are <strong>less than or equal to</strong> this threshold are automatically approved and logged into the official expense ledger. Any expense exceeding this threshold requires mandatory <strong>Superadmin verification</strong>.
            All <strong>Admin-created</strong> expenses are routed to the Accountant verification queue regardless of amount.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Threshold Card & Reconfiguration Form */}
        <div className="lg:col-span-1 space-y-6">
          {/* Active Status Display */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Currently Active</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ACTIVE
              </span>
            </div>

            <div>
              <p className="text-3xl font-black text-slate-900">
                {active?.currency || "ZMW"} {Number(active?.amount || 5000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Auto-Approval Limit
              </p>
            </div>

            <div className="text-xs border-t border-slate-100 pt-3 space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Effective Date:</span>
                <span className="font-semibold text-slate-800">
                  {active?.effectiveFrom ? new Date(active.effectiveFrom).toLocaleDateString() : "System Init"}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Configured By:</span>
                <span className="font-semibold text-slate-800">{active?.createdByName || "Superadmin"}</span>
              </div>
              {active?.changeReason && (
                <div className="pt-1">
                  <span className="text-slate-500">Last Reason:</span>
                  <p className="italic text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                    &quot;{active.changeReason}&quot;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Superadmin Configuration Form OR Read-Only Notice */}
          {isSuperadmin ? (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Reconfigure Threshold</h3>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Threshold Amount <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
                    >
                      <option value="ZMW">ZMW</option>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="e.g. 7500.00"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mandatory Change Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Document why this threshold is being revised (e.g. Q4 inflation adjustment)..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Threshold...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Update Threshold Policy</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs space-y-3 text-center">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-xs font-bold text-slate-700">Read-Only Permission</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                As an {isAccountant ? "Accountant" : "Administrator"}, you have read-only permissions to inspect the threshold. Only <strong>Superadmin</strong> accounts can reconfigure the limit.
              </p>
            </div>
          )}
        </div>

        {/* Right: Threshold Audit History */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Threshold Revision History</h3>
            </div>
            <span className="text-xs text-slate-400">{history.length} record(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                  <th className="p-3">Threshold Limit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Effective Date</th>
                  <th className="p-3">Configured By</th>
                  <th className="p-3">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h: any) => (
                  <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {h.currency} {Number(h.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      {h.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          CURRENT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          SUPERSEDED
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">
                      {new Date(h.effectiveFrom).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {h.createdBy?.name || "System"}
                    </td>
                    <td className="p-3 text-slate-600 italic max-w-xs truncate">
                      {h.changeReason || "Baseline"}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                      No historical revisions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
