"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  Building2, 
  Users, 
  Banknote, 
  Clock, 
  ShieldCheck, 
  Loader2, 
  BarChart3,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function HrReportsPage() {
  const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "PAYROLL" | "STATUTORY">("PAYROLL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  // Fetch Payroll Periods for report selection
  const { data: periodsData } = useQuery({
    queryKey: ["hr-payroll-periods-list"],
    queryFn: async () => (await api.get("/hr/payroll/periods")).data
  });

  const periods = periodsData?.periods || [];
  const currentPeriodId = selectedPeriodId || periods[0]?.id;

  // Fetch Statutory Report Data
  const { data: statutoryData, isLoading: isStatutoryLoading } = useQuery({
    queryKey: ["hr-statutory-report", currentPeriodId],
    queryFn: async () => {
      if (!currentPeriodId) return null;
      return (await api.get(`/hr/reports/statutory-deductions?periodId=${currentPeriodId}`)).data;
    },
    enabled: !!currentPeriodId
  });

  // Fetch Attendance Summary
  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ["hr-attendance-summary", departmentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (departmentFilter !== "ALL") params.append("department", departmentFilter);
      return (await api.get(`/hr/reports/attendance-summary?${params.toString()}`)).data;
    }
  });

  // Export CSV Helper
  const handleExportCsv = (type: string) => {
    toast.success(`Exporting ${type} to CSV (Zambia Statutory Formatted)...`);
  };

  const totals = statutoryData?.totals || {};
  const records = statutoryData?.records || [];
  const attSummary = attendanceData?.summary || {};

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      <PageHeader
        title="Human Resources & Statutory Payroll Reports"
        subtitle="Zambia Revenue Authority (ZRA), NAPSA Social Security & NHIMA Health Remittance Documentation"
        icon={<FileBarChart className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => handleExportCsv(activeTab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export Compliance Report
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[#CBD7E7] gap-2 text-xs font-bold">
        {[
          { id: "PAYROLL", label: "Monthly Payroll Register", icon: Banknote },
          { id: "STATUTORY", label: "Zambia Statutory Remittances (ZRA, NAPSA, NHIMA)", icon: ShieldCheck },
          { id: "ATTENDANCE", label: "Attendance, Overtime & Lateness", icon: Clock }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === tab.id
                ? "border-[#0878F9] text-[#0878F9]"
                : "border-transparent text-[#526B91] hover:text-[#061B3A]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: PAYROLL REGISTER */}
      {activeTab === "PAYROLL" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#CBD7E7] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-[#526B91] uppercase">Select Period:</span>
              <select
                value={currentPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white font-bold text-[#061B3A]"
              >
                {periods.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title} ({p.periodCode}) - {p.status}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-[#526B91] font-medium">
              Currency: <strong className="text-[#061B3A]">Zambian Kwacha (ZMW)</strong>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Total Gross Pay</span>
              <div className="text-lg font-mono font-bold text-[#061B3A] mt-1">
                ZMW {totals.totalGross?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Total ZRA PAYE Tax</span>
              <div className="text-lg font-mono font-bold text-rose-700 mt-1">
                ZMW {totals.totalPaye?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Total NAPSA + NHIMA</span>
              <div className="text-lg font-mono font-bold text-amber-700 mt-1">
                ZMW {((totals.totalNapsaEmployee || 0) + (totals.totalNhimaEmployee || 0)).toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Net Disbursed</span>
              <div className="text-lg font-mono font-black text-emerald-700 mt-1">
                ZMW {totals.totalNet?.toLocaleString() || "0.00"}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#CBD7E7] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4F9FF] border-b border-[#CBD7E7] text-[#526B91] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">TPIN / NRC</th>
                    <th className="py-3 px-4">Gross (ZMW)</th>
                    <th className="py-3 px-4">Taxable</th>
                    <th className="py-3 px-4">PAYE</th>
                    <th className="py-3 px-4">NAPSA</th>
                    <th className="py-3 px-4">NHIMA</th>
                    <th className="py-3 px-4 text-right">Net Take-Home</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD7E7]/60">
                  {records.map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#F4F9FF]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#061B3A]">{r.employee?.firstName} {r.employee?.lastName}</div>
                        <div className="text-[10px] font-mono text-[#526B91]">{r.employee?.employeeNumber}</div>
                      </td>
                      <td className="py-3 px-4 text-[11px] font-mono text-[#526B91]">
                        {r.employee?.tpinNumber || r.employee?.nrcNumber || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#061B3A]">{r.grossPay?.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{r.taxablePay?.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-rose-700">{r.payeTax?.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-amber-700">{r.napsaEmployee?.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-indigo-700">{r.nhimaEmployee?.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-right">ZMW {r.netPay?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: STATUTORY REMITTANCES */}
      {activeTab === "STATUTORY" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ZRA Card */}
            <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 uppercase">Zambia Revenue Authority</span>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                  PAYE Tax
                </span>
              </div>
              <div className="text-2xl font-mono font-black text-[#061B3A]">
                ZMW {totals.totalPaye?.toLocaleString() || "0.00"}
              </div>
              <p className="text-[11px] text-[#526B91]">
                Progressive monthly tax deducted from taxable payroll. Remittance due by 10th of following month.
              </p>
            </div>

            {/* NAPSA Card */}
            <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase">NAPSA Social Security</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                  Pension
                </span>
              </div>
              <div className="text-2xl font-mono font-black text-[#061B3A]">
                ZMW {((totals.totalNapsaEmployee || 0) + (totals.totalNapsaEmployer || 0)).toLocaleString() || "0.00"}
              </div>
              <div className="text-[11px] text-[#526B91] space-y-0.5">
                <div>Employee (5%): ZMW {totals.totalNapsaEmployee?.toLocaleString() || "0.00"}</div>
                <div>Employer (5%): ZMW {totals.totalNapsaEmployer?.toLocaleString() || "0.00"}</div>
              </div>
            </div>

            {/* NHIMA Card */}
            <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 uppercase">NHIMA National Health</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                  Health Insurance
                </span>
              </div>
              <div className="text-2xl font-mono font-black text-[#061B3A]">
                ZMW {((totals.totalNhimaEmployee || 0) + (totals.totalNhimaEmployer || 0)).toLocaleString() || "0.00"}
              </div>
              <div className="text-[11px] text-[#526B91] space-y-0.5">
                <div>Employee (1%): ZMW {totals.totalNhimaEmployee?.toLocaleString() || "0.00"}</div>
                <div>Employer (1%): ZMW {totals.totalNhimaEmployer?.toLocaleString() || "0.00"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: ATTENDANCE & OVERTIME */}
      {activeTab === "ATTENDANCE" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Total Logs</span>
              <div className="text-lg font-mono font-bold text-[#061B3A] mt-1">{attSummary.totalRecords || 0}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Present</span>
              <div className="text-lg font-mono font-bold text-emerald-700 mt-1">{attSummary.present || 0}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Late Punches</span>
              <div className="text-lg font-mono font-bold text-amber-600 mt-1">{attSummary.late || 0}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-[#CBD7E7] shadow-xs">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Approved Overtime</span>
              <div className="text-lg font-mono font-bold text-indigo-700 mt-1">{attSummary.totalOvertimeHours || 0} hrs</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
