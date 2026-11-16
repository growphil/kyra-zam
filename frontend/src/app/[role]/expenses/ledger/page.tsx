"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { getApiBaseUrl } from "@/lib/api";
import {
  FileText,
  Search,
  Filter,
  Download,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Layers,
  Building2,
  IndianRupee,
  Calendar,
  Receipt
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function OfficialExpenseLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-ledger", page, searchTerm, categoryFilter, methodFilter, startDate, endDate],
    queryFn: async () =>
      (
        await api.get("/expenses/ledger", {
          params: {
            page,
            limit: 25,
            search: searchTerm,
            categoryName: categoryFilter || undefined,
            approvalMethod: methodFilter || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined
          }
        })
      ).data
  });

  const entries = data?.entries || [];
  const totalAmount = data?.totalAmount || 0;
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  const handleExportCsv = async () => {
    try {
      const res = await api.get("/expenses/reports/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `official-expense-ledger-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] pb-16">
      <PageHeader
        title="Official Expense Ledger"
        subtitle="Immutable financial register of all authorized, approved, and auto-settled operational expenditures"
        icon={<FileText className="w-5 h-5 text-[#0878F9]" />}
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
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              Export Official Ledger CSV
            </button>
          </div>
        }
      />

      {/* Balance Summary Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-200">Total Approved Ledger Expenditure</span>
            <p className="text-2xl font-black text-white">
              ZMW {Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="text-xs text-emerald-200/80">
          Showing {entries.length} of {pagination.total} authorized ledger transactions
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search ledger ref, expense ID, vendor..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="">All Approval Methods</option>
            <option value="AUTO">AUTO (System Threshold)</option>
            <option value="ACCOUNTANT">ACCOUNTANT</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
          />
        </div>
      </div>

      {/* Official Ledger Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="p-3">Ledger ID</th>
                <th className="p-3">Expense Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Category & Description</th>
                <th className="p-3">Payee / Vendor</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Approved By</th>
                <th className="p-3">Method</th>
                <th className="p-3 text-right">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-mono font-bold text-emerald-700">{entry.ledgerNumber}</td>
                  <td className="p-3 font-mono font-bold text-blue-600">
                    <button
                      onClick={() => router.push(`/${roleSlug}/expenses/${entry.expenseId}`)}
                      className="hover:underline cursor-pointer"
                    >
                      {entry.expenseNumber}
                    </button>
                  </td>
                  <td className="p-3 text-slate-600">{new Date(entry.expenseDate).toLocaleDateString()}</td>
                  <td className="p-3 max-w-xs">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {entry.categoryName}
                    </span>
                    <p className="font-semibold text-slate-800 mt-0.5 truncate">{entry.description}</p>
                  </td>
                  <td className="p-3 font-medium text-slate-700">{entry.vendorName || "Internal / Petty"}</td>
                  <td className="p-3 font-bold text-slate-900">
                    {entry.currency} {Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-slate-700">
                    <p className="font-semibold">{entry.approvedByName}</p>
                    <p className="text-[10px] text-slate-400">{new Date(entry.approvedAt).toLocaleDateString()}</p>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      entry.approvalMethod === "AUTO"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}>
                      {entry.approvalMethod}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {entry.expense?.attachments && entry.expense.attachments.length > 0 ? (
                      <a
                        href={
                          entry.expense.attachments[0].fileUrl.startsWith("http")
                            ? entry.expense.attachments[0].fileUrl
                            : `${getApiBaseUrl()}${entry.expense.attachments[0].fileUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[10px]">None</span>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 text-xs">
                    No approved expense records found in the official ledger.
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
