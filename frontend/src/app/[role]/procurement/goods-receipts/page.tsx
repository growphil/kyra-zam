"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Archive, 
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

export default function GoodsReceiptsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  const poIdFromUrl = searchParams.get("poId") || "";

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [page, setPage] = useState(1);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [linkedPOId, setLinkedPOId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([
    { materialId: "", quantityOrdered: 0, quantityReceived: 0, batchNumber: "", serialNumber: "" }
  ]);

  // --- DATA FETCHING ---
  const { data: listData, isLoading } = useQuery({
    queryKey: ["procurement-grn-list", search, status, vendorFilter, page],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/goods-receipts", {
        params: { search, status, vendorId: vendorFilter, page, limit: 10 }
      });
      return res.data;
    }
  });

  const { data: vendors } = useQuery({
    queryKey: ["procurement-vendors-dropdown"],
    queryFn: async () => (await api.get("/sales/vendors")).data || []
  });

  const { data: warehouses } = useQuery({
    queryKey: ["procurement-warehouses-dropdown"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data || []
  });

  // Handle PO pre-fill if converting
  const { data: poDetails } = useQuery({
    queryKey: ["po-prefill-details", poIdFromUrl],
    queryFn: async () => {
      if (!poIdFromUrl) return null;
      const res = await api.get(`/crm/procurement/purchase-orders/${poIdFromUrl}`);
      return res.data;
    },
    enabled: !!poIdFromUrl
  });

  useEffect(() => {
    if (poDetails) {
      setLinkedPOId(poDetails.id);
      setSelectedVendorId(poDetails.vendorId);
      
      const grnItems = poDetails.items.map((item: any) => ({
        materialId: item.materialId,
        materialName: item.material?.name,
        materialSku: item.material?.sku,
        quantityOrdered: item.quantityPending, // prefill with remaining pending
        quantityReceived: item.quantityPending,
        batchNumber: "",
        serialNumber: ""
      }));
      setItems(grnItems);
      setIsCreateOpen(true);
    }
  }, [poDetails]);

  // --- MUTATIONS ---
  const createGRNMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/procurement/goods-receipts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-grn-list"] });
      toast.success("Goods Receipt EXPECTED registered successfully");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create Goods Receipt");
    }
  });

  const resetForm = () => {
    setSelectedVendorId("");
    setLinkedPOId("");
    setWarehouseId("");
    setNotes("");
    setItems([{ materialId: "", quantityOrdered: 0, quantityReceived: 0, batchNumber: "", serialNumber: "" }]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const receipts = listData?.receipts || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / 10) || 1;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedPOId || !selectedVendorId || items.some(it => !it.materialId)) {
      toast.error("Please fill in PO link, Vendor, and items.");
      return;
    }
    createGRNMutation.mutate({
      purchaseOrderId: linkedPOId,
      vendorId: selectedVendorId,
      warehouseId: warehouseId || null,
      notes: notes || null,
      items
    });
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      {/* Header */}
      <PageHeader
        title="Goods Receipts"
        subtitle={`Active Registry: ${totalCount} GRN Inwards`}
        icon={<Archive className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Goods Receipt
          </button>
        }
      />

      {/* Filters */}
      <div className="flex-none flex gap-4 items-center bg-white border border-[#D8E8FA] p-3.5 rounded-xl shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search receipts (GRN Number)..."
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
          <option value="EXPECTED">Expected</option>
          <option value="QC_PENDING">QC Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PARTIALLY_ACCEPTED">Partially Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="STOCKED">Stocked</option>
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
          ) : receipts.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">GRN Number</th>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Received Date</th>
                  <th className="px-4 py-3">Received By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {receipts.map((grn: any) => (
                  <tr key={grn.id} className="hover:bg-[#F4F9FF]/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B2148] text-xs">{grn.grnNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#526B91]">{grn.purchaseOrder?.poNumber}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#0B2148]">{grn.vendor?.name}</td>
                    <td className="px-4 py-3 text-xs text-[#526B91] font-medium">
                      {new Date(grn.receivedDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#0B2148]">{grn.receivedBy?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
                        grn.status === "STOCKED" || grn.status === "ACCEPTED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
                        grn.status === "REJECTED" ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]" :
                        grn.status === "QC_PENDING" ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" :
                        "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                      }`}>
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a 
                        href={`/${roleSlug}/procurement/goods-receipts/${grn.id}`} 
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
              <Archive className="w-10 h-10 mb-3 opacity-40 text-[#526B91]" />
              <p className="text-sm font-semibold text-[#0B2148]">No Goods Receipts Found</p>
              <p className="text-xs text-[#526B91] mt-1">Create a new goods receipt or adjust your filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex-none px-4 py-3 border-t border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
          <p className="text-xs text-[#526B91] font-semibold">
            Showing Page {page} of {totalPages} ({totalCount} Total GRNs)
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
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Create Goods Receipt (GRN)</h2>
                  <p className="text-xs text-[#526B91] mt-0.5">Receive material inwards from purchase orders.</p>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Target Warehouse</label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="">Choose Warehouse</option>
                      {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Internal Notes</label>
                    <input 
                      type="text"
                      placeholder="e.g. Delivery challan #1234"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                {/* Items Box */}
                <div className="space-y-3">
                  <div className="pb-1.5 border-b border-[#D8E8FA]">
                    <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Items in Goods Receipt</h3>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-[#D8E8FA] bg-[#F4F9FF] space-y-2">
                        <div className="grid grid-cols-12 gap-2.5 items-center">
                          <div className="col-span-4 text-xs font-semibold">
                            <span className="text-[10px] text-[#526B91] uppercase tracking-wider block">Material SKU</span>
                            <span className="text-[#0B2148] font-bold">{item.materialName || "Raw Material"}</span>
                            <span className="text-[#526B91] block font-mono text-[11px]">({item.materialSku})</span>
                          </div>

                          <div className="col-span-2 text-center text-xs">
                            <span className="text-[10px] text-[#526B91] uppercase tracking-wider block">Ordered Qty</span>
                            <span className="text-[#0B2148] font-mono font-bold">{item.quantityOrdered}</span>
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Received Qty</label>
                            <input 
                              type="number"
                              required
                              min={0}
                              value={item.quantityReceived}
                              onChange={(e) => handleItemChange(idx, "quantityReceived", parseInt(e.target.value, 10) || 0)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Batch Number</label>
                            <input 
                              type="text"
                              placeholder="Batch SKU"
                              value={item.batchNumber}
                              onChange={(e) => handleItemChange(idx, "batchNumber", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Serial Number</label>
                            <input 
                              type="text"
                              placeholder="Serial SKU"
                              value={item.serialNumber}
                              onChange={(e) => handleItemChange(idx, "serialNumber", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={createGRNMutation.isPending}
                  className="w-full py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {createGRNMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Register Expected Delivery"
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
