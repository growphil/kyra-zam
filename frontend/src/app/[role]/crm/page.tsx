"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  UserCheck, 
  PhoneCall, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Activity, 
  FileText, 
  Calendar,
  Loader2 
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function CRMDashboard() {
  const { data: session } = useSession();
  const params = useParams();
  const roleSlug = params.role as string;

  const { data, isLoading } = useQuery({
    queryKey: ["crm-dashboard"],
    queryFn: async () => (await api.get("/crm/dashboard")).data,
    refetchInterval: 10000 // refresh every 10s
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentActivities = data?.recentActivities || [];

  const cards = [
    { label: "Total Leads", value: stats.totalLeads, icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "New Leads", value: stats.newLeads, icon: UserCheck, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Contacted Leads", value: stats.contactedLeads, icon: PhoneCall, color: "text-indigo-400", bg: "bg-indigo-400/10" },
    { label: "Qualified Leads", value: stats.qualifiedLeads, icon: TrendingUp, color: "text-[#166534]", bg: "bg-emerald-400/10" },
    { label: "Converted Leads", value: stats.convertedLeads, icon: UserCheck, color: "text-teal-400", bg: "bg-teal-400/10" },
    { label: "Lost Leads", value: stats.lostLeads, icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "High Priority", value: stats.highPriorityLeads, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Today's Followups", value: stats.todayFollowUps, icon: Calendar, color: "text-violet-400", bg: "bg-violet-400/10" },
    { label: "Overdue Followups", value: stats.overdueFollowUps, icon: Clock, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  return (
    <div className="space-y-4 text-[#0B2148]">
      <PageHeader
        title="CRM Dashboard"
        description="Real-time commercial leads and customer acquisition metrics."
        icon={<Activity className="w-5 h-5 text-[#0878F9]" />}
      />

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-center">
              <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Live</span>
            </div>
            <div className="mt-4">
              <p className="text-[#526B91] text-xs font-semibold uppercase tracking-wider">{card.label}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">
                {card.value?.toLocaleString() || 0}
              </h3>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Panel split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent CRM Activities */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent CRM Activities
            </h2>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs p-4 space-y-3">
            {recentActivities.length > 0 ? (
              recentActivities.map((act: any) => (
                <div 
                  key={act.id} 
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-100/70 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-xs">
                      {act.activityType}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{act.subject}</p>
                      <p className="text-xs text-[#526B91] mt-0.5">{act.description || "No description"}</p>
                      <p className="text-[10px] text-[#526B91] font-medium mt-1">
                        {act.lead ? `Lead: ${act.lead.leadNumber} (${act.lead.name})` : act.customer ? `Customer: ${act.customer.customerCode} (${act.customer.name})` : "General"}
                        {act.assignedUser && ` • Assigned to: ${act.assignedUser.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${act.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : act.status === "CANCELLED" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                      {act.status}
                    </span>
                    <p className="text-[10px] text-[#526B91] mt-1">{new Date(act.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-[#526B91]">
                <FileText className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-medium">No recent activities recorded.</p>
              </div>
            )}
          </div>
        </section>

        {/* Action Quick Links */}
        <section className="space-y-4">
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Quick Actions
          </h2>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <a 
              href={`/${roleSlug}/crm/leads`} 
              className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-all group"
            >
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Manage Leads</p>
                <p className="text-xs text-[#526B91] mt-1">Create, assign, qualify, or convert leads.</p>
              </div>
              <span className="text-[#526B91] group-hover:text-blue-600 font-bold">&rarr;</span>
            </a>

            <a 
              href={`/${roleSlug}/crm/customers`} 
              className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-all group"
            >
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Customer Registry</p>
                <p className="text-xs text-[#526B91] mt-1">View unified customer files, addresses, and history.</p>
              </div>
              <span className="text-[#526B91] group-hover:text-blue-600 font-bold">&rarr;</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
