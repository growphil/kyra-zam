"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Clock, 
  Search, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  UserCheck, 
  UserX, 
  Loader2, 
  Filter, 
  X, 
  Check, 
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function HrAttendancePage() {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modals
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [requestedIn, setRequestedIn] = useState("");
  const [requestedOut, setRequestedOut] = useState("");

  // Quick punch form state
  const [clockEmployeeId, setClockEmployeeId] = useState("");
  const [clockType, setClockType] = useState<"IN" | "OUT">("IN");
  const [clockNotes, setClockNotes] = useState("");

  // Fetch Attendance
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ["hr-attendance", selectedDate, departmentFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDate) params.append("date", selectedDate);
      if (departmentFilter !== "ALL") params.append("department", departmentFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      return (await api.get(`/hr/attendance?${params.toString()}`)).data;
    }
  });

  // Fetch Employees for punch modal
  const { data: employeesData } = useQuery({
    queryKey: ["hr-employees-quick"],
    queryFn: async () => (await api.get("/hr/employees?status=ACTIVE")).data
  });

  // Fetch pending corrections
  const { data: correctionsData } = useQuery({
    queryKey: ["hr-corrections-pending"],
    queryFn: async () => (await api.get("/hr/attendance/corrections?status=PENDING")).data
  });

  const attendances = attendanceData?.attendances || [];
  const employees = employeesData?.employees || [];
  const pendingCorrections = correctionsData?.corrections || [];

  // Clock Punch Mutation
  const clockMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/hr/attendance/clock", payload)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Clock event registered");
      setIsClockModalOpen(false);
      setClockNotes("");
      queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to process punch");
    }
  });

  // Correction Submit Mutation
  const correctionSubmitMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/hr/attendance/corrections", payload)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Correction request submitted");
      setIsCorrectionModalOpen(false);
      setCorrectionReason("");
      queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["hr-corrections-pending"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to submit correction");
    }
  });

  // Correction Decision Mutation
  const decideMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "APPROVED" | "REJECTED" }) => {
      return (await api.patch(`/hr/attendance/corrections/${id}/decide`, { decision })).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Correction decided");
      queryClient.invalidateQueries({ queryKey: ["hr-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["hr-corrections-pending"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to process decision");
    }
  });

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      <PageHeader
        title="Attendance Register & Timesheets"
        subtitle="Africa/Lusaka Shift Timings, Overtime Calculations, Exceptions & Correction History"
        icon={<Clock className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => {
              setClockEmployeeId(employees[0]?.id || "");
              setIsClockModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Clock className="w-4 h-4" />
            Record Clock Punch
          </button>
        }
      />

      {/* Pending Corrections Alert Banner if any */}
      {pendingCorrections.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              {pendingCorrections.length} Pending Attendance Correction Request(s)
            </h4>
          </div>
          <div className="space-y-2">
            {pendingCorrections.map((corr: any) => (
              <div key={corr.id} className="p-3 bg-white rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-[#061B3A]">{corr.employee?.firstName} {corr.employee?.lastName}</span>
                  <span className="text-[11px] text-[#526B91] ml-2">({corr.employee?.employeeNumber})</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    <strong>Reason:</strong> &ldquo;{corr.reason}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decideMutation.mutate({ id: corr.id, decision: "APPROVED" })}
                    disabled={decideMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => decideMutation.mutate({ id: corr.id, decision: "REJECTED" })}
                    disabled={decideMutation.isPending}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#CBD7E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#526B91]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white font-medium focus:outline-none focus:border-[#0878F9]"
            />
          </div>

          <button
            onClick={() => setSelectedDate(todayStr)}
            className="px-3 py-2 rounded-xl bg-[#F4F9FF] border border-[#CBD7E7] text-[#0878F9] hover:bg-[#0878F9] hover:text-white font-semibold text-xs transition-all cursor-pointer"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#526B91] uppercase">Dept:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white focus:outline-none focus:border-[#0878F9]"
            >
              <option value="ALL">All Departments</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Testing & QC">Testing &amp; QC</option>
              <option value="Supply Chain">Supply Chain</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#526B91] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white focus:outline-none focus:border-[#0878F9]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Register Table */}
      <div className="bg-white rounded-2xl border border-[#CBD7E7] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#526B91]">Loading attendance logs for {selectedDate}...</p>
          </div>
        ) : attendances.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-[#CBD7E7] mx-auto mb-3" />
            <h4 className="text-sm font-bold text-[#061B3A]">No attendance records found for {selectedDate}</h4>
            <p className="text-xs text-[#526B91] mt-1">Use the &quot;Record Clock Punch&quot; button above to clock in employees.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F9FF] border-b border-[#CBD7E7] text-[#526B91] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Shift Scheduled</th>
                  <th className="py-3 px-4">Clock In (Lusaka)</th>
                  <th className="py-3 px-4">Clock Out (Lusaka)</th>
                  <th className="py-3 px-4">Worked Hours</th>
                  <th className="py-3 px-4">Overtime (h)</th>
                  <th className="py-3 px-4">Status &amp; Exceptions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD7E7]/60">
                {attendances.map((att: any) => (
                  <tr key={att.id} className="hover:bg-[#F4F9FF]/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#061B3A]">{att.employee?.firstName} {att.employee?.lastName}</div>
                      <div className="text-[11px] font-mono text-[#0878F9]">{att.employee?.employeeNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-[#526B91]">{att.employee?.department}</td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] text-[#061B3A] font-medium">
                        {att.shift ? `${att.shift.name} (${att.shift.startTime} - ${att.shift.endTime})` : "General (08:00 - 17:00)"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-600">
                      {att.clockIn ? new Date(att.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                      {att.clockOut ? new Date(att.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (
                        <span className="text-amber-600 font-sans text-[11px] bg-amber-50 px-2 py-0.5 rounded">Clocked In</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#061B3A]">
                      {att.workedHours ? `${att.workedHours} hrs` : "0 hrs"}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {att.overtimeHours > 0 ? (
                        <span className="font-bold text-indigo-600">+{att.overtimeHours} hrs</span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          att.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          att.status === "LATE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          att.status === "ON_LEAVE" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {att.status}
                        </span>
                        {att.lateMinutes > 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">({att.lateMinutes}m late)</span>
                        )}
                        {att.isMissingPunch && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">Punch Missed</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedAttendance(att);
                          setRequestedIn(att.clockIn ? new Date(att.clockIn).toISOString().slice(11, 16) : "");
                          setRequestedOut(att.clockOut ? new Date(att.clockOut).toISOString().slice(11, 16) : "");
                          setIsCorrectionModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-[#0878F9] hover:underline cursor-pointer"
                      >
                        Request Correction
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Punch Modal */}
      {isClockModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Record Shift Clock Punch</h3>
                <p className="text-[11px] text-[#526B91]">Lusaka timezone punch logger</p>
              </div>
              <button onClick={() => setIsClockModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                clockMutation.mutate({
                  employeeId: clockEmployeeId,
                  type: clockType,
                  notes: clockNotes
                });
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Select Employee *</label>
                <select
                  required
                  value={clockEmployeeId}
                  onChange={(e) => setClockEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] bg-white text-xs font-semibold"
                >
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber} &bull; {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Punch Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClockType("IN")}
                    className={`py-2 rounded-xl font-bold border text-xs transition-all cursor-pointer ${
                      clockType === "IN"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-[#CBD7E7] hover:bg-[#F4F9FF]"
                    }`}
                  >
                    Clock IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockType("OUT")}
                    className={`py-2 rounded-xl font-bold border text-xs transition-all cursor-pointer ${
                      clockType === "OUT"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-[#CBD7E7] hover:bg-[#F4F9FF]"
                    }`}
                  >
                    Clock OUT
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Notes / Station Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Line 1 Assembly Punch"
                  value={clockNotes}
                  onChange={(e) => setClockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsClockModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={clockMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs flex items-center gap-2"
                >
                  {clockMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Record Punch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Correction Modal */}
      {isCorrectionModalOpen && selectedAttendance && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Attendance Correction Request</h3>
                <p className="text-[11px] text-[#526B91]">
                  {selectedAttendance.employee?.firstName} {selectedAttendance.employee?.lastName} ({selectedAttendance.employee?.employeeNumber})
                </p>
              </div>
              <button onClick={() => setIsCorrectionModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Create full datetime strings on the attendance workDate
                const wDateStr = new Date(selectedAttendance.workDate).toISOString().split("T")[0];
                const fullIn = requestedIn ? new Date(`${wDateStr}T${requestedIn}:00.000Z`).toISOString() : null;
                const fullOut = requestedOut ? new Date(`${wDateStr}T${requestedOut}:00.000Z`).toISOString() : null;

                correctionSubmitMutation.mutate({
                  attendanceId: selectedAttendance.id,
                  requestedClockIn: fullIn,
                  requestedClockOut: fullOut,
                  reason: correctionReason
                });
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Correct Clock In Time</label>
                  <input
                    type="time"
                    value={requestedIn}
                    onChange={(e) => setRequestedIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Correct Clock Out Time</label>
                  <input
                    type="time"
                    value={requestedOut}
                    onChange={(e) => setRequestedOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Reason for Correction *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain reason (e.g. Biometric scanner offline, overtime approved by line supervisor...)"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionSubmitMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs flex items-center gap-2"
                >
                  {correctionSubmitMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
