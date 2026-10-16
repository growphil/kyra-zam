"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  FileText, 
  Search, 
  Plus, 
  X, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Trash
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

export default function PurchaseOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  const prIdFromUrl = searchParams.get("prId") || "";

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [page, setPage] = useState(1);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [linkedPRId, setLinkedPRId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("30 Days Net");
  const [deliveryTerms, setDeliveryTerms] = useState("FOB Mumbai Port");
  const [billingAddress, setBillingAddress] = useState("KYRA ZAM HQ, Pune, Maharashtra");
  const [deliveryAddress, setDeliveryAddress] = useState("KYRA ZAM Assembly Warehouse, Pune");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<any[]>([
    { materialId: "", description: "", quantityOrdered: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "" }
  ]);

  // --- DATA FETCHING ---
  const { data: dashboardData } = useQuery({
    queryKey: ["procurement-dashboard"],
    queryFn: async () => (await api.get("/crm/procurement/dashboard")).data
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ["procurement-po-list", search, status, vendorFilter, page],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/purchase-orders", {
        params: { search, status, vendorId: vendorFilter, page, limit: 10 }
      });
      return res.data;
    }
  });

  const { data: vendors } = useQuery({
    queryKey: ["procurement-vendors-dropdown"],
    queryFn: async () => (await api.get("/sales/vendors")).data || []
  });

  const { data: materials } = useQuery({
    queryKey: ["procurement-materials-dropdown"],
    queryFn: async () => (await api.get("/inventory/materials")).data || []
  });

  // Handle PR loading if converting
  const { data: prDetails } = useQuery({
    queryKey: ["pr-prefill-details", prIdFromUrl],
    queryFn: async () => {
      if (!prIdFromUrl) return null;
      const res = await api.get(`/crm/procurement/purchase-requests/${prIdFromUrl}`);
      return res.data;
    },
    enabled: !!prIdFromUrl
  });

  // Pre-fill creation state from PR details
  useEffect(() => {
    if (prDetails) {
      setLinkedPRId(prDetails.id);
      setExpectedDeliveryDate(prDetails.requiredDate.split("T")[0]);
      if (prDetails.notes) setNotes(`Linked to PR: ${prDetails.notes}`);
      
      const prItems = prDetails.items.map((item: any) => ({
        materialId: item.materialId,
        description: item.material?.name || "Raw Material",
        quantityOrdered: item.requestedQuantity,
        unitPrice: item.material?.unitPrice || 0,
        discount: 0,
        taxRate: 18,
        specification: item.specification || ""
      }));
      setItems(prItems);
      setIsCreateOpen(true);
    }
  }, [prDetails]);

  // --- MUTATIONS ---
  const createPOMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/procurement/purchase-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-list"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-dashboard"] });
      toast.success("Purchase Order Draft Created Successfully");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create PO");
    }
  });

  const resetForm = () => {
    setSelectedVendorId("");
    setLinkedPRId("");
    setExpectedDeliveryDate("");
    setAdditionalCharges(0);
    setPaymentTerms("30 Days Net");
    setDeliveryTerms("FOB Mumbai Port");
    setNotes("");
    setItems([{ materialId: "", description: "", quantityOrdered: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "" }]);
  };

  const handleAddItem = () => {
    setItems([...items, { materialId: "", description: "", quantityOrdered: 1, unitPrice: 0, discount: 0, taxRate: 18, specification: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === "materialId" && value) {
      const selected = materials?.find((m: any) => m.id === value);
      if (selected) {
        newItems[index].description = selected.name;
        newItems[index].unitPrice = selected.unitPrice || 0;
      }
    }
    setItems(newItems);
  };

  const totals = () => {
    let sub = 0;
    let tax = 0;
    let disc = 0;
    items.forEach(it => {
      const subL = it.quantityOrdered * it.unitPrice;
      const taxable = Math.max(0, subL - it.discount);
      const taxL = taxable * (it.taxRate / 100);

      sub += subL;
      disc += it.discount;
      tax += taxL;
    });
    return { subtotal: sub, discount: disc, tax, grandTotal: sub - disc + tax + Number(additionalCharges) };
  };

  const currentTotals = totals();
  const pos = listData?.orders || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / 10) || 1;
  const stats = dashboardData?.stats || {};

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId || !expectedDeliveryDate || items.some(it => !it.materialId)) {
      toast.error("Please fill in Vendor, expected date, and all items.");
      return;
    }
    createPOMutation.mutate({
      vendorId: selectedVendorId,
      purchaseRequestId: linkedPRId || null,
      expectedDeliveryDate,
      currency,
      additionalCharges: Number(additionalCharges),
      paymentTerms,
      deliveryTerms,
      billingAddress,
      deliveryAddress,
      notes: notes || null,
      items
    });
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      {/* Header */}
      <PageHeader
        title="Purchase Orders"
        subtitle={`Active Orders: ${totalCount} Formal POs`}
        icon={<FileText className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
        }
      />

      {/* Filters */}
      <div className="flex-none flex gap-4 items-center bg-white border border-[#D8E8FA] p-3.5 rounded-xl shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search orders (Number)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg pl-10 pr-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
          />
        </div>

        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-[#0878F9]"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="SENT">Sent</option>
          <option value="PARTIALLY_RECEIVED">Partially Received</option>
          <option value="RECEIVED">Received</option>
          <option value="CLOSED">Closed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select 
          value={vendorFilter}
          onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-[#0878F9]"
        >
          <option value="">All Vendors</option>
          {vendors?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Main Grid */}
      <div className="flex-1 bg-white rounded-xl border border-[#D8E8FA] overflow-hidden flex flex-col shadow-2xs">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            </div>
          ) : pos.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Expected Delivery</th>
                  <th className="px-4 py-3">Grand Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {pos.map((po: any) => (
                  <tr key={po.id} className="hover:bg-[#F4F9FF]/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B2148] text-xs">{po.poNumber}</td>
                    <td className="px-4 py-3 text-xs text-[#0B2148] font-semibold">{po.vendor?.name}</td>
                    <td className="px-4 py-3 text-xs text-[#526B91] font-medium">
                      {new Date(po.orderDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#526B91] font-medium">
                      {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#0B2148] text-xs font-mono">
                      {po.currency} {parseFloat(po.grandTotal.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
                        po.status === "RECEIVED" || po.status === "CLOSED" || po.status === "APPROVED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
                        po.status === "CANCELLED" || po.status === "REJECTED" ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]" :
                        po.status === "SENT" ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]" :
                        po.status === "PARTIALLY_RECEIVED" ? "bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF]" :
                        "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a 
                        href={`/${roleSlug}/procurement/purchase-orders/${po.id}`} 
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0878F9] hover:underline"
                      >
                        Details
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-16 text-[#526B91]">
              <FileText className="w-10 h-10 mb-3 opacity-40 text-[#526B91]" />
              <p className="text-sm font-semibold text-[#0B2148]">No Purchase Orders Found</p>
              <p className="text-xs text-[#526B91] mt-1">Create a new purchase order or adjust your filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex-none px-4 py-3 border-t border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
          <p className="text-xs text-[#526B91] font-semibold">
            Showing Page {page} of {totalPages} ({totalCount} Total POs)
          </p>
          <div className="flex gap-1.5">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 bg-white border border-[#D8E8FA] rounded-lg text-[#0B2148] disabled:opacity-40 hover:bg-[#EAF5FF] transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 bg-white border border-[#D8E8FA] rounded-lg text-[#0B2148] disabled:opacity-40 hover:bg-[#EAF5FF] transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Create Drawer */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#061B3A]/40 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setIsCreateOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-white border-l border-[#D8E8FA] h-full flex flex-col shadow-2xl p-6 z-10 overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-4 border-b border-[#D8E8FA]">
                <div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Issue Purchase Order</h2>
                  <p className="text-xs text-[#526B91] mt-0.5">Submit formal commercial requests to verified vendor files.</p>
                </div>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex-1 py-4 space-y-5">
                
                {/* Meta details */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Select Vendor *</label>
                    <select
                      required
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="">Select Vendor File</option>
                      {vendors?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Expected Delivery Date *</label>
                    <input 
                      type="date"
                      required
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Currency</label>
                    <input 
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                {/* Terms and addresses */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Billing Address *</label>
                    <input 
                      type="text"
                      required
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Delivery Target Address *</label>
                    <input 
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Payment Terms *</label>
                    <input 
                      type="text"
                      required
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Delivery Terms *</label>
                    <input 
                      type="text"
                      required
                      value={deliveryTerms}
                      onChange={(e) => setDeliveryTerms(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                {/* Items Box */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#D8E8FA]">
                    <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Ordered Materials</h3>
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg text-xs font-bold text-[#0878F9] hover:bg-[#EAF5FF] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-[#D8E8FA] bg-[#F4F9FF] space-y-2">
                        <div className="grid grid-cols-12 gap-2.5 items-center">
                          <div className="col-span-3">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Choose Material *</label>
                            <select
                              required
                              value={item.materialId}
                              onChange={(e) => handleItemChange(idx, "materialId", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            >
                              <option value="">Select Material SKU</option>
                              {materials?.map((m: any) => <option key={m.id} value={m.id}>{m.sku} - {m.name}</option>)}
                            </select>
                          </div>

                          <div className="col-span-3">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Description *</label>
                            <input 
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Qty *</label>
                            <input 
                              type="number"
                              required
                              min={1}
                              value={item.quantityOrdered}
                              onChange={(e) => handleItemChange(idx, "quantityOrdered", parseInt(e.target.value, 10))}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Unit Price *</label>
                            <input 
                              type="number"
                              required
                              min={0}
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", parseFloat(e.target.value))}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Tax %</label>
                            <input 
                              type="number"
                              min={0}
                              value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, "taxRate", parseFloat(e.target.value))}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-1 flex justify-center pt-4">
                            <button 
                              type="button" 
                              disabled={items.length === 1}
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional charges */}
                <div className="grid grid-cols-3 gap-4 border-t border-[#D8E8FA] pt-4">
                  <div className="space-y-1 col-span-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Additional Freight/Charges</label>
                    <input 
                      type="number" 
                      min={0}
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                {/* Financial Summary box */}
                <div className="p-4 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] space-y-1.5 text-xs text-[#526B91]">
                  <div className="flex justify-between">
                    <span>Purchase Subtotal:</span>
                    <span className="font-mono font-bold text-[#0B2148]">INR {currentTotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (GST) Cumulative:</span>
                    <span className="font-mono font-bold text-[#0B2148]">INR {currentTotals.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Freight & Additional:</span>
                    <span className="font-mono font-bold text-[#0B2148]">INR {Number(additionalCharges).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#D8E8FA] font-bold text-[#0B2148]">
                    <span>Grand Total amount:</span>
                    <span className="font-mono text-[#0878F9]">INR {currentTotals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={createPOMutation.isPending}
                  className="w-full py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {createPOMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Save Draft Purchase Order"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
