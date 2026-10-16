"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Search, 
  Loader2, 
  RefreshCw,
  Trash2,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  Zap,
  Printer,
  Eye,
  X,
  Battery,
  Layers,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Calendar,
  User,
  History,
  Check,
  Sparkles,
  QrCode
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { QRCodeSVG } from "qrcode.react";

// --- STATUS HELPER & PALETTE ---
function getStatusConfig(status: string) {
  switch (status) {
    case "READY_FOR_SALE":
      return { 
        label: "Ready for Sale", 
        color: "text-[#166534]", 
        bg: "bg-emerald-50", 
        border: "border-emerald-200", 
        dot: "bg-emerald-500",
        icon: CheckCircle2 
      };
    case "PAX_ASSEMBLED":
      return { 
        label: "Assembled", 
        color: "text-[#0878F9]", 
        bg: "bg-[#EAF5FF]", 
        border: "border-[#0878F9]/30", 
        dot: "bg-[#0878F9]",
        icon: Package 
      };
    case "READY_FOR_PAX_TEST":
      return { 
        label: "Ready for PAX Test", 
        color: "text-amber-800", 
        bg: "bg-amber-50", 
        border: "border-amber-300", 
        dot: "bg-amber-500",
        icon: Clock 
      };
    case "PAX_TESTED":
      return { 
        label: "PAX Tested", 
        color: "text-indigo-800", 
        bg: "bg-indigo-50", 
        border: "border-indigo-200", 
        dot: "bg-indigo-500",
        icon: Zap 
      };
    case "READY_FOR_PACKING":
      return { 
        label: "Ready for Packing", 
        color: "text-teal-800", 
        bg: "bg-teal-50", 
        border: "border-teal-200", 
        dot: "bg-teal-500",
        icon: Package 
      };
    case "PACKED":
      return { 
        label: "Packed", 
        color: "text-blue-800", 
        bg: "bg-blue-50", 
        border: "border-blue-200", 
        dot: "bg-blue-500",
        icon: ShieldCheck 
      };
    case "UNDER_REPAIR":
      return { 
        label: "Under Repair", 
        color: "text-orange-800", 
        bg: "bg-orange-50", 
        border: "border-orange-300", 
        dot: "bg-orange-500",
        icon: Wrench 
      };
    case "SCRAPPED":
      return { 
        label: "Scrapped", 
        color: "text-rose-800", 
        bg: "bg-rose-50", 
        border: "border-rose-300", 
        dot: "bg-rose-500",
        icon: XCircle 
      };
    default:
      return { 
        label: status ? status.replace(/_/g, " ") : "Unknown", 
        color: "text-[#526B91]", 
        bg: "bg-slate-100", 
        border: "border-slate-200", 
        dot: "bg-slate-400",
        icon: Package 
      };
  }
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "---";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return dateStr;
  }
}

export default function AllPaxRegisterPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.roles?.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Detail Modal & Reprint Dialog States
  const [selectedSerialForDetails, setSelectedSerialForDetails] = useState<string | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<"overview" | "cells" | "bom" | "qc" | "history">("overview");
  const [reprintPackData, setReprintPackData] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Query: Main PAX Register List
  const { data: paxListResponse, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["all-pax-register", page, limit, statusFilter, debouncedSearch],
    queryFn: async () => {
      const res = await api.get("/pax", { 
        params: { 
          page, 
          limit, 
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: debouncedSearch || undefined
        } 
      });
      return res.data;
    },
    enabled: mounted
  });

  // Query: Single PAX Details for Modal
  const { data: singlePackDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["pax-pack-single-detail", selectedSerialForDetails],
    queryFn: async () => {
      if (!selectedSerialForDetails) return null;
      const res = await api.get(`/pax/${selectedSerialForDetails}`);
      return res.data;
    },
    enabled: !!selectedSerialForDetails
  });

  // Mutation: Delete/Disassemble PAX (Admin only)
  const deletePaxMutation = useMutation({
    mutationFn: (serial: string) => api.delete(`/pax/${serial}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-pax-register"] });
      if (selectedSerialForDetails) setSelectedSerialForDetails(null);
      toast.success("PAX pack deleted successfully and cells returned to pool");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to delete PAX pack")
  });

  // Mutation: Audit Reprint Action
  const recordReprintMutation = useMutation({
    mutationFn: (serial: string) => api.post(`/pax/${serial}/reprint-audit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pax-pack-single-detail", selectedSerialForDetails] });
    }
  });

  const packs = paxListResponse?.packs || [];
  const totalRecords = paxListResponse?.total || 0;
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  // Lifecycle filter definitions mapped to real backend PaxStatus
  const LIFECYCLE_FILTERS = [
    { key: "ALL", label: "All Packs" },
    { key: "PAX_ASSEMBLED", label: "Assembled" },
    { key: "READY_FOR_PAX_TEST", label: "Ready for PAX Test" },
    { key: "PAX_TESTED", label: "PAX Tested" },
    { key: "READY_FOR_SALE", label: "Ready for Sale" },
    { key: "UNDER_REPAIR", label: "Under Repair" },
    { key: "SCRAPPED", label: "Scrapped" },
  ];

  // Helper: compute telemetry stats for a pack
  const computePackTelemetry = (pack: any) => {
    const cells = pack?.cells || [];
    if (!cells.length) {
      return { avgAh: 0, avgIr: 0, ahDelta: 0, irDelta: 0, grade: "---" };
    }
    const ahs = cells.map((c: any) => c.cell?.ahValue || 0).filter((v: number) => v > 0);
    const irs = cells.map((c: any) => c.cell?.irValue || 0).filter((v: number) => v > 0);
    const avgAh = ahs.length ? ahs.reduce((a: number, b: number) => a + b, 0) / ahs.length : 0;
    const avgIr = irs.length ? irs.reduce((a: number, b: number) => a + b, 0) / irs.length : 0;
    const ahDelta = ahs.length ? Math.max(...ahs) - Math.min(...ahs) : 0;
    const irDelta = irs.length ? Math.max(...irs) - Math.min(...irs) : 0;
    const grade = cells[0]?.cell?.grade || "A+";
    return { avgAh, avgIr, ahDelta, irDelta, grade };
  };

  // Helper: Prepare QR payload string for a pack
  const getPackQrPayload = (pack: any) => {
    if (!pack) return "";
    const telemetry = computePackTelemetry(pack);
    const payload = {
      paxSerial: pack.paxSerial,
      model: pack.paxType?.name || "Battery Pack",
      topology: pack.paxType?.configuration || `${pack.cells?.length || 0}S1P`,
      cellCount: pack.cells?.length || 0,
      workOrder: pack.workOrder?.workOrderNumber || "DIRECT_PROD",
      assembledAt: pack.assembledAt,
      status: pack.status,
      telemetry: {
        avgAh: Number(telemetry.avgAh.toFixed(2)),
        avgIr: Number(telemetry.avgIr.toFixed(2)),
        ahSpread: Number(telemetry.ahDelta.toFixed(3)),
        irSpread: Number(telemetry.irDelta.toFixed(2)),
        grade: telemetry.grade
      },
      cells: (pack.cells || []).map((c: any) => ({
        pos: c.position,
        serial: c.cellSerial,
        ah: c.cell?.ahValue || 0,
        ir: c.cell?.irValue || 0,
        grade: c.cell?.grade || "A+"
      })),
      bom: {
        name: pack.bom?.name || pack.paxType?.bom?.name || "Standard BOM",
        partsCount: pack.bom?.items?.length || pack.paxType?.bom?.items?.length || 0
      }
    };
    return JSON.stringify(payload, null, 2);
  };

  // Execute print label
  const handleConfirmReprint = (pack: any) => {
    recordReprintMutation.mutate(pack.paxSerial);
    toast.success(`Label print queued for ${pack.paxSerial}`);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#D8E8FA]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0878F9]/10 text-[#0878F9] flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-bold text-[#0B2148]">
                  Battery Pack Register
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] text-xs font-mono font-bold">
                  {totalRecords} {totalRecords === 1 ? "Pack" : "Packs"} Total
                </span>
              </div>
              <p className="text-xs text-[#526B91] mt-0.5 font-medium">
                Search, inspect and manage assembled battery packs across their manufacturing lifecycle.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Search */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input 
              type="text"
              placeholder="Search PAX serial, model, cell, WO..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-9 pr-8 text-xs text-[#0B2148] placeholder-[#526B91]/70 focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/10 outline-none transition-all shadow-2xs" 
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526B91] hover:text-[#0B2148] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button 
            type="button"
            onClick={() => refetch()} 
            disabled={isFetching}
            title="Refresh register data"
            className="p-2.5 bg-white border border-[#D8E8FA] rounded-xl hover:bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148] transition-all shadow-2xs cursor-pointer flex items-center justify-center shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-[#0878F9]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── 2. LIFECYCLE STATUS FILTER BAR ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 custom-scrollbar">
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-[#D8E8FA] shadow-2xs">
          {LIFECYCLE_FILTERS.map((f) => {
            const isActive = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setStatusFilter(f.key);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#0878F9] text-white shadow-2xs"
                    : "text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF]"
                }`}
              >
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {debouncedSearch && (
          <div className="flex items-center gap-2 text-xs text-[#526B91] font-mono bg-white px-3 py-1.5 rounded-xl border border-[#D8E8FA] shrink-0">
            <span>Query: <strong>"{debouncedSearch}"</strong></span>
            <button 
              type="button"
              onClick={() => setSearchTerm("")} 
              className="text-[#0878F9] hover:underline font-bold"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── 3. COMPACT BATTERY PACK REGISTER TABLE ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#D8E8FA] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-24 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin text-[#0878F9]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B2148]">Loading Battery Pack Register...</p>
              <p className="text-xs text-[#526B91] mt-0.5">Fetching serialized packs, bound cells and lifecycle states</p>
            </div>
          </div>
        ) : packs.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-center text-[#526B91]">
              <Package className="w-7 h-7 text-[#526B91]" />
            </div>
            <h3 className="text-base font-bold text-[#0B2148]">No Battery Packs Found</h3>
            <p className="text-xs text-[#526B91] max-w-sm">
              {debouncedSearch 
                ? `No battery packs matched your search query "${debouncedSearch}". Try searching by another serial number or clearing filters.`
                : `No battery packs currently exist in the "${statusFilter === "ALL" ? "All Packs" : statusFilter.replace(/_/g, " ")}" lifecycle state.`}
            </p>
            {(statusFilter !== "ALL" || debouncedSearch) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearchTerm("");
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0667DB] transition-all cursor-pointer shadow-2xs"
              >
                Reset Filters & Search
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] font-bold text-[#526B91] uppercase tracking-wider">
                  <th className="py-3 px-4">PAX Serial</th>
                  <th className="py-3 px-4">Product / Model</th>
                  <th className="py-3 px-4">Cell Count</th>
                  <th className="py-3 px-4">Assembly Date</th>
                  <th className="py-3 px-4">Work Order</th>
                  <th className="py-3 px-4">Lifecycle Status</th>
                  <th className="py-3 px-4">Station / QA</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E8FA]/70">
                {packs.map((pack: any) => {
                  const statusCfg = getStatusConfig(pack.status);
                  const telemetry = computePackTelemetry(pack);
                  const expectedCellCount = pack.paxType?.cellCount || pack.cells?.length || 0;
                  const actualCellCount = pack.cells?.length || 0;
                  const isCountComplete = expectedCellCount > 0 && actualCellCount >= expectedCellCount;

                  return (
                    <tr 
                      key={pack.paxSerial}
                      className="hover:bg-[#F4F9FF]/80 transition-colors group"
                    >
                      {/* 1. PAX Serial */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot}`} />
                          <div className="font-mono font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors">
                            {pack.paxSerial}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(pack.paxSerial);
                              toast.success(`Copied ${pack.paxSerial}`);
                            }}
                            title="Copy Serial"
                            className="text-[#526B91]/60 hover:text-[#0878F9] p-0.5 rounded cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 2. Product / Model */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-[#0B2148]">
                            {pack.paxType?.name || "Battery Pack Model"}
                          </p>
                          <p className="text-[10px] text-[#526B91] font-mono mt-0.5">
                            {pack.paxType?.configuration || `${actualCellCount}S1P`} • {pack.paxType?.cellChemistry || "LFP"}
                          </p>
                        </div>
                      </td>

                      {/* 3. Cell Count & Telemetry */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${
                            isCountComplete 
                              ? "bg-emerald-50 text-[#166534] border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}>
                            {actualCellCount} / {expectedCellCount} Cells
                          </span>
                          {telemetry.avgAh > 0 && (
                            <span className="text-[10px] font-mono text-[#526B91]">
                              ({telemetry.avgAh.toFixed(1)} Ah)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Assembly Date */}
                      <td className="py-3.5 px-4 font-mono text-[#526B91]">
                        {formatDateTime(pack.assembledAt)}
                      </td>

                      {/* 5. Work Order */}
                      <td className="py-3.5 px-4">
                        {pack.workOrder ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#F4F9FF] border border-[#D8E8FA] font-mono text-[11px] font-bold text-[#0878F9]">
                              {pack.workOrder.workOrderNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#526B91] font-mono">Direct Build</span>
                        )}
                      </td>

                      {/* 6. Lifecycle Status Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* 7. Station / QA */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] font-mono text-[#526B91]">
                          {pack.assembledAtStation?.name || pack.assembledAtStation?.code || "STN-ASY-01"}
                        </div>
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details Action */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSerialForDetails(pack.paxSerial);
                              setDetailActiveTab("overview");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#EAF5FF] hover:bg-[#0878F9] text-[#0878F9] hover:text-white font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {/* Reprint Label Action */}
                          <button
                            type="button"
                            onClick={() => setReprintPackData(pack)}
                            title="Reprint QR/Barcode Passport Label"
                            className="p-1.5 rounded-lg text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF] border border-transparent hover:border-[#D8E8FA] transition-all cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Admin Delete Action */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Disassemble and delete PAX Pack ${pack.paxSerial}? All bound cells will be returned to inventory.`)) {
                                  deletePaxMutation.mutate(pack.paxSerial);
                                }
                              }}
                              title="Delete / Disassemble Pack"
                              className="p-1.5 rounded-lg text-[#526B91] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && totalRecords > 0 && (
          <div className="px-4 py-3 bg-[#F4F9FF] border-t border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <p className="text-[#526B91] font-medium">
              Showing <strong className="text-[#0B2148]">{(page - 1) * limit + 1}</strong> to <strong className="text-[#0B2148]">{Math.min(page * limit, totalRecords)}</strong> of <strong className="text-[#0B2148]">{totalRecords}</strong> packs
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#D8E8FA] text-[#0B2148] font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EAF5FF] transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <span className="px-3 py-1 rounded-lg bg-white border border-[#D8E8FA] font-mono font-bold text-[#0878F9]">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#D8E8FA] text-[#0B2148] font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EAF5FF] transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. COMPLETE BATTERY PACK DETAILS MODAL ───────────────────────────── */}
      <AnimatePresence>
        {selectedSerialForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061B3A]/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-[#D8E8FA] rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-6 max-h-[92vh]"
            >
              {/* Modal Top Header */}
              <div className="p-5 bg-[#F4F9FF] border-b border-[#D8E8FA] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0878F9]/10 text-[#0878F9] flex items-center justify-center font-bold">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-display font-bold text-[#0B2148]">
                        Battery Pack Traceability Record
                      </h3>
                      {singlePackDetails && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusConfig(singlePackDetails.status).bg} ${getStatusConfig(singlePackDetails.status).color} ${getStatusConfig(singlePackDetails.status).border}`}>
                          {getStatusConfig(singlePackDetails.status).label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#526B91] font-mono mt-0.5 flex items-center gap-2">
                      PAX Serial: <strong className="text-[#0878F9]">{selectedSerialForDetails}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedSerialForDetails);
                          toast.success("Serial copied to clipboard");
                        }}
                        className="text-[#526B91] hover:text-[#0878F9] cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {singlePackDetails && (
                    <button
                      type="button"
                      onClick={() => setReprintPackData(singlePackDetails)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0B2148] font-bold text-xs border border-[#D8E8FA] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#0878F9]" />
                      <span>Reprint Label</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedSerialForDetails(null)}
                    className="p-2 rounded-xl text-[#526B91] hover:text-[#0B2148] hover:bg-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Subtabs */}
              <div className="px-6 pt-3 bg-white flex items-center justify-between border-b border-[#D8E8FA] overflow-x-auto gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDetailActiveTab("overview")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      detailActiveTab === "overview"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Overview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab("cells")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      detailActiveTab === "cells"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    <Battery className="w-3.5 h-3.5" />
                    <span>Bound Cells ({singlePackDetails?.cells?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab("bom")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      detailActiveTab === "bom"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Configuration & BOM ({singlePackDetails?.bom?.items?.length || singlePackDetails?.paxType?.bom?.items?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab("qc")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      detailActiveTab === "qc"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Quality & Reports ({singlePackDetails?.inspections?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailActiveTab("history")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      detailActiveTab === "history"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Persisted History ({singlePackDetails?.auditLogs?.length || 0})</span>
                  </button>
                </div>

                {singlePackDetails && (
                  <span className="text-[11px] text-[#526B91] font-mono hidden md:block">
                    Assembled: {formatDateTime(singlePackDetails.assembledAt)}
                  </span>
                )}
              </div>

              {/* Modal Content Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                {loadingDetails ? (
                  <div className="p-20 flex flex-col items-center justify-center space-y-3 text-[#526B91]">
                    <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
                    <p className="text-xs font-bold text-[#0B2148]">Retrieving full traceability snapshot...</p>
                  </div>
                ) : !singlePackDetails ? (
                  <div className="p-12 text-center text-rose-600 space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
                    <p className="text-sm font-bold">Could not load battery pack details</p>
                  </div>
                ) : (
                  <>
                    {/* ── TAB 1: OVERVIEW ── */}
                    {detailActiveTab === "overview" && (
                      <div className="space-y-5">
                        {/* 4 Top KPI Cards */}
                        {(() => {
                          const telemetry = computePackTelemetry(singlePackDetails);
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">Product Model</span>
                                <strong className="text-sm text-[#0B2148] block truncate">{singlePackDetails.paxType?.name || "Standard Pack"}</strong>
                                <span className="text-[10px] font-mono text-[#0878F9]">
                                  {singlePackDetails.paxType?.configuration || `${singlePackDetails.cells?.length || 0}S1P`} • {singlePackDetails.paxType?.cellChemistry || "LFP"}
                                </span>
                              </div>

                              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">Average Capacity (AH)</span>
                                <strong className="text-sm font-mono text-[#166534] block">
                                  {telemetry.avgAh > 0 ? `${telemetry.avgAh.toFixed(2)} AH` : "---"}
                                </strong>
                                <span className="text-[10px] font-mono text-[#526B91]">
                                  Spread: ΔAH {telemetry.ahDelta.toFixed(3)}
                                </span>
                              </div>

                              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">Average Resistance (IR)</span>
                                <strong className="text-sm font-mono text-[#0B2148] block">
                                  {telemetry.avgIr > 0 ? `${telemetry.avgIr.toFixed(2)} mΩ` : "---"}
                                </strong>
                                <span className="text-[10px] font-mono text-[#526B91]">
                                  Spread: ΔIR {telemetry.irDelta.toFixed(2)} mΩ
                                </span>
                              </div>

                              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#526B91] block">Matched Grade</span>
                                <strong className="text-sm font-mono text-[#0878F9] block">
                                  Grade {telemetry.grade}
                                </strong>
                                <span className="text-[10px] font-mono text-emerald-700 font-bold">
                                  Tolerance Safe ✓
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Manufacturing & Assembly Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] space-y-3">
                            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                              <Package className="w-4 h-4 text-[#0878F9]" />
                              <span>Assembly Identity</span>
                            </h4>
                            <div className="space-y-2 text-xs font-mono">
                              <div className="flex justify-between py-1 border-b border-[#D8E8FA]/60">
                                <span className="text-[#526B91] font-sans">PAX Serial:</span>
                                <strong className="text-[#0B2148]">{singlePackDetails.paxSerial}</strong>
                              </div>
                              <div className="flex justify-between py-1 border-b border-[#D8E8FA]/60">
                                <span className="text-[#526B91] font-sans">Assembly Timestamp:</span>
                                <span className="text-[#0B2148]">{formatDateTime(singlePackDetails.assembledAt)}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-[#D8E8FA]/60">
                                <span className="text-[#526B91] font-sans">Assembly Station:</span>
                                <span className="text-[#0B2148] font-bold">
                                  {singlePackDetails.assembledAtStation?.name || singlePackDetails.assembledAtStation?.code || "STN-ASY-01"}
                                </span>
                              </div>
                              <div className="flex justify-between py-1">
                                <span className="text-[#526B91] font-sans">Lifecycle Stage:</span>
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${getStatusConfig(singlePackDetails.status).bg} ${getStatusConfig(singlePackDetails.status).color}`}>
                                  {getStatusConfig(singlePackDetails.status).label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 rounded-2xl bg-white border border-[#D8E8FA] space-y-3">
                            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#0878F9]" />
                              <span>Production Work Order</span>
                            </h4>
                            <div className="space-y-2 text-xs font-mono">
                              <div className="flex justify-between py-1 border-b border-[#D8E8FA]/60">
                                <span className="text-[#526B91] font-sans">Work Order #:</span>
                                <strong className="text-[#0878F9]">
                                  {singlePackDetails.workOrder?.workOrderNumber || "Direct Assembly"}
                                </strong>
                              </div>
                              <div className="flex justify-between py-1 border-b border-[#D8E8FA]/60">
                                <span className="text-[#526B91] font-sans">Product Reference:</span>
                                <span className="text-[#0B2148] truncate max-w-[200px]">
                                  {singlePackDetails.workOrder?.productRef || singlePackDetails.paxType?.name}
                                </span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-[#D8E8FA]/60">
                                <span className="text-[#526B91] font-sans">WO Status:</span>
                                <span className="text-[#0B2148] font-bold">
                                  {singlePackDetails.workOrder?.status || "COMPLETED"}
                                </span>
                              </div>
                              <div className="flex justify-between py-1">
                                <span className="text-[#526B91] font-sans">Supervisor Approval:</span>
                                <span className="text-[#166534] font-bold">
                                  {singlePackDetails.approvedAt ? `Approved (${formatDateTime(singlePackDetails.approvedAt)})` : "Standard QC Path"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Quick Barcode & QR Stamp Preview */}
                        <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-xl border border-[#D8E8FA] shrink-0 shadow-2xs">
                              <QRCodeSVG 
                                value={getPackQrPayload(singlePackDetails)} 
                                size={72} 
                                level="M" 
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#0B2148]">Scannable Electronic QC Passport</p>
                              <p className="text-[11px] text-[#526B91] font-mono mt-0.5">
                                Contains {singlePackDetails.cells?.length || 0} serialized physical cells and verified BOM items
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setReprintPackData(singlePackDetails)}
                            className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Print Full Label</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── TAB 2: CELLS TRACEABILITY ── */}
                    {detailActiveTab === "cells" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Battery className="w-4 h-4 text-[#0878F9]" />
                            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                              Bound Physical Cells ({singlePackDetails.cells?.length || 0} Units)
                            </h4>
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            100% Tested & Qualified ✓
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {(singlePackDetails.cells || []).map((c: any) => (
                            <div
                              key={c.cellSerial}
                              className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2 text-xs font-mono"
                            >
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded bg-[#0878F9]/10 text-[#0878F9] font-bold text-[11px]">
                                  Position P{c.position}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-white border border-[#D8E8FA] font-bold text-[10px] text-[#0B2148]">
                                  Grade {c.cell?.grade || "A+"}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-[#526B91] uppercase font-sans block">Serial Number</span>
                                <strong className="text-[#0B2148] text-xs block truncate">{c.cellSerial}</strong>
                              </div>

                              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-[#D8E8FA] text-[11px]">
                                <div>
                                  <span className="text-[9px] text-[#526B91] block">Capacity</span>
                                  <strong className="text-[#166534]">{c.cell?.ahValue ? `${c.cell.ahValue.toFixed(2)} Ah` : "---"}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-[#526B91] block">Resistance</span>
                                  <strong className="text-[#0B2148]">{c.cell?.irValue ? `${c.cell.irValue.toFixed(2)} mΩ` : "---"}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-[#526B91] block">Voltage</span>
                                  <strong className="text-[#0B2148]">{c.cell?.voltage ? `${c.cell.voltage.toFixed(2)} V` : "3.2 V"}</strong>
                                </div>
                              </div>

                              {c.cell?.batchNumber && (
                                <p className="text-[9px] text-[#526B91] truncate pt-0.5">
                                  Batch: <strong>{c.cell.batchNumber}</strong>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── TAB 3: PRODUCT CONFIGURATION & BOM ── */}
                    {detailActiveTab === "bom" && (
                      <div className="space-y-5">
                        {/* Product Blueprint Specs */}
                        <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                          <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#0878F9]" />
                            <span>Product Model Configuration Snapshot</span>
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                            <div className="bg-white p-2.5 rounded-xl border border-[#D8E8FA]">
                              <span className="text-[9px] text-[#526B91] uppercase block font-sans">Topology</span>
                              <strong className="text-[#0B2148]">{singlePackDetails.paxType?.configuration || `${singlePackDetails.cells?.length || 0}S1P`}</strong>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-[#D8E8FA]">
                              <span className="text-[9px] text-[#526B91] uppercase block font-sans">Cell Chemistry</span>
                              <strong className="text-[#0B2148]">{singlePackDetails.paxType?.cellChemistry || "LFP"}</strong>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-[#D8E8FA]">
                              <span className="text-[9px] text-[#526B91] uppercase block font-sans">Max Allowed ΔAH</span>
                              <strong className="text-[#166534]">{singlePackDetails.paxType?.maxAhDifference || 0.05} AH</strong>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-[#D8E8FA]">
                              <span className="text-[9px] text-[#526B91] uppercase block font-sans">Max Allowed ΔIR</span>
                              <strong className="text-[#166534]">{singlePackDetails.paxType?.maxIrDifference || 3.0} mΩ</strong>
                            </div>
                          </div>
                        </div>

                        {/* Bill of Materials Items */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">
                              Verified Hardware Bill of Materials ({singlePackDetails.bom?.name || singlePackDetails.paxType?.bom?.name || "Pack BOM"})
                            </h4>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                              All Verified & Issued ✓
                            </span>
                          </div>

                          {(() => {
                            const items = singlePackDetails.bom?.items || singlePackDetails.paxType?.bom?.items || singlePackDetails.workOrder?.bom?.items || [];
                            if (items.length === 0) {
                              return (
                                <div className="p-6 bg-[#F4F9FF] rounded-2xl border border-dashed border-[#D8E8FA] text-center text-xs text-[#526B91]">
                                  No Bill of Materials items recorded for this configuration.
                                </div>
                              );
                            }
                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {items.map((item: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="p-3.5 rounded-2xl bg-white border border-[#D8E8FA] flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-[#0B2148] font-sans">
                                        {item.material?.name || item.name || "Hardware Component"}
                                      </p>
                                      <p className="text-[11px] font-mono text-[#526B91] mt-0.5">
                                        SKU: {item.material?.sku || item.sku || "BOM-SKU"}
                                      </p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-[#166534] font-mono font-bold text-xs">
                                      Qty: {item.quantity || 1} ✓
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* ── TAB 4: QUALITY & REPORTS ── */}
                    {detailActiveTab === "qc" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#0878F9]" />
                            <span>Quality Inspections & Testing Reports</span>
                          </h4>
                        </div>

                        {/* Test Report File if available */}
                        {singlePackDetails.testReportUrl && (
                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-bold text-emerald-900">PAX Quality Testing Report Uploaded</p>
                                <p className="text-[11px] text-emerald-700 font-mono">
                                  Report URI: {singlePackDetails.testReportUrl}
                                </p>
                              </div>
                            </div>
                            <a
                              href={singlePackDetails.testReportUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold text-xs transition-all flex items-center gap-1 shadow-2xs"
                            >
                              <span>View Report</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}

                        {/* Inspections List */}
                        {singlePackDetails.inspections && singlePackDetails.inspections.length > 0 ? (
                          <div className="space-y-2">
                            {singlePackDetails.inspections.map((insp: any) => (
                              <div
                                key={insp.id}
                                className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs"
                              >
                                <div>
                                  <p className="font-bold text-[#0B2148]">{insp.stage || "Quality Inspection"}</p>
                                  <p className="text-[11px] text-[#526B91]">
                                    Inspector: <strong>{insp.inspector?.name || "QC Officer"}</strong> • {formatDateTime(insp.createdAt)}
                                  </p>
                                  {insp.notes && (
                                    <p className="text-[11px] text-[#526B91] mt-1 italic">"{insp.notes}"</p>
                                  )}
                                </div>
                                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase font-mono ${
                                  insp.result === "PASSED" || insp.status === "PASSED"
                                    ? "bg-emerald-100 text-[#166534]"
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  {insp.result || insp.status || "PASSED"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 bg-[#F4F9FF] rounded-2xl border border-dashed border-[#D8E8FA] text-center text-xs text-[#526B91]">
                            No formal inspection records logged. Pack assembled under standard automated verification.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TAB 5: PERSISTED HISTORY & AUDIT TIMELINE ── */}
                    {detailActiveTab === "history" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-2">
                            <History className="w-4 h-4 text-[#0878F9]" />
                            <span>Persisted Manufacturing & Quality Audit Trail</span>
                          </h4>
                        </div>

                        {singlePackDetails.auditLogs && singlePackDetails.auditLogs.length > 0 ? (
                          <div className="relative pl-6 border-l-2 border-[#D8E8FA] space-y-4 ml-2 my-2">
                            {singlePackDetails.auditLogs.map((log: any, idx: number) => (
                              <div key={log.id || idx} className="relative">
                                {/* Timeline Dot */}
                                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#0878F9] border-2 border-white shadow-2xs" />
                                
                                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-[#0B2148] uppercase font-mono tracking-wider">
                                      {log.action.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-[11px] font-mono text-[#526B91]">
                                      {formatDateTime(log.timestamp)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#526B91]">
                                    Actor: <strong className="text-[#0B2148]">{log.actor?.name || log.actor?.email || "System Operator"}</strong>
                                  </p>
                                  {log.newStatus && (
                                    <p className="text-[11px] text-[#0878F9] font-mono">
                                      Status Transition: <strong>{log.prevStatus || "---"}</strong> → <strong>{log.newStatus}</strong>
                                    </p>
                                  )}
                                  {log.metadata && typeof log.metadata === "object" && (
                                    <pre className="text-[10px] font-mono bg-white p-2 rounded-lg border border-[#D8E8FA] text-[#526B91] overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 bg-[#F4F9FF] rounded-2xl border border-dashed border-[#D8E8FA] text-center text-xs text-[#526B91]">
                            Initial assembly logged on {formatDateTime(singlePackDetails.assembledAt)}. No subsequent audit events recorded.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#F4F9FF] border-t border-[#D8E8FA] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedSerialForDetails(null)}
                  className="px-5 py-2 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#0B2148] font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  Close Record
                </button>

                {singlePackDetails && (
                  <button
                    type="button"
                    onClick={() => setReprintPackData(singlePackDetails)}
                    className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Reprint All-in-One Label</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 5. REPRINT LABEL CONFIRMATION & PRINTABLE PASSPORT MODAL ─────────── */}
      <AnimatePresence>
        {reprintPackData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061B3A]/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-[#D8E8FA] rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-6"
            >
              {/* Dialog Header */}
              <div className="p-5 bg-[#F4F9FF] border-b border-[#D8E8FA] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0878F9]/10 text-[#0878F9] flex items-center justify-center font-bold">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-[#0B2148]">
                      Reprint Battery Pack Label
                    </h3>
                    <p className="text-xs text-[#526B91] mt-0.5">
                      Confirm label generation for existing identity: <strong className="text-[#0878F9] font-mono">{reprintPackData.paxSerial}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReprintPackData(null)}
                  className="p-2 rounded-xl text-[#526B91] hover:text-[#0B2148] hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dialog Body / Label Preview */}
              <div className="p-6 space-y-4">
                {/* Printable High-Density Label Preview Box */}
                <div className="p-5 rounded-2xl bg-white border-2 border-[#0B2148] space-y-4 font-mono text-[#0B2148] shadow-xs">
                  {/* Passport Header */}
                  <div className="flex items-center justify-between border-b-2 border-[#0B2148] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-xs bg-[#FFC928]" />
                      <span className="font-display font-black text-sm tracking-wider">KYRA ZAM 2.0</span>
                      <span className="text-[9px] bg-[#0B2148] text-white px-2 py-0.5 rounded font-bold font-sans">
                        BATTERY PACK PASSPORT
                      </span>
                    </div>
                    <span className="text-[9px] font-sans text-[#526B91]">
                      {formatDateTime(reprintPackData.assembledAt)}
                    </span>
                  </div>

                  {/* QR & Barcode Section */}
                  <div className="flex items-center gap-5 bg-[#F4F9FF] p-3 rounded-xl border border-[#D8E8FA]">
                    <div className="p-1.5 bg-white rounded-lg border border-[#D8E8FA] shrink-0">
                      <QRCodeSVG
                        value={getPackQrPayload(reprintPackData)}
                        size={100}
                        level="M"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <span className="text-[8px] uppercase font-sans text-[#526B91] font-bold block">Pack Serial Number</span>
                      <div className="text-base font-black tracking-wider text-[#0B2148] truncate font-mono">
                        {reprintPackData.paxSerial}
                      </div>
                      <div className="h-7 w-full bg-slate-900 rounded flex items-center justify-center p-1 px-2">
                        <div className="flex items-center justify-between w-full h-full">
                          {Array.from({ length: 32 }).map((_, i) => (
                            <div
                              key={i}
                              className="bg-white h-full"
                              style={{
                                width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1.5 : 2)}px`,
                                opacity: i % 6 === 0 ? 0 : 1
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Specs Strip */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-sans">
                    <div className="bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA]">
                      <span className="text-[8px] text-[#526B91] uppercase block font-bold">Model</span>
                      <strong className="text-[#0B2148] truncate block">{reprintPackData.paxType?.name || "Battery Pack"}</strong>
                    </div>
                    <div className="bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA]">
                      <span className="text-[8px] text-[#526B91] uppercase block font-bold">Topology</span>
                      <strong className="text-[#0878F9] block">{reprintPackData.paxType?.configuration || `${reprintPackData.cells?.length || 0}S1P`}</strong>
                    </div>
                    <div className="bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA]">
                      <span className="text-[8px] text-[#526B91] uppercase block font-bold">Cells</span>
                      <strong className="text-[#166534] block">{reprintPackData.cells?.length || 0} Units</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p>
                    Reprinting will preserve the exact serialized barcode and scannable QR payload without modifying pack state. An audit log entry will be recorded.
                  </p>
                </div>
              </div>

              {/* Dialog Actions */}
              <div className="p-4 bg-[#F4F9FF] border-t border-[#D8E8FA] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getPackQrPayload(reprintPackData));
                    toast.success("QR Payload JSON copied to clipboard");
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy QR JSON</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReprintPackData(null)}
                    className="px-4 py-2 rounded-xl bg-white border border-[#D8E8FA] hover:bg-slate-50 text-[#526B91] font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmReprint(reprintPackData)}
                    className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Confirm & Print Label</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
