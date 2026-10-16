"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  ArrowLeft, 
  Loader2, 
  Building2, 
  Phone, 
  Mail, 
  User, 
  Calendar, 
  Clock,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Send,
  UserCheck,
  CheckSquare,
  FileText,
  Copy,
  Check,
  X,
  Sparkles,
  Tag,
  ShieldCheck,
  ChevronRight,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const ACTIVITY_TABS = [
  { 
    type: "CALL", 
    label: "Call", 
    icon: Phone, 
    placeholder: "e.g. Phone discussion on battery specs", 
    descPlaceholder: "Discussion points, customer feedback, next steps..." 
  },
  { 
    type: "MEETING", 
    label: "Meeting", 
    icon: Users, 
    placeholder: "e.g. Technical demo & commercial review", 
    descPlaceholder: "Meeting agenda, key attendees, decisions made..." 
  },
  { 
    type: "EMAIL", 
    label: "Email", 
    icon: Mail, 
    placeholder: "e.g. Sent technical datasheet & preliminary quotation", 
    descPlaceholder: "Summary of email thread, attachments sent, client response..." 
  },
  { 
    type: "NOTE", 
    label: "Note", 
    icon: FileText, 
    placeholder: "e.g. Internal note regarding procurement timeline", 
    descPlaceholder: "Confidential observations, competitor context, budget estimates..." 
  },
  { 
    type: "FOLLOW_UP", 
    label: "Follow-up", 
    icon: Clock, 
    placeholder: "e.g. Follow-up on sample evaluation results", 
    descPlaceholder: "Target objectives for next touchpoint..." 
  },
  { 
    type: "TASK", 
    label: "Task", 
    icon: CheckSquare, 
    placeholder: "e.g. Prepare custom BMS wiring diagram", 
    descPlaceholder: "Action items, required deliverables, team alignment..." 
  },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Activity Log State
  const [newActivity, setNewActivity] = useState({
    activityType: "CALL",
    subject: "",
    description: "",
    dueDate: ""
  });

  // Assignee / Duplicate Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [duplicateCustomer, setDuplicateCustomer] = useState<any>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-details", leadId],
    queryFn: async () => (await api.get(`/crm/leads/${leadId}`)).data
  });

  const { data: users } = useQuery({
    queryKey: ["crm-system-users"],
    queryFn: async () => (await api.get("/crm/users")).data
  });

  // --- MUTATIONS ---
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/leads/${leadId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-details"] });
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
      toast.success("Lead status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to update status")
  });

  const updatePriorityMutation = useMutation({
    mutationFn: (priority: string) => api.put(`/crm/leads/${leadId}`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-details"] });
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
      toast.success("Lead priority updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to update priority")
  });

  const assignLeadMutation = useMutation({
    mutationFn: (userId: string | null) => api.put(`/crm/leads/${leadId}`, { assignedUserId: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-details"] });
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
      toast.success("Lead assignment updated successfully");
      setIsAssignOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to assign lead")
  });

  const addActivityMutation = useMutation({
    mutationFn: (actData: any) => api.post("/crm/activities", { ...actData, leadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-details"] });
      toast.success("CRM activity entry logged");
      setNewActivity(prev => ({
        activityType: prev.activityType,
        subject: "",
        description: "",
        dueDate: ""
      }));
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to add activity")
  });

  const completeActivityMutation = useMutation({
    mutationFn: (activityId: string) => api.put(`/crm/activities/${activityId}`, { status: "COMPLETED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-details"] });
      toast.success("Activity marked as completed");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to complete activity")
  });

  const convertLeadMutation = useMutation({
    mutationFn: (bypass: boolean) => api.post(`/crm/leads/${leadId}/convert`, { bypassDuplicateCheck: bypass }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["lead-details"] });
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      toast.success("Lead converted to verified Customer account!");
      setIsDuplicateOpen(false);
      router.push(`/${roleSlug}/crm/customers/${res.data.customer.id}`);
    },
    onError: (err: any) => {
      if (err.response?.status === 409 && err.response?.data?.duplicateFound) {
        setDuplicateCustomer(err.response.data.existingCustomer);
        setIsDuplicateOpen(true);
      } else {
        toast.error(err.response?.data?.message || err.response?.data?.error || "Conversion failed");
      }
    }
  });

  const copyToClipboard = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const getAvatarInitials = (name: string) => {
    if (!name) return "LD";
    return name
      .split(" ")
      .map(part => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "CALL": return Phone;
      case "MEETING": return Users;
      case "EMAIL": return Mail;
      case "NOTE": return FileText;
      case "FOLLOW_UP": return Clock;
      case "TASK": return CheckSquare;
      default: return MessageSquare;
    }
  };

  const getActivityBadgeStyle = (type: string) => {
    switch (type) {
      case "CALL": return "bg-blue-50 text-blue-700 border-blue-200";
      case "MEETING": return "bg-purple-50 text-purple-700 border-purple-200";
      case "EMAIL": return "bg-sky-50 text-sky-700 border-sky-200";
      case "NOTE": return "bg-amber-50 text-amber-700 border-amber-200";
      case "FOLLOW_UP": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "TASK": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 gap-3">
        <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
        <span className="text-xs text-[#526B91] font-medium">Loading lead workspace...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-10 text-center text-[#526B91] bg-white rounded-2xl border border-[#D8E8FA] max-w-md mx-auto my-12 shadow-xs">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-500 mb-3" />
        <p className="font-bold text-[#0B2148] text-base">Lead File Not Found</p>
        <p className="text-xs text-[#526B91] mt-1">The requested lead profile could not be retrieved.</p>
        <button
          type="button"
          onClick={() => router.push(`/${roleSlug}/crm/leads`)}
          className="mt-4 px-4 py-2 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] text-xs font-semibold transition-all cursor-pointer"
        >
          Return to Pipeline
        </button>
      </div>
    );
  }

  const activeTabConfig = ACTIVITY_TABS.find(t => t.type === newActivity.activityType) || ACTIVITY_TABS[0];

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    addActivityMutation.mutate({
      activityType: newActivity.activityType,
      subject: newActivity.subject.trim(),
      description: newActivity.description.trim() || null,
      dueDate: newActivity.dueDate ? newActivity.dueDate : null
    });
  };

  const isConverted = lead.status === "CONVERTED";

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto p-4 sm:p-6 text-[#0B2148]">
      
      {/* 1. Compact Page Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8E8FA]">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => router.push(`/${roleSlug}/crm/leads`)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Pipeline</span>
          </button>

          <div className="h-4 w-px bg-[#D8E8FA] hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-[#0878F9] bg-[#EAF5FF] px-2.5 py-0.5 rounded-md border border-[#D8E8FA]">
              {lead.leadNumber}
            </span>
            <span className="text-sm font-bold text-[#0B2148] truncate max-w-[200px] sm:max-w-xs">
              {lead.name}
            </span>
          </div>
        </div>

        {/* Primary Action Button */}
        {!isConverted ? (
          <button 
            type="button"
            onClick={() => convertLeadMutation.mutate(false)}
            disabled={convertLeadMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
          >
            {convertLeadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting Account...
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                Qualify & Convert to Customer
              </>
            )}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Customer File Activated</span>
          </div>
        )}
      </div>

      {/* 2. Main Workspace (32% Profile / 68% Activity Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ── LEFT COLUMN: LEAD PROFILE & REQUIREMENTS (lg:col-span-4) ────────── */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Main Lead Profile Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-4">
            
            {/* Lead Header with Status & ID */}
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] text-xs font-bold flex-shrink-0">
                  {getAvatarInitials(lead.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#0B2148] truncate leading-tight">
                    {lead.name}
                  </h2>
                  {lead.companyName ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#526B91] mt-0.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-[#526B91] flex-shrink-0" />
                      <span className="truncate">{lead.companyName}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#526B91]">Individual Prospect</span>
                  )}
                </div>
              </div>

              {/* Status Select Box */}
              <div className="flex-shrink-0">
                <select 
                  disabled={isConverted}
                  value={lead.status}
                  onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                    lead.status === "CONVERTED" ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed" :
                    lead.status === "QUALIFIED" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    lead.status === "PROPOSAL" ? "bg-purple-50 text-purple-700 border-purple-200" :
                    lead.status === "LOST" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="CONVERTED" disabled>Converted</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
            </div>

            {/* Contact Identifiers */}
            <div className="space-y-2.5 text-xs">
              
              {/* Lead ID */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Lead Code</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-[#0B2148]">{lead.leadNumber}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(lead.leadNumber, "leadNumber", "Lead Number")}
                    className="p-1 text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer"
                    title="Copy Lead Code"
                  >
                    {copiedKey === "leadNumber" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Email Address */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#526B91]" />
                  Email
                </span>
                <div className="flex items-center gap-1.5 max-w-[200px]">
                  <a href={`mailto:${lead.email}`} className="text-[#0878F9] hover:underline truncate font-medium">
                    {lead.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(lead.email, "email", "Email")}
                    className="p-1 text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer flex-shrink-0"
                    title="Copy Email"
                  >
                    {copiedKey === "email" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Phone Number */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#526B91]" />
                  Phone
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[#0B2148] font-medium">{lead.phone}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(lead.phone, "phone", "Phone")}
                    className="p-1 text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer"
                    title="Copy Phone"
                  >
                    {copiedKey === "phone" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Alternate Phone */}
              {lead.alternatePhone && (
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Alt Phone</span>
                  <span className="font-mono text-[#526B91]">{lead.alternatePhone}</span>
                </div>
              )}

              {/* Source */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Source</span>
                <span className="font-medium text-[#0B2148] bg-slate-50 border border-[#D8E8FA] px-2 py-0.5 rounded-md text-[11px]">
                  {lead.source}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Priority</span>
                <select 
                  value={lead.priority}
                  onChange={(e) => updatePriorityMutation.mutate(e.target.value)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border focus:outline-none transition-colors cursor-pointer ${
                    lead.priority === "URGENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
                    lead.priority === "HIGH" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    lead.priority === "MEDIUM" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              {/* Assigned Agent */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Assigned Agent</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-[#0B2148]">
                    {lead.assignedUser?.name || <span className="text-[#526B91] italic">Unassigned</span>}
                  </span>
                  <button 
                    type="button"
                    onClick={() => { setAssigneeId(lead.assignedUserId || ""); setIsAssignOpen(true); }}
                    className="px-2 py-0.5 bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] rounded text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Integrated Requirements & Notes Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-[#D8E8FA]">
              <MessageSquare className="w-3.5 h-3.5 text-[#0878F9]" />
              Requirements & Notes
            </h3>

            {/* Requirement Summary */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Specification Summary</span>
              <p className="text-xs text-[#0B2148] p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 leading-relaxed font-normal">
                {lead.requirementSummary || <span className="text-[#526B91] italic">No technical requirements specified yet.</span>}
              </p>
            </div>

            {/* General Notes */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Internal Notes</span>
              <p className="text-xs text-[#0B2148] p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 leading-relaxed font-normal whitespace-pre-wrap">
                {lead.notes || <span className="text-[#526B91] italic">No internal background notes registered.</span>}
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: ACTIVITY WORKSPACE & TIMELINE (lg:col-span-8) ─────── */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Linked Converted Customer Alert Banner */}
          {isConverted && lead.convertedCustomer && (
            <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">Lead Successfully Converted</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Account: <span className="font-mono font-bold text-emerald-900">{lead.convertedCustomer.customerCode}</span> — {lead.convertedCustomer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/${roleSlug}/crm/customers/${lead.convertedCustomerId}`)}
                className="px-3.5 py-1.5 bg-white hover:bg-emerald-100/50 border border-emerald-300 text-xs font-bold text-emerald-800 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>View Customer Account</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Activity Composer Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-4">
            
            {/* Tab Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0878F9]" />
                <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                  Log Commercial Touchpoint
                </h3>
              </div>

              {/* Activity Type Selector Tabs */}
              <div className="flex flex-wrap gap-1 bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA]">
                {ACTIVITY_TABS.map(tab => {
                  const isSelected = newActivity.activityType === tab.type;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => setNewActivity(prev => ({ ...prev, activityType: tab.type }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-[#0878F9] text-white shadow-xs" 
                          : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF]"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Composer Form */}
            <form onSubmit={handleAddActivity} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                
                {/* Subject Field */}
                <div className="sm:col-span-8 space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                    Touchpoint Subject *
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder={activeTabConfig.placeholder}
                    value={newActivity.subject}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full bg-slate-50/70 border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-colors"
                  />
                </div>

                {/* Due / Scheduled Date */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#526B91]" />
                    Scheduled Date
                  </label>
                  <input 
                    type="date" 
                    value={newActivity.dueDate}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full bg-slate-50/70 border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Details Textarea */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                  Detailed Notes & Observations
                </label>
                <textarea 
                  placeholder={activeTabConfig.descPlaceholder}
                  value={newActivity.description}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-slate-50/70 border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0878F9] focus:bg-white resize-none transition-colors"
                />
              </div>

              {/* Submit Action Button */}
              <div className="flex justify-end pt-1">
                <button 
                  type="submit" 
                  disabled={addActivityMutation.isPending || !newActivity.subject.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addActivityMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging Entry...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Record {activeTabConfig.label}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Activity Timeline List */}
          <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
              <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0878F9]" />
                <span>Interaction History</span>
                <span className="text-[10px] font-semibold text-[#526B91] bg-slate-100 px-2 py-0.5 rounded-full">
                  {lead.activities?.length || 0} entries
                </span>
              </h3>
            </div>

            {lead.activities?.length > 0 ? (
              <div className="relative border-l border-[#D8E8FA] ml-3 pl-5 space-y-4 py-1">
                {lead.activities.map((act: any) => {
                  const Icon = getActivityIcon(act.activityType);
                  const isPending = act.status === "PENDING";
                  return (
                    <div key={act.id} className="relative group">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[27px] top-3.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#0878F9] shadow-2xs" />
                      
                      {/* Activity Card */}
                      <div className="p-4 rounded-xl border border-[#D8E8FA] bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300 transition-all space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          
                          {/* Subject & Type Badge */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${getActivityBadgeStyle(act.activityType)}`}>
                                <Icon className="w-3 h-3" />
                                {act.activityType}
                              </span>
                              <h4 className="text-xs font-bold text-[#0B2148]">
                                {act.subject}
                              </h4>
                            </div>
                            
                            {act.description && (
                              <p className="text-xs text-slate-700 leading-relaxed pt-0.5">
                                {act.description}
                              </p>
                            )}
                          </div>

                          {/* Action / Status Badge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isPending ? (
                              <button
                                type="button"
                                disabled={completeActivityMutation.isPending}
                                onClick={() => completeActivityMutation.mutate(act.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Mark Complete</span>
                              </button>
                            ) : (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                act.status === "COMPLETED" 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}>
                                {act.status}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Metadata Footer */}
                        <div className="flex items-center gap-3 text-[10px] text-[#526B91] pt-1 border-t border-slate-200/60 font-medium">
                          <span>By {act.createdByUser?.name || "System"}</span>
                          <span>•</span>
                          <span>{new Date(act.createdAt).toLocaleString()}</span>
                          {act.dueDate && (
                            <>
                              <span>•</span>
                              <span className="text-amber-700 font-bold">
                                Due: {new Date(act.dueDate).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-[#526B91] space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-[#526B91]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <p className="font-semibold text-xs text-[#0B2148]">No Activity History Logged</p>
                <p className="text-[11px] text-[#526B91]">
                  Use the composer above to log calls, meetings, emails, or internal follow-up tasks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── REASSIGN LEAD MODAL DIALOG ────────────────────────────────────────── */}
      <AnimatePresence>
        {isAssignOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="absolute inset-0" onClick={() => setIsAssignOpen(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative bg-white rounded-2xl border border-[#D8E8FA] shadow-2xl max-w-md w-full p-6 space-y-4 z-10 text-[#0B2148]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#0878F9]" />
                  <h3 className="text-sm font-bold text-[#0B2148]">Reassign Commercial Lead</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="p-1.5 text-[#526B91] hover:text-[#0B2148] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                  Select Assignee Sales Executive
                </label>
                <select 
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full bg-slate-50 border border-[#D8E8FA] text-[#0B2148] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#0878F9] focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {users?.filter((u: any) => u.roles?.includes("SALES_EXECUTIVE") || u.role === "SALES_EXECUTIVE").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} (Sales Executive)</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={assignLeadMutation.isPending}
                  onClick={() => assignLeadMutation.mutate(assigneeId || null)}
                  className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {assignLeadMutation.isPending ? "Assigning..." : "Apply Reassignment"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DUPLICATE DETECTION WARNING MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {isDuplicateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="absolute inset-0" onClick={() => setIsDuplicateOpen(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-lg w-full p-6 space-y-4 z-10 text-[#0B2148]"
            >
              <div className="flex items-center gap-3 text-rose-600 pb-3 border-b border-slate-100">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-bold">Potential Duplicate Customer Found</h3>
              </div>
              
              <p className="text-xs text-slate-700 leading-relaxed">
                An active customer account matches this lead&apos;s phone, email, or company name. Converting this lead directly will create a separate account record.
              </p>

              {duplicateCustomer && (
                <div className="p-3.5 rounded-xl border border-[#D8E8FA] bg-[#F4F9FF] space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Existing Customer Record</span>
                  <p className="text-xs font-bold text-[#0B2148]">{duplicateCustomer.name}</p>
                  <p className="text-[11px] text-[#526B91]">{duplicateCustomer.email} • {duplicateCustomer.phone}</p>
                  <p className="text-[11px] text-[#526B91]">Customer Code: <span className="font-mono font-bold text-[#0878F9]">{duplicateCustomer.customerCode}</span></p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsDuplicateOpen(false);
                    toast.info("Conversion cancelled to prevent duplicate customer records");
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel Conversion
                </button>
                <button 
                  type="button"
                  onClick={() => convertLeadMutation.mutate(true)}
                  disabled={convertLeadMutation.isPending}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {convertLeadMutation.isPending ? "Creating Account..." : "Create New Customer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
