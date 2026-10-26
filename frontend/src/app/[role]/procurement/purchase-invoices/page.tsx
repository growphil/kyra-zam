"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Receipt,
  Search,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

const INVOICEABLE_STATUSES = ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED"];

type InvoiceLine = {
  key: string;
  productId?: string | null;
  materialId?: string | null;
  description: string;
  partNumber?: string | null;
  brand?: string | null;
  productUin?: string | null;
  ordered: number;
  billed: number;
  remaining: number;
  include: boolean;
  quantityBilled: number;
  unitPrice: number;
  taxRate: number;
};

const lineKeyOf = (it: { productId?: string | null; materialId?: string | null }) =>
  it.productId ? `P:${it.productId}` : it.materialId ? `M:${it.materialId}` : null;

const money = (n: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PurchaseInvoicesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const poId = searchParams.get("poId") || "";

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  // ---------------- DATA ----------------
  const {
    data: po,
    isLoading: isPOLoading,
    isError: isPOError
  } = useQuery({
    queryKey: ["supplier-invoice-po", poId],
    queryFn: async () => (await api.get(`/crm/procurement/purchase-orders/${poId}`)).data,
    enabled: !!poId,
    retry: false
  });

  const { data: invoices = [], isLoading: isInvoicesLoading } = useQuery({
    queryKey: ["procurement-supplier-invoices", poId],
    queryFn: async () =>
      (await api.get("/crm/procurement/supplier-invoices", {
        params: poId ? { purchaseOrderId: poId } : {}
      })).data || []
  });

  // Ordered vs already-billed per PO line (product-brand identity or material)
  const poLines: InvoiceLine[] = useMemo(() => {
    if (!po?.items) return [];
    const billed = new Map<string, number>();
    for (const inv of po.supplierInvoices || []) {
      if (inv.status === "CANCELLED") continue;
      for (const it of inv.items || []) {
        const k = lineKeyOf(it);
        if (k) billed.set(k, (billed.get(k) || 0) + Number(it.quantityBilled || 0));
      }
    }
    const grouped = new Map<string, InvoiceLine>();
    for (const it of po.items) {
      const k = lineKeyOf(it);
      if (!k) continue;
      const existing = grouped.get(k);
      if (existing) {
        existing.ordered += Number(it.quantityOrdered || 0);
        continue;
      }
      grouped.set(k, {
        key: k,
        productId: it.productId,
        materialId: it.materialId,
        description: it.description || it.product?.name || it.material?.name || "Item",
        partNumber: it.partNumber || it.product?.partNumber || it.material?.sku,
        brand: it.brand || it.product?.brand,
        productUin: it.productUin || it.product?.uin,
        ordered: Number(it.quantityOrdered || 0),
        billed: 0,
        remaining: 0,
        include: true,
        quantityBilled: 0,
        unitPrice: Number(it.unitPrice || 0),
        taxRate: Number(it.taxRate || 0)
      });
    }
    return Array.from(grouped.values()).map((l) => {
      const b = billed.get(l.key) || 0;
      const remaining = Math.max(0, l.ordered - b);
      return { ...l, billed: b, remaining, quantityBilled: remaining, include: remaining > 0 };
    });
  }, [po]);

  const fullyBilled = poLines.length > 0 && poLines.every((l) => l.remaining === 0);
  const canInvoice = !!po && INVOICEABLE_STATUSES.includes(po.status) && !fullyBilled;

  const openCreate = () => {
    if (!po) {
      toast.info("Open a Purchase Order and choose “Record Supplier Invoice” to bill against it.");
      return;
    }
    setLines(poLines.map((l) => ({ ...l })));
    setInvoiceNumber("");
    setInvoiceDate(todayISO());
    setDueDate("");
    setNotes("");
    setIsCreateOpen(true);
  };

  // Auto-open the drawer once when arriving from a PO with billable quantity
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (po && !autoOpened && canInvoice) {
      setAutoOpened(true);
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po, canInvoice]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      if (!l.include) continue;
      const sub = l.quantityBilled * l.unitPrice;
      subtotal += sub;
      tax += (sub * l.taxRate) / 100;
    }
    return { subtotal, tax, grand: subtotal + tax };
  }, [lines]);

  // ---------------- MUTATION ----------------
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/crm/procurement/supplier-invoices", payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["procurement-supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-invoice-po", poId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-po-details", poId] });
      toast.success(`Supplier invoice ${res.data?.invoiceNumber || ""} recorded`);
      setIsCreateOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to record supplier invoice");
    }
  });

  const updateLine = (key: string, patch: Partial<InvoiceLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    if (!invoiceNumber.trim()) return toast.error("Supplier invoice number is required.");
    if (!invoiceDate) return toast.error("Invoice date is required.");
    if (dueDate && dueDate < invoiceDate) return toast.error("Due date cannot be before the invoice date.");

    const selected = lines.filter((l) => l.include && l.quantityBilled > 0);
    if (selected.length === 0) return toast.error("Select at least one line with a billed quantity.");
    const over = selected.find((l) => l.quantityBilled > l.remaining);
    if (over) return toast.error(`"${over.description}" exceeds the remaining quantity (${over.remaining}).`);

    createMutation.mutate({
      invoiceNumber: invoiceNumber.trim(),
      purchaseOrderId: po.id,
      vendorId: po.vendorId,
      invoiceDate,
      dueDate: dueDate || null,
      notes: notes.trim() || null,
      items: selected.map((l) => ({
        productId: l.productId || null,
        materialId: l.materialId || null,
        description: l.description,
        quantityBilled: l.quantityBilled,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate
      }))
    });
  };

  const filteredInvoices = (Array.isArray(invoices) ? invoices : []).filter((inv: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.vendor?.name?.toLowerCase().includes(q) ||
      inv.purchaseOrder?.poNumber?.toLowerCase().includes(q)
    );
  });

  const currency = po?.currency || "INR";

  // ---------------- RENDER ----------------
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      <PageHeader
        title="Supplier Invoices"
        subtitle={po ? `Billing against ${po.poNumber} • ${po.vendor?.name || ""}` : `${filteredInvoices.length} recorded supplier invoices`}
        icon={<Receipt className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            {poId && (
              <button
                onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders/${poId}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D8E8FA] hover:border-[#0878F9] text-[#0B2148] font-bold text-xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to PO
              </button>
            )}
            <button
              id="record-supplier-invoice-btn"
              onClick={openCreate}
              disabled={!!poId && !canInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Record Supplier Invoice
            </button>
          </div>
        }
      />

      {/* PO context card */}
      {poId && (
        <div className="flex-none bg-white border border-[#D8E8FA] rounded-xl p-4 shadow-2xs">
          {isPOLoading ? (
            <div className="flex items-center gap-2 text-xs text-[#526B91]">
              <Loader2 className="w-4 h-4 animate-spin text-[#0878F9]" /> Loading purchase order…
            </div>
          ) : isPOError || !po ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4" /> Purchase Order not found or you do not have access to it.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <span className="font-mono font-bold text-[#0878F9] bg-[#EAF5FF] border border-blue-200 px-2 py-0.5 rounded">
                  {po.poNumber}
                </span>
                <span className="flex items-center gap-1.5 text-[#0B2148] font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-[#526B91]" /> {po.vendor?.name}
                </span>
                <span className="flex items-center gap-1.5 text-[#526B91]">
                  <CalendarDays className="w-3.5 h-3.5" /> {new Date(po.orderDate).toLocaleDateString()}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                  {po.status}
                </span>
                <span className="text-[#526B91]">
                  PO Total: <strong className="text-[#0B2148]">{money(Number(po.grandTotal || 0), currency)}</strong>
                </span>
                {fullyBilled && (
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fully billed
                  </span>
                )}
                {!INVOICEABLE_STATUSES.includes(po.status) && (
                  <span className="flex items-center gap-1 text-amber-700 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" /> Invoices can be recorded once the PO is approved
                  </span>
                )}
              </div>

              {/* Billing progress per line */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#526B91] border-b border-[#E8F1FC]">
                      <th className="py-1.5 pr-3">Item</th>
                      <th className="py-1.5 pr-3">Part No.</th>
                      <th className="py-1.5 pr-3">Brand</th>
                      <th className="py-1.5 pr-3 text-right">Ordered</th>
                      <th className="py-1.5 pr-3 text-right">Billed</th>
                      <th className="py-1.5 pr-3 text-right">Remaining</th>
                      <th className="py-1.5 w-40">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F6FD]">
                    {poLines.map((l) => {
                      const pct = l.ordered ? Math.min(100, (l.billed / l.ordered) * 100) : 0;
                      return (
                        <tr key={l.key}>
                          <td className="py-1.5 pr-3 font-semibold text-[#0B2148]">{l.description}</td>
                          <td className="py-1.5 pr-3 font-mono text-[#0878F9]">{l.partNumber || "—"}</td>
                          <td className="py-1.5 pr-3">{l.brand || "—"}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{l.ordered}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{l.billed}</td>
                          <td className="py-1.5 pr-3 text-right font-mono font-bold">{l.remaining}</td>
                          <td className="py-1.5">
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-[#0878F9]"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {poLines.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-3 text-center text-[#526B91]">
                          This PO has no product or material lines that can be billed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex-none flex gap-4 items-center bg-white border border-[#D8E8FA] p-3.5 rounded-xl shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input
            id="supplier-invoice-search"
            type="text"
            placeholder="Search by invoice number, supplier or PO number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg pl-10 pr-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
          />
        </div>
      </div>

      {/* Invoice list */}
      <div className="flex-1 bg-white rounded-xl border border-[#D8E8FA] overflow-hidden flex flex-col shadow-2xs">
        <div className="flex-1 overflow-y-auto">
          {isInvoicesLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            </div>
          ) : filteredInvoices.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">Invoice No.</th>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Lines</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-[#F4F9FF]/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders/${inv.purchaseOrderId}`)}
                        className="font-mono text-[#0878F9] hover:underline cursor-pointer"
                      >
                        {inv.purchaseOrder?.poNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold">{inv.vendor?.name}</td>
                    <td className="px-4 py-3 text-[#526B91]">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[#526B91]">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{inv.items?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {money(Number(inv.grandTotal || 0), inv.currency || "INR")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center border ${
                          inv.status === "PAID"
                            ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                            : inv.status === "CANCELLED"
                            ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                            : inv.status === "VERIFIED"
                            ? "bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]"
                            : "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-16 text-[#526B91]">
              <FileText className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-semibold text-[#0B2148]">No Supplier Invoices Yet</p>
              <p className="text-xs mt-1">
                {poId ? "Record the supplier's bill against this purchase order." : "Open a purchase order to record its supplier invoice."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create drawer */}
      <AnimatePresence>
        {isCreateOpen && po && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#061B3A]/40 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setIsCreateOpen(false)} />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-5xl bg-white border-l border-[#D8E8FA] h-full flex flex-col shadow-2xl z-10"
            >
              <div className="flex justify-between items-center p-6 pb-4 border-b border-[#D8E8FA]">
                <div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Record Supplier Invoice</h2>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    {po.poNumber} • {po.vendor?.name} • Only remaining (unbilled) quantities can be billed.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">
                        Supplier Invoice No. <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="supplier-invoice-number"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV/2026/0451"
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">
                        Invoice Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="supplier-invoice-date"
                        type="date"
                        required
                        value={invoiceDate}
                        max={todayISO()}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Due Date</label>
                      <input
                        id="supplier-invoice-due-date"
                        type="date"
                        value={dueDate}
                        min={invoiceDate || undefined}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider pb-1.5 border-b border-[#D8E8FA]">
                      Billed Lines
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-[#526B91] bg-[#F4F9FF]">
                            <th className="p-2 w-8"></th>
                            <th className="p-2">Item / Part No. / Brand</th>
                            <th className="p-2 text-right">Remaining</th>
                            <th className="p-2 w-24">Qty Billed</th>
                            <th className="p-2 w-28">Unit Price</th>
                            <th className="p-2 w-20">Tax %</th>
                            <th className="p-2 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8F1FC]">
                          {lines.map((l) => {
                            const disabled = l.remaining === 0;
                            const sub = l.quantityBilled * l.unitPrice;
                            const lineTotal = sub + (sub * l.taxRate) / 100;
                            const overQty = l.quantityBilled > l.remaining;
                            return (
                              <tr key={l.key} className={disabled ? "opacity-50" : ""}>
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={l.include && !disabled}
                                    onChange={(e) => updateLine(l.key, { include: e.target.checked })}
                                    className="accent-[#0878F9] cursor-pointer"
                                  />
                                </td>
                                <td className="p-2">
                                  <p className="font-semibold text-[#0B2148]">{l.description}</p>
                                  <div className="flex flex-wrap gap-1 mt-0.5 text-[10px]">
                                    <span className="font-mono font-bold text-[#0878F9] bg-[#EAF5FF] border border-blue-200 px-1.5 rounded">
                                      {l.partNumber || "—"}
                                    </span>
                                    {l.brand && (
                                      <span className="px-1.5 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-700">
                                        {l.brand}
                                      </span>
                                    )}
                                    {l.productUin && (
                                      <span className="font-mono text-slate-500" title={l.productUin}>
                                        {l.productUin}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {l.remaining} / {l.ordered}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={l.remaining}
                                    step={1}
                                    disabled={disabled || !l.include}
                                    value={l.quantityBilled}
                                    onChange={(e) =>
                                      updateLine(l.key, { quantityBilled: Math.max(0, parseInt(e.target.value, 10) || 0) })
                                    }
                                    className={`w-full bg-white border rounded-md px-2 py-1 font-mono focus:outline-none ${
                                      overQty ? "border-rose-400 text-rose-700" : "border-[#D8E8FA] focus:border-[#0878F9]"
                                    }`}
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    disabled={disabled || !l.include}
                                    value={l.unitPrice}
                                    onChange={(e) => updateLine(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full bg-white border border-[#D8E8FA] rounded-md px-2 py-1 font-mono focus:outline-none focus:border-[#0878F9]"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    disabled={disabled || !l.include}
                                    value={l.taxRate}
                                    onChange={(e) => updateLine(l.key, { taxRate: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full bg-white border border-[#D8E8FA] rounded-md px-2 py-1 font-mono focus:outline-none focus:border-[#0878F9]"
                                  />
                                </td>
                                <td className="p-2 text-right font-mono font-bold">
                                  {l.include && !disabled ? money(lineTotal, currency) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional remarks (e.g. freight billed separately)"
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                <div className="flex-none border-t border-[#D8E8FA] p-5 bg-[#F4F9FF] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex gap-6 text-xs">
                    <span className="text-[#526B91]">
                      Subtotal <strong className="block text-[#0B2148] font-mono">{money(totals.subtotal, currency)}</strong>
                    </span>
                    <span className="text-[#526B91]">
                      Tax <strong className="block text-[#0B2148] font-mono">{money(totals.tax, currency)}</strong>
                    </span>
                    <span className="text-[#526B91]">
                      Grand Total <strong className="block text-[#0878F9] font-mono text-sm">{money(totals.grand, currency)}</strong>
                    </span>
                  </div>
                  <button
                    id="submit-supplier-invoice"
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-6 py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer text-xs disabled:opacity-60"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Recording…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Record Invoice
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
