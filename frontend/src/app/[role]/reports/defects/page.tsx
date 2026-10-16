"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion } from "framer-motion";
import { 
  BarChart3, Loader2, TrendingUp, AlertTriangle, IndianRupee, PieChart as PieChartIcon
} from "lucide-react";
import { useSession } from "next-auth/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export default function DefectAnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["scrap-analytics"],
    queryFn: async () => (await api.get("/scrap/analytics")).data,
    enabled: mounted,
  });

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest">Loading Analytics...</p>
      </div>
    );
  }

  const defectTypes = analytics?.defectTypesCount || {};
  const sourceTypes = analytics?.sourceTypesCount || {};

  // Simple sort for top defects
  const sortedDefects = Object.entries(defectTypes).sort(([,a], [,b]) => (b as number) - (a as number));
  
  const defectChartData = sortedDefects.map(([name, value]) => ({ name, value }));
  const sourceChartData = Object.entries(sourceTypes)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#ec4899', '#f97316'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-[#0B2148] flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-accent" />
          Defect Analytics
        </h1>
        <p className="text-xs text-[#526B91] mt-1 uppercase tracking-widest font-bold">Scrap & Waste Intelligence</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><TrendingUp className="w-5 h-5" /></div>
            <h3 className="text-sm font-bold text-[#0B2148]">Total Scrapped Volume</h3>
          </div>
          <p className="text-4xl font-display font-bold text-[#0B2148]">{analytics?.totalScrap || 0}</p>
          <p className="text-[10px] text-[#526B91] mt-2 uppercase tracking-widest font-bold">Units permanently removed</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><IndianRupee className="w-5 h-5" /></div>
            <h3 className="text-sm font-bold text-[#0B2148]">Financial Loss</h3>
          </div>
          <p className="text-4xl font-display font-bold text-[#0B2148]">₹{(analytics?.totalFinancialLoss || 0).toLocaleString()}</p>
          <p className="text-[10px] text-[#526B91] mt-2 uppercase tracking-widest font-bold">Value of approved scrap</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><AlertTriangle className="w-5 h-5" /></div>
            <h3 className="text-sm font-bold text-[#0B2148]">Top Defect</h3>
          </div>
          <p className="text-2xl font-display font-bold text-[#0B2148] truncate">
            {sortedDefects.length > 0 ? sortedDefects[0][0] : "None"}
          </p>
          <p className="text-[10px] text-[#526B91] mt-2 uppercase tracking-widest font-bold">Most frequent issue</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA]">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-[#0B2148]">Defects by Category</h3>
          </div>
          <div className="h-80 w-full">
            {defectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={defectChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {defectChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[#526B91] text-center py-20">No data available</p>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA]">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-[#0B2148]">Scrap Sources</h3>
          </div>
          <div className="h-80 w-full">
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sourceChartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    {sourceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[#526B91] text-center py-20">No data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
