"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Receipt,
  PlusSquare,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  Sliders,
  DollarSign,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function ExpenseDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const { data: session } = useSession();
  const userRoles: string[] = (session?.user as any)?.roles || [];

  const isSuperadmin = userRoles.includes("SUPERADMIN") || userRoles.includes("ULTRA_ADMIN");
  const isAccountant = userRoles.includes("ACCOUNTANT") && !isSuperadmin;
  const isAdmin = userRoles.includes("ADMIN") && !isSuperadmin && !isAccountant;

  // 1. Summary stats
  const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["expenses-summary"],
    queryFn: async () => (await api.get("/expenses/reports/summary")).data
  });

  // 2. Recent Expenses
  const { data: expensesData, isLoading: isExpensesLoading } = useQuery({
    queryKey: ["expenses-recent"],
    queryFn: async () => (await api.get("/expenses", { params: { limit: 8 } })).data
  });

  // 3. Category Breakdown
  const { data: categoryReport } = useQuery({
    queryKey: ["expenses-category-report"],
    queryFn: async () => (await api.get("/expenses/reports/category")).data
  });

  // 4. Monthly Breakdown
  const { data: monthlyReport } = useQuery({
    queryKey: ["expenses-monthly-report"],
    queryFn: async () => (await api.get("/expenses/reports/monthly")).data
  });

  const stats = summaryData?.stats || {};
  const recentExpenses = expensesData?.expenses || [];
  const categories = categoryReport?.categories || [];
  const monthlyTrends = monthlyReport?.monthlyTrends || [];

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
    <div className="space-y-6 max-w-[1700px] pb-12">
      {/* Header */}
      <PageHeader
        title="Expense Management & Approvals"
        subtitle="Centralised enterprise expense lifecycle, auto-approval thresholds, and official financial ledger"
        icon={<Receipt className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchSummary()}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4" />
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

      {/* Threshold Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-[#0B2148] text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-200">Current Auto-Approval Threshold</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold">ACTIVE</span>
            </div>
            <p className="text-xl font-black text-white">
              {stats.thresholdCurrency || "ZMW"} {Number(stats.activeThreshold || 5000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-blue-200/80 max-w-sm hidden sm:block">
            {isAccountant
              ? "Accountant expenses at or below this threshold are automatically approved and recorded into the official ledger."
              : isSuperadmin
              ? "Superadmin can reconfigure this threshold anytime to adapt to factory OPEX budget revisions."
              : "Admin-created expenses always enter Accountant verification regardless of threshold."}
          </div>
          <Link
            href={`/${roleSlug}/expenses/threshold`}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-1.5"
          >
            <span>{isSuperadmin ? "Configure Threshold" : "View Threshold Policy"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Expenses</span>
            <ClipboardList className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-slate-900">{stats.totalExpensesCount ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.totalExpensesAmount || 0).toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-600">{stats.approvedCount ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.approvedAmount || 0).toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Auto-Approved</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl font-bold text-green-600">{stats.autoApprovedCount ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Instant system settlement</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Pending Verification</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-600">{stats.pendingCount ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.pendingAmount || 0).toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-rose-600">{stats.rejectedCount ?? 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.rejectedAmount || 0).toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Official Ledger</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-indigo-600">
            {Number(stats.officialLedgerTotal || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Approved fiscal balance</p>
        </div>
      </div>

      {/* Role-Specific Quick Navigation Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Link
          href={`/${roleSlug}/expenses/create`}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <PlusSquare className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">New Expense</p>
            <p className="text-[10px] text-slate-500">Record submission</p>
          </div>
        </Link>

        <Link
          href={`/${roleSlug}/expenses/my`}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">My Submissions</p>
            <p className="text-[10px] text-slate-500">Track my requests</p>
          </div>
        </Link>

        {isAccountant && (
          <Link
            href={`/${roleSlug}/expenses/accountant-queue`}
            className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 hover:border-amber-400 hover:shadow-sm transition-all flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Admin Queue</p>
              <p className="text-[10px] text-amber-700">Accountant audit</p>
            </div>
          </Link>
        )}

        {isSuperadmin && (
          <Link
            href={`/${roleSlug}/expenses/approvals`}
            className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900">Approval Queue</p>
              <p className="text-[10px] text-blue-700">Pending verification</p>
            </div>
          </Link>
        )}

        <Link
          href={`/${roleSlug}/expenses/ledger`}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Expense Ledger</p>
            <p className="text-[10px] text-slate-500">Official ledger records</p>
          </div>
        </Link>

        {isSuperadmin && (
          <Link
            href={`/${roleSlug}/expenses/categories`}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Categories</p>
              <p className="text-[10px] text-slate-500">25 standard classifications</p>
            </div>
          </Link>
        )}

        <Link
          href={`/${roleSlug}/expenses/reports`}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Reports & Export</p>
            <p className="text-[10px] text-slate-500">CSV & analytics</p>
          </div>
        </Link>
      </div>

      {/* Two Column Layout: Category distribution + Monthly trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Category-wise Expenditure</h3>
              <p className="text-xs text-slate-500">Distribution across active business categories</p>
            </div>
            <Link href={`/${roleSlug}/expenses/reports`} className="text-xs font-semibold text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {categories.slice(0, 6).map((cat: any) => {
              const totalAmount = Number(stats.approvedAmount || 1);
              const pct = Math.min(100, Math.round((cat.totalAmount / (totalAmount > 0 ? totalAmount : 1)) * 100));
              return (
                <div key={cat.categoryId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{cat.name}</span>
                    <span className="font-bold text-slate-900">
                      {stats.thresholdCurrency || "ZMW"} {Number(cat.totalAmount).toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No approved expense records to compute categories.</p>
            )}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Monthly Expense Trend</h3>
              <p className="text-xs text-slate-500">Approved historical operational expenditure</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">Current Year</span>
          </div>

          <div className="space-y-3">
            {monthlyTrends.slice(-6).map((m: any) => (
              <div key={m.month} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {m.month.split("-")[1]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{m.month}</p>
                    <p className="text-[11px] text-slate-500">{m.count} approved voucher(s)</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {stats.thresholdCurrency || "ZMW"} {Number(m.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            {monthlyTrends.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No historical monthly data recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Expenses Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Recent Expense Transactions</h3>
            <p className="text-xs text-slate-500">Recently logged operational expense vouchers</p>
          </div>
          <Link
            href={`/${roleSlug}/expenses/my`}
            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Submissions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="p-3">Expense ID</th>
                <th className="p-3">Title & Category</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Submitted By</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentExpenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-mono font-bold text-blue-600">{exp.expenseNumber}</td>
                  <td className="p-3">
                    <p className="font-bold text-slate-800">{exp.title}</p>
                    <p className="text-[11px] text-slate-500">{exp.category?.name || "General"}</p>
                  </td>
                  <td className="p-3 font-bold text-slate-900">
                    {exp.currency} {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-slate-700">
                    <p className="font-semibold">{exp.submittedBy?.name || "User"}</p>
                    <p className="text-[10px] text-slate-400">{exp.submittedBy?.roles?.[0]}</p>
                  </td>
                  <td className="p-3 text-slate-500">
                    {new Date(exp.expenseDate).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {getStatusBadge(exp.status)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => router.push(`/${roleSlug}/expenses/${exp.id}`)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {recentExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                    No expense vouchers recorded. Click &quot;Create Expense&quot; above to submit the first entry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
