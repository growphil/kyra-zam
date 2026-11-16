"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Activity,
  Search,
  Filter,
  ArrowLeft,
  Calendar,
  User,
  ShieldCheck,
  FileText
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function ExpenseAuditLogsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-audit-logs", page, actionFilter],
    queryFn: async () =>
      (
        await api.get("/expenses/audit-logs", {
          params: { page, limit: 30, action: actionFilter || undefined }
        })
      ).data
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  return (
    <div className="space-y-6 max-w-[1500px] pb-16">
      <PageHeader
        title="Expense Audit Trail"
        subtitle="Complete immutable chronological audit log of all expense lifecycle events, threshold adjustments, and reviewer decisions"
        icon={<Activity className="w-5 h-5 text-[#0878F9]" />}
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

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">Filter Event Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="">All Audit Actions</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="AUTO_APPROVED">AUTO_APPROVED</option>
            <option value="SUPERADMIN_APPROVED">SUPERADMIN_APPROVED</option>
            <option value="ACCOUNTANT_APPROVED">ACCOUNTANT_APPROVED</option>
            <option value="SUPERADMIN_REJECTED">SUPERADMIN_REJECTED</option>
            <option value="ACCOUNTANT_REJECTED">ACCOUNTANT_REJECTED</option>
            <option value="THRESHOLD_CHANGED">THRESHOLD_CHANGED</option>
            <option value="ATTACHMENT_ADDED">ATTACHMENT_ADDED</option>
            <option value="CATEGORY_CREATED">CATEGORY_CREATED</option>
          </select>
        </div>
        <span className="text-xs text-slate-400">Total Events: {pagination.total}</span>
      </div>

      {/* Audit Log Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Related Voucher</th>
                <th className="p-3">Status Change</th>
                <th className="p-3">Event Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-800">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">
                    <p className="font-semibold">{log.actor?.name || "System"}</p>
                    <p className="text-[10px] text-slate-400">{log.actor?.roles?.[0]}</p>
                  </td>
                  <td className="p-3 font-mono text-blue-600 font-bold">
                    {log.expense?.expenseNumber ? (
                      <button
                        onClick={() => router.push(`/${roleSlug}/expenses/${log.expense.id}`)}
                        className="hover:underline cursor-pointer"
                      >
                        {log.expense.expenseNumber}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-3 text-slate-600">
                    {log.previousStatus && <span className="line-through mr-1 text-slate-400">{log.previousStatus}</span>}
                    {log.newStatus && <span className="font-bold text-slate-800">{log.newStatus}</span>}
                    {!log.previousStatus && !log.newStatus && "-"}
                  </td>
                  <td className="p-3 text-slate-600 max-w-sm truncate font-mono text-[11px]">
                    {log.metadata ? JSON.stringify(log.metadata) : "-"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                    No audit log records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center pt-2 text-xs text-slate-500">
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
