"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Loader2, 
  X, 
  Check, 
  Building2, 
  Mail, 
  Phone, 
  CreditCard, 
  Briefcase,
  Calendar,
  Layers,
  Trash2,
  UserX,
  UserCheck,
  AlertTriangle
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function HrEmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showBankDetails, setShowBankDetails] = useState<Record<string, boolean>>({});
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<any>(null);

  // Query employees
  const { data, isLoading } = useQuery({
    queryKey: ["hr-employees", search, departmentFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (departmentFilter !== "ALL") params.append("department", departmentFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      return (await api.get(`/hr/employees?${params.toString()}`)).data;
    }
  });

  // Query shifts
  const { data: shiftsData } = useQuery({
    queryKey: ["hr-shifts"],
    queryFn: async () => (await api.get("/hr/shifts")).data
  });

  const employees = data?.employees || [];
  const shifts = shiftsData?.shifts || [];

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nrcNumber: "",
    tpinNumber: "",
    napsaNumber: "",
    nhimaNumber: "",
    department: "Manufacturing",
    designation: "Assembly Technician",
    employmentStatus: "ACTIVE",
    employmentType: "FULL_TIME",
    shiftId: "",
    salaryBasis: "MONTHLY",
    baseSalary: 6500,
    currency: "ZMW",
    bankName: "Stanbic Bank Zambia",
    bankBranch: "Lusaka Industrial Area",
    bankAccountNumber: "",
    mobileMoneyProvider: "MTN",
    mobileMoneyNumber: ""
  });

  const handleOpenAdd = () => {
    setSelectedEmployee(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      nrcNumber: "",
      tpinNumber: "",
      napsaNumber: "",
      nhimaNumber: "",
      department: "Manufacturing",
      designation: "Assembly Technician",
      employmentStatus: "ACTIVE",
      employmentType: "FULL_TIME",
      shiftId: shifts[0]?.id || "",
      salaryBasis: "MONTHLY",
      baseSalary: 6500,
      currency: "ZMW",
      bankName: "Stanbic Bank Zambia",
      bankBranch: "Lusaka Industrial Area",
      bankAccountNumber: "",
      mobileMoneyProvider: "MTN",
      mobileMoneyNumber: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setSelectedEmployee(emp);
    setFormData({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email || "",
      phone: emp.phone || "",
      nrcNumber: emp.nrcNumber || "",
      tpinNumber: emp.tpinNumber || "",
      napsaNumber: emp.napsaNumber || "",
      nhimaNumber: emp.nhimaNumber || "",
      department: emp.department,
      designation: emp.designation,
      employmentStatus: emp.employmentStatus,
      employmentType: emp.employmentType,
      shiftId: emp.shiftId || "",
      salaryBasis: emp.salaryBasis,
      baseSalary: emp.baseSalary,
      currency: emp.currency || "ZMW",
      bankName: emp.bankName || "",
      bankBranch: emp.bankBranch || "",
      bankAccountNumber: emp.bankAccountNumber || "",
      mobileMoneyProvider: emp.mobileMoneyProvider || "MTN",
      mobileMoneyNumber: emp.mobileMoneyNumber || ""
    });
    setIsModalOpen(true);
  };

  // Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (selectedEmployee) {
        return (await api.patch(`/hr/employees/${selectedEmployee.id}`, payload)).data;
      } else {
        return (await api.post("/hr/employees", payload)).data;
      }
    },
    onSuccess: () => {
      toast.success(selectedEmployee ? "Employee record updated" : "Employee registered successfully");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to save employee");
    }
  });

  // Delete Employee Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/hr/employees/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Employee deleted successfully");
      setDeleteConfirmEmp(null);
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to delete employee");
    }
  });

  // Toggle Employee Status Mutation (Active <-> Inactive / Suspended)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status?: string }) => {
      return (await api.patch(`/hr/employees/${id}/toggle-status`, { status })).data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Employee status updated");
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update employee status");
    }
  });

  return (
    <div className="space-y-6 max-w-[1700px] pb-12">
      <PageHeader
        title="Employee Directory & Employment Records"
        subtitle="Manage personnel profiles, Zambia statutory IDs (NRC, TPIN, NAPSA, NHIMA) and salary baselines"
        icon={<Users className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Register New Employee
          </button>
        }
      />

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#CBD7E7] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, employee #, NRC or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#CBD7E7] bg-white focus:outline-none focus:border-[#0878F9]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Department Filter */}
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
              <option value="Human Resources">Human Resources</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#526B91] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-2 px-3 rounded-xl border border-[#CBD7E7] bg-white focus:outline-none focus:border-[#0878F9]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="INACTIVE">Inactive (Suspended / Terminated)</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-[#CBD7E7] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#526B91]">Loading employees directory...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-[#CBD7E7] mx-auto mb-3" />
            <h4 className="text-sm font-bold text-[#061B3A]">No employees found</h4>
            <p className="text-xs text-[#526B91] mt-1">Register an employee or adjust your search filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F9FF] border-b border-[#CBD7E7] text-[#526B91] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Emp ID &amp; Name</th>
                  <th className="py-3 px-4">Role &amp; Department</th>
                  <th className="py-3 px-4">Assigned Shift</th>
                  <th className="py-3 px-4">Zambia Statutory IDs</th>
                  <th className="py-3 px-4">Base Salary (ZMW)</th>
                  <th className="py-3 px-4">Bank / Disbursement</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD7E7]/60">
                {employees.map((emp: any) => {
                  const isBankVisible = showBankDetails[emp.id];
                  return (
                    <tr key={emp.id} className="hover:bg-[#F4F9FF]/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#061B3A]">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[11px] font-mono text-[#0878F9]">{emp.employeeNumber}</div>
                        {emp.phone && <div className="text-[10px] text-[#526B91] mt-0.5">{emp.phone}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#061B3A]">{emp.designation}</div>
                        <div className="text-[11px] text-[#526B91]">{emp.department} &bull; {emp.employmentType}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                          {emp.shift ? emp.shift.name : "Default Shift"}
                        </span>
                      </td>
                      <td className="py-3 px-4 space-y-0.5 text-[11px]">
                        <div><strong className="text-[#526B91]">NRC:</strong> {emp.nrcNumber || "—"}</div>
                        <div><strong className="text-[#526B91]">TPIN:</strong> {emp.tpinNumber || "—"}</div>
                        <div><strong className="text-[#526B91]">NAPSA:</strong> {emp.napsaNumber || "—"}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#061B3A]">
                        ZMW {emp.baseSalary?.toLocaleString() || "0.00"}
                        <span className="block text-[10px] font-normal text-[#526B91]">{emp.salaryBasis}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-[#061B3A]">
                            {isBankVisible
                              ? (emp.bankAccountNumber ? `${emp.bankName} - ${emp.bankAccountNumber}` : emp.mobileMoneyNumber ? `${emp.mobileMoneyProvider}: ${emp.mobileMoneyNumber}` : "Cash")
                              : (emp.bankAccountNumber ? "•••• •••• ••••" : emp.mobileMoneyNumber ? "Mobile Money (Hidden)" : "Cash")}
                          </span>
                          <button
                            onClick={() => setShowBankDetails(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                            className="text-[#526B91] hover:text-[#0878F9] p-1 cursor-pointer"
                            title={isBankVisible ? "Hide sensitive bank details" : "Show bank details"}
                          >
                            {isBankVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.employmentStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          emp.employmentStatus === "PROBATION" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {emp.employmentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 rounded-lg border border-[#CBD7E7] hover:border-[#0878F9] hover:text-[#0878F9] text-[#526B91] transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>

                          {/* Toggle Active / Inactive Button */}
                          {emp.employmentStatus === "ACTIVE" || emp.employmentStatus === "PROBATION" ? (
                            <button
                              onClick={() => toggleStatusMutation.mutate({ id: emp.id, status: "SUSPENDED" })}
                              disabled={toggleStatusMutation.isPending}
                              className="p-1.5 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-700 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                              title="Mark Inactive / Suspend"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleStatusMutation.mutate({ id: emp.id, status: "ACTIVE" })}
                              disabled={toggleStatusMutation.isPending}
                              className="p-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 text-emerald-700 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                              title="Set Active"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Activate
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmEmp(emp)}
                            className="p-1.5 rounded-lg border border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-rose-600 transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#CBD7E7] my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#CBD7E7]">
              <div>
                <h3 className="text-base font-bold text-[#061B3A]">
                  {selectedEmployee ? `Edit Employee (${selectedEmployee.employeeNumber})` : "Register New Employee"}
                </h3>
                <p className="text-xs text-[#526B91]">Zambia HR profile, employment terms &amp; statutory compliance</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#F4F9FF] text-[#526B91] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(formData);
              }}
              className="mt-4 space-y-4 text-xs"
            >
              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Phone Number (+260)</label>
                  <input
                    type="text"
                    placeholder="+260 97 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>
              </div>

              {/* Zambia Statutory IDs */}
              <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#CBD7E7] space-y-3">
                <div className="text-[11px] font-bold text-[#0878F9] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Zambia Statutory Numbers
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">NRC Number</label>
                    <input
                      type="text"
                      placeholder="123456/78/1"
                      value={formData.nrcNumber}
                      onChange={(e) => setFormData({ ...formData, nrcNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">TPIN (ZRA)</label>
                    <input
                      type="text"
                      placeholder="1000000000"
                      value={formData.tpinNumber}
                      onChange={(e) => setFormData({ ...formData, tpinNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">NAPSA Social Sec</label>
                    <input
                      type="text"
                      placeholder="NP-123456"
                      value={formData.napsaNumber}
                      onChange={(e) => setFormData({ ...formData, napsaNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">NHIMA Health No</label>
                    <input
                      type="text"
                      placeholder="NH-123456"
                      value={formData.nhimaNumber}
                      onChange={(e) => setFormData({ ...formData, nhimaNumber: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Department, Designation, Shift */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] bg-white"
                  >
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Testing & QC">Testing &amp; QC</option>
                    <option value="Supply Chain">Supply Chain</option>
                    <option value="Finance">Finance</option>
                    <option value="Human Resources">Human Resources</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Assigned Shift</label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7] bg-white"
                  >
                    <option value="">No Shift / Flexible</option>
                    {shifts.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Structure (ZMW) */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Salary Structure (Zambian Kwacha - ZMW)
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">Salary Basis</label>
                    <select
                      value={formData.salaryBasis}
                      onChange={(e) => setFormData({ ...formData, salaryBasis: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="DAILY">Daily</option>
                      <option value="HOURLY">Hourly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">Base Salary (ZMW)</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      required
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#526B91] mb-1">Employment Status</label>
                    <select
                      value={formData.employmentStatus}
                      onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#CBD7E7] bg-white text-xs"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="PROBATION">Probation</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bank & Payment Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Bank Name &amp; Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. Stanbic Bank / Zanaco"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#061B3A] mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    placeholder="Account number"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD7E7]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#CBD7E7]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {selectedEmployee ? "Save Changes" : "Register Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 bg-[#061B3A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#061B3A]">Delete Employee Record?</h3>
                <p className="text-xs text-[#526B91]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed mb-4">
              Are you sure you want to permanently delete employee{" "}
              <strong className="text-[#061B3A]">{deleteConfirmEmp.firstName} {deleteConfirmEmp.lastName}</strong>{" "}
              (<span className="font-mono text-[#0878F9]">{deleteConfirmEmp.employeeNumber}</span>)?
              All related attendance, correction requests, leave balances and draft payroll records will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD7E7]">
              <button
                type="button"
                onClick={() => setDeleteConfirmEmp(null)}
                className="px-4 py-2 rounded-xl border border-[#CBD7E7] text-[#526B91] hover:bg-[#F4F9FF] font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmEmp.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
