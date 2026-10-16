"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Loader2, 
  Save, 
  Search, 
  UserCheck, 
  Mail, 
  Lock, 
  Shield, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const ROLE_CATEGORIES = [
  {
    name: "Executive & Oversight",
    icon: ShieldCheck,
    roles: [
      { id: "SUPERADMIN", label: "Super Admin", desc: "Unrestricted master system access" },
      { id: "ADMIN", label: "Administrator", desc: "Production parameters & system config" },
      { id: "SUPERVISOR", label: "Supervisor", desc: "QC escalations & batch approvals" },
    ]
  },
  {
    name: "Testing & Assembly",
    icon: Zap,
    roles: [
      { id: "TEST_ENGINEER", label: "Test Engineer", desc: "Cell testing station & barcode scanner" },
      { id: "QC", label: "QC Auditor", desc: "Quality control inspection & retests" },
      { id: "PAX_TEST_ENGINEER", label: "PAX Tester", desc: "Final battery pack testing station" },
      { id: "ASSEMBLY_TECHNICIAN", label: "Assembly Tech", desc: "Cell matching & pack assembly" },
    ]
  },
  {
    name: "Supply Chain & Warehouse",
    icon: Briefcase,
    roles: [
      { id: "INVENTORY_MANAGER", label: "Inventory Manager", desc: "Cell bulk inward & warehouse stock" },
      { id: "PURCHASE_MANAGER", label: "Purchase Manager", desc: "Raw material & vendor PO orders" },
    ]
  },
  {
    name: "Commercial & Finance",
    icon: Users,
    roles: [
      { id: "SALES_EXECUTIVE", label: "Sales Executive", desc: "Customer orders & pax reservations" },
      { id: "MARKETING_MANAGER", label: "Marketing Manager", desc: "Lead tracking & client management" },
      { id: "ACCOUNTANT", label: "Accountant", desc: "Invoicing, payments & financial audit" },
    ]
  },
  {
    name: "Human Resources & Payroll",
    icon: Users,
    roles: [
      { id: "HR_PAYROLL", label: "HR & Payroll Manager", desc: "Zambia statutory payroll, attendance, leave & employee records" },
    ]
  }
];

export default function UserManagementTab() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal form local states
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // --- USERS QUERY ---
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users")).data
  });

  // --- CREATE / UPDATE USER MUTATION ---
  const saveUserMutation = useMutation({
    mutationFn: (data: any) => {
      if (selectedUser) {
        return api.patch(`/admin/users/${selectedUser.id}`, data);
      }
      return api.post("/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(selectedUser ? "Personnel profile updated successfully" : "User created successfully");
      setIsModalOpen(false);
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save personnel profile");
    }
  });

  // --- TOGGLE STATUS MUTATION ---
  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Personnel status modified");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to modify status");
    }
  });

  const handleOpenModal = (user: any = null) => {
    setSelectedUser(user);
    if (user) {
      setSelectedRoles(user.roles || []);
      setPasswordValue("");
    } else {
      setSelectedRoles([]);
      setPasswordValue("");
    }
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev => 
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasswordValue(pwd);
    setShowPassword(true);
    toast.info("Secure temporary password generated");
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = passwordValue;

    if (!selectedRoles.length) {
      toast.error("Please assign at least one authorization role.");
      return;
    }

    if (!selectedUser && (!password || password.length < 6)) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    const payload: any = {
      name,
      email,
      roles: selectedRoles
    };

    if (password) {
      payload.password = password;
    }

    saveUserMutation.mutate(payload);
  };

  const filteredUsers = users?.filter((u: any) => {
    const q = searchQuery.toLowerCase();
    const roleMatches = u.roles?.some((r: string) => r.toLowerCase().includes(q));
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      roleMatches
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {[
          { label: "Registered Personnel", value: users?.length || 0, icon: Users, color: "text-[#0878F9]", bg: "bg-[#EAF5FF] border-[#BFDBFE]" },
          { label: "Active Operators", value: users?.filter((u: any) => u.isActive !== false).length || 0, icon: CheckCircle2, color: "text-[#166534]", bg: "bg-[#DCFCE7] border-[#BBF7D0]" },
          { label: "Superadmin / Admins", value: users?.filter((u: any) => u.roles?.includes("SUPERADMIN") || u.roles?.includes("ADMIN")).length || 0, icon: ShieldCheck, color: "text-[#7C3AED]", bg: "bg-[#F5F3FF] border-[#DDD6FE]" },
          { label: "Deactivated Accounts", value: users?.filter((u: any) => u.isActive === false).length || 0, icon: XCircle, color: "text-[#991B1B]", bg: "bg-[#FEE2E2] border-[#FECACA]" },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-sm flex items-center gap-4 hover:border-[#0878F9]/40 transition-all"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-[#0B2148] tracking-tight">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Directory Table */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#D8E8FA] overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-[#D8E8FA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F4F9FF]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0B2148]">Personnel & Access Control</h3>
              <p className="text-xs text-[#526B91] font-medium">Departmental access matrix, operator identities, and token credentials</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, role..."
                className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-10 pr-4 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/20"
              />
            </div>

            <button 
              type="button"
              onClick={() => handleOpenModal(null)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] px-5 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Operator
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#526B91]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0878F9]" />
            <p className="text-xs font-semibold">Loading personnel...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                  <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#526B91] w-14 text-center">S.No</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Personnel Info</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Assigned Roles</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Account Status</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#526B91] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-[#526B91] text-sm">
                      {searchQuery ? "No personnel match your search query." : "No personnel accounts found."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any, idx: number) => (
                    <tr key={user.id} className="hover:bg-[#F4F9FF] transition-colors group">
                      <td className="px-4 py-4 text-center font-mono font-bold text-xs text-[#526B91]">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9] group-hover:border-[#0878F9] transition-all font-bold text-sm">
                            {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors">{user.name}</p>
                            <p className="text-xs text-[#526B91] font-mono flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3.5 h-3.5 text-[#526B91]" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {user.roles?.map((role: string) => (
                            <span 
                              key={role} 
                              className="px-2 py-0.5 bg-[#EAF5FF] border border-[#BFDBFE] rounded text-[11px] font-bold uppercase text-[#0878F9] font-mono"
                            >
                              {role.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.isActive !== false 
                            ? "bg-[#DCFCE7] border border-[#BBF7D0] text-[#166534]" 
                            : "bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? "bg-[#166534] animate-pulse" : "bg-[#991B1B]"}`} />
                          {user.isActive !== false ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => handleOpenModal(user)} 
                            title="Edit user details & permissions"
                            className="p-2 hover:bg-[#EAF5FF] rounded-lg text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => toggleUserStatusMutation.mutate({ 
                              id: user.id, 
                              isActive: user.isActive === false ? true : false 
                            })}
                            disabled={toggleUserStatusMutation.isPending}
                            title={user.isActive === false ? "Enable User Access" : "Deactivate User & Revoke Tokens"}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                              user.isActive === false 
                                ? "bg-[#DCFCE7] hover:bg-[#BBF7D0] border-[#BBF7D0] text-[#166534]" 
                                : "bg-[#FEE2E2] hover:bg-[#FECACA] border-[#FECACA] text-[#991B1B]"
                            }`}
                          >
                            {user.isActive === false ? "Activate" : "Deactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* User Create/Edit Modal (Clean Light Theme Modal) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 20 }} 
              className="relative w-full max-w-4xl bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl overflow-hidden z-10 text-[#0B2148]"
            >
              <div className="p-6 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-[#EAF5FF] border border-[#BFDBFE] rounded-xl flex items-center justify-center text-[#0878F9]">
                    {selectedUser ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B2148]">
                      {selectedUser ? "Update User Account" : "Add Operator Account"}
                    </h3>
                    <p className="text-xs font-semibold text-[#526B91] uppercase tracking-wider mt-0.5">
                      Personnel Access & Role Matrix
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-[#EAF5FF] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                      Full Legal Name *
                    </label>
                    <div className="relative">
                      <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
                      <input 
                        name="name" 
                        defaultValue={selectedUser?.name} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 pl-10 pr-4 text-[#0B2148] placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all text-sm font-semibold" 
                        placeholder="e.g. Priya Sharma" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                      Email Address (Login Identity) *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
                      <input 
                        name="email" 
                        type="email" 
                        defaultValue={selectedUser?.email} 
                        required 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 pl-10 pr-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all text-xs" 
                        placeholder="priya@kyrazam.com" 
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                        {selectedUser ? "New Password (Leave blank to preserve existing)" : "Initial Password *"}
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-xs text-[#0878F9] hover:text-[#0667DB] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate Secure Key
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
                      <input 
                        name="password" 
                        type={showPassword ? "text" : "password"} 
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        required={!selectedUser} 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 pl-10 pr-12 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-[#0878F9] focus:bg-white focus:ring-2 focus:ring-[#0878F9]/20 outline-none transition-all text-xs" 
                        placeholder={selectedUser ? "Enter new password to reset" : "Enter temporary password (min 8 chars)"} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-[#0878F9] cursor-pointer p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categorized Role Matrix Selector */}
                <div className="space-y-3 pt-3 border-t border-[#E8F1FC]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider ml-0.5">
                      Departmental Role Assignments *
                    </label>
                    <span className="text-xs text-[#526B91] font-medium">{selectedRoles.length} role(s) selected</span>
                  </div>

                  <div className="space-y-3">
                    {ROLE_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <div key={cat.name} className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                            <Icon className="w-3.5 h-3.5 text-[#0878F9]" />
                            {cat.name}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cat.roles.map(r => {
                              const isChecked = selectedRoles.includes(r.id);
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => toggleRole(r.id)}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                                    isChecked 
                                      ? "bg-[#EAF5FF] border-[#0878F9] text-[#0878F9] ring-1 ring-[#0878F9]/20 shadow-xs" 
                                      : "bg-white border-[#D8E8FA] text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF]"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-bold ${isChecked ? "text-[#0878F9]" : "text-[#0B2148]"}`}>
                                      {r.label}
                                    </p>
                                    <p className="text-[11px] text-[#526B91] mt-0.5 leading-snug">
                                      {r.desc}
                                    </p>
                                  </div>
                                  <div className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    isChecked ? "bg-[#0878F9] text-white" : "border border-[#D8E8FA] bg-[#F4F9FF]"
                                  }`}>
                                    {isChecked && <CheckCircle2 className="w-3 h-3" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E8F1FC] flex items-center justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-5 py-2.5 rounded-xl border border-[#D8E8FA] text-[#0B2148] hover:text-[#0878F9] hover:bg-[#EAF5FF] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saveUserMutation.isPending} 
                    className="flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 px-6 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                  >
                    {saveUserMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {selectedUser ? "Update Profile" : "Create Operator"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
