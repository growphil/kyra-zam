"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShieldCheck, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  FileText
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function QualityInspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inspId = params.id as string;
  const roleSlug = params.role as string;

  // --- DATA FETCHING ---
  const { data: insp, isLoading } = useQuery({
    queryKey: ["quality-inspection-details", inspId],
    queryFn: async () => (await api.get(`/crm/quality/inspections/${inspId}`)).data
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!insp) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Inspection File Not Found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/quality`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-white font-bold text-sm bg-[#F4F9FF] border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Inspection ID</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{insp.inspectionNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                insp.result === "PASS" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}>
                {insp.result}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">{insp.inspector?.name}</p>
                  <p className="text-xs text-[#526B91]">Inspector File</p>
                </div>
              </div>

              {insp.workOrder && (
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-accent mt-0.5" />
                  <div>
                    <p className="font-bold text-[#0B2148]">Work Order: {insp.workOrder.workOrderNumber}</p>
                  </div>
                </div>
              )}

              {insp.paxSerial && (
                <div className="flex items-start gap-3">
                  <Bookmark className="w-4 h-4 text-accent mt-0.5" />
                  <div>
                    <p className="font-bold text-[#0B2148] font-mono">Pack Serial: {insp.paxSerial}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91] border-t border-[#D8E8FA] pt-4">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Inspection Type</p>
                  <p className="mt-0.5 text-[#0B2148]">{insp.inspectionType}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Date Audited</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(insp.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {insp.notes && (
                <div className="border-t border-[#D8E8FA] pt-4">
                  <p className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Inspector Notes</p>
                  <p className="text-xs text-[#0B2148] mt-1">{insp.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column Checkpoint parameters list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-lg font-display font-bold text-[#0B2148]">Checkpoint Parameters Readings</h3>
            
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider">
                  <th className="pb-3">Parameter / Criterion</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Expected Value</th>
                  <th className="pb-3 font-bold text-accent">Actual Reading</th>
                  <th className="pb-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {insp.checkpoints?.map((cp: any) => (
                  <tr key={cp.id}>
                    <td className="py-4 font-bold text-[#0B2148]">{cp.name}</td>
                    <td className="py-4 text-[#526B91] max-w-xs">{cp.description || "-"}</td>
                    <td className="py-4 font-mono text-[#526B91]">{cp.expectedValue || "-"}</td>
                    <td className="py-4 font-mono font-bold text-[#0B2148]">{cp.actualValue || "-"}</td>
                    <td className="py-4 text-right">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        cp.result === "PASS" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {cp.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
