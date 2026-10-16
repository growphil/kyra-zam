"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Archive, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  Check,
  X,
  ShieldCheck,
  Building2,
  Bookmark,
  MapPin,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function GoodsReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const grnId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Dialog / Modal States
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [inwardQuantities, setInwardQuantities] = useState<Record<string, number>>({});

  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [inspectItems, setInspectItems] = useState<Record<string, { acceptedQty: number; rejectedQty: number; damagedQty?: number }>>({});

  const [isStockOpen, setIsStockOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");

  // --- DATA FETCHING ---
  const { data: grn, isLoading } = useQuery({
    queryKey: ["procurement-grn-details", grnId],
    queryFn: async () => {
      const res = await api.get(`/crm/procurement/goods-receipts/${grnId}`);
      // Init states
      const inward: Record<string, number> = {};
      const inspect: Record<string, { acceptedQty: number; rejectedQty: number; damagedQty?: number }> = {};
      res.data.items?.forEach((it: any) => {
        inward[it.id] = it.quantityOrdered;
        inspect[it.id] = { acceptedQty: it.quantityReceived, rejectedQty: 0, damagedQty: 0 };
      });
      setInwardQuantities(inward);
      setInspectItems(inspect);
      if (res.data.warehouseId) {
        setSelectedWarehouseId(res.data.warehouseId);
      }
      return res.data;
    }
  });

  const { data: warehouses } = useQuery({
    queryKey: ["procurement-warehouses-dropdown"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data || []
  });

  const activeWarehouse = warehouses?.find((w: any) => w.id === selectedWarehouseId);
  const locations = activeWarehouse?.locations || [];

  // --- MUTATIONS ---
  const receiveInwardMutation = useMutation({
    mutationFn: (items: any[]) => api.put(`/crm/procurement/goods-receipts/${grnId}/receive`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-grn-details"] });
      toast.success("Inward material successfully logged. Pending QC");
      setIsInwardOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Inward failed")
  });

  const inspectMutation = useMutation({
    mutationFn: (items: any[]) => api.put(`/crm/procurement/goods-receipts/${grnId}/inspect`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-grn-details"] });
      toast.success("QC Inspection results recorded");
      setIsInspectOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Inspection recording failed")
  });

  const stockInventoryMutation = useMutation({
    mutationFn: (data: { warehouseId: string; locationId?: string }) => api.put(`/crm/procurement/goods-receipts/${grnId}/stock`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-grn-details"] });
      toast.success("Material stock updated successfully inside target Warehouse location");
      setIsStockOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Stocking failed")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!grn) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Goods Receipt File Not Found</p>
      </div>
    );
  }

  const handleInwardChange = (itemId: string, val: number) => {
    setInwardQuantities({ ...inwardQuantities, [itemId]: val });
  };

  const handleInspectChange = (itemId: string, field: string, val: number) => {
    const prev = inspectItems[itemId] || { acceptedQty: 0, rejectedQty: 0, damagedQty: 0 };
    setInspectItems({
      ...inspectItems,
      [itemId]: { ...prev, [field]: val }
    });
  };

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/procurement/goods-receipts`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-white font-bold text-sm bg-[#F4F9FF] border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Receipts
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Inward receipt ID</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{grn.grnNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                grn.status === "STOCKED" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                grn.status === "REJECTED" ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                grn.status === "QC_PENDING" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                "bg-slate-500/15 text-[#526B91] border border-slate-500/20"
              }`}>
                {grn.status}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">{grn.vendor?.name}</p>
                  <p className="text-xs text-[#526B91]">Vendor Profile</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Bookmark className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">PO Reference: {grn.purchaseOrder?.poNumber}</p>
                </div>
              </div>

              {grn.warehouse && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-accent mt-0.5" />
                  <div>
                    <p className="font-bold text-[#0B2148]">Warehouse: {grn.warehouse?.name} ({grn.warehouse?.code})</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91] border-t border-[#D8E8FA] pt-4">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Received Date</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(grn.receivedDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Received By</p>
                  <p className="mt-0.5 text-[#0B2148]">{grn.receivedBy?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-3">
            <h3 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">GRN Status Workflow</h3>
            
            {grn.status === "EXPECTED" && (
              <button 
                onClick={() => setIsInwardOpen(true)}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all"
              >
                Record Material Inward Arrival
              </button>
            )}

            {grn.status === "QC_PENDING" && (
              <button 
                onClick={() => setIsInspectOpen(true)}
                className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Record Quality QC Inspection
              </button>
            )}

            {["ACCEPTED", "PARTIALLY_ACCEPTED"].includes(grn.status) && (
              <button 
                onClick={() => setIsStockOpen(true)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Finalize & Stock Items
              </button>
            )}

            {grn.status === "STOCKED" && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-center text-xs font-bold">
                Inward Stocked successfully
              </div>
            )}
          </div>
        </div>

        {/* Right Column details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-lg font-display font-bold text-[#0B2148]">Inward Items List</h3>
            
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider">
                  <th className="pb-3">Material SKU / Name</th>
                  <th className="pb-3">Qty Ordered</th>
                  <th className="pb-3">Qty Received</th>
                  <th className="pb-3 text-[#166534] font-bold">Accepted</th>
                  <th className="pb-3 text-red-400 font-bold">Rejected</th>
                  <th className="pb-3">Batch/Serial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {grn.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <div className="font-bold text-white">{item.material?.name}</div>
                      <div className="text-[10px] text-[#526B91] font-mono mt-0.5">SKU: {item.material?.sku}</div>
                    </td>
                    <td className="py-4 font-mono">{item.quantityOrdered}</td>
                    <td className="py-4 font-mono">{item.quantityReceived}</td>
                    <td className="py-4 font-mono font-bold text-[#166534]">{item.quantityAccepted}</td>
                    <td className="py-4 font-mono font-bold text-red-400">{item.quantityRejected}</td>
                    <td className="py-4 text-[#526B91]">
                      {item.batchNumber && <div>Batch: {item.batchNumber}</div>}
                      {item.serialNumber && <div>Serial: {item.serialNumber}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Record Inward Modal */}
      {isInwardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-xl w-full mx-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[#0B2148]">Record Material Arrival</h3>
            <div className="space-y-3">
              {grn.items?.map((item: any) => (
                <div key={item.id} className="grid grid-cols-2 gap-3 items-center text-xs">
                  <div>
                    <p className="font-bold text-[#0B2148]">{item.material?.name}</p>
                    <p className="text-[10px] text-[#526B91] font-mono">Ordered: {item.quantityOrdered}</p>
                  </div>
                  <input 
                    type="number"
                    min={0}
                    value={inwardQuantities[item.id] || 0}
                    onChange={(e) => handleInwardChange(item.id, parseInt(e.target.value, 10) || 0)}
                    className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-white font-mono text-right"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsInwardOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  const itemsPayload = grn.items.map((it: any) => ({
                    itemId: it.id,
                    quantityReceived: inwardQuantities[it.id] || 0
                  }));
                  receiveInwardMutation.mutate(itemsPayload);
                }}
                disabled={receiveInwardMutation.isPending}
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                Save Inward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {isInspectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl w-full mx-4 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[#0B2148]">Record QC Inspection Results</h3>
            <div className="space-y-4 divide-y divide-[#E8F1FC]">
              {grn.items?.map((item: any) => {
                const values = inspectItems[item.id] || { acceptedQty: 0, rejectedQty: 0, damagedQty: 0 };
                return (
                  <div key={item.id} className="pt-3 text-xs space-y-2">
                    <div className="flex justify-between">
                      <p className="font-bold text-[#0B2148]">{item.material?.name} ({item.material?.sku})</p>
                      <p className="text-[#526B91]">Total Received: {item.quantityReceived}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-[#526B91] uppercase tracking-wider block font-semibold">Accepted Qty</label>
                        <input 
                          type="number"
                          min={0}
                          value={values.acceptedQty}
                          onChange={(e) => handleInspectChange(item.id, "acceptedQty", parseInt(e.target.value, 10) || 0)}
                          className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1 font-mono text-[#166534]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#526B91] uppercase tracking-wider block font-semibold">Rejected Qty</label>
                        <input 
                          type="number"
                          min={0}
                          value={values.rejectedQty}
                          onChange={(e) => handleInspectChange(item.id, "rejectedQty", parseInt(e.target.value, 10) || 0)}
                          className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1 font-mono text-red-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#526B91] uppercase tracking-wider block font-semibold">Damaged Qty</label>
                        <input 
                          type="number"
                          min={0}
                          value={values.damagedQty || 0}
                          onChange={(e) => handleInspectChange(item.id, "damagedQty", parseInt(e.target.value, 10) || 0)}
                          className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1 font-mono text-orange-400"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button onClick={() => setIsInspectOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  const inspectPayload = grn.items.map((it: any) => {
                    const val = inspectItems[it.id];
                    return {
                      itemId: it.id,
                      acceptedQty: val?.acceptedQty || 0,
                      rejectedQty: val?.rejectedQty || 0,
                      damagedQty: val?.damagedQty || 0
                    };
                  });
                  inspectMutation.mutate(inspectPayload);
                }}
                disabled={inspectMutation.isPending}
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                Submit Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Stocking Modal */}
      {isStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-[#0B2148]">Stock Items into Inventory</h3>
            
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Select Warehouse *</label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => { setSelectedWarehouseId(e.target.value); setSelectedLocationId(""); }}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-[#0B2148] focus:outline-none"
                >
                  <option value="">Choose Warehouse</option>
                  {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Select Location Bin *</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-[#0B2148] focus:outline-none"
                >
                  <option value="">Choose Location/Bin</option>
                  {locations?.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsStockOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  if (!selectedWarehouseId || !selectedLocationId) {
                    toast.error("Warehouse and Location are required to stock items.");
                    return;
                  }
                  stockInventoryMutation.mutate({ warehouseId: selectedWarehouseId, locationId: selectedLocationId });
                }}
                disabled={stockInventoryMutation.isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                Finalize Stock Inward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
