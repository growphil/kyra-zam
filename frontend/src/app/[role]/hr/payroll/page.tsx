"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Banknote, 
  Plus, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Printer, 
  Loader2, 
  X, 
  ArrowRight, 
  Clock, 
  CreditCard,
  Building2,
  DollarSign,
  Lock,
  Layers,
  Sparkles
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function HrPayrollPage() {
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [activePayslipRecord, setActivePayslipRecord] = useState<any>(null);
  const [paymentRefInput, setPaymentRefInput] = useState("");
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // New Period Form
  const [periodForm, setPeriodForm] = useState({
    periodCode: "2026-03",
    title: "March 2026 Monthly Payroll",
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    payoutDate: "2026-04-05"
  });

  // Query Periods
  const { data: periodsData, isLoading: isPeriodsLoading } = useQuery({
    queryKey: ["hr-payroll-periods"],
    queryFn: async () => (await api.get("/hr/payroll/periods")).data
  });

  // Query Active Period Records when selected
  const { data: periodDetailData, isLoading: isRecordsLoading } = useQuery({
    queryKey: ["hr-payroll-records", selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod?.id) return { records: [] };
      return (await api.get(`/hr/payroll/periods/${selectedPeriod.id}/records`)).data;
    },
    enabled: !!selectedPeriod?.id
  });

  // Query Statutory Rules
  const { data: rulesData } = useQuery({
    queryKey: ["hr-statutory-rules"],
    queryFn: async () => (await api.get("/hr/payroll/statutory-rules")).data
  });

  const periods = periodsData?.periods || [];
  const records = periodDetailData?.records || [];
  const activeRule = rulesData?.rules?.find((r: any) => r.isActive) || rulesData?.rules?.[0];

  // Auto-select first period if none selected
  if (!selectedPeriod && periods.length > 0) {
    setSelectedPeriod(periods[0]);
  }

  // Create Period Mutation
  const createPeriodMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/hr/payroll/periods", payload)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Payroll period created in Draft state");
      setIsNewPeriodModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr-payroll-periods"] });
      setSelectedPeriod(res.period);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to create payroll period")
  });

  // Calculate Payroll Mutation
  const calculateMutation = useMutation({
    mutationFn: async (periodId: string) => (await api.post(`/hr/payroll/periods/${periodId}/calculate`, {})).data,
    onSuccess: (res) => {
      toast.success(res.message || "Payroll calculated successfully");
      queryClient.invalidateQueries({ queryKey: ["hr-payroll-periods"] });
      queryClient.invalidateQueries({ queryKey: ["hr-payroll-records", selectedPeriod?.id] });
      setSelectedPeriod(res.period);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Calculation failed")
  });

  // Submit Review Mutation
  const reviewMutation = useMutation({
    mutationFn: async (periodId: string) => (await api.patch(`/hr/payroll/periods/${periodId}/review`, {})).data,
    onSuccess: (res) => {
      toast.success(res.message || "Submitted for management review");
      queryClient.invalidateQueries({ queryKey: ["hr-payroll-periods"] });
      setSelectedPeriod(res.period);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Review submission failed")
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async (periodId: string) => (await api.patch(`/hr/payroll/periods/${periodId}/approve`, {})).data,
    onSuccess: (res) => {
      toast.success(res.message || "Payroll approved for disbursement");
      queryClient.invalidateQueries({ queryKey: ["hr-payroll-periods"] });
      setSelectedPeriod(res.period);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Approval failed")
  });

  // Payment Execution Mutation
  const payMutation = useMutation({
    mutationFn: async ({ periodId, paymentReference }: { periodId: string; paymentReference: string }) => {
      return (await api.patch(`/hr/payroll/periods/${periodId}/pay`, { paymentReference })).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Disbursement recorded. Marked as PAID.");
      setIsPayModalOpen(false);
      setPaymentRefInput("");
      queryClient.invalidateQueries({ queryKey: ["hr-payroll-periods"] });
      setSelectedPeriod(res.period);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Payment execution failed")
  });

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      <PageHeader
        title="Salary Structures & Payroll Runs (Zambia)"
        subtitle="ZMW Statutory Gross-to-Net Calculations, ZRA PAYE, NAPSA Pension, NHIMA Health & Immutable Audit Trail"
        icon={<Banknote className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => setIsNewPeriodModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Initialize Pay Period
          </button>
        }
      />

      {/* Statutory Rules Version Indicator */}
      <div className="bg-[#061B3A] text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0878F9]/20 border border-[#0878F9]/40 flex items-center justify-center text-[#0878F9]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Active Statutory Version:</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#0878F9] text-white">
                {activeRule ? activeRule.versionName : "ZAM-2026-STATUTORY-V1"}
              </span>
            </div>
            <p className="text-xs text-[#CBD7E7] mt-0.5">
              ZRA Progressive PAYE (0% to 37%) &bull; NAPSA 5% (Ceiling: ZMW 30,368) &bull; NHIMA 1% &bull; Currency: ZMW
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-[#CBD7E7] block">Effective From</span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {activeRule ? new Date(activeRule.effectiveFrom).toLocaleDateString("en-GB") : "01/01/2026"}
          </span>
        </div>
      </div>

      {/* Periods Carousel / Selection Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#061B3A] uppercase tracking-wider">Payroll Processing Periods</h3>
          <span className="text-xs text-[#526B91]">Workflow: Draft &rarr; Calculated &rarr; Review Required &rarr; Approved &rarr; Paid</span>
        </div>

        {isPeriodsLoading ? (
          <div className="p-6 bg-white rounded-2xl text-center text-xs text-[#526B91]">Loading payroll runs...</div>
        ) : periods.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed border-[#CBD7E7] text-center">
            <Banknote className="w-10 h-10 text-[#CBD7E7] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-[#061B3A]">No payroll periods initiated</h4>
            <p className="text-xs text-[#526B91] mt-1">Click &quot;Initialize Pay Period&quot; to start your first Zambian payroll run.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {periods.map((p: any) => {
              const isSelected = selectedPeriod?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPeriod(p)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-white border-[#0878F9] ring-2 ring-[#0878F9]/20 shadow-sm"
                      : "bg-white/80 border-[#CBD7E7] hover:border-[#0878F9]/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-xs text-[#061B3A]">{p.periodCode}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
                      p.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                      p.status === "REVIEW_REQUIRED" ? "bg-purple-100 text-purple-800" :
                      p.status === "CALCULATED" ? "bg-amber-100 text-amber-800" :
                      "bg-slate-100 text-slate-800"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#061B3A] truncate">{p.title}</h4>
                  <div className="mt-2 pt-2 border-t border-[#CBD7E7]/60 flex items-center justify-between text-[11px] text-[#526B91]">
                    <span>Net Disbursable:</span>
                    <span className="font-mono font-bold text-[#061B3A]">ZMW {p.totalNet?.toLocaleString() || "0.00"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Period Control Banner */}
      {selectedPeriod && (
        <div className="bg-white rounded-2xl border border-[#CBD7E7] p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#CBD7E7]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#061B3A]">{selectedPeriod.title}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedPeriod.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
                  selectedPeriod.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                  selectedPeriod.status === "REVIEW_REQUIRED" ? "bg-purple-100 text-purple-800" :
                  selectedPeriod.status === "CALCULATED" ? "bg-amber-100 text-amber-800" :
                  "bg-slate-100 text-slate-800"
                }`}>
                  {selectedPeriod.status}
                </span>
              </div>
              <p className="text-xs text-[#526B91] mt-0.5 font-mono">
                Span: {new Date(selectedPeriod.startDate).toLocaleDateString("en-GB")} &rarr; {new Date(selectedPeriod.endDate).toLocaleDateString("en-GB")}
                {selectedPeriod.paymentReference && ` &bull; Payment Ref: ${selectedPeriod.paymentReference}`}
              </p>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Calculate / Recalculate */}
              {selectedPeriod.status !== "APPROVED" && selectedPeriod.status !== "PAID" && (
                <button
                  onClick={() => calculateMutation.mutate(selectedPeriod.id)}
                  disabled={calculateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#CBD7E7] hover:border-[#0878F9] text-[#061B3A] font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {calculateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5 text-[#0878F9]" />}
                  {selectedPeriod.status === "DRAFT" ? "Calculate Payroll" : "Recalculate Run"}
                </button>
              )}

              {/* Submit for Review */}
              {selectedPeriod.status === "CALCULATED" && (
                <button
                  onClick={() => reviewMutation.mutate(selectedPeriod.id)}
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  {reviewMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit For Review &rarr;
                </button>
              )}

              {/* Approve (Separation of duties enforced) */}
              {(selectedPeriod.status === "REVIEW_REQUIRED" || selectedPeriod.status === "CALCULATED") && (
                <button
                  onClick={() => approveMutation.mutate(selectedPeriod.id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  {approveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Authorize &amp; Approve
                </button>
              )}

              {/* Pay / Disburse */}
              {selectedPeriod.status === "APPROVED" && (
                <button
                  onClick={() => setIsPayModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Execute Disbursement
                </button>
              )}

              {selectedPeriod.status === "PAID" && (
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" /> Disbursed &amp; Reconciled
                </div>
              )}
            </div>
          </div>

          {/* Period Financial Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#CBD7E7]/80">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Total Gross Pay</span>
              <div className="text-sm font-mono font-bold text-[#061B3A] mt-0.5">
                ZMW {selectedPeriod.totalGross?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#CBD7E7]/80">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">Taxable Pay</span>
              <div className="text-sm font-mono font-bold text-[#061B3A] mt-0.5">
                ZMW {selectedPeriod.totalTaxable?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#CBD7E7]/80">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">ZRA PAYE Tax</span>
              <div className="text-sm font-mono font-bold text-rose-700 mt-0.5">
                ZMW {selectedPeriod.totalPaye?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#CBD7E7]/80">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">NAPSA (5%)</span>
              <div className="text-sm font-mono font-bold text-amber-700 mt-0.5">
                ZMW {selectedPeriod.totalNapsa?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#CBD7E7]/80">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">NHIMA (1%)</span>
              <div className="text-sm font-mono font-bold text-indigo-700 mt-0.5">
                ZMW {selectedPeriod.totalNhima?.toLocaleString() || "0.00"}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Net Disbursable</span>
              <div className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                ZMW {selectedPeriod.totalNet?.toLocaleString() || "0.00"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Payroll Records Register */}
      {selectedPeriod && (
        <div className="bg-white rounded-2xl border border-[#CBD7E7] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#F4F9FF] border-b border-[#CBD7E7] flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#061B3A] uppercase tracking-wider">
              Employee Payroll Register &bull; {selectedPeriod.periodCode} ({records.length} Staff)
            </h4>
          </div>

          {isRecordsLoading ? (
            <div className="p-12 text-center text-xs text-[#526B91]">Loading employee records...</div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center">
              <Calculator className="w-10 h-10 text-[#CBD7E7] mx-auto mb-2" />
              <h4 className="text-sm font-bold text-[#061B3A]">Payroll not calculated yet</h4>
              <p className="text-xs text-[#526B91] mt-1">Click &quot;Calculate Payroll&quot; to execute the Zambian statutory engine for this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4F9FF] border-b border-[#CBD7E7] text-[#526B91] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Base Salary</th>
                    <th className="py-3 px-4">Days / OT (h)</th>
                    <th className="py-3 px-4">Gross (ZMW)</th>
                    <th className="py-3 px-4">NAPSA (5%)</th>
                    <th className="py-3 px-4">NHIMA (1%)</th>
                    <th className="py-3 px-4">ZRA PAYE</th>
                    <th className="py-3 px-4">Net Pay (ZMW)</th>
                    <th className="py-3 px-4 text-right">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD7E7]/60">
                  {records.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-[#F4F9FF]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#061B3A]">{rec.employee?.firstName} {rec.employee?.lastName}</div>
                        <div className="text-[11px] font-mono text-[#0878F9]">{rec.employee?.employeeNumber} &bull; {rec.employee?.department}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-[#061B3A]">
                        {rec.baseSalary?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#526B91]">
                        {rec.workedDays}d / {rec.overtimeHours}h
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#061B3A]">
                        {rec.grossPay?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-700">
                        {rec.napsaEmployee?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-indigo-700">
                        {rec.nhimaEmployee?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-rose-700">
                        {rec.payeTax?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-700">
                        ZMW {rec.netPay?.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setActivePayslipRecord(rec);
                            setIsPayslipModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[#CBD7E7] hover:border-[#0878F9] hover:text-[#0878F9] text-[#526B91] font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Payslip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Initialize Period Modal */}
      {isNewPeriodModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Initialize Pay Period</h3>
                <p className="text-[11px] text-[#526B91]">Start a new Zambian Kwacha monthly run</p>
              </div>
              <button onClick={() => setIsNewPeriodModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPeriodMutation.mutate(periodForm);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Period Code * (e.g. 2026-03)</label>
                <input
                  type="text"
                  required
                  placeholder="2026-03"
                  value={periodForm.periodCode}
                  onChange={(e) => setPeriodForm({ ...periodForm, periodCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Run Title *</label>
                <input
                  type="text"
                  required
                  placeholder="March 2026 Monthly Payroll"
                  value={periodForm.title}
                  onChange={(e) => setPeriodForm({ ...periodForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Target Payout Date</label>
                <input
                  type="date"
                  value={periodForm.payoutDate}
                  onChange={(e) => setPeriodForm({ ...periodForm, payoutDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPeriodMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs flex items-center gap-2"
                >
                  {createPeriodMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Draft Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Reference Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Execute Payroll Disbursement</h3>
                <p className="text-[11px] text-[#526B91]">Confirm bank batch or mobile money payment reference</p>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                payMutation.mutate({
                  periodId: selectedPeriod.id,
                  paymentReference: paymentRefInput
                });
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">
                  Bank / Disbursement Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STANBIC-EFT-20260331-0091"
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] font-mono font-bold"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-blue-900 text-xs">
                <strong>Disbursement Total:</strong> ZMW {selectedPeriod.totalNet?.toLocaleString() || "0.00"}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2"
                >
                  {payMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm &amp; Mark as Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Printable Payslip Modal */}
      {isPayslipModalOpen && activePayslipRecord && (
        <div className="fixed inset-0 bg-[#061B3A]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-[#CBD7E7] my-8 relative">
            <button
              onClick={() => setIsPayslipModalOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 rounded-lg hover:bg-[#F4F9FF] text-[#526B91] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Printable Payslip Container */}
            <div className="space-y-6 text-xs text-[#061B3A]">
              {/* Header */}
              <div className="text-center border-b border-[#CBD7E7] pb-4">
                <h2 className="text-base font-black tracking-wide text-[#061B3A]">KYRA ZAMBIA ENERGY SYSTEMS LIMITED</h2>
                <p className="text-[11px] text-[#526B91]">Plot 1928, Lusaka Heavy Industrial Area, Lusaka, Zambia</p>
                <div className="inline-block mt-2 px-3 py-1 rounded bg-[#061B3A] text-white font-bold text-[11px] tracking-wider uppercase">
                  Confidential Salary Slip &bull; {selectedPeriod?.title}
                </div>
              </div>

              {/* Employee & Statutory Identifiers */}
              <div className="grid grid-cols-2 gap-4 bg-[#F4F9FF] p-3 rounded-xl border border-[#CBD7E7]">
                <div>
                  <div><strong className="text-[#526B91]">Employee:</strong> {activePayslipRecord.employee?.firstName} {activePayslipRecord.employee?.lastName}</div>
                  <div><strong className="text-[#526B91]">Emp ID:</strong> {activePayslipRecord.employee?.employeeNumber}</div>
                  <div><strong className="text-[#526B91]">Department:</strong> {activePayslipRecord.employee?.department}</div>
                  <div><strong className="text-[#526B91]">Designation:</strong> {activePayslipRecord.employee?.designation}</div>
                </div>
                <div>
                  <div><strong className="text-[#526B91]">NRC Number:</strong> {activePayslipRecord.employee?.nrcNumber || "—"}</div>
                  <div><strong className="text-[#526B91]">ZRA TPIN:</strong> {activePayslipRecord.employee?.tpinNumber || "—"}</div>
                  <div><strong className="text-[#526B91]">NAPSA No:</strong> {activePayslipRecord.employee?.napsaNumber || "—"}</div>
                  <div><strong className="text-[#526B91]">NHIMA No:</strong> {activePayslipRecord.employee?.nhimaNumber || "—"}</div>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-2 gap-6">
                {/* Earnings */}
                <div>
                  <h4 className="text-[11px] font-bold text-[#0878F9] uppercase tracking-wider mb-2 border-b border-[#CBD7E7] pb-1">
                    Gross Earnings (ZMW)
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Basic Salary</span>
                      <span className="font-mono font-semibold">{activePayslipRecord.baseSalary?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Overtime Pay ({activePayslipRecord.overtimeHours}h)</span>
                      <span className="font-mono font-semibold">{activePayslipRecord.overtimePay?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">Allowances</span>
                      <span className="font-mono font-semibold">{activePayslipRecord.allowances?.toFixed(2)}</span>
                    </div>
                    {activePayslipRecord.absenceDeductions > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Unpaid Absence Adj</span>
                        <span className="font-mono font-semibold">-{activePayslipRecord.absenceDeductions?.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-[#CBD7E7] font-bold text-[#061B3A]">
                      <span>Gross Total</span>
                      <span className="font-mono">{activePayslipRecord.grossPay?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <h4 className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-2 border-b border-[#CBD7E7] pb-1">
                    Statutory Deductions (ZMW)
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">ZRA PAYE Tax</span>
                      <span className="font-mono font-semibold text-rose-700">{activePayslipRecord.payeTax?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">NAPSA Pension (5%)</span>
                      <span className="font-mono font-semibold">{activePayslipRecord.napsaEmployee?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526B91]">NHIMA Health (1%)</span>
                      <span className="font-mono font-semibold">{activePayslipRecord.nhimaEmployee?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#CBD7E7] font-bold text-[#061B3A]">
                      <span>Total Deductions</span>
                      <span className="font-mono">{activePayslipRecord.totalDeductions?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight Banner */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Net Take-Home Pay</span>
                  <span className="text-xs text-[#526B91]">Disbursed to: {activePayslipRecord.paymentMethod}</span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700">
                  ZMW {activePayslipRecord.netPay?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Employer Contributions (Non-deducted) */}
              <div className="text-[10px] text-[#526B91] pt-2 border-t border-[#CBD7E7] flex justify-between">
                <span>Employer NAPSA Contribution (5%): ZMW {activePayslipRecord.napsaEmployer?.toFixed(2)}</span>
                <span>Employer NHIMA Contribution (1%): ZMW {activePayslipRecord.nhimaEmployer?.toFixed(2)}</span>
              </div>

              {/* Action */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-[#061B3A] text-white hover:bg-[#0B2148] font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Official Payslip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
