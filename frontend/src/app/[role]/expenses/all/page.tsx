"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Receipt,
  PlusSquare,
  Search,
  Filter,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  FileText
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function AllExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-all", page, statusFilter, searchTerm],
    queryFn: async () =>
      (
        await api.get("/expenses", {
          params: {
            page,
            limit: 25,
            status: statusFilter,
            search: searchTerm
          }
        })
      ).data
  });

  const expenses = data?.expenses || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AUTO_APPROVED":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">AUTO APPROVED</span>;
      case "APPROVED":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">APPROVED</span>;
      case "PENDING_VERIFICATION":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">PENDING VERIFICATION</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] pb-16">
      <PageHeader
        title="All Organization Expenses"
        subtitle="Global directory of all operational expense vouchers logged across departments"
        icon={<Receipt className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/${roleSlug}/expenses`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => router.push(`/${roleSlug}/expenses/create`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <PlusSquare className="w-4 h-4" />
              Create Expense
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search expense ID, title or payee..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="AUTO_APPROVED">Auto Approved</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="p-3">Expense ID</th>
                <th className="p-3">Title & Category</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Submitted By</th>
                <th className="p-3">Expense Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ledger Number</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-mono font-bold text-blue-600">{exp.expenseNumber}</td>
                  <td className="p-3">
                    <p className="font-bold text-slate-800">{exp.title}</p>
                    <p className="text-[11px] text-slate-500">{exp.category?.name}</p>
                  </td>
                  <td className="p-3 font-bold text-slate-900">
                    {exp.currency} {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-slate-700">
                    <p className="font-semibold">{exp.submittedBy?.name}</p>
                    <p className="text-[10px] text-slate-400">{exp.submittedBy?.roles?.[0]}</p>
                  </td>
                  <td className="p-3 text-slate-600">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                  <td className="p-3">{getStatusBadge(exp.status)}</td>
                  <td className="p-3 font-mono text-[11px] text-emerald-700 font-bold">
                    {exp.ledgerEntry?.ledgerNumber || "-"}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => router.push(`/${roleSlug}/expenses/${exp.id}`)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                    No expense records found.
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
