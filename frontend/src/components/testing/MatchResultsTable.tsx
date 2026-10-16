"use client";

import { useState } from "react";
import { useTestingStore, TestResult } from "@/store/testingStore";
import { evaluateQcCell } from "@/utils/qcRules";
import { useFormattedSerial } from "@/hooks/useFormattedSerial";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  HelpCircle, 
  Link as LinkIcon, 
  ExternalLink,
  Search,
  Zap,
  Check,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ManualLinkModal from "./ManualLinkModal";

export default function MatchResultsTable() {
  const { formatSerial } = useFormattedSerial();
  const { results, thresholds, updateResult } = useTestingStore();
  const [activeTab, setActiveTab] = useState<"all" | "matched" | "review" | "unmatched">("all");
  const [search, setSearch] = useState("");
  const [linkingSerial, setLinkingSerial] = useState<string | null>(null);

  if (!results.length) return null;

  const getQcStatus = (res: TestResult) => {
    if (!thresholds) return "incomplete";
    const config = {
      ahMin: thresholds.ahMin,
      ahMax: thresholds.ahMax,
      irMin: thresholds.irMin ?? 5.0,
      irMax: thresholds.irMax,
      retestAhMargin: (thresholds as any).retestAhMargin ?? 0.1,
      retestIrMargin: (thresholds as any).retestIrMargin ?? 2.0,
      hardFailAh: (thresholds as any).hardFailAh ?? 3.0,
      hardFailIr: (thresholds as any).hardFailIr ?? 70.0,
    };
    return evaluateQcCell(res.ahValue, res.irValue, config);
  };

  const getMatchStatus = (res: TestResult) => {
    if (res.cellSerial === "UNMATCHED" || !res.cellSerial) return "UNMATCHED";
    if (res.confidence >= 0.85) return "MATCHED";
    return "REVIEW REQUIRED";
  };

  const matchedCount = results.filter(r => getMatchStatus(r) === "MATCHED").length;
  const reviewCount = results.filter(r => getMatchStatus(r) === "REVIEW REQUIRED").length;
  const unmatchedCount = results.filter(r => getMatchStatus(r) === "UNMATCHED").length;

  const filteredResults = results.filter(r => {
    const matchStatus = getMatchStatus(r);
    if (activeTab === "matched" && matchStatus !== "MATCHED") return false;
    if (activeTab === "review" && matchStatus !== "REVIEW REQUIRED") return false;
    if (activeTab === "unmatched" && matchStatus !== "UNMATCHED") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.machineSerial.toLowerCase().includes(q) ||
        r.cellSerial.toLowerCase().includes(q) ||
        (r.normalizedSerial && r.normalizedSerial.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA] w-fit gap-1">
          <button 
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "all" ? "bg-[#0878F9] text-white shadow-xs" : "text-[#526B91] hover:text-[#0878F9]"
            }`}
          >
            All ({results.length})
          </button>
          <button 
            onClick={() => setActiveTab("matched")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "matched" ? "bg-[#166534] text-white shadow-xs" : "text-[#526B91] hover:text-[#166534]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Matched ({matchedCount})</span>
          </button>
          <button 
            onClick={() => setActiveTab("review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "review" ? "bg-[#92400E] text-white shadow-xs" : "text-[#526B91] hover:text-[#92400E]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Review Required ({reviewCount})</span>
          </button>
          <button 
            onClick={() => setActiveTab("unmatched")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "unmatched" ? "bg-[#991B1B] text-white shadow-xs" : "text-[#526B91] hover:text-[#991B1B]"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Unmatched ({unmatchedCount})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search report serials..." 
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-1.5 pl-9 pr-3 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent transition-all" 
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-[#D8E8FA] shadow-xs">
        <div className="overflow-x-auto max-h-[380px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F4F9FF] border-b border-[#D8E8FA]">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">
                <th className="px-4 py-3">Report Serial</th>
                <th className="px-4 py-3">Matched Cell</th>
                <th className="px-4 py-3">Test Values</th>
                <th className="px-4 py-3 text-center">Match Status</th>
                <th className="px-4 py-3 text-center">Confidence</th>
                <th className="px-4 py-3 text-center">QC Result</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC] text-xs">
              <AnimatePresence mode="wait">
                {filteredResults.map((res) => {
                  const qcResult = getQcStatus(res);
                  const matchStatus = getMatchStatus(res);
                  const confPct = Math.round(res.confidence * 100);

                  return (
                    <tr 
                      key={res.machineSerial}
                      className="hover:bg-[#F4F9FF] transition-colors"
                    >
                      {/* Report Serial */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-[#0B2148] text-xs">
                          {res.machineSerial}
                        </div>
                      </td>

                      {/* Matched Cell */}
                      <td className="px-4 py-3">
                        {res.cellSerial && res.cellSerial !== "UNMATCHED" ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#166534] shrink-0" />
                            <span className="font-mono font-bold text-[#0878F9]">
                              {res.cellSerial}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#991B1B] font-mono text-[11px] font-semibold">
                            Not Linked
                          </span>
                        )}
                      </td>

                      {/* Test Values */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#0B2148] font-bold">{res.ahValue?.toFixed(2) ?? "—"} AH</span>
                          <span className="text-[#526B91]">|</span>
                          <span className="text-[#0B2148]">{res.irValue?.toFixed(1) ?? "—"} mΩ</span>
                          {res.grade && (
                            <span className="px-1.5 py-0.2 rounded bg-[#EAF5FF] text-[#0878F9] font-bold text-[10px] border border-[#D8E8FA]">
                              {res.grade}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Match Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          matchStatus === "MATCHED"
                            ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                            : matchStatus === "REVIEW REQUIRED"
                            ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                            : "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                        }`}>
                          {matchStatus}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        <span className={`font-bold ${
                          confPct >= 90 ? "text-[#166534]" : confPct >= 70 ? "text-[#92400E]" : "text-[#991B1B]"
                        }`}>
                          {confPct}%
                        </span>
                      </td>

                      {/* QC Result */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          qcResult === "PASS"
                            ? "bg-[#DCFCE7] text-[#166534] font-bold border border-[#BBF7D0]"
                            : qcResult === "RETEST"
                            ? "bg-[#FEF3C7] text-[#92400E] font-bold border border-[#FDE68A]"
                            : qcResult === "HOLD"
                            ? "bg-[#DBEAFE] text-[#1D4ED8] font-bold border border-[#BFDBFE]"
                            : "bg-[#FEE2E2] text-[#991B1B] font-bold border border-[#FECACA]"
                        }`}>
                          {qcResult}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setLinkingSerial(res.machineSerial)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] text-[11px] font-bold text-[#0B2148] hover:text-[#0878F9] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                          title="Manually link to serialized cell"
                        >
                          <LinkIcon className="w-3 h-3 text-accent" />
                          <span>{res.cellSerial === "UNMATCHED" ? "Link" : "Re-link"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>

          {filteredResults.length === 0 && (
            <div className="py-12 text-center text-[#526B91] text-xs space-y-1">
              <HelpCircle className="w-6 h-6 text-[#526B91] mx-auto" />
              <p>No test results matching your filter</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Link Modal */}
      {linkingSerial && (
        <ManualLinkModal
          isOpen={!!linkingSerial}
          onClose={() => setLinkingSerial(null)}
          machineSerial={linkingSerial}
        />
      )}
    </div>
  );
}
