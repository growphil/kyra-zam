"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  History,
  Search,
  Package,
  Calendar,
  User,
  MapPin,
  Printer,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Barcode,
  ArrowLeft,
  Building2,
  ExternalLink,
  ShieldCheck,
  QrCode,
  X
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

export default function PackingHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params?.role as string) || "packing";

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["packing-history", search, selectedStatus, page],
    queryFn: async () => {
      const res = await api.get("/packing/history", {
        params: {
          search: search || undefined,
          status: selectedStatus !== "ALL" ? selectedStatus : undefined,
          page,
          limit: 15
        }
      });
      return res.data;
    }
  });

  const records = historyData?.history || [];
  const total = historyData?.total || 0;
  const totalPages = historyData?.totalPages || 1;

  const handlePrintSticker = async (packingId: string) => {
    try {
      const res = await api.get(`/packing/${packingId}/sticker`);
      const sticker = res.data.sticker;

      const printWindow = window.open("", "_blank", "width=600,height=750");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Packing Sticker - ${sticker.paxSerial}</title>
              <style>
                @page { size: 100mm 150mm; margin: 0; }
                body { font-family: sans-serif; margin: 0; padding: 12mm; color: #000; }
                .sticker-box { border: 3px solid #000; border-radius: 8px; padding: 10px; height: calc(100% - 24px); box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
                .header { border-bottom: 2px solid #000; padding-bottom: 6px; text-align: center; }
                .brand { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
                .tagline { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #333; }
                .specs { margin-top: 8px; font-size: 11px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                .label { font-weight: bold; }
                .val { font-family: monospace; font-weight: 700; }
                .qr-area { text-align: center; margin: 8px 0; padding: 6px; border: 1px dashed #666; border-radius: 4px; }
                .qr-img { width: 140px; height: 140px; }
                .serial-hero { font-size: 16px; font-weight: 900; font-family: monospace; letter-spacing: 1px; text-align: center; margin-top: 4px; }
                .footer { border-top: 2px solid #000; padding-top: 6px; font-size: 9px; display: flex; justify-content: space-between; font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="sticker-box">
                <div class="header">
                  <div class="brand">KYRA ZAM 2.0</div>
                  <div class="tagline">CERTIFIED LITHIUM BATTERY PACK</div>
                </div>
                <div class="specs">
                  <div class="row"><span class="label">MODEL:</span><span class="val">${sticker.modelName}</span></div>
                  <div class="row"><span class="label">CONFIG:</span><span class="val">${sticker.configuration} (${sticker.nominalVoltage} ${sticker.nominalCapacity})</span></div>
                  <div class="row"><span class="label">PACKING ID:</span><span class="val">${sticker.packingNumber}</span></div>
                  <div class="row"><span class="label">DATE:</span><span class="val">${new Date(sticker.packingDate).toLocaleDateString()}</span></div>
                </div>
                <div class="qr-area">
                  <img class="qr-img" src="${sticker.qrCodeBase64}" alt="QR" />
                  <div class="serial-hero">${sticker.paxSerial}</div>
                </div>
                <div class="footer">
                  <span>QC: APPROVED</span>
                  <span>STATUS: PACKED</span>
                  <span>OP: ${sticker.operatorName}</span>
                </div>
              </div>
              <script>
                window.onload = function() { window.print(); window.close(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err: any) {
      toast.error("Failed to generate sticker for printing");
    }
  };

  return (
    <div className="space-y-4 max-w-[1750px] mx-auto text-[#0B2148] pb-12">
      {/* Header */}
      <PageHeader
        title="Packing History"
        subtitle="Complete audit ledger of packed battery units, checklist records, sticker IDs & warehouse transfers"
        icon={<History className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={
          <button
            onClick={() => router.push(`/${roleSlug}/packing`)}
            className="flex items-center gap-1.5 text-xs text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Station
          </button>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#526B91] bg-white px-3 py-1.5 rounded-xl border border-[#D8E8FA] shadow-xs">
              Total: <strong className="text-[#0B2148] font-mono">{total}</strong> units
            </span>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-[#D8E8FA] shadow-xs">
        <div className="flex flex-1 gap-3 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input
              type="text"
              placeholder="Search Packing ID, Serial, Sticker or Operator..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:border-[#0878F9]"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
          >
            <option value="ALL">All Statuses</option>
            <option value="TRANSFERRED_TO_FINISHED_GOODS">Transferred to FG</option>
            <option value="PACKED">Packed (Pending FG Transfer)</option>
            <option value="PACKING_IN_PROGRESS">In Progress</option>
          </select>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-[#526B91]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-[#D8E8FA] overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
              <p className="text-xs font-semibold text-[#526B91]">Loading history records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-16 text-center text-[#526B91] text-xs">
              No matching packing records found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                  <th className="py-3 px-4 pl-6">Packing ID</th>
                  <th className="py-3 px-4">PAX Serial</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Sticker Number</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Warehouse Bay</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E8FA] text-sm">
                {records.map((rec: any) => {
                  const isTransferred = rec.status === "TRANSFERRED_TO_FINISHED_GOODS";
                  const isPacked = rec.status === "PACKED";

                  return (
                    <tr key={rec.id} className="hover:bg-[#F4F9FF]/80 transition-colors">
                      <td className="py-3.5 px-4 pl-6 font-mono font-bold text-[#0878F9] text-xs">
                        {rec.packingNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-[#0B2148] text-xs">{rec.paxSerial}</div>
                        <div className="text-[10px] text-[#526B91]">
                          {new Date(rec.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-[#0B2148] font-semibold">
                        {rec.paxType?.name}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-[#0B2148]">
                        {rec.stickerNumber || "—"}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-[#0B2148]">
                        {rec.operator?.name || "Packing Tech"}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        {rec.destinationWarehouse ? (
                          <div className="flex items-center gap-1.5 text-[#1D4ED8]">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>
                              {rec.destinationWarehouse.code} • {rec.destinationLocation?.code || "BAY-1"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#526B91]">Pending FG</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isTransferred
                              ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                              : isPacked
                              ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                              : "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {rec.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 pr-6 text-right space-x-2">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-semibold text-xs border border-[#D8E8FA] transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                        {rec.stickerNumber && (
                          <button
                            onClick={() => handlePrintSticker(rec.id)}
                            className="p-1.5 rounded-lg bg-[#0878F9]/10 hover:bg-[#0878F9] text-[#0878F9] hover:text-white border border-[#D8E8FA] transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="Reprint Sticker"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Details Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#061B3A]/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white border border-[#D8E8FA] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B2148] font-mono">{selectedRecord.packingNumber}</h3>
                    <p className="text-xs text-[#526B91]">Pax Serial: {selectedRecord.paxSerial}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 rounded-xl hover:bg-[#EAF5FF] text-[#526B91]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[#526B91] block">Model</span>
                  <span className="font-bold text-[#0B2148]">{selectedRecord.paxType?.name}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[#526B91] block">Sticker Number</span>
                  <span className="font-mono font-bold text-accent">{selectedRecord.stickerNumber || "N/A"}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[#526B91] block">Operator</span>
                  <span className="font-semibold text-[#0B2148]">{selectedRecord.operator?.name}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[#526B91] block">Packing Date</span>
                  <span className="text-[#0B2148]">{new Date(selectedRecord.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Checklist Items list */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#0B2148]">Checklist Summary:</div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {selectedRecord.checklistItems?.map((it: any) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                        <span className="text-[#0B2148]">{it.itemName}</span>
                      </div>
                      <span className="text-[10px] text-[#526B91]">Qty: {it.quantity} • {it.condition}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8E8FA]">
                {selectedRecord.stickerNumber && (
                  <button
                    onClick={() => handlePrintSticker(selectedRecord.id)}
                    className="px-5 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0878F9]/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#0878F9]/20"
                  >
                    <Printer className="w-4 h-4" />
                    Print Sticker
                  </button>
                )}
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#F4F9FF] text-[#0B2148] text-xs font-semibold hover:bg-[#EAF5FF] border border-[#D8E8FA]"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
