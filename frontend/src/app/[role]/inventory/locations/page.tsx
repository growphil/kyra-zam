"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  MapPin, 
  Plus, 
  X, 
  Loader2, 
  Building2, 
  Warehouse, 
  Archive, 
  Boxes
} from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";

export default function WarehouseLocationsPage() {
  const queryClient = useQueryClient();

  // Dialog/Modal states
  const [isWHOpen, setIsWHOpen] = useState(false);
  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [whAddress, setWhAddress] = useState("");

  const [isLocOpen, setIsLocOpen] = useState(false);
  const [selectedWHId, setSelectedWHId] = useState("");
  const [locName, setLocName] = useState("");
  const [locCode, setLocCode] = useState("");

  // --- DATA FETCHING ---
  const { data: warehouses, isLoading: isWHLoding } = useQuery({
    queryKey: ["inventory-warehouses"],
    queryFn: async () => (await api.get("/inventory/warehouses")).data
  });

  const { data: balances, isLoading: isBalLoading } = useQuery({
    queryKey: ["inventory-location-balances"],
    queryFn: async () => (await api.get("/inventory/location-balances")).data
  });

  // --- MUTATIONS ---
  const createWHMutation = useMutation({
    mutationFn: (data: any) => api.post("/inventory/warehouses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      toast.success("Warehouse created successfully");
      setIsWHOpen(false);
      setWhName("");
      setWhCode("");
      setWhAddress("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Warehouse creation failed")
  });

  const createLocMutation = useMutation({
    mutationFn: (data: { warehouseId: string; name: string; code: string }) => 
      api.post(`/inventory/warehouses/${data.warehouseId}/locations`, { name: data.name, code: data.code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      toast.success("Warehouse Location Bin created");
      setIsLocOpen(false);
      setSelectedWHId("");
      setLocName("");
      setLocCode("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Location creation failed")
  });

  return (
    <div className="space-y-4 max-w-[1600px] pb-8">
      {/* Header */}
      <PageHeader
        title="Warehouse Locations"
        subtitle="Locations & Balances Directory"
        icon={<MapPin className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => setIsWHOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0B2148] font-bold text-xs border border-[#D8E8FA] hover:border-[#0878F9]/30 transition-all cursor-pointer shadow-xs"
            >
              <Building2 className="w-4 h-4 text-[#0878F9]" />
              Add Warehouse
            </button>
            <button 
              onClick={() => setIsLocOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Add Location Bin
            </button>
          </div>
        }
      />

      {/* Main layout splits: left warehouses tree, right material balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Warehouses Tree */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
          <h3 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA] flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-accent" />
            Warehouse Directories
          </h3>
          
          {isWHLoding ? (
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
          ) : warehouses?.length > 0 ? (
            <div className="space-y-4">
              {warehouses.map((w: any) => (
                <div key={w.id} className="p-4 rounded-xl border border-[#D8E8FA] bg-white/[0.01]">
                  <p className="font-bold text-[#0B2148] text-sm">{w.name}</p>
                  <p className="text-[10px] text-[#526B91] font-semibold font-mono">Code: {w.code}</p>
                  {w.address && <p className="text-[10px] text-[#526B91] mt-1">{w.address}</p>}

                  {/* Locations */}
                  <div className="mt-3 pl-4 border-l border-[#D8E8FA] space-y-1 text-xs text-[#526B91] font-mono">
                    {w.locations?.length > 0 ? (
                      w.locations.map((loc: any) => (
                        <div key={loc.id} className="flex items-center gap-1.5 py-0.5">
                          <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                          <span>{loc.name} ({loc.code})</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-[#526B91]">No Bins registered</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#526B91] text-center">No Warehouses Registered</p>
          )}
        </div>

        {/* Right: Location Balances Grid */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
          <h3 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA] flex items-center gap-2">
            <Boxes className="w-4 h-4 text-accent" />
            Material Location Stock Balances
          </h3>

          {isBalLoading ? (
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
          ) : balances?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider">
                    <th className="pb-3">Material SKU / Name</th>
                    <th className="pb-3">Warehouse</th>
                    <th className="pb-3">Location Bin</th>
                    <th className="pb-3 text-right">Physical Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                  {balances.map((b: any) => (
                    <tr key={b.id}>
                      <td className="py-3">
                        <div className="font-bold text-white">{b.material?.name}</div>
                        <div className="text-[10px] text-[#526B91] font-mono mt-0.5">SKU: {b.material?.sku}</div>
                      </td>
                      <td className="py-3 text-[#526B91]">{b.warehouse?.name}</td>
                      <td className="py-3 font-mono text-[#526B91]">{b.location?.name} ({b.location?.code})</td>
                      <td className="py-3 text-right font-bold text-[#0B2148] font-mono">{b.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#526B91] text-center py-10">No stock balances registered inside location Bins.</p>
          )}
        </div>
      </div>

      {/* Warehouse create Dialog */}
      {isWHOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-[#0B2148]">Create Warehouse</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Warehouse Name *</label>
                <input 
                  type="text"
                  required
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Warehouse Code *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. WH-01"
                  value={whCode}
                  onChange={(e) => setWhCode(e.target.value)}
                  className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Address</label>
                <input 
                  type="text"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsWHOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  if (!whName || !whCode) return;
                  createWHMutation.mutate({ name: whName, code: whCode, address: whAddress });
                }}
                disabled={createWHMutation.isPending}
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                Confirm Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Create Dialog */}
      {isLocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-[#0B2148]">Create Warehouse Location Bin</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Select Warehouse *</label>
                <select
                  value={selectedWHId}
                  onChange={(e) => setSelectedWHId(e.target.value)}
                  className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-[#0B2148]"
                >
                  <option value="">Select Target Warehouse</option>
                  {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Location Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Row A Bin 1"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Location Code *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. RA-B1"
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value)}
                  className="w-full mt-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsLocOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] text-xs font-bold">Cancel</button>
              <button 
                onClick={() => {
                  if (!selectedWHId || !locName || !locCode) return;
                  createLocMutation.mutate({ warehouseId: selectedWHId, name: locName, code: locCode });
                }}
                disabled={createLocMutation.isPending}
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                Confirm Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
