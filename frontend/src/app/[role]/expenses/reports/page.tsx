"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  FileBarChart,
  BarChart3,
  Calendar,
  Download,
  ArrowLeft,
  Building2,
  Layers,
  PieChart,
  TrendingUp,
  Receipt
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function ExpenseReportsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState("");

  const { data: summaryData } = useQuery({
    queryKey: ["expenses-reports-summary", startDate, endDate, department],
    queryFn: async () =>
      (
        await api.get("/expenses/reports/summary", {
          params: { startDate: startDate || undefined, endDate: endDate || undefined, department: department || undefined }
        })
      ).data
  });

  const { data: categoryData } = useQuery({
    queryKey: ["expenses-reports-category"],
    queryFn: async () => (await api.get("/expenses/reports/category")).data
  });

  const { data: departmentData } = useQuery({
    queryKey: ["expenses-reports-department"],
    queryFn: async () => (await api.get("/expenses/reports/department")).data
  });

  const { data: monthlyData } = useQuery({
    queryKey: ["expenses-reports-monthly"],
    queryFn: async () => (await api.get("/expenses/reports/monthly")).data
  });

  const stats = summaryData?.stats || {};
  const categories = categoryData?.categories || [];
  const departments = departmentData?.departments || [];
  const monthlyTrends = monthlyData?.monthlyTrends || [];

  const handleExportCsv = async () => {
    try {
      const res = await api.get("/expenses/reports/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `expense-report-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  return (
    <div className="space-y-6 max-w-[1500px] pb-16">
      <PageHeader
        title="Expense Reports & Cost Analytics"
        subtitle="Departmental expenditure breakdowns, category distribution, and official fiscal exports"
        icon={<FileBarChart className="w-5 h-5 text-[#0878F9]" />}
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
              Export Full Report (CSV)
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
            >
              <option value="">All Departments</option>
              <option value="Operations">Operations</option>
              <option value="Finance & Accounts">Finance & Accounts</option>
              <option value="Assembly & Production">Assembly & Production</option>
              <option value="Quality Control">Quality Control</option>
              <option value="Procurement & Logistics">Procurement & Logistics</option>
              <option value="Sales & Marketing">Sales & Marketing</option>
              <option value="Management & Admin">Management & Admin</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
            setDepartment("");
          }}
          className="text-xs text-blue-600 font-bold hover:underline self-end pb-2"
        >
          Reset Filters
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Submitted</span>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.totalExpensesAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.totalExpensesCount || 0} vouchers</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Approved / Settled</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.approvedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">{stats.approvedCount || 0} approved vouchers</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Pending Verification</span>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.pendingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">{stats.pendingCount || 0} awaiting sign-off</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Official Ledger Total</span>
          <p className="text-2xl font-black text-indigo-600 mt-1">
            {stats.thresholdCurrency || "ZMW"} {Number(stats.officialLedgerTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-indigo-700 mt-0.5">Authoritative balance</p>
        </div>
      </div>

      {/* Analytics Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Category Expenditure Breakdown</h3>
          </div>

          <div className="space-y-3">
            {categories.map((c: any) => {
              const total = Number(stats.approvedAmount || 1);
              const pct = Math.min(100, Math.round((c.totalAmount / (total > 0 ? total : 1)) * 100));
              return (
                <div key={c.categoryId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{c.name}</span>
                    <span className="font-bold text-slate-900">
                      ZMW {Number(c.totalAmount).toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No approved category data available.</p>
            )}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Departmental Cost Allocation</h3>
          </div>

          <div className="space-y-3">
            {departments.map((d: any) => {
              const total = Number(stats.approvedAmount || 1);
              const pct = Math.min(100, Math.round((d.totalAmount / (total > 0 ? total : 1)) * 100));
              return (
                <div key={d.department} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{d.department}</span>
                    <span className="font-bold text-slate-900">
                      ZMW {Number(d.totalAmount).toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {departments.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No approved departmental data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
