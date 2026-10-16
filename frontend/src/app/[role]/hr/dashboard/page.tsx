"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Banknote, 
  ArrowUpRight, 
  TrendingUp, 
  Loader2, 
  Sparkles, 
  CalendarDays,
  ShieldAlert,
  UserCheck,
  UserX,
  ChevronRight,
  ClipboardList,
  Layers
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";
import StatusBadge from "@/components/ui/StatusBadge";

export default function HrDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = params.role as string;

  // Fetch Dashboard Stats
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ["hr-dashboard"],
    queryFn: async () => (await api.get("/hr/dashboard")).data,
    refetchInterval: 15000 // Refresh live attendance every 15s
  });

  // Seed / Bootstrap Zambia statutory defaults
  const seedMutation = useMutation({
    mutationFn: async () => (await api.post("/hr/bootstrap-defaults", {})).data,
    onSuccess: (res) => {
      toast.success(res.message || "Zambia HR & Payroll baseline seeded successfully!");
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to initialize defaults");
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#526B91]">Loading Zambia HR &amp; Payroll Intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl max-w-lg mx-auto my-12">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-rose-900">Failed to load HR Dashboard</h3>
        <p className="text-xs text-rose-700 mt-1">Please ensure your user session is authorized with HR_PAYROLL, ADMIN, or SUPERADMIN.</p>
      </div>
    );
  }

  const activePayroll = dashboard?.activePayrollPeriod;
  const holidays = dashboard?.upcomingHolidays || [];
  const recentPunches = dashboard?.recentAttendance || [];

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      {/* Page Header */}
      <PageHeader
        title="Human Resources & Payroll (Zambia)"
        subtitle="Workforce Operations, Lusaka Factory Attendance, Statutory Benefits & ZMW Payroll"
        icon={<Users className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CBD7E7] text-[#061B3A] hover:bg-[#F4F9FF] font-semibold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0878F9]" /> : <Sparkles className="w-3.5 h-3.5 text-[#0878F9]" />}
              Initialize Zambia Statutory Defaults
            </button>
            <button
              onClick={() => router.push(`/${roleSlug}/hr/attendance`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Clock className="w-4 h-4" />
              Clock Punch Register
            </button>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Workforce */}
        <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Active Employees</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0878F9] flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#061B3A]">{dashboard?.activeEmployeesCount || 0}</span>
            <span className="text-xs text-[#526B91] font-semibold">of {dashboard?.totalEmployeesCount || 0} enrolled</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Lusaka Plant &amp; Assembly Ops</span>
          </div>
        </div>

        {/* Today's Present & Clocked-In */}
        <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Present Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">{dashboard?.presentCount || 0}</span>
            <span className="text-xs text-[#526B91] font-semibold">({dashboard?.clockedInCount || 0} currently on floor)</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs font-semibold">
            <span className="text-amber-600 font-medium">Late: {dashboard?.lateCount || 0}</span>
            <span className="text-[#CBD7E7]">|</span>
            <span className="text-slate-500 font-medium">Grace period: 15 min</span>
          </div>
        </div>

        {/* Missing Clock-Outs & Corrections */}
        <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Exceptions &amp; Approvals</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">
              {(dashboard?.pendingCorrectionsCount || 0) + (dashboard?.pendingLeaveCount || 0)}
            </span>
            <span className="text-xs text-[#526B91] font-semibold">pending action</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#526B91]">
            <span>Leave: <strong className="text-[#061B3A]">{dashboard?.pendingLeaveCount || 0}</strong></span>
            <span>Corrections: <strong className="text-[#061B3A]">{dashboard?.pendingCorrectionsCount || 0}</strong></span>
            <span>Missed punch: <strong className="text-rose-600">{dashboard?.missingClockOutCount || 0}</strong></span>
          </div>
        </div>

        {/* Payroll Cycle */}
        <div className="p-5 rounded-2xl bg-white border border-[#CBD7E7] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Active Payroll Run</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#061B3A]">
              {activePayroll ? activePayroll.periodCode : "No Run Active"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-[#526B91] font-medium">Status:</span>
            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-100 text-blue-800">
              {activePayroll ? activePayroll.status : "READY"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Links, Upcoming Holidays, Recent Punches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Quick Modules */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-[#CBD7E7] p-5 shadow-xs">
            <h3 className="text-xs font-bold text-[#061B3A] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0878F9]" />
              HR &amp; Payroll Subsystems
            </h3>
            <div className="space-y-2">
              {[
                { title: "Employee Directory", desc: "NRC, TPIN, NAPSA & salary structures", path: "employees", icon: Users },
                { title: "Attendance & Timesheets", desc: "Shift punches, worked hours & overtime", path: "attendance", icon: Clock },
                { title: "Working Calendar & Shifts", desc: "Zambia statutory holidays & plant schedules", path: "calendar", icon: Calendar },
                { title: "Leave Management", desc: "24-day statutory leave, sick & maternity", path: "leave", icon: ClipboardList },
                { title: "Salary Structures & Payroll", desc: "ZMW PAYE tax, NAPSA 5% & NHIMA 1%", path: "payroll", icon: Banknote },
                { title: "Statutory & HR Reports", desc: "Attendance logs, payroll register & exports", path: "reports", icon: FileText }
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => router.push(`/${roleSlug}/hr/${item.path}`)}
                  className="p-3 rounded-xl border border-[#CBD7E7]/60 hover:border-[#0878F9] hover:bg-[#F4F9FF] transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F4F9FF] group-hover:bg-[#0878F9] group-hover:text-white text-[#0878F9] flex items-center justify-center transition-colors">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#061B3A] group-hover:text-[#0878F9] transition-colors">{item.title}</h4>
                      <p className="text-[10px] text-[#526B91]">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#CBD7E7] group-hover:text-[#0878F9] transition-colors" />
                </div>
              ))}
            </div>
          </div>

          {/* Zambia Statutory Compliance Summary */}
          <div className="bg-[#061B3A] text-white rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2 text-[#0878F9] text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              Republic of Zambia Compliance
            </div>
            <h4 className="text-sm font-bold mb-3">Statutory Standard Framework</h4>
            <ul className="space-y-2 text-xs text-[#CBD7E7]">
              <li className="flex items-center justify-between py-1 border-b border-white/10">
                <span>ZRA PAYE Tax:</span>
                <span className="font-bold text-white">4 Progressive Brackets (0% - 37%)</span>
              </li>
              <li className="flex items-center justify-between py-1 border-b border-white/10">
                <span>NAPSA Pension:</span>
                <span className="font-bold text-white">5% Employee + 5% Employer</span>
              </li>
              <li className="flex items-center justify-between py-1 border-b border-white/10">
                <span>NHIMA Health:</span>
                <span className="font-bold text-white">1% Employee + 1% Employer</span>
              </li>
              <li className="flex items-center justify-between py-1">
                <span>Timezone:</span>
                <span className="font-bold text-white">Africa/Lusaka (UTC+2)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Center/Right: Live Attendance Stream & Upcoming Holidays */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Clock Events */}
          <div className="bg-white rounded-2xl border border-[#CBD7E7] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Live Floor Attendance Stream</h3>
                <p className="text-xs text-[#526B91]">Recent shift punches recorded across Lusaka assembly lines</p>
              </div>
              <button
                onClick={() => router.push(`/${roleSlug}/hr/attendance`)}
                className="text-xs text-[#0878F9] hover:underline font-semibold"
              >
                View Full Register &rarr;
              </button>
            </div>

            {recentPunches.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#CBD7E7] rounded-xl text-xs text-[#526B91]">
                No punch events recorded today yet. Use the Attendance section to clock in workers.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#CBD7E7] text-[#526B91] font-semibold uppercase text-[10px]">
                      <th className="pb-2">Employee</th>
                      <th className="pb-2">Department</th>
                      <th className="pb-2">Shift</th>
                      <th className="pb-2">Clock In</th>
                      <th className="pb-2">Clock Out</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CBD7E7]/50">
                    {recentPunches.map((item: any) => (
                      <tr key={item.id} className="hover:bg-[#F4F9FF]/60 transition-colors">
                        <td className="py-2.5 font-bold text-[#061B3A]">
                          {item.employee?.firstName} {item.employee?.lastName}
                          <span className="block text-[10px] font-normal text-[#526B91]">{item.employee?.employeeNumber}</span>
                        </td>
                        <td className="py-2.5 text-[#526B91]">{item.employee?.department}</td>
                        <td className="py-2.5 text-[#061B3A]">{item.shift?.name || "General Shift"}</td>
                        <td className="py-2.5 font-mono text-emerald-600 font-semibold">
                          {item.clockIn ? new Date(item.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="py-2.5 font-mono text-slate-600">
                          {item.clockOut ? new Date(item.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "In Progress"}
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            item.status === "LATE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upcoming Official Zambia Public Holidays */}
          <div className="bg-white rounded-2xl border border-[#CBD7E7] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Upcoming Zambia Gazette Holidays</h3>
                <p className="text-xs text-[#526B91]">Officially declared national non-working and factory rest days</p>
              </div>
              <button
                onClick={() => router.push(`/${roleSlug}/hr/calendar`)}
                className="text-xs text-[#0878F9] hover:underline font-semibold"
              >
                Calendar View &rarr;
              </button>
            </div>

            {holidays.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#CBD7E7] rounded-xl text-xs text-[#526B91]">
                No upcoming holidays found. Click &quot;Initialize Zambia Statutory Defaults&quot; above to seed 2026 official holidays.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {holidays.map((h: any) => (
                  <div key={h.id} className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#CBD7E7] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#061B3A]">{h.name}</h4>
                      <p className="text-[11px] text-[#526B91] mt-0.5">
                        {new Date(h.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded bg-white text-[10px] font-bold text-[#0878F9] border border-[#CBD7E7]">
                      {h.isStatutory ? "Gazette" : "Company"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
