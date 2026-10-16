"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ArrowLeftRight, 
  Plus, 
  X, 
  Loader2, 
  ArrowRight,
  Warehouse, 
  Calendar,
  CheckCircle,
  Truck,
  PackageCheck,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";

interface TransferItemInput {
  materialId: string;
  quantityRequested: number;
  originLocationId: string;
  destinationLocationId: string;
}

export default function StockTransfersPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userRoles = (session?.user as any)?.roles || [];

  // Dialog/Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItemInput[]>([
    { materialId: "", quantityRequested: 1, originLocationId: "", destinationLocationId: "" }
  ]);

  // Details expand state
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  
  // Quantities input during action workflows
  const [shippedQtys, setShippedQtys] = useState<Record<string, number>>({});
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});

  // --- DATA FETCHING ---
  const { data: transfers, isLoading: isTransfersLoading } = useQuery({
    queryKey: ["inventory-transfers"],
    queryFn: async () => (await api.get("/inventory/transfers")).data
  });

  const { data: warehouses } = useQuery({
    queryKey: ["inventory-warehouses"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data
  });

  const { data: materials } = useQuery({
    queryKey: ["inventory-materials"],
    queryFn: async () => (await api.get("/inventory/materials")).data
  });

  // Filtered lists for the form helper
  const originWarehouse = warehouses?.find((w: any) => w.id === originWarehouseId);
  const destinationWarehouse = warehouses?.find((w: any) => w.id === destinationWarehouseId);

  // --- MUTATIONS ---
  const createTransferMutation = useMutation({
    mutationFn: (data: any) => api.post("/inventory/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Stock transfer requested successfully");
      setIsOpen(false);
      setOriginWarehouseId("");
      setDestinationWarehouseId("");
      setNotes("");
      setItems([{ materialId: "", quantityRequested: 1, originLocationId: "", destinationLocationId: "" }]);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Transfer request failed")
  });

  const approveTransferMutation = useMutation({
    mutationFn: (id: string) => api.put(`/inventory/transfers/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Stock transfer approved");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Approval failed")
  });

  const shipTransferMutation = useMutation({
    mutationFn: (data: { id: string, shippedItems: any[] }) => 
      api.put(`/inventory/transfers/${data.id}/ship`, { shippedItems: data.shippedItems }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Stock transfer marked as In-Transit");
      setShippedQtys({});
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Shipment dispatch failed")
  });

  const receiveTransferMutation = useMutation({
    mutationFn: (data: { id: string, receivedItems: any[] }) => 
      api.put(`/inventory/transfers/${data.id}/receive`, { receivedItems: data.receivedItems }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Stock transfer items successfully received in stock");
      setReceivedQtys({});
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Receiving transaction failed")
  });

  const cancelTransferMutation = useMutation({
    mutationFn: (id: string) => api.put(`/inventory/transfers/${id}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      toast.success("Stock transfer cancelled");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Cancellation failed")
  });

  // Action Guards based on RBAC & Status
  const canApprove = userRoles.some((r: string) => ["SUPERVISOR", "ADMIN", "SUPERADMIN"].includes(r));
  const canShipOrReceive = userRoles.some((r: string) => ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"].includes(r));

  const handleAddItem = () => {
    setItems([...items, { materialId: "", quantityRequested: 1, originLocationId: "", destinationLocationId: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, key: keyof TransferItemInput, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    setItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originWarehouseId || !destinationWarehouseId) {
      toast.error("Origin and Destination warehouses are required.");
      return;
    }
    if (originWarehouseId === destinationWarehouseId) {
      toast.error("Origin and Destination warehouses must be different.");
      return;
    }
    createTransferMutation.mutate({
      originWarehouseId,
      destinationWarehouseId,
      notes,
      items
    });
  };

  const selectedTransfer = transfers?.find((t: any) => t.id === selectedTransferId);

  return (
    <div className="space-y-4 max-w-[1600px] pb-8">
      {/* Header */}
      <PageHeader
        title="Inter-Warehouse Transfers"
        subtitle="Stock Relocations & Multi-Warehouse Manifests"
        icon={<ArrowLeftRight className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] text-white font-bold text-xs hover:bg-[#0667DB] transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Request Transfer
          </button>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Transfers List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA]">
            <h2 className="text-lg font-bold text-[#0B2148] mb-4">Relocations Manifest</h2>

            {isTransfersLoading ? (
              <div className="flex justify-center p-8 text-[#526B91]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : transfers?.length === 0 ? (
              <p className="text-[#526B91] text-sm text-center py-8">No transfer manifests recorded.</p>
            ) : (
              <div className="space-y-3">
                {transfers?.map((tr: any) => (
                  <div 
                    key={tr.id}
                    onClick={() => setSelectedTransferId(tr.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      selectedTransferId === tr.id 
                        ? "bg-accent/10 border-accent" 
                        : "bg-[#F4F9FF] border-[#D8E8FA] hover:border-[#D8E8FA]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-[#0B2148]">{tr.transferNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tr.status === "REQUESTED" ? "bg-blue-500/20 text-blue-400" :
                          tr.status === "APPROVED" ? "bg-amber-500/20 text-amber-400" :
                          tr.status === "IN_TRANSIT" ? "bg-purple-500/20 text-purple-400" :
                          tr.status === "RECEIVED" ? "bg-green-500/20 text-green-400" :
                          "bg-rose-500/20 text-rose-400"
                        }`}>
                          {tr.status}
                        </span>
                      </div>
                      <span className="text-xs text-[#526B91] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(tr.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-[#0B2148]">
                      <span className="flex items-center gap-1.5 bg-[#F4F9FF] px-2.5 py-1 rounded-lg">
                        <Warehouse className="w-3.5 h-3.5 text-accent" />
                        {tr.originWarehouse.name} ({tr.originWarehouse.code})
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#526B91]" />
                      <span className="flex items-center gap-1.5 bg-[#F4F9FF] px-2.5 py-1 rounded-lg">
                        <Warehouse className="w-3.5 h-3.5 text-green-400" />
                        {tr.destinationWarehouse.name} ({tr.destinationWarehouse.code})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Transfer Details Panel */}
        <div className="lg:col-span-1">
          {selectedTransfer ? (
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] space-y-6">
              <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#0B2148]">{selectedTransfer.transferNumber}</h3>
                  <p className="text-[10px] text-[#526B91] uppercase mt-0.5">Transfer Details</p>
                </div>
                <button 
                  onClick={() => setSelectedTransferId(null)}
                  className="p-1.5 rounded-lg bg-[#F4F9FF] text-[#526B91] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Header */}
              <div className="flex items-center gap-3 bg-[#F4F9FF] p-4 rounded-2xl border border-[#D8E8FA]">
                <span className="text-xs font-semibold text-[#526B91]">Current Status:</span>
                <span className="text-xs font-bold text-accent">{selectedTransfer.status}</span>
              </div>

              {/* Item Manifest */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#526B91] uppercase">Items Payload</h4>
                {selectedTransfer.items.map((item: any) => (
                  <div key={item.id} className="p-4 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0B2148]">{item.material.name}</span>
                      <span className="text-xs font-mono text-[#526B91]">{item.material.sku}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] text-[#526B91]">
                      <div>
                        <span className="block font-bold">FROM BIN:</span>
                        <span className="text-[#0B2148]">{item.originLocation.name} ({item.originLocation.code})</span>
                      </div>
                      <div>
                        <span className="block font-bold">TO BIN:</span>
                        <span className="text-[#0B2148]">{item.destinationLocation.name} ({item.destinationLocation.code})</span>
                      </div>
                    </div>

                    {/* Quantities */}
                    <div className="flex items-center justify-between border-t border-[#D8E8FA] pt-2 mt-2 text-xs">
                      <div>
                        <span className="block text-[10px] text-[#526B91] font-bold">REQUESTED:</span>
                        <span className="font-bold text-[#0B2148]">{item.quantityRequested}</span>
                      </div>
                      {selectedTransfer.status !== "REQUESTED" && selectedTransfer.status !== "APPROVED" && (
                        <div>
                          <span className="block text-[10px] text-[#526B91] font-bold">SHIPPED:</span>
                          <span className="font-bold text-amber-400">{item.quantityShipped}</span>
                        </div>
                      )}
                      {selectedTransfer.status === "RECEIVED" && (
                        <div>
                          <span className="block text-[10px] text-[#526B91] font-bold">RECEIVED:</span>
                          <span className="font-bold text-green-400">{item.quantityReceived}</span>
                        </div>
                      )}
                    </div>

                    {/* Action inputs */}
                    {selectedTransfer.status === "APPROVED" && canShipOrReceive && (
                      <div className="mt-3">
                        <label className="text-[10px] text-[#526B91] block font-bold mb-1">SHIPPED QTY:</label>
                        <input 
                          type="number"
                          value={shippedQtys[item.id] ?? item.quantityRequested}
                          onChange={(e) => setShippedQtys({ ...shippedQtys, [item.id]: Number(e.target.value) })}
                          className="w-full bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    )}

                    {selectedTransfer.status === "IN_TRANSIT" && canShipOrReceive && (
                      <div className="mt-3">
                        <label className="text-[10px] text-[#526B91] block font-bold mb-1">RECEIVED QTY:</label>
                        <input 
                          type="number"
                          value={receivedQtys[item.id] ?? item.quantityShipped}
                          onChange={(e) => setReceivedQtys({ ...receivedQtys, [item.id]: Number(e.target.value) })}
                          className="w-full bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 border-t border-[#D8E8FA] pt-4">
                {selectedTransfer.status === "REQUESTED" && canApprove && (
                  <button 
                    disabled={approveTransferMutation.isPending}
                    onClick={() => approveTransferMutation.mutate(selectedTransfer.id)}
                    className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {approveTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve Transfer
                  </button>
                )}

                {selectedTransfer.status === "APPROVED" && canShipOrReceive && (
                  <button 
                    disabled={shipTransferMutation.isPending}
                    onClick={() => {
                      const payload = selectedTransfer.items.map((item: any) => ({
                        itemId: item.id,
                        quantityShipped: shippedQtys[item.id] ?? item.quantityRequested
                      }));
                      shipTransferMutation.mutate({ id: selectedTransfer.id, shippedItems: payload });
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {shipTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                    Dispatch / Ship items
                  </button>
                )}

                {selectedTransfer.status === "IN_TRANSIT" && canShipOrReceive && (
                  <button 
                    disabled={receiveTransferMutation.isPending}
                    onClick={() => {
                      const payload = selectedTransfer.items.map((item: any) => ({
                        itemId: item.id,
                        quantityReceived: receivedQtys[item.id] ?? item.quantityShipped
                      }));
                      receiveTransferMutation.mutate({ id: selectedTransfer.id, receivedItems: payload });
                    }}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {receiveTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                    Receive items in inventory
                  </button>
                )}

                {["REQUESTED", "APPROVED"].includes(selectedTransfer.status) && (
                  <button 
                    disabled={cancelTransferMutation.isPending}
                    onClick={() => cancelTransferMutation.mutate(selectedTransfer.id)}
                    className="w-full py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {cancelTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                    Cancel Request
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-3xl border border-[#D8E8FA] text-center text-[#526B91] text-sm py-16">
              Select a transfer manifest to audit details and gate lifecycle actions.
            </div>
          )}
        </div>

      </div>

      {/* Creation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#061B3A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#D8E8FA] rounded-3xl p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0B2148]">Create Transfer Request</h2>
                <p className="text-xs text-[#526B91]">Initialize a structured inter-warehouse stock relocation request.</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Warehouses Select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-[#526B91] block mb-2 uppercase">Origin Warehouse</label>
                  <select 
                    value={originWarehouseId}
                    onChange={(e) => {
                      setOriginWarehouseId(e.target.value);
                      // Clear items location logic if warehouse changes
                      setItems([{ materialId: "", quantityRequested: 1, originLocationId: "", destinationLocationId: "" }]);
                    }}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-3 text-sm text-[#0B2148]"
                    required
                  >
                    <option value="" disabled className="bg-white text-[#0B2148]">Select Warehouse</option>
                    {warehouses?.map((w: any) => (
                      <option key={w.id} value={w.id} className="bg-white text-[#0B2148]">{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#526B91] block mb-2 uppercase">Destination Warehouse</label>
                  <select 
                    value={destinationWarehouseId}
                    onChange={(e) => {
                      setDestinationWarehouseId(e.target.value);
                      // Clear destination location logic
                      setItems([{ materialId: "", quantityRequested: 1, originLocationId: "", destinationLocationId: "" }]);
                    }}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-3 text-sm text-[#0B2148]"
                    required
                  >
                    <option value="" disabled className="bg-white text-[#0B2148]">Select Warehouse</option>
                    {warehouses?.map((w: any) => (
                      <option key={w.id} value={w.id} className="bg-white text-[#0B2148]">{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0B2148] uppercase tracking-wider">Item Manifest</h3>
                  <button 
                    type="button"
                    onClick={handleAddItem}
                    disabled={!originWarehouseId || !destinationWarehouseId}
                    className="px-4 py-1.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] rounded-lg text-[10px] font-bold border border-[#D8E8FA] disabled:opacity-50"
                  >
                    + Add Item
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="p-4 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA] grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    
                    {/* Material Select */}
                    <div className="md:col-span-1">
                      <label className="text-[10px] font-bold text-[#526B91] block mb-1 uppercase">Material SKU</label>
                      <select 
                        value={item.materialId}
                        onChange={(e) => handleItemChange(index, "materialId", e.target.value)}
                        className="w-full bg-white border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148]"
                        required
                      >
                        <option value="" disabled>Select SKU</option>
                        {materials?.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.sku} - {m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Origin Location Select */}
                    <div>
                      <label className="text-[10px] font-bold text-[#526B91] block mb-1 uppercase">Origin Bin</label>
                      <select 
                        value={item.originLocationId}
                        onChange={(e) => handleItemChange(index, "originLocationId", e.target.value)}
                        className="w-full bg-white border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148]"
                        required
                        disabled={!originWarehouseId}
                      >
                        <option value="" disabled>Select Bin</option>
                        {originWarehouse?.locations?.map((l: any) => (
                          <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                        ))}
                      </select>
                    </div>

                    {/* Destination Location Select */}
                    <div>
                      <label className="text-[10px] font-bold text-[#526B91] block mb-1 uppercase">Dest Bin</label>
                      <select 
                        value={item.destinationLocationId}
                        onChange={(e) => handleItemChange(index, "destinationLocationId", e.target.value)}
                        className="w-full bg-white border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148]"
                        required
                        disabled={!destinationWarehouseId}
                      >
                        <option value="" disabled>Select Bin</option>
                        {destinationWarehouse?.locations?.map((l: any) => (
                          <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity & Delete */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-[#526B91] block mb-1 uppercase">Qty</label>
                        <input 
                          type="number"
                          min="1"
                          value={item.quantityRequested}
                          onChange={(e) => handleItemChange(index, "quantityRequested", Number(e.target.value))}
                          className="w-full bg-white border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148]"
                          required
                        />
                      </div>

                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 mt-5 border border-rose-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-[#526B91] block mb-2 uppercase font-display">Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-3 text-sm text-[#0B2148] placeholder-[#64748B] h-24 resize-none focus:outline-none"
                  placeholder="Specify transit requirements or special cargo instructions..."
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#D8E8FA]">
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2.5 rounded-xl bg-[#F4F9FF] text-[#0B2148] text-xs font-bold hover:bg-[#EAF5FF] border border-[#D8E8FA] transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={createTransferMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0878F9]/90 transition-all flex items-center gap-2 shadow-md shadow-[#0878F9]/20"
                >
                  {createTransferMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Request
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
