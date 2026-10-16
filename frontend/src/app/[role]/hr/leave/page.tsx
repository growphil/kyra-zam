"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Check, 
  X, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  UserCheck, 
  FileText, 
  ShieldCheck, 
  Loader2, 
  User
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function HrLeavePage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [decisionNote, setDecisionNote] = useState("");

  // Form
  const [formData, setFormData] = useState({
    employeeId: "",
    policyId: "",
    startDate: "",
    endDate: "",
    workingDaysCount: 1,
    reason: "",
    attachmentName: ""
  });

  // Query Leave Requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["hr-leave-requests", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      return (await api.get(`/hr/leave/requests?${params.toString()}`)).data;
    }
  });

  // Query Policies
  const { data: policiesData } = useQuery({
    queryKey: ["hr-leave-policies"],
    queryFn: async () => (await api.get("/hr/leave/policies")).data
  });

  // Query Employees
  const { data: employeesData } = useQuery({
    queryKey: ["hr-employees-quick"],
    queryFn: async () => (await api.get("/hr/employees?status=ACTIVE")).data
  });

  const requests = requestsData?.requests || [];
  const policies = policiesData?.policies || [];
  const employees = employeesData?.employees || [];

  // Submit Leave Request Mutation
  const submitLeaveMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/hr/leave/requests", payload)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Leave request submitted");
      setIsApplyModalOpen(false);
      setFormData({
        employeeId: "",
        policyId: "",
        startDate: "",
        endDate: "",
        workingDaysCount: 1,
        reason: "",
        attachmentName: ""
      });
      queryClient.invalidateQueries({ queryKey: ["hr-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to submit leave request");
    }
  });

  // Decide Leave Mutation
  const decideMutation = useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "APPROVED" | "REJECTED"; note?: string }) => {
      return (await api.patch(`/hr/leave/requests/${id}/decide`, { decision, note })).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Leave decision recorded");
      setSelectedRequest(null);
      setDecisionNote("");
      queryClient.invalidateQueries({ queryKey: ["hr-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to decide leave");
    }
  });

  // Auto-calculate working days between start & end
  const handleDatesChange = (sDate: string, eDate: string) => {
    if (sDate && eDate) {
      const s = new Date(sDate);
      const e = new Date(eDate);
      if (e >= s) {
        const diffTime = Math.abs(e.getTime() - s.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setFormData((prev) => ({ ...prev, workingDaysCount: diffDays }));
      }
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      <PageHeader
        title="Leave Management & Statutory Entitlements"
        subtitle="Zambia Employment Code Act Leave Policies, Balances & Multi-Stage Approvals"
        icon={<ClipboardList className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => {
              setFormData({
                employeeId: employees[0]?.id || "",
                policyId: policies[0]?.id || "",
                startDate: new Date().toISOString().split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
                workingDaysCount: 1,
                reason: "",
                attachmentName: ""
              });
              setIsApplyModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Apply For Leave
          </button>
        }
      />

      {/* Statutory Policies Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {policies.map((p: any) => (
          <div key={p.id} className="p-4 rounded-xl border border-[#CBD7E7] bg-white shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#526B91] uppercase">{p.code}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0878F9] border border-blue-200">
                {p.daysPerYear} Days/Yr
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#061B3A]">{p.name}</h4>
            <p className="text-[10px] text-[#526B91] line-clamp-2 leading-relaxed">{p.description}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#CBD7E7] shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#526B91] uppercase">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white font-semibold text-[#061B3A]"
          >
            <option value="ALL">All Requests</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-[#CBD7E7] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#526B91]">Loading leave records...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-[#CBD7E7] mx-auto mb-3" />
            <h4 className="text-sm font-bold text-[#061B3A]">No leave requests found</h4>
            <p className="text-xs text-[#526B91] mt-1">Submit a leave request using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F9FF] border-b border-[#CBD7E7] text-[#526B91] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Policy</th>
                  <th className="py-3 px-4">Date Span</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD7E7]/60">
                {requests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-[#F4F9FF]/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#061B3A]">{req.employee?.firstName} {req.employee?.lastName}</div>
                      <div className="text-[11px] font-mono text-[#0878F9]">{req.employee?.employeeNumber} &bull; {req.employee?.department}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#061B3A]">{req.policy?.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                      {new Date(req.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} &rarr; {new Date(req.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#061B3A]">
                      {req.workingDaysCount} working days
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[#526B91] max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        req.status === "PENDING" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {req.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => decideMutation.mutate({ id: req.id, decision: "APPROVED" })}
                            disabled={decideMutation.isPending}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => decideMutation.mutate({ id: req.id, decision: "REJECTED" })}
                            disabled={decideMutation.isPending}
                            className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-[10px] cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#526B91]">
                          Decided on {new Date(req.decidedAt || req.updatedAt).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Submit Leave Request</h3>
                <p className="text-[11px] text-[#526B91]">Subject to Zambia statutory balance checks</p>
              </div>
              <button onClick={() => setIsApplyModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitLeaveMutation.mutate(formData);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Employee *</label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] bg-white font-semibold"
                >
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber} &bull; {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Leave Entitlement / Policy *</label>
                <select
                  required
                  value={formData.policyId}
                  onChange={(e) => setFormData({ ...formData, policyId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] bg-white font-semibold"
                >
                  {policies.map((pol: any) => (
                    <option key={pol.id} value={pol.id}>
                      {pol.name} ({pol.daysPerYear} days/yr &bull; {pol.isPaid ? "Paid" : "Unpaid"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => {
                      setFormData({ ...formData, startDate: e.target.value });
                      handleDatesChange(e.target.value, formData.endDate);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => {
                      setFormData({ ...formData, endDate: e.target.value });
                      handleDatesChange(formData.startDate, e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Total Working Days</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={formData.workingDaysCount}
                  onChange={(e) => setFormData({ ...formData, workingDaysCount: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Reason / Purpose *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="State reason for absence..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLeaveMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs flex items-center gap-2"
                >
                  {submitLeaveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
