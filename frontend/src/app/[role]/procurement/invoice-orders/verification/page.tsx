"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { toast } from "sonner";
import {
  ShieldCheck,
  Clock,
  ArrowRight,
  Package,
  Building2,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Search,
  Filter,
  RefreshCw,
  Boxes,
  X,
  XCircle,
  FileText,
  Paperclip,
  ExternalLink,
  AlertTriangle,
  Check,
  Warehouse,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

interface VerificationLineState {
  itemId: string;
  actualReceivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  warehouseId: string;
  warehouseLocationId: string;
  batchNumber: string;
  serialNumber: string;
  inspectionNotes: string;
}

export default function InventoryVerificationQueuePage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params.role as string) || "inventory-manager";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedIO, setSelectedIO] = useState<any | null>(null);
  const [verificationInputs, setVerificationInputs] = useState<Record<string, VerificationLineState>>({});
  const [expandedDetailsLine, setExpandedDetailsLine] = useState<string | null>(null);
  const [verificationRemarks, setVerificationRemarks] = useState("");
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [correctionRemarks, setCorrectionRemarks] = useState("");

  // 1. Fetch Warehouses for inward storage allocation
  const { data: warehouses } = useQuery({
    queryKey: ["inventory-warehouses-dropdown"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data || [],
  });

  // 2. Fetch Pending Inventory Queue
  const { data: queueData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["procurement-io-pending-inventory"],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/invoice-orders/pending-inventory");
      return res.data?.items || [];
    },
  });

  const filteredItems = (queueData || []).filter((io: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      io.ioNumber?.toLowerCase().includes(q) ||
      io.supplierInvoiceNumber?.toLowerCase().includes(q) ||
      io.purchaseOrder?.poNumber?.toLowerCase().includes(q) ||
      io.vendor?.name?.toLowerCase().includes(q) ||
      io.createdBy?.name?.toLowerCase().includes(q)
    );
  });

  // Open the Physical Verification Workbench for an Invoice Order
  const handleOpenVerification = (io: any) => {
    setSelectedIO(io);
    const initialMap: Record<string, VerificationLineState> = {};
    const defaultWarehouseId = warehouses?.[0]?.id || "";

    (io.items || []).forEach((line: any) => {
      const existingRecv = line.actualReceivedQuantity ?? 0;
      initialMap[line.id] = {
        itemId: line.id,
        actualReceivedQuantity: existingRecv,
        acceptedQuantity: line.acceptedQuantity ?? existingRecv,
        rejectedQuantity: line.rejectedQuantity ?? 0,
        damagedQuantity: line.damagedQuantity ?? 0,
        warehouseId: line.warehouseId || defaultWarehouseId,
        warehouseLocationId: line.warehouseLocationId || "",
        batchNumber: line.batchNumber || "",
        serialNumber: line.serialNumber || "",
        inspectionNotes: line.inspectionNotes || "",
      };
    });

    setVerificationInputs(initialMap);
    setVerificationRemarks("");
    setCorrectionRemarks("");
    setIsCorrectionOpen(false);
    setExpandedDetailsLine(null);
  };

  // Update physical received quantity
  const handleQtyChange = (itemId: string, enteredQty: number) => {
    setVerificationInputs((prev) => {
      const curr = prev[itemId] || {
        itemId,
        actualReceivedQuantity: 0,
        acceptedQuantity: 0,
        rejectedQuantity: 0,
        damagedQuantity: 0,
        warehouseId: warehouses?.[0]?.id || "",
        warehouseLocationId: "",
        batchNumber: "",
        serialNumber: "",
        inspectionNotes: "",
      };

      const prevDamaged = curr.damagedQuantity || 0;
      const prevRejected = curr.rejectedQuantity || 0;
      const newAccepted = Math.max(0, enteredQty - prevDamaged - prevRejected);

      return {
        ...prev,
        [itemId]: {
          ...curr,
          actualReceivedQuantity: enteredQty,
          acceptedQuantity: newAccepted,
        },
      };
    });
  };

  // Update line field
  const handleFieldChange = (itemId: string, field: keyof VerificationLineState, value: any) => {
    setVerificationInputs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  // Live match statistics for selected order
  const matchStats = useMemo(() => {
    if (!selectedIO?.items) {
      return { allMatched: false, matchedCount: 0, mismatchCount: 0, totalItems: 0, lineStates: [] };
    }

    const lineStates = selectedIO.items.map((line: any) => {
      const state = verificationInputs[line.id];
      const entered = Number(state?.actualReceivedQuantity || 0);
      const expected = Number(line.invoiceQuantity);
      const hasCount = entered > 0;
      const isMatch = hasCount && entered === expected;
      const isMismatch = hasCount && entered !== expected;

      return {
        lineId: line.id,
        entered,
        expected,
        hasCount,
        isMatch,
        isMismatch,
      };
    });

    const totalItems = lineStates.length;
    const matchedCount = lineStates.filter((s: any) => s.isMatch).length;
    const mismatchCount = lineStates.filter((s: any) => s.isMismatch || !s.hasCount).length;
    const allMatched = totalItems > 0 && lineStates.every((s: any) => s.isMatch);

    return { allMatched, matchedCount, mismatchCount, totalItems, lineStates };
  }, [selectedIO, verificationInputs]);

  // Submit Physical Inward Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ isDraft }: { isDraft: boolean }) => {
      if (!selectedIO) throw new Error("No invoice order selected");
      const itemsPayload = Object.values(verificationInputs);
      if (itemsPayload.length === 0) throw new Error("No items to verify");

      if (!isDraft) {
        // Enforce that all items match expected invoice quantity
        for (const item of selectedIO.items) {
          const inp = verificationInputs[item.id];
          const entered = Number(inp?.actualReceivedQuantity || 0);
          const expected = Number(item.invoiceQuantity);
          if (entered !== expected) {
            throw new Error(
              `Physical count does not match the invoice on item "${item.description || item.product?.name}". Inward verification blocked.`
            );
          }
        }
      }

      const res = await api.post(`/crm/procurement/invoice-orders/${selectedIO.id}/verify`, {
        isDraft,
        remarks: verificationRemarks.trim() || undefined,
        items: itemsPayload,
      });
      return res.data;
    },
    onSuccess: (_, { isDraft }) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-pending-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success(
        isDraft
          ? "Physical gate count saved as draft"
          : "Inward verification complete! All product quantities matched and handed over for Admin authorization."
      );
      setSelectedIO(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Failed to submit verification");
    },
  });

  // Request Correction Mutation
  const requestCorrectionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIO) throw new Error("No invoice order selected");
      if (!correctionRemarks.trim()) throw new Error("Please specify the discrepancy for Admin correction.");

      const itemsPayload = Object.values(verificationInputs);
      const res = await api.post(`/crm/procurement/invoice-orders/${selectedIO.id}/verify`, {
        requestCorrection: true,
        correctionRemarks: correctionRemarks.trim(),
        items: itemsPayload.length > 0 ? itemsPayload : selectedIO.items.map((i: any) => ({
          itemId: i.id,
          actualReceivedQuantity: 0,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          damagedQuantity: 0,
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-io-pending-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-io-list"] });
      toast.success("Correction requested from Admin. Invoice order returned for adjustment.");
      setSelectedIO(null);
      setIsCorrectionOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.message || "Failed to request correction");
    },
  });

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto pb-12">
      <PageHeader
        title="Pending Goods Receiving & Inward Verification"
        description="Gate Inward Station: Check arrived physical goods against the Admin's uploaded Supplier Tax Invoice, enter gate counts, and verify inward stock"
        icon={<ShieldCheck className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Procurement", href: `/${roleSlug}/procurement/purchase-orders` },
          { label: "Invoice Orders", href: `/${roleSlug}/procurement/invoice-orders` },
          { label: "Inward Verification" },
        ]}
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#526B91] rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#0878F9]" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        }
      />

      {/* Overview Notice */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-950 flex items-start justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <Boxes className="w-5 h-5 text-[#0878F9] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-[#0B2148] text-sm">Warehouse Physical Inward Verification Station</h4>
            <p className="text-[#526B91] leading-relaxed">
              Verify incoming shipments against the registered Supplier Tax Invoice and Purchase Order. Enter the physical gate count manually.
              <strong className="text-[#0B2148]"> The entered quantity must match the Admin's invoice quantity on all items to complete inward verification.</strong>
            </p>
          </div>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Awaiting Verification</span>
          <p className="text-xl font-bold font-mono text-[#0878F9]">{filteredItems.length} Invoices</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#D8E8FA] shadow-2xs">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Invoice #, Supplier Invoice #, PO #, Vendor, or Requester..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
          />
        </div>
        <div className="text-xs text-[#526B91] font-medium">
          Showing <strong className="text-[#0B2148]">{filteredItems.length}</strong> pending delivery shipments
        </div>
      </div>

      {/* Goods Receiving Queue Table */}
      <div className="rounded-2xl border border-[#D8E8FA] bg-white overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            <span className="text-xs text-[#526B91]">Loading pending goods receiving queue...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div className="text-sm font-bold text-[#0B2148]">Goods Receiving Queue is Clear</div>
            <p className="text-xs text-[#526B91] max-w-md mx-auto">
              All registered commercial invoices have undergone physical gate inward inspection. Check back when Admin registers newly arrived supplier invoices.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] bg-[#F8FAFC] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Invoice Number</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Invoice Date</th>
                  <th className="py-3.5 px-4">Invoice Document</th>
                  <th className="py-3.5 px-4">Total Products</th>
                  <th className="py-3.5 px-4 text-center">Inward Match Status</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Registered By</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {filteredItems.map((io: any) => {
                  const totalProducts = io._count?.items ?? io.items?.length ?? 0;

                  return (
                    <tr
                      key={io.id}
                      onClick={() => handleOpenVerification(io)}
                      className="hover:bg-[#F4F9FF]/70 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-[#0878F9]">{io.supplierInvoiceNumber || io.ioNumber}</div>
                        <div className="text-[10px] text-[#526B91] font-normal">{io.ioNumber}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0B2148]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#526B91] shrink-0" />
                          <span>{io.vendor?.name || "Vendor"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                        {io.purchaseOrder?.poNumber || "Direct (No PO)"}
                      </td>
                      <td className="py-3.5 px-4 text-[#526B91]">
                        {new Date(io.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        {io.documents && io.documents.length > 0 ? (
                          <a
                            href={getMediaUrl(io.documents[0].fileReference)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0878F9] hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#0878F9]" />
                            <span className="truncate max-w-[130px]">{io.documents[0].fileName}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-[#526B91]" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No file</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {totalProducts} products
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {(() => {
                          const items = io.items || [];
                          const allMatch = items.length > 0 && items.every((it: any) => it.actualReceivedQuantity > 0 && it.actualReceivedQuantity === it.invoiceQuantity);
                          const hasMismatch = items.some((it: any) => it.actualReceivedQuantity > 0 && it.actualReceivedQuantity !== it.invoiceQuantity);

                          if (allMatch) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Matched</span>
                              </span>
                            );
                          }
                          if (hasMismatch) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Not Matched</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Awaiting Count</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-full border flex items-center gap-1 w-fit ${
                            io.status === "CORRECTION_REQUIRED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {io.status === "CORRECTION_REQUIRED" ? "CORRECTION REQ" : "PENDING INWARD"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#526B91]">
                        {io.createdBy?.name || "Admin"}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenVerification(io)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0878F9] hover:bg-[#0766D0] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Check & Verify Qty</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── PHYSICAL INWARD VERIFICATION WORKBENCH MODAL ────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {selectedIO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-[#D8E8FA] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#D8E8FA] bg-gradient-to-r from-[#F8FAFC] to-[#F4F9FF] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#0878F9]/10 border border-[#0878F9]/20 text-[#0878F9]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#0B2148]">
                      Verify Physical Inward — {selectedIO.supplierInvoiceNumber || selectedIO.ioNumber}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {selectedIO.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    Vendor: <strong className="text-[#0B2148]">{selectedIO.vendor?.name}</strong> | PO:{" "}
                    <span className="font-mono">{selectedIO.purchaseOrder?.poNumber || "Direct (No PO)"}</span> | Internal Ref:{" "}
                    <span className="font-mono">{selectedIO.ioNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIO(null)}
                className="p-2 hover:bg-slate-200/60 text-slate-500 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* 1. Admin Uploaded Supplier Tax Invoice & Proofs */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#D8E8FA] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[#0B2148] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0878F9]" />
                    <span>Admin Uploaded Supplier Invoice Document</span>
                  </div>
                  <span className="text-[11px] text-[#526B91]">
                    Registered on: <strong>{new Date(selectedIO.invoiceDate).toLocaleDateString()}</strong> by{" "}
                    <strong>{selectedIO.createdBy?.name || "Admin"}</strong>
                  </span>
                </div>

                {selectedIO.documents && selectedIO.documents.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {selectedIO.documents.map((doc: any, dIdx: number) => (
                      <a
                        key={doc.id || dIdx}
                        href={getMediaUrl(doc.fileReference)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#D8E8FA] hover:border-[#0878F9] text-[#0878F9] hover:bg-[#F4F9FF] rounded-xl font-semibold shadow-2xs transition-all group"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-[#526B91] group-hover:text-[#0878F9]" />
                        <span className="truncate max-w-[220px]">{doc.fileName}</span>
                        <ExternalLink className="w-3 h-3 text-[#526B91]" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic bg-white p-2.5 rounded-xl border border-dashed border-slate-200">
                    No supplier invoice files were attached by Admin for this invoice order.
                  </div>
                )}
              </div>

              {/* 2. Blind Physical Receiving Notice */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#0878F9] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Blind Physical Receiving Mode:</strong> Commercial values and prices are hidden. 
                  Inspect the physically delivered packages and enter the gate count for each product line. 
                  <strong> If the entered physical quantity does not match the Admin invoice quantity, inward verification is blocked.</strong>
                </div>
              </div>

              {/* 3. Products Verification Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#0B2148] flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#0878F9]" />
                    <span>Product Lines Verification ({selectedIO.items?.length || 0})</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#526B91]">
                      Matched: <strong className="text-emerald-700 font-mono">{matchStats.matchedCount}</strong> /{" "}
                      <span className="font-mono">{matchStats.totalItems}</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#D8E8FA] overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#D8E8FA] bg-[#F8FAFC] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-3.5">Product / Identity / Brand</th>
                        <th className="py-3 px-3">Part # & UIN</th>
                        <th className="py-3 px-3.5 min-w-[170px]">Enter Physical Count *</th>
                        <th className="py-3 px-3 text-center">Match Status</th>
                        <th className="py-3 px-3 min-w-[160px]">Target Warehouse</th>
                        <th className="py-3 px-2 text-center">QC Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8F1FC]">
                      {(selectedIO.items || []).map((line: any, idx: number) => {
                        const inputState = verificationInputs[line.id] || {
                          actualReceivedQuantity: 0,
                          acceptedQuantity: 0,
                          rejectedQuantity: 0,
                          damagedQuantity: 0,
                          warehouseId: warehouses?.[0]?.id || "",
                          warehouseLocationId: "",
                          batchNumber: "",
                          serialNumber: "",
                          inspectionNotes: "",
                        };

                        const entered = Number(inputState.actualReceivedQuantity || 0);
                        const expected = Number(line.invoiceQuantity);
                        const hasCount = entered > 0;
                        const isMatch = hasCount && entered === expected;
                        const isMismatch = hasCount && entered !== expected;
                        const isExpanded = expandedDetailsLine === line.id;

                        const prodName = line.product?.name || line.description || "Product Component";
                        const brand = line.product?.brand || line.brand || "OEM";
                        const category = line.product?.category || line.material?.category || "RAW_MATERIAL";
                        const partNumber = line.product?.partNumber || line.material?.partNumber || line.material?.sku || "N/A";
                        const uin = line.product?.uin || line.productUin || "N/A";
                        const unit = line.unit || "PCS";

                        // Current warehouse locations
                        const currentWh = (warehouses || []).find((w: any) => w.id === inputState.warehouseId);
                        const locations = currentWh?.locations || [];

                        return (
                          <tr
                            key={line.id}
                            className={`transition-colors ${
                              isMatch
                                ? "bg-emerald-50/20 hover:bg-emerald-50/30"
                                : isMismatch
                                ? "bg-rose-50/30 hover:bg-rose-50/40"
                                : "hover:bg-[#F4F9FF]/50"
                            }`}
                          >
                            {/* Product & Brand */}
                            <td className="py-3.5 px-3.5">
                              <div className="font-bold text-[#0B2148]">{prodName}</div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA]">
                                  {brand}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                  {category}
                                </span>
                              </div>
                            </td>

                            {/* Part Number & UIN */}
                            <td className="py-3.5 px-3 font-mono text-[11px]">
                              <div className="font-bold text-[#0B2148]">{partNumber}</div>
                              <div className="text-[10px] text-[#526B91] truncate max-w-[160px]" title={uin}>
                                {uin}
                              </div>
                            </td>

                            {/* Manual Enter Qty Input (Blind Receiving) */}
                            <td className="py-3.5 px-3.5">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder={`Count (${unit})...`}
                                  value={inputState.actualReceivedQuantity === 0 ? "" : inputState.actualReceivedQuantity}
                                  onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value) || 0)}
                                  className={`w-full py-1.5 px-3 text-sm font-bold font-mono rounded-xl border transition-all focus:outline-none ${
                                    isMatch
                                      ? "border-emerald-500 bg-emerald-50/40 text-emerald-900 focus:ring-2 focus:ring-emerald-400/30"
                                      : isMismatch
                                      ? "border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-400/30"
                                      : "border-[#D8E8FA] bg-white text-[#0B2148] focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/20"
                                  }`}
                                />
                              </div>
                            </td>

                            {/* Live Match Status */}
                            <td className="py-3.5 px-3 text-center">
                              {isMatch ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                  <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>Matched</span>
                                </span>
                              ) : isMismatch ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                  <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                                  <span>Not Matched</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>Awaiting Count</span>
                                </span>
                              )}
                            </td>

                            {/* Storage Warehouse & Bin */}
                            <td className="py-3.5 px-3">
                              <select
                                value={inputState.warehouseId}
                                onChange={(e) => handleFieldChange(line.id, "warehouseId", e.target.value)}
                                className="w-full py-1.5 px-2 bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-xs font-medium text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                              >
                                {(warehouses || []).map((w: any) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                              {locations.length > 0 && (
                                <select
                                  value={inputState.warehouseLocationId}
                                  onChange={(e) => handleFieldChange(line.id, "warehouseLocationId", e.target.value)}
                                  className="w-full mt-1 py-1 px-2 bg-[#F8FAFC] border border-[#D8E8FA] rounded-lg text-[10px] text-[#526B91]"
                                >
                                  <option value="">Default Location</option>
                                  {locations.map((loc: any) => (
                                    <option key={loc.id} value={loc.id}>
                                      {loc.name || loc.code}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>

                            {/* QC Breakdown Trigger */}
                            <td className="py-3.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedDetailsLine(isExpanded ? null : line.id)}
                                className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                                  isExpanded
                                    ? "bg-[#0878F9] text-white border-[#0878F9]"
                                    : "bg-white hover:bg-slate-50 border-[#D8E8FA] text-[#526B91]"
                                }`}
                                title="Add Batch #, Serial #, or Damage Breakdown"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Expanded Details Sub-Panel */}
                {expandedDetailsLine && (() => {
                  const targetLine = selectedIO.items?.find((i: any) => i.id === expandedDetailsLine);
                  const inp = verificationInputs[expandedDetailsLine];
                  if (!targetLine || !inp) return null;

                  return (
                    <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#D8E8FA] space-y-3 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-2">
                        <span className="font-bold text-xs text-[#0B2148]">
                          Detailed QC & Batch Breakdown for: {targetLine.product?.name || targetLine.description}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedDetailsLine(null)}
                          className="text-[11px] text-[#526B91] hover:text-[#0B2148] font-bold cursor-pointer"
                        >
                          ✕ Close QC Breakdown
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-emerald-700 block mb-1">Accepted Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={inp.acceptedQuantity}
                            onChange={(e) => handleFieldChange(expandedDetailsLine, "acceptedQuantity", parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-white border border-[#D8E8FA] rounded-xl font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-amber-700 block mb-1">Damaged Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={inp.damagedQuantity}
                            onChange={(e) => handleFieldChange(expandedDetailsLine, "damagedQuantity", parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-white border border-[#D8E8FA] rounded-xl font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-rose-700 block mb-1">Rejected Qty</label>
                          <input
                            type="number"
                            min="0"
                            value={inp.rejectedQuantity}
                            onChange={(e) => handleFieldChange(expandedDetailsLine, "rejectedQuantity", parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-white border border-[#D8E8FA] rounded-xl font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#526B91] block mb-1">Batch Number</label>
                          <input
                            type="text"
                            placeholder="e.g. BATCH-2026-X"
                            value={inp.batchNumber}
                            onChange={(e) => handleFieldChange(expandedDetailsLine, "batchNumber", e.target.value)}
                            className="w-full p-2 bg-white border border-[#D8E8FA] rounded-xl font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#526B91] block mb-1">Inspection Notes</label>
                        <input
                          type="text"
                          placeholder="Condition of packaging, courier observations, seal integrity..."
                          value={inp.inspectionNotes}
                          onChange={(e) => handleFieldChange(expandedDetailsLine, "inspectionNotes", e.target.value)}
                          className="w-full p-2 bg-white border border-[#D8E8FA] rounded-xl"
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 4. Match Validation Status Banner */}
              <div>
                {matchStats.allMatched ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-start gap-3 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs text-emerald-900">
                        All Products Matched!
                      </h4>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Physical gate counts match the invoice on all products. You can now complete the inward verification.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 flex items-start gap-3 shadow-2xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs text-rose-900">
                        Count Not Matched — Inward Verification Blocked
                      </h4>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        The entered physical gate count does not match the invoice. All product counts must match to verify inward. 
                        If the supplier delivered different quantities, recount or click "Request Correction from Admin" below.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* General Inward Inspection Notes */}
              <div>
                <label className="text-[11px] font-bold text-[#526B91] block mb-1">
                  General Inward Receiving Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={verificationRemarks}
                  onChange={(e) => setVerificationRemarks(e.target.value)}
                  placeholder="Notes on packaging, delivery driver, physical tags, or container seals..."
                  className="w-full p-2.5 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                />
              </div>

              {/* Request Correction Section */}
              {isCorrectionOpen && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Request Correction from Admin</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCorrectionOpen(false)}
                      className="text-xs text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    If the physical goods delivered do not match the Admin's invoice (e.g. shortage from vendor, damaged cartons, wrong part numbers), enter the explanation below. The invoice will be returned to Admin for adjustment.
                  </p>
                  <textarea
                    rows={3}
                    value={correctionRemarks}
                    onChange={(e) => setCorrectionRemarks(e.target.value)}
                    placeholder="Describe discrepancy (e.g. 'Vendor delivered 40 units of BMS-001 instead of 50 invoiced')..."
                    className="w-full p-2.5 text-xs bg-white border border-amber-300 rounded-xl text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={requestCorrectionMutation.isPending || !correctionRemarks.trim()}
                      onClick={() => requestCorrectionMutation.mutate()}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {requestCorrectionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Send Correction Request to Admin</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="p-4 border-t border-[#D8E8FA] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {!isCorrectionOpen && (
                  <button
                    type="button"
                    onClick={() => setIsCorrectionOpen(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer"
                  >
                    Request Correction from Admin
                  </button>
                )}
                <button
                  type="button"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate({ isDraft: true })}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0B2148] bg-white hover:bg-slate-50 border border-[#D8E8FA] rounded-xl transition-all cursor-pointer"
                >
                  Save Draft Count
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedIO(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!matchStats.allMatched || verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate({ isDraft: false })}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    matchStats.allMatched && !verifyMutation.isPending
                      ? "bg-[#0878F9] hover:bg-[#0667DB] text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60"
                  }`}
                  title={
                    matchStats.allMatched
                      ? "Complete Inward Verification"
                      : "Cannot verify: Entered physical quantity must match Admin invoice quantity on all items"
                  }
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {matchStats.allMatched
                      ? "Verify Inward Stock (All Matched)"
                      : "Verify Blocked (Not Matched)"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
