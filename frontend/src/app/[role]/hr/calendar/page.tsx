"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Clock, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  Loader2, 
  X, 
  Check, 
  AlertCircle,
  Layers,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function HrCalendarPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [viewMode, setViewMode] = useState<"LIST" | "MONTH">("LIST");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Modals
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Forms
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    isStatutory: true,
    isMovable: false,
    description: "",
    isCompanyShutdown: false,
    applicableDepartment: ""
  });

  const [shiftForm, setShiftForm] = useState({
    name: "",
    code: "",
    startTime: "07:00",
    endTime: "15:30",
    breakMinutes: 30,
    graceMinutes: 15,
    isFactoryShift: true,
    workDays: [1, 2, 3, 4, 5, 6]
  });

  // Query Holidays
  const { data: holidayData, isLoading: isHolidaysLoading } = useQuery({
    queryKey: ["hr-calendar-holidays", selectedYear],
    queryFn: async () => (await api.get(`/hr/calendar/holidays?year=${selectedYear}`)).data
  });

  // Query Shifts
  const { data: shiftData, isLoading: isShiftsLoading } = useQuery({
    queryKey: ["hr-shifts"],
    queryFn: async () => (await api.get("/hr/shifts")).data
  });

  const holidays = holidayData?.holidays || [];
  const shifts = shiftData?.shifts || [];

  // Mutations
  const createHolidayMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/hr/calendar/holidays", payload)).data,
    onSuccess: () => {
      toast.success("Calendar entry created successfully");
      setIsHolidayModalOpen(false);
      setHolidayForm({
        name: "",
        date: "",
        isStatutory: true,
        isMovable: false,
        description: "",
        isCompanyShutdown: false,
        applicableDepartment: ""
      });
      queryClient.invalidateQueries({ queryKey: ["hr-calendar-holidays"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to create holiday")
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/hr/calendar/holidays/${id}`)).data,
    onSuccess: () => {
      toast.success("Holiday removed");
      queryClient.invalidateQueries({ queryKey: ["hr-calendar-holidays"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to delete holiday")
  });

  const createShiftMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/hr/shifts", payload)).data,
    onSuccess: () => {
      toast.success("Shift schedule configured");
      setIsShiftModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr-shifts"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to create shift")
  });

  // Month navigation
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const filteredHolidays = holidays.filter((h: any) => {
    if (viewMode === "MONTH") {
      const hMonth = new Date(h.date).getMonth();
      return hMonth === selectedMonth;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      <PageHeader
        title="Zambia Working Calendar & Shift Schedules"
        subtitle="Africa/Lusaka Timezone, Statutory Gazette Holidays, Factory Operating Shifts & Break Rules"
        icon={<CalendarIcon className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#CBD7E7] text-[#061B3A] hover:bg-[#F4F9FF] font-semibold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[#0878F9]" />
              New Shift Schedule
            </button>
            <button
              onClick={() => setIsHolidayModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Holiday / Shutdown
            </button>
          </div>
        }
      />

      {/* Shifts Section */}
      <div className="bg-white rounded-2xl border border-[#CBD7E7] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#061B3A]">Factory &amp; Corporate Working Shifts</h3>
            <p className="text-xs text-[#526B91]">Shift windows, grace periods and meal break deductions</p>
          </div>
        </div>

        {isShiftsLoading ? (
          <div className="p-6 text-center text-xs text-[#526B91]">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#526B91] border border-dashed border-[#CBD7E7] rounded-xl">
            No shifts configured. Create your first shift using &quot;New Shift Schedule&quot; above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((s: any) => (
              <div key={s.id} className="p-4 rounded-xl border border-[#CBD7E7] bg-[#F4F9FF] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#061B3A] text-xs">{s.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#0878F9] border border-[#CBD7E7]">
                    {s.code}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 font-mono text-lg font-black text-[#061B3A]">
                  <span>{s.startTime}</span>
                  <span className="text-xs font-normal text-[#526B91]">to</span>
                  <span>{s.endTime}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#526B91] pt-2 border-t border-[#CBD7E7]/60">
                  <span>Break: <strong>{s.breakMinutes}m</strong></span>
                  <span>Grace: <strong>{s.graceMinutes}m</strong></span>
                  <span>Staff: <strong>{s._count?.employees || 0}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Holidays & Working Days Header */}
      <div className="bg-white p-4 rounded-2xl border border-[#CBD7E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#526B91] uppercase">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white font-bold text-[#061B3A]"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex rounded-xl border border-[#CBD7E7] p-0.5 bg-slate-50 text-xs font-bold">
            <button
              onClick={() => setViewMode("LIST")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === "LIST" ? "bg-white text-[#0878F9] shadow-xs" : "text-[#526B91] hover:text-[#061B3A]"
              }`}
            >
              Annual List View
            </button>
            <button
              onClick={() => setViewMode("MONTH")}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === "MONTH" ? "bg-white text-[#0878F9] shadow-xs" : "text-[#526B91] hover:text-[#061B3A]"
              }`}
            >
              Month View
            </button>
          </div>
        </div>

        {viewMode === "MONTH" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMonth((prev) => (prev > 0 ? prev - 1 : 11))}
              className="p-1.5 rounded-lg border border-[#CBD7E7] hover:bg-[#F4F9FF] text-[#061B3A]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[#061B3A] min-w-[90px] text-center">
              {monthNames[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={() => setSelectedMonth((prev) => (prev < 11 ? prev + 1 : 0))}
              className="p-1.5 rounded-lg border border-[#CBD7E7] hover:bg-[#F4F9FF] text-[#061B3A]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Holidays List / Calendar Grid */}
      <div className="bg-white rounded-2xl border border-[#CBD7E7] overflow-hidden shadow-xs">
        {isHolidaysLoading ? (
          <div className="p-12 text-center text-xs text-[#526B91]">Loading calendar holidays...</div>
        ) : filteredHolidays.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-[#CBD7E7] mx-auto mb-3" />
            <h4 className="text-sm font-bold text-[#061B3A]">No holidays recorded</h4>
            <p className="text-xs text-[#526B91] mt-1">Initialize the statutory defaults on the HR Dashboard or add custom entries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F9FF] border-b border-[#CBD7E7] text-[#526B91] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Holiday / Event Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Plant Impact</th>
                  <th className="py-3 px-4">Description / Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD7E7]/60">
                {filteredHolidays.map((h: any) => (
                  <tr key={h.id} className="hover:bg-[#F4F9FF]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#061B3A]">
                      {new Date(h.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#061B3A]">{h.name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        h.isStatutory ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}>
                        {h.isStatutory ? "Zambia Statutory Gazette" : "Company Specific"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {h.isCompanyShutdown ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Complete Factory Shutdown
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#526B91]">Normal Rest Day</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[#526B91] max-w-xs truncate">
                      {h.description || "Official Public Holiday"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${h.name}?`)) {
                            deleteHolidayMutation.mutate(h.id);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Holiday Modal */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Add Calendar Entry</h3>
                <p className="text-[11px] text-[#526B91]">Public holiday or company factory shutdown</p>
              </div>
              <button onClick={() => setIsHolidayModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createHolidayMutation.mutate(holidayForm);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Holiday / Event Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special National Day of Prayer"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holidayForm.isStatutory}
                    onChange={(e) => setHolidayForm({ ...holidayForm, isStatutory: e.target.checked })}
                    className="rounded text-[#0878F9]"
                  />
                  <span className="font-semibold text-[#061B3A]">Official Statutory Zambian Gazette Holiday</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={holidayForm.isCompanyShutdown}
                    onChange={(e) => setHolidayForm({ ...holidayForm, isCompanyShutdown: e.target.checked })}
                    className="rounded text-[#0878F9]"
                  />
                  <span className="font-semibold text-[#061B3A]">Company Factory Shutdown (Assembly lines closed)</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Presidential decree or annual maintenance shutdown"
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createHolidayMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs flex items-center gap-2"
                >
                  {createHolidayMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Calendar Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD7E7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-sm font-bold text-[#061B3A]">Configure Shift Schedule</h3>
                <p className="text-[11px] text-[#526B91]">Factory line or administrative timings</p>
              </div>
              <button onClick={() => setIsShiftModalOpen(false)} className="text-[#526B91] hover:text-[#061B3A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createShiftMutation.mutate(shiftForm);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Battery Assembly Night Shift"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Shift Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SH-NIGHT"
                  value={shiftForm.code}
                  onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Start Time (24h) *</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">End Time (24h) *</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Break Duration (mins)</label>
                  <input
                    type="number"
                    value={shiftForm.breakMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Grace Period (mins)</label>
                  <input
                    type="number"
                    value={shiftForm.graceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createShiftMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs flex items-center gap-2"
                >
                  {createShiftMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
