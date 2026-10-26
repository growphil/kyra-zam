"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Building2, 
  Calendar, 
  FileCheck2, 
  Save, 
  Send, 
  Loader2, 
  ShieldAlert, 
  Check, 
  AlertCircle,
  HelpCircle,
  FileText,
  Clock,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";

interface BlindLineItem {
  id: string; // poItem.id
  productId?: string | null;
  materialId?: string | null;
  productName: string;
  partNumber: string;
  productUin: string;
  brand: string;
  category: string;
  unit: string;
  batchNumber?: string | null;
  imageUrl?: string | null;
  specification?: string | null;
  materialType: string;
  isQualityInspectionRequired: boolean;
  quantityReceived: number;
}

interface ItemEntry {
  poItemId: string;
  passedQty: number | string;
  defectiveQty: number | string;
  batchNumber: string;
  shortageNotes: string;
  defectNotes: string;
}

export default function BlindReceivingPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = params.role as string;
  const poId = params.id as string;

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch Blind Receiving PO Data
  const { data: po, isLoading, error } = useQuery({
    queryKey: ["blind-receiving-po", poId],
    queryFn: async () => {
      const res = await api.get(`/crm/procurement/receiving/purchase-orders/${poId}`);
      return res.data;
    },
    enabled: !!poId,
    retry: 1
  });

  // Pre-fill entries and invoice when PO data loads
  useEffect(() => {
    if (po) {
      if (po.supplierInvoiceNumber) {
        setSupplierInvoiceNumber(po.supplierInvoiceNumber);
      }
      const initial: Record<string, ItemEntry> = {};
      po.items.forEach((item: BlindLineItem) => {
        initial[item.id] = {
          poItemId: item.id,
          passedQty: "",
          defectiveQty: 0,
          batchNumber: item.batchNumber || "",
          shortageNotes: "",
          defectNotes: ""
        };
      });
      setEntries(initial);
    }
  }, [po]);

  // Mutation to Submit or Save Draft Receipt
  const receiveMutation = useMutation({
    mutationFn: async ({ isDraft }: { isDraft: boolean }) => {
      setServerError(null);

      const itemsPayload = Object.values(entries).map(e => ({
        poItemId: e.poItemId,
        passedQty: Number(e.passedQty) || 0,
        defectiveQty: Number(e.defectiveQty) || 0,
        batchNumber: e.batchNumber?.trim() || null,
        notes: [e.shortageNotes, e.defectNotes].filter(Boolean).join(" | ") || null,
        shortageNotes: e.shortageNotes?.trim() || null,
        defectNotes: e.defectNotes?.trim() || null
      }));

      const res = await api.post(`/crm/procurement/receiving/purchase-orders/${poId}/receive`, {
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
        isDraft,
        items: itemsPayload
      });
      return res.data;
    },
    onSuccess: (data, { isDraft }) => {
      queryClient.invalidateQueries({ queryKey: ["blind-receiving-po", poId] });
      queryClient.invalidateQueries({ queryKey: ["procurement-receiving-po-list"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-po-list"] });

      if (isDraft) {
        toast.success(`Draft Receipt ${data.grnNumber || ""} saved successfully.`);
      } else {
        toast.success(`GRN ${data.grnNumber} generated successfully!`);
        setTimeout(() => {
          router.push(`/${roleSlug}/procurement/purchase-orders`);
        }, 1200);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to process receipt.";
      setServerError(msg);
      toast.error(msg);
    }
  });

  const handleFieldChange = (poItemId: string, field: keyof ItemEntry, value: any) => {
    setEntries(prev => ({
      ...prev,
      [poItemId]: {
        ...prev[poItemId],
        [field]: value
      }
    }));
  };

  const totalPassedCount = Object.values(entries).reduce((acc, curr) => acc + (Number(curr.passedQty) || 0), 0);
  const totalDefectiveCount = Object.values(entries).reduce((acc, curr) => acc + (Number(curr.defectiveQty) || 0), 0);
  const totalEnteredItems = totalPassedCount + totalDefectiveCount;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 text-[#0878F9] animate-spin mb-4" />
        <p className="text-sm font-semibold text-[#0B2148]">Loading Blind Receiving Data...</p>
        <p className="text-xs text-[#526B91] mt-1">Obscuring commercial terms for warehouse verification compliance.</p>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-[#EF4444] mb-3" />
        <h2 className="text-base font-bold text-[#0B2148]">Purchase Order Not Available for Receiving</h2>
        <p className="text-xs text-[#526B91] max-w-md mt-1 mb-5">
          {(error as any)?.response?.data?.error || "This PO does not exist or has not been approved for receiving."}
        </p>
        <button
          onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders`)}
          className="px-4 py-2 bg-[#0878F9] text-white text-xs font-bold rounded-lg hover:bg-[#0667DB] transition-all cursor-pointer"
        >
          Return to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Page Header */}
      <PageHeader
        title={`Receiving Verification — ${po.poNumber}`}
        subtitle="Perform blind physical count verification against incoming supplier shipments."
        icon={<FileCheck2 className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8E8FA] bg-white text-xs font-semibold text-[#0B2148] hover:bg-[#F4F9FF] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#526B91]" />
            Back to Orders
          </button>
        }
      />

      {/* Compliance Notice Banner */}
      <div className="bg-gradient-to-r from-[#EFF6FF] to-[#E0E7FF] border border-[#BFDBFE] rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-[#1D4ED8] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
              Blind Physical Receiving &amp; QC Audit Mode
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]">
              Segregation of Duties Enforced
            </span>
          </div>
          <p className="text-xs text-[#1E40AF] mt-1 leading-relaxed">
            In compliance with factory receiving governance, ordered quantities and pricing are completely obscured.
            Please count physical stock arriving at the bay and enter exact accepted and defective totals.
            Full receipt is required to complete verification against the authorized purchase order.
          </p>
        </div>
      </div>

      {/* PO Meta Summary Bar */}
      <div className="bg-white border border-[#D8E8FA] rounded-xl p-4 shadow-2xs grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Supplier</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Building2 className="w-4 h-4 text-[#0878F9]" />
            <span className="text-xs font-bold text-[#0B2148]">{po.vendor?.name}</span>
          </div>
          <span className="text-[11px] text-[#526B91] block mt-0.5">{po.vendor?.contact || po.vendor?.email || "Verified Supplier"}</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Supplier Invoice #</span>
          <div className="mt-1">
            <input
              type="text"
              placeholder="e.g. INV-2026-0089"
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
            />
          </div>
          <span className="text-[10px] text-[#526B91] block mt-0.5">Required for 3-way matching invoice reconciliation</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Dates</span>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-[#0B2148] font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#526B91]" />
            <span>Ordered: {new Date(po.orderDate).toLocaleDateString()}</span>
          </div>
          <span className="text-[11px] text-[#526B91] block mt-0.5">
            Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString()}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Receiving Status</span>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
              po.status === "RECEIVED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
              po.status === "PARTIALLY_RECEIVED" ? "bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF]" :
              "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
            }`}>
              {po.status}
            </span>
            <span className="text-xs font-bold text-[#526B91]">{po.items.length} Product Lines</span>
          </div>
        </div>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3.5 flex items-start gap-2.5 text-[#991B1B]">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <strong className="font-bold block">Quantity Mismatch</strong>
            <p className="mt-0.5 leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}



      {/* Main Receiving Items Table */}
      <div className="flex-1 bg-white rounded-xl border border-[#D8E8FA] overflow-hidden flex flex-col shadow-2xs">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider sticky top-0 z-10">
                <th className="px-4 py-3">Product / Identity</th>
                <th className="px-4 py-3">UIN &amp; Part #</th>
                <th className="px-4 py-3">Brand &amp; Category</th>
                <th className="px-4 py-3">QC Policy</th>
                <th className="px-4 py-3 w-32">Passed / Accepted *</th>
                <th className="px-4 py-3 w-32">Defective</th>
                <th className="px-4 py-3 w-40">Batch Number</th>
                <th className="px-4 py-3">Shortage / Defect Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
              {po.items.map((item: BlindLineItem) => {
                const entry = entries[item.id] || {
                  poItemId: item.id,
                  passedQty: "",
                  defectiveQty: 0,
                  batchNumber: item.batchNumber || "",
                  shortageNotes: "",
                  defectNotes: ""
                };

                return (
                  <tr key={item.id} className="hover:bg-[#F9FBFF] transition-colors">
                    {/* Product Image & Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] overflow-hidden flex items-center justify-center flex-shrink-0">
                          {item.imageUrl ? (
                            <img 
                              src={getMediaUrl(item.imageUrl)} 
                              alt={item.productName} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-[#526B91]/50" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-[#0B2148] block leading-snug">{item.productName}</span>
                          {item.specification && (
                            <span className="text-[11px] text-[#526B91] block mt-0.5 line-clamp-1">{item.specification}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* UIN & Part Number */}
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-[#0B2148]">{item.productUin || "—"}</div>
                      <div className="text-[11px] text-[#526B91] font-mono mt-0.5">Part: {item.partNumber || "—"}</div>
                    </td>

                    {/* Brand & Category */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#0B2148]">{item.brand}</div>
                      <div className="text-[11px] text-[#526B91]">{item.category} ({item.unit})</div>
                    </td>

                    {/* QC Policy Badge */}
                    <td className="px-4 py-3">
                      {item.isQualityInspectionRequired ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                          <AlertTriangle className="w-3 h-3 text-[#D97706]" />
                          QTZ (QC Required)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                          <Check className="w-3 h-3 text-[#16A34A]" />
                          NQZ (Direct Stock)
                        </span>
                      )}
                    </td>

                    {/* Accepted Quantity Input */}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={entry.passedQty}
                        onChange={(e) => handleFieldChange(item.id, "passedQty", e.target.value)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white text-center"
                      />
                    </td>

                    {/* Defective Quantity Input */}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={entry.defectiveQty}
                        onChange={(e) => handleFieldChange(item.id, "defectiveQty", e.target.value)}
                        className="w-full bg-[#FFF5F5] border border-[#FECACA] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#991B1B] focus:outline-none focus:border-[#EF4444] focus:bg-white text-center"
                      />
                    </td>

                    {/* Actual Batch Number */}
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="e.g. B-2026-X"
                        value={entry.batchNumber}
                        onChange={(e) => handleFieldChange(item.id, "batchNumber", e.target.value)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                      />
                    </td>

                    {/* Shortage & Defect Notes */}
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="Damage, shortage or bay notes..."
                        value={entry.shortageNotes}
                        onChange={(e) => handleFieldChange(item.id, "shortageNotes", e.target.value)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-xs text-[#0B2148] placeholder-[#94A3B8] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Sticky Action Footer */}
        <div className="flex-none px-6 py-4 border-t border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Items Counted</span>
              <span className="text-xs font-bold text-[#0B2148]">
                {po.items.length} line(s) · {totalEnteredItems} total units entered
              </span>
            </div>

            <div className="h-6 w-[1px] bg-[#D8E8FA]" />

            <div>
              <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider block">Accepted / Passed</span>
              <span className="text-xs font-bold text-[#166534] font-mono">{totalPassedCount} units</span>
            </div>

            <div className="h-6 w-[1px] bg-[#D8E8FA]" />

            <div>
              <span className="text-[10px] font-bold text-[#991B1B] uppercase tracking-wider block">Defective / Rejected</span>
              <span className="text-xs font-bold text-[#991B1B] font-mono">{totalDefectiveCount} units (quarantined)</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={receiveMutation.isPending}
              onClick={() => receiveMutation.mutate({ isDraft: true })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D8E8FA] bg-white text-xs font-bold text-[#0B2148] hover:bg-[#EAF5FF] transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#526B91]" />
              Save Draft
            </button>

            <button
              type="button"
              disabled={receiveMutation.isPending || totalEnteredItems === 0}
              onClick={() => receiveMutation.mutate({ isDraft: false })}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {receiveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Submit &amp; Post Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
