"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  Search, 
  Plus, 
  X, 
  Loader2, 
  TrendingUp, 
  Calendar, 
  Building2, 
  Phone, 
  Mail, 
  ArrowUpRight,
  Copy,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Country, DEFAULT_COUNTRY } from "@/lib/countries";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { 
  LeadFormState, 
  LeadFormErrors, 
  validateLeadForm, 
  validateContactName, 
  validateCompanyName, 
  validateEmailAddress 
} from "@/lib/leadFormValidation";
import { validatePhoneNumber } from "@/lib/phoneValidation";

const initialLeadState: LeadFormState = {
  name: "",
  companyName: "",
  email: "",
  phoneCountry: DEFAULT_COUNTRY,
  phoneNumber: "",
  altPhoneCountry: DEFAULT_COUNTRY,
  altPhoneNumber: "",
  source: "Website",
  priority: "MEDIUM",
  requirementSummary: "",
  notes: "",
  expectedFollowUpDate: "",
  assignedUserId: ""
};

export default function LeadsPage() {
  const params = useParams();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Search, Filter & Pagination State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [source, setSource] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25); // Default to 25 items per page
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Create Lead Modal State & Validation
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLead, setNewLead] = useState<LeadFormState>(initialLeadState);
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Input Refs for Autofocus on validation failure
  const nameInputRef = useRef<HTMLInputElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const altPhoneInputRef = useRef<HTMLInputElement>(null);
  const sourceSelectRef = useRef<HTMLSelectElement>(null);
  const prioritySelectRef = useRef<HTMLSelectElement>(null);

  // --- DATA FETCHING ---
  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ["leads-list", search, status, priority, source, assignedUserId, page, sortBy, sortOrder, limit],
    queryFn: async () => {
      const res = await api.get("/crm/leads", {
        params: {
          search,
          status,
          priority,
          source,
          assignedUserId,
          page,
          sortBy,
          sortOrder,
          limit
        }
      });
      return res.data;
    }
  });

  // Fetch Dashboard Stats for the metrics display
  const { data: dashboardData } = useQuery({
    queryKey: ["crm-dashboard-stats-leads"],
    queryFn: async () => (await api.get("/crm/dashboard")).data
  });

  const { data: users } = useQuery({
    queryKey: ["crm-system-users"],
    queryFn: async () => (await api.get("/crm/users")).data
  });

  // --- MUTATIONS ---
  const createLeadMutation = useMutation({
    mutationFn: (leadData: any) => api.post("/crm/leads", leadData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
      queryClient.invalidateQueries({ queryKey: ["crm-dashboard-stats-leads"] });
      toast.success("Lead Registered Successfully");
      setIsCreateOpen(false);
      setNewLead(initialLeadState);
      setErrors({});
      setTouched({});
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to create lead");
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      name: true,
      companyName: true,
      email: true,
      phone: true,
      alternatePhone: true,
      source: true,
      priority: true
    });

    const validation = validateLeadForm(newLead);

    if (!validation.isValid) {
      setErrors(validation.errors);

      // Focus the first invalid input element
      if (validation.firstErrorField === "name") {
        nameInputRef.current?.focus();
      } else if (validation.firstErrorField === "companyName") {
        companyInputRef.current?.focus();
      } else if (validation.firstErrorField === "email") {
        emailInputRef.current?.focus();
      } else if (validation.firstErrorField === "phone") {
        phoneInputRef.current?.focus();
      } else if (validation.firstErrorField === "alternatePhone") {
        altPhoneInputRef.current?.focus();
      } else if (validation.firstErrorField === "source") {
        sourceSelectRef.current?.focus();
      } else if (validation.firstErrorField === "priority") {
        prioritySelectRef.current?.focus();
      }

      toast.error("Please resolve the highlighted validation errors.");
      return;
    }

    createLeadMutation.mutate(validation.normalizedPayload);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setSource("");
    setAssignedUserId("");
    setPage(1);
    toast.success("Filters reset successfully");
  };

  const leads = data?.leads || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const leadSources = [
    "Website", "Referral", "Social Media", "Advertisement", "Direct Enquiry", "Existing Customer", "Other"
  ];

  const getAvatarInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Helper for expectation alert indicators
  const getFollowUpStatus = (dateStr: string) => {
    if (!dateStr) return { label: "No follow-up", style: "text-[#526B91] bg-slate-500/5 border-[#D8E8FA]" };
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    date.setHours(0,0,0,0);
    
    if (date.getTime() < today.getTime()) {
      return { label: `Overdue: ${date.toLocaleDateString()}`, style: "text-red-400 bg-red-500/10 border-red-500/20" };
    } else if (date.getTime() === today.getTime()) {
      return { label: `Today`, style: "text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse font-bold" };
    } else {
      return { label: date.toLocaleDateString(), style: "text-[#166534] bg-emerald-500/10 border-emerald-500/20" };
    }
  };

  // Pagination Range Helper
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      if (start === 1) {
        end = maxVisiblePages;
      } else if (end === totalPages) {
        start = totalPages - maxVisiblePages + 1;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const isFilterActive = search || status || priority || source || assignedUserId;

  const totalLeads = dashboardData?.stats?.totalLeads || 0;
  const newLeadsCount = dashboardData?.stats?.newLeads || 0;
  const qualifiedCount = dashboardData?.stats?.qualifiedLeads || 0;
  const convertedCount = dashboardData?.stats?.convertedLeads || 0;
  const conversionRate = totalLeads > 0 ? ((convertedCount / totalLeads) * 100).toFixed(1) : "0.0";

  const startRange = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, total);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4 text-[#0B2148]">
      
      {/* 1. Page Header */}
      <div className="flex-none flex items-center justify-between py-2 border-b border-[#D8E8FA]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B2148] flex items-center gap-2">
            Leads
            <span className="text-xs font-normal text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] px-2.5 py-0.5 rounded-full">
              {total} active
            </span>
          </h1>
          <p className="text-xs text-[#526B91] mt-0.5">Manage and track your sales pipeline</p>
        </div>

        <button 
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-semibold text-xs hover:bg-accent/90 shadow-sm border border-[#D8E8FA] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Lead
        </button>
      </div>

      {/* 2. Compact KPI Summary Panel */}
      <div className="flex-none flex flex-wrap gap-8 items-center py-3 px-6 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-xs">
        
        {/* KPI 1: Active Leads */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Pipeline</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-[#0B2148]">{totalLeads}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Active leads</span>
          </div>
        </div>
        
        <div className="h-6 w-px bg-[#F4F9FF]" /> {/* Divider */}

        {/* KPI 2: New Opportunities */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">New Queries</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-amber-400">{newLeadsCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Awaiting contact</span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#F4F9FF]" /> {/* Divider */}

        {/* KPI 3: Qualified */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Qualified</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-[#166534]">{qualifiedCount}</span>
            <span className="text-[10px] text-[#526B91] font-medium">High intent</span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#F4F9FF]" /> {/* Divider */}

        {/* KPI 4: Conversion Rate */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Conversion</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-purple-400">{conversionRate}%</span>
            <span className="text-[10px] text-[#526B91] font-medium">{convertedCount} converted</span>
          </div>
        </div>
      </div>

      {/* 3. Search + Filter Toolbar */}
      <div className="flex-none flex flex-wrap gap-2 items-center py-1">
        
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search leads..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-accent/60 transition-colors"
          />
        </div>

        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Status: All</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="PROPOSAL">Proposal</option>
          <option value="CONVERTED">Converted</option>
          <option value="LOST">Lost</option>
        </select>

        <select 
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Priority: All</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select 
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Source: All</option>
          {leadSources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select 
          value={assignedUserId}
          onChange={(e) => { setAssignedUserId(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
        >
          <option value="">Assignee: All</option>
          {users?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {isFilterActive && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* 4. Professional Data Table Container */}
      <div className="flex-1 bg-[#F4F9FF]/10 border border-[#D8E8FA] rounded-xl overflow-hidden flex flex-col">
        
        <div className="flex-1 overflow-auto">
          {isLoading || isRefetching ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <span className="text-[11px] text-[#526B91] font-medium">Loading leads data...</span>
            </div>
          ) : leads.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-semibold text-[#526B91] tracking-wider bg-white/[0.01]">
                  <th className="py-2.5 px-4 font-bold">Lead</th>
                  <th className="py-2.5 px-4 font-bold">Contact</th>
                  <th className="py-2.5 px-4 font-bold">Company</th>
                  <th className="py-2.5 px-4 font-bold">Source</th>
                  <th className="py-2.5 px-4 font-bold">Priority</th>
                  <th className="py-2.5 px-4 font-bold">Assignee</th>
                  <th className="py-2.5 px-4 font-bold">Follow-Up</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                  <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {leads.map((lead: any) => {
                  const followUp = getFollowUpStatus(lead.expectedFollowUpDate);
                  return (
                    <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors group">
                      
                      {/* LEAD column: Initial avatar, bold name, small ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ring-1 ring-white/10 ${getAvatarColor(lead.status)}`}>
                            {getAvatarInitials(lead.name)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#0B2148] group-hover:text-accent transition-colors">
                              {lead.name}
                            </span>
                            <span className="text-[10px] text-[#526B91] font-mono mt-0.5">
                              {lead.leadNumber}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CONTACT column: Email / phone copy actions */}
                      <td className="py-3 px-4 text-[#526B91]">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer" onClick={() => copyToClipboard(lead.email, "Email")}>
                            <Mail className="w-3 h-3 text-[#526B91]" />
                            <span>{lead.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#526B91] hover:text-white transition-colors cursor-pointer" onClick={() => copyToClipboard(lead.phone, "Phone")}>
                            <Phone className="w-3 h-3 text-[#526B91]" />
                            <span>{lead.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* COMPANY column */}
                      <td className="py-3 px-4 font-medium text-[#0B2148]">
                        {lead.companyName ? lead.companyName : <span className="text-[#526B91]">-</span>}
                      </td>

                      {/* SOURCE column */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] px-2 py-0.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded text-[#526B91]">
                          {lead.source}
                        </span>
                      </td>

                      {/* PRIORITY column */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          lead.priority === "URGENT" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          lead.priority === "HIGH" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                          lead.priority === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-slate-500/10 text-[#526B91] border-slate-500/20"
                        }`}>
                          {lead.priority}
                        </span>
                      </td>

                      {/* ASSIGNEE column */}
                      <td className="py-3 px-4 text-[#0B2148]">
                        {lead.assignedUser ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[8px] font-bold ring-1 ring-white/10">
                              {getAvatarInitials(lead.assignedUser.name)}
                            </div>
                            <span>{lead.assignedUser.name}</span>
                          </div>
                        ) : (
                          <span className="text-[#526B91]">Unassigned</span>
                        )}
                      </td>

                      {/* FOLLOW-UP column */}
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${followUp.style}`}>
                          {followUp.label}
                        </span>
                      </td>

                      {/* STATUS column */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                          lead.status === "CONVERTED" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" :
                          lead.status === "LOST" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          lead.status === "QUALIFIED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          lead.status === "PROPOSAL" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                          lead.status === "CONTACTED" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {lead.status}
                        </span>
                      </td>

                      {/* ACTIONS column: Manage action */}
                      <td className="py-3 px-4 text-right">
                        <a 
                          href={`/${roleSlug}/crm/leads/${lead.id}`} 
                          className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent hover:text-blue-700 transition-colors cursor-pointer"
                        >
                          <span>Manage</span>
                          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-[#526B91]">
              <Users className="w-10 h-10 mb-2 opacity-30 text-[#526B91]" />
              <p className="font-semibold text-[#0B2148]">No Leads Found</p>
              <p className="text-xs mt-0.5 text-[#526B91]">Refine search query filters or register a new client file.</p>
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#0B2148] text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Pagination Area */}
        <div className="flex-none py-3 px-4 border-t border-[#D8E8FA] flex items-center justify-between bg-white/[0.01]">
          
          {/* Left: Range count */}
          <div className="text-xs text-[#526B91] font-medium">
            Showing <span className="font-semibold text-[#0B2148]">{startRange}–{endRange}</span> of <span className="font-semibold text-[#0B2148]">{total}</span> leads
          </div>

          {/* Right: page list selectors & limit */}
          <div className="flex items-center gap-6">
            
            {/* Rows Per Page */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#526B91] font-bold uppercase tracking-wider">Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent/60 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Range Numbers */}
            <div className="flex items-center gap-1">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 text-[#526B91] hover:text-slate-900 disabled:opacity-30 disabled:hover:text-[#526B91] transition-colors text-xs font-semibold cursor-pointer"
              >
                Previous
              </button>

              {getPageNumbers().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                    page === p
                      ? "bg-accent/20 text-accent font-extrabold"
                      : "text-[#526B91] hover:text-slate-900"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 text-[#526B91] hover:text-slate-900 disabled:opacity-30 disabled:hover:text-[#526B91] transition-colors text-xs font-semibold cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Create Lead Dialog Drawer */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
            {/* Backdrop click close */}
            <div className="absolute inset-0" onClick={() => setIsCreateOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl p-6 sm:p-8 z-10 overflow-y-auto text-slate-900"
            >
              <div className="flex justify-between items-center pb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Register Lead
                  </h2>
                  <p className="text-xs text-[#526B91] mt-0.5">Acquire and initialize a new commercial opportunity.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-[#526B91] hover:text-slate-800 transition-colors cursor-pointer border border-slate-200"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} noValidate className="flex-1 py-6 space-y-4">
                {/* Contact Name & Company Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="lead-contact-name" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      ref={nameInputRef}
                      id="lead-contact-name"
                      type="text" 
                      required
                      placeholder="e.g. Rajesh Kumar"
                      value={newLead.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewLead({ ...newLead, name: val });
                        if (touched.name || errors.name) {
                          const res = validateContactName(val);
                          setErrors(prev => ({ ...prev, name: res.isValid ? undefined : res.error }));
                        }
                      }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, name: true }));
                        const res = validateContactName(newLead.name);
                        setErrors(prev => ({ ...prev, name: res.isValid ? undefined : res.error }));
                      }}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "lead-name-error" : undefined}
                      className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-[#94A3B8] focus:outline-none transition-colors shadow-xs ${
                        errors.name ? "border-red-400 bg-red-50/40 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                      }`}
                    />
                    {errors.name && (
                      <p id="lead-name-error" role="alert" className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                        <span className="w-1 h-1 rounded-full bg-red-600 inline-block" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="lead-company-name" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Company Name
                    </label>
                    <input 
                      ref={companyInputRef}
                      id="lead-company-name"
                      type="text" 
                      placeholder="e.g. Acme Corp / Industries"
                      value={newLead.companyName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewLead({ ...newLead, companyName: val });
                        if (touched.companyName || errors.companyName) {
                          const res = validateCompanyName(val);
                          setErrors(prev => ({ ...prev, companyName: res.isValid ? undefined : res.error }));
                        }
                      }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, companyName: true }));
                        const res = validateCompanyName(newLead.companyName);
                        setErrors(prev => ({ ...prev, companyName: res.isValid ? undefined : res.error }));
                      }}
                      aria-invalid={Boolean(errors.companyName)}
                      aria-describedby={errors.companyName ? "lead-company-error" : undefined}
                      className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-[#94A3B8] focus:outline-none transition-colors shadow-xs ${
                        errors.companyName ? "border-red-400 bg-red-50/40 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                      }`}
                    />
                    {errors.companyName && (
                      <p id="lead-company-error" role="alert" className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                        <span className="w-1 h-1 rounded-full bg-red-600 inline-block" />
                        {errors.companyName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="lead-email" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    ref={emailInputRef}
                    id="lead-email"
                    type="email" 
                    required
                    placeholder="e.g. contact@example.com"
                    value={newLead.email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewLead({ ...newLead, email: val });
                      if (touched.email || errors.email) {
                        const res = validateEmailAddress(val);
                        setErrors(prev => ({ ...prev, email: res.isValid ? undefined : res.error }));
                      }
                    }}
                    onBlur={() => {
                      setTouched(prev => ({ ...prev, email: true }));
                      const res = validateEmailAddress(newLead.email);
                      setErrors(prev => ({ ...prev, email: res.isValid ? undefined : res.error }));
                    }}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "lead-email-error" : undefined}
                    className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-[#94A3B8] focus:outline-none transition-colors shadow-xs ${
                      errors.email ? "border-red-400 bg-red-50/40 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                  {errors.email && (
                    <p id="lead-email-error" role="alert" className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                      <span className="w-1 h-1 rounded-full bg-red-600 inline-block" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Primary Phone Number & Alternate Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <PhoneInput 
                      id="lead-phone"
                      label="Phone Number"
                      required={true}
                      country={newLead.phoneCountry}
                      phoneNumber={newLead.phoneNumber}
                      error={errors.phone}
                      inputRef={phoneInputRef}
                      onCountryChange={(country) => {
                        setNewLead(prev => ({ ...prev, phoneCountry: country }));
                        if (touched.phone || errors.phone) {
                          const res = validatePhoneNumber(newLead.phoneNumber, country, true);
                          setErrors(prev => ({ ...prev, phone: res.isValid ? undefined : res.error || undefined }));
                        }
                      }}
                      onPhoneChange={(phoneNum) => {
                        setNewLead(prev => ({ ...prev, phoneNumber: phoneNum }));
                        if (touched.phone || errors.phone) {
                          const res = validatePhoneNumber(phoneNum, newLead.phoneCountry, true);
                          setErrors(prev => ({ ...prev, phone: res.isValid ? undefined : res.error || undefined }));
                        }
                      }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, phone: true }));
                        const res = validatePhoneNumber(newLead.phoneNumber, newLead.phoneCountry, true);
                        setErrors(prev => ({ ...prev, phone: res.isValid ? undefined : res.error || undefined }));
                      }}
                    />
                  </div>

                  <div>
                    <PhoneInput 
                      id="lead-alt-phone"
                      label="Alternate Phone"
                      required={false}
                      country={newLead.altPhoneCountry}
                      phoneNumber={newLead.altPhoneNumber}
                      error={errors.alternatePhone}
                      inputRef={altPhoneInputRef}
                      onCountryChange={(country) => {
                        setNewLead(prev => ({ ...prev, altPhoneCountry: country }));
                        if (newLead.altPhoneNumber && (touched.alternatePhone || errors.alternatePhone)) {
                          const res = validatePhoneNumber(newLead.altPhoneNumber, country, false);
                          setErrors(prev => ({ ...prev, alternatePhone: res.isValid ? undefined : res.error || undefined }));
                        }
                      }}
                      onPhoneChange={(phoneNum) => {
                        setNewLead(prev => ({ ...prev, altPhoneNumber: phoneNum }));
                        if (touched.alternatePhone || errors.alternatePhone || phoneNum) {
                          const res = validatePhoneNumber(phoneNum, newLead.altPhoneCountry, false);
                          setErrors(prev => ({ ...prev, alternatePhone: res.isValid ? undefined : res.error || undefined }));
                        }
                      }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, alternatePhone: true }));
                        if (newLead.altPhoneNumber) {
                          const res = validatePhoneNumber(newLead.altPhoneNumber, newLead.altPhoneCountry, false);
                          setErrors(prev => ({ ...prev, alternatePhone: res.isValid ? undefined : res.error || undefined }));
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Lead Source & Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="lead-source" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Lead Source <span className="text-red-500">*</span>
                    </label>
                    <select 
                      ref={sourceSelectRef}
                      id="lead-source"
                      value={newLead.source}
                      onChange={(e) => {
                        setNewLead({ ...newLead, source: e.target.value });
                        if (errors.source) setErrors(prev => ({ ...prev, source: undefined }));
                      }}
                      aria-invalid={Boolean(errors.source)}
                      aria-describedby={errors.source ? "lead-source-error" : undefined}
                      className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none transition-colors cursor-pointer shadow-xs ${
                        errors.source ? "border-red-400 bg-red-50/40 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                      }`}
                    >
                      {leadSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.source && (
                      <p id="lead-source-error" role="alert" className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                        <span className="w-1 h-1 rounded-full bg-red-600 inline-block" />
                        {errors.source}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="lead-priority" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select 
                      ref={prioritySelectRef}
                      id="lead-priority"
                      value={newLead.priority}
                      onChange={(e) => {
                        setNewLead({ ...newLead, priority: e.target.value });
                        if (errors.priority) setErrors(prev => ({ ...prev, priority: undefined }));
                      }}
                      aria-invalid={Boolean(errors.priority)}
                      aria-describedby={errors.priority ? "lead-priority-error" : undefined}
                      className={`w-full bg-white border rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none transition-colors cursor-pointer shadow-xs ${
                        errors.priority ? "border-red-400 bg-red-50/40 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                      }`}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    {errors.priority && (
                      <p id="lead-priority-error" role="alert" className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                        <span className="w-1 h-1 rounded-full bg-red-600 inline-block" />
                        {errors.priority}
                      </p>
                    )}
                  </div>
                </div>

                {/* Assignee & Expected Follow-up Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="lead-assignee" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Assignee User
                    </label>
                    <select 
                      id="lead-assignee"
                      value={newLead.assignedUserId}
                      onChange={(e) => setNewLead({ ...newLead, assignedUserId: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-xs"
                    >
                      <option value="">Select Assignee User</option>
                      {users?.filter((u: any) => u.roles?.includes("SALES_EXECUTIVE") || u.role === "SALES_EXECUTIVE").map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} (Sales Executive)</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="lead-followup" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Expected Follow-up Date
                    </label>
                    <input 
                      id="lead-followup"
                      type="date" 
                      value={newLead.expectedFollowUpDate}
                      onChange={(e) => setNewLead({ ...newLead, expectedFollowUpDate: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-xs"
                    />
                  </div>
                </div>

                {/* Requirement Summary */}
                <div className="space-y-1.5">
                  <label htmlFor="lead-requirement" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                    Requirement Summary
                  </label>
                  <textarea 
                    id="lead-requirement"
                    placeholder="e.g. Wants LFP battery pack quote with 48V 100Ah specifications."
                    value={newLead.requirementSummary}
                    onChange={(e) => setNewLead({ ...newLead, requirementSummary: e.target.value })}
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-blue-500 resize-none transition-colors shadow-xs"
                  />
                </div>

                {/* General Notes */}
                <div className="space-y-1.5">
                  <label htmlFor="lead-notes" className="block text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                    Notes
                  </label>
                  <textarea 
                    id="lead-notes"
                    placeholder="General comments..."
                    value={newLead.notes}
                    onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                    rows={2}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-blue-500 resize-none transition-colors shadow-xs"
                  />
                </div>

                {/* Form Action Button */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button 
                    type="submit" 
                    disabled={createLeadMutation.isPending}
                    className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {createLeadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Registering Lead...
                      </>
                    ) : (
                      "Register Lead File"
                    )}
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

const getAvatarColor = (status: string) => {
  switch (status) {
    case "CONVERTED":
      return "bg-teal-500/10 text-teal-400 ring-teal-500/30";
    case "LOST":
      return "bg-rose-500/10 text-rose-400 ring-rose-500/30";
    case "QUALIFIED":
      return "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30";
    case "PROPOSAL":
      return "bg-purple-500/10 text-purple-400 ring-purple-500/30";
    case "CONTACTED":
      return "bg-indigo-500/10 text-indigo-400 ring-indigo-500/30";
    default:
      return "bg-amber-500/10 text-amber-400 ring-amber-500/30";
  }
};
