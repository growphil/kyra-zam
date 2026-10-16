"use client";

import { useTestingStore } from "@/store/testingStore";
import { Activity, ShieldCheck, AlertTriangle, Timer, Info } from "lucide-react";

export default function QcSummaryBar() {
  const { results, thresholds } = useTestingStore();

  if (!results.length && !thresholds) return null;

  const testedCount = results.length;
  const autoMatched = results.filter(r => r.cellSerial !== "UNMATCHED").length;
  const alreadyTested = results.filter(r => r.isAlreadyTested).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Threshold Stats */}
      <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] flex flex-col justify-center">
        <div className="flex items-center gap-2 text-[#526B91] mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Active Thresholds</span>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[9px] text-[#526B91] font-bold uppercase">AH Range</p>
            <p className="text-sm font-mono text-[#0B2148]">{thresholds?.ahMin} - {thresholds?.ahMax}</p>
          </div>
          <div className="w-px h-6 bg-[#F4F9FF]" />
          <div>
            <p className="text-[9px] text-[#526B91] font-bold uppercase">IR Max</p>
            <p className="text-sm font-mono text-[#0B2148]">{thresholds?.irMax} mΩ</p>
          </div>
        </div>
      </div>

      {/* Matching Stats */}
      <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA] bg-accent/5">
        <div className="flex items-center gap-2 text-accent mb-1">
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Report Integrity</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-display font-bold text-[#0B2148]">{testedCount}</p>
          <p className="text-[10px] text-[#526B91] font-bold uppercase">Cells in File</p>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA]">
        <div className="flex items-center gap-2 text-[#166534] mb-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Auto-Matched</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-display font-bold text-[#0B2148]">{autoMatched}</p>
          <p className="text-[10px] text-[#526B91] font-bold uppercase">Ready to Apply</p>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-2xl border border-[#D8E8FA]">
        <div className="flex items-center gap-2 text-amber-500 mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Manual Review</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-display font-bold text-[#0B2148]">{testedCount - autoMatched}</p>
          <p className="text-[10px] text-[#526B91] font-bold uppercase">Need Linking</p>
        </div>
      </div>

      {alreadyTested > 0 && (
        <div className="col-span-full flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Warning: {alreadyTested} cells in this report are already marked as tested or rejected in the database. 
            Applying this report may duplicate data or cause conflicts.
          </p>
        </div>
      )}
    </div>
  );
}
