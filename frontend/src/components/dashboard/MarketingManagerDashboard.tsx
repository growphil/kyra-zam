"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import api from "@/lib/api";
import {
  Users,
  Target,
  FileText,
  Calendar,
  Loader2,
  Plus,
  ArrowRight,
  Clock,
  TrendingUp,
  Activity,
  AlertCircle,
  Phone,
  Mail,
  Building2,
  RefreshCw,
  PhoneCall,
  UserCheck,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import Link from "next/link";

interface MarketingManagerDashboardProps {
  roleSlug: string;
  userName: string;
}

export default function MarketingManagerDashboard({ roleSlug, userName }: MarketingManagerDashboardProps) {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["crm-dashboard"],
    queryFn: async () => (await api.get("/crm/dashboard")).data,
    refetchInterval: 15000
  });

  const stats = data?.stats || {};
  const leadsBySource = data?.leadsBySource || [];
  const urgentFollowUps = data?.urgentFollowUps || [];
  const recentLeads = data?.recentLeads || [];
  const recentActivities = data?.recentActivities || [];

  const cards = [
    {
      label: "Total Leads",
      value: stats.totalLeads ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 border border-blue-100"
    },
    {
      label: "New Leads",
      value: stats.newLeads ?? 0,
      icon: UserCheck,
      color: "text-amber-600",
      bg: "bg-amber-50 border border-amber-100"
    },
    {
      label: "Contacted Leads",
      value: stats.contactedLeads ?? 0,
      icon: PhoneCall,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border border-indigo-100"
    },
    {
      label: "Qualified Leads",
      value: stats.qualifiedLeads ?? 0,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border border-emerald-100"
    },
    {
      label: "Converted Leads",
      value: stats.convertedLeads ?? 0,
      icon: CheckCircle2,
      color: "text-teal-600",
      bg: "bg-teal-50 border border-teal-100"
    },
    {
      label: "Lost Leads",
      value: stats.lostLeads ?? 0,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-50 border border-rose-100"
    },
    {
      label: "High Priority",
      value: stats.highPriorityLeads ?? 0,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50 border border-red-100"
    },
    {
      label: "Today's Follow-ups",
      value: stats.todayFollowUps ?? 0,
      icon: Calendar,
      color: "text-amber-600",
      bg: "bg-amber-50 border border-amber-100"
    },
    {
      label: "Overdue Follow-ups",
      value: stats.overdueFollowUps ?? 0,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50 border border-orange-100"
    },
    {
      label: "Active Customers",
      value: stats.totalCustomers ?? 0,
      icon: Building2,
      color: "text-slate-700",
      bg: "bg-slate-100 border border-slate-200"
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Native Welcome Section */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
              Welcome back, <span className="text-blue-600">{userName}</span>
            </h1>
            <p className="text-[#526B91] mt-1">
              Here&apos;s the live commercial pipeline and customer acquisition metrics for today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href={`/${roleSlug}/crm/leads`}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Lead</span>
            </Link>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700">CRM Live</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Native Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs hover:border-slate-300 hover:shadow-md transition-all cursor-default"
          >
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <TrendingUp className="w-3 h-3" />
                Live
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[#526B91] text-[10px] font-bold uppercase tracking-wider">{card.label}</p>
              <h3 className="text-2xl font-display font-bold text-slate-900 mt-1">
                {card.value?.toLocaleString() || 0}
              </h3>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Follow-ups & Recent Activities */}
        <div className="lg:col-span-2 space-y-8">
          {/* Urgent & Today's Follow-ups */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Today&apos;s Follow-ups & Scheduled Actions
              </h2>
              <Link
                href={`/${roleSlug}/crm/leads`}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                View All Leads
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
              {urgentFollowUps.length > 0 ? (
                urgentFollowUps.map((lead: any) => {
                  const isOverdue = lead.expectedFollowUpDate && new Date(lead.expectedFollowUpDate) < new Date();
                  return (
                    <div
                      key={lead.id}
                      className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-100/70 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{lead.name}</span>
                          {lead.companyName && (
                            <span className="text-xs text-[#526B91] font-medium">({lead.companyName})</span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOverdue
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {isOverdue ? "OVERDUE" : "DUE TODAY"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#526B91]">
                          <span className="font-mono text-[#526B91] font-bold">{lead.leadNumber}</span>
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="flex items-center gap-1 text-[#526B91] hover:underline"
                            >
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                        <Link
                          href={`/${roleSlug}/crm/leads?search=${lead.leadNumber}`}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center p-10 text-[#526B91]">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500 opacity-80" />
                  <p className="text-sm font-medium text-[#526B91]">No overdue or pending follow-ups for today.</p>
                </div>
              )}
            </div>
          </section>

          {/* Recent CRM Activities */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Recent CRM Activities
              </h2>
              <Link
                href={`/${roleSlug}/crm`}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                View CRM Hub
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
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
                          {act.lead
                            ? `Lead: ${act.lead.leadNumber} (${act.lead.name})`
                            : act.customer
                            ? `Customer: ${act.customer.customerCode} (${act.customer.name})`
                            : "General"}
                          {act.assignedUser && ` • Assigned to: ${act.assignedUser.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 self-end md:self-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          act.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : act.status === "CANCELLED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {act.status}
                      </span>
                      <p className="text-[10px] text-[#526B91] mt-1">
                        {new Date(act.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-10 text-[#526B91]">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No recent activities recorded.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Lead Sources & Quick Actions */}
        <div className="space-y-8">
          {/* Lead Sources Distribution */}
          <section className="space-y-4">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Lead Sources
            </h2>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              {leadsBySource.length > 0 ? (
                leadsBySource.map((s: any) => {
                  const total = stats.totalLeads || 1;
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <div key={s.source} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700 capitalize font-semibold">
                          {s.source.replace(/_/g, " ").toLowerCase()}
                        </span>
                        <span className="text-[#526B91]">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[#526B91] text-center py-4">No source data available</p>
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="space-y-4">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Commercial Tools
            </h2>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <Link
                href={`/${roleSlug}/crm/leads`}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-all group"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Manage Leads
                  </p>
                  <p className="text-xs text-[#526B91] mt-1">Create, assign, qualify, or convert leads.</p>
                </div>
                <span className="text-[#526B91] group-hover:text-blue-600 font-bold">&rarr;</span>
              </Link>

              <Link
                href={`/${roleSlug}/crm/customers`}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-all group"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Customer Registry
                  </p>
                  <p className="text-xs text-[#526B91] mt-1">View unified customer files and history.</p>
                </div>
                <span className="text-[#526B91] group-hover:text-blue-600 font-bold">&rarr;</span>
              </Link>

              <Link
                href={`/${roleSlug}/sales/quotations`}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-all group"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Quotations & Proposals
                  </p>
                  <p className="text-xs text-[#526B91] mt-1">Create and manage customer quotations.</p>
                </div>
                <span className="text-[#526B91] group-hover:text-blue-600 font-bold">&rarr;</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
