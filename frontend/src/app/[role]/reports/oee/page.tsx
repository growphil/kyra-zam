"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  BarChart3, 
  Loader2, 
  Activity, 
  CheckCircle, 
  Cpu, 
  AlertOctagon, 
  Clock 
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StationOEEReportPage() {
  // Fetch OEE report
  const { data, isLoading } = useQuery({
    queryKey: ["reports-oee"],
    queryFn: async () => (await api.get("/crm/reports/oee")).data
  });

  const stations = data?.stations || [];

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-8">
      {/* Header */}
      <PageHeader
        title="Station OEE Analytics"
        subtitle="Overall Equipment Effectiveness & Production Telemetry"
        icon={<BarChart3 className="w-5 h-5 text-[#0878F9]" />}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent" />
        </div>
      ) : stations.length === 0 ? (
        <div className="glass-panel p-12 text-center text-[#526B91] rounded-3xl border border-[#D8E8FA]">
          No station metrics logged. Start production work orders to record OEE metrics.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
          {stations.map((st: any) => {
            const oee = st.metrics.oee;
            let oeeColor = "text-red-500 border-red-500/20 bg-red-500/10";
            if (oee >= 85) oeeColor = "text-[#166534] border-emerald-500/20 bg-emerald-500/10";
            else if (oee >= 65) oeeColor = "text-amber-400 border-amber-500/20 bg-amber-500/10";

            return (
              <div 
                key={st.stationId}
                className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] hover:border-[#D8E8FA] transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Station info */}
                  <div className="flex justify-between items-start border-b border-[#D8E8FA] pb-4 mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">{st.stationCode}</span>
                      <h3 className="text-lg font-bold text-[#0B2148] mt-0.5">{st.stationName}</h3>
                      <span className="text-[#526B91] text-xs mt-1 block">Type: {st.stationType}</span>
                    </div>

                    <div className={`px-4 py-2 rounded-2xl border text-center ${oeeColor}`}>
                      <span className="text-[10px] uppercase font-bold block opacity-75">OEE</span>
                      <span className="text-xl font-mono font-bold">{oee}%</span>
                    </div>
                  </div>

                  {/* High level metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-[#F4F9FF] rounded-2xl p-4 border border-[#D8E8FA] text-center">
                      <span className="text-[10px] font-bold text-[#526B91] block uppercase">Scheduled</span>
                      <span className="text-sm font-mono font-bold text-[#0B2148] mt-1 block">{st.scheduledHours} hrs</span>
                    </div>
                    <div className="bg-[#F4F9FF] rounded-2xl p-4 border border-[#D8E8FA] text-center">
                      <span className="text-[10px] font-bold text-[#526B91] block uppercase">Active Run</span>
                      <span className="text-sm font-mono font-bold text-accent mt-1 block">{st.activeHours} hrs</span>
                    </div>
                    <div className="bg-[#F4F9FF] rounded-2xl p-4 border border-[#D8E8FA] text-center">
                      <span className="text-[10px] font-bold text-[#526B91] block uppercase">Assembled Output</span>
                      <span className="text-sm font-mono font-bold text-green-400 mt-1 block">{st.packsAssembled} packs</span>
                    </div>
                  </div>

                  {/* Metrics details breakdown */}
                  <div className="space-y-4">
                    {/* Availability */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#526B91] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-accent" />
                          Availability (Active/Scheduled)
                        </span>
                        <span className="text-[#0B2148] font-mono">{st.metrics.availability}%</span>
                      </div>
                      <div className="w-full bg-[#F4F9FF] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-accent h-full rounded-full transition-all"
                          style={{ width: `${st.metrics.availability}%` }}
                        />
                      </div>
                    </div>

                    {/* Performance */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#526B91] flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-purple-400" />
                          Performance (Ideal Output vs Actual)
                        </span>
                        <span className="text-[#0B2148] font-mono">{st.metrics.performance}%</span>
                      </div>
                      <div className="w-full bg-[#F4F9FF] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full rounded-full transition-all"
                          style={{ width: `${st.metrics.performance}%` }}
                        />
                      </div>
                    </div>

                    {/* Quality */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[#526B91] flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          Quality (Pass Rate)
                        </span>
                        <span className="text-[#0B2148] font-mono">{st.metrics.quality}%</span>
                      </div>
                      <div className="w-full bg-[#F4F9FF] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 h-full rounded-full transition-all"
                          style={{ width: `${st.metrics.quality}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="flex justify-between border-t border-[#D8E8FA] pt-4 mt-6 text-[10px] text-[#526B91] font-semibold uppercase">
                  <span>QC Passed: {st.passedInspections}</span>
                  <span>QC Inspections: {st.totalInspections}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
