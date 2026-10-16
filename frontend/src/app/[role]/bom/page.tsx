"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Layers, 
  Plus, 
  Search, 
  Box, 
  Loader2, 
  CheckCircle2, 
  X,
  Package,
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  Info,
  Trash2,
  Edit
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function BOMPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.roles?.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isInventoryManager = (session?.user as any)?.roles?.includes("INVENTORY_MANAGER");
  const canEdit = isAdmin || isInventoryManager;
  
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [bomName, setBomName] = useState("");
  const [kitQuantity, setKitQuantity] = useState(1);
  const [selectedItems, setSelectedItems] = useState<{ materialId: string, quantity: number, name: string, stock: number }[]>([]);
  const [editingBom, setEditingBom] = useState<any>(null);
  
  const queryClient = useQueryClient();

  useEffect(() => { setMounted(true); }, []);

  const { data: materials } = useQuery({
    queryKey: ["materials-for-bom"],
    queryFn: async () => {
      const res = await api.get("/inventory/materials");
      return res.data;
    },
    enabled: mounted,
  });

  const { data: boms, isLoading: bomsLoading } = useQuery({
    queryKey: ["boms"],
    queryFn: async () => {
      const res = await api.get("/bom");
      return res.data;
    },
    enabled: mounted,
  });

  const createBomMutation = useMutation({
    mutationFn: (data: any) => api.post("/bom", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      queryClient.invalidateQueries({ queryKey: ["materials-for-bom"] });
      toast.success(`Successfully created and deducted inventory for ${kitQuantity} kits.`);
      setShowCreateModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create BOM batch");
    }
  });

  const deleteBomMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bom/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      toast.success("BOM batch deleted successfully");
    },
    onError: (err: any) => toast.error("Failed to delete BOM")
  });

  const updateBomMutation = useMutation({
    mutationFn: (data: { id: string, name: string, description: string, items: { materialId: string, quantity: number }[] }) => 
      api.patch(`/bom/${data.id}`, { name: data.name, description: data.description, items: data.items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      toast.success("BOM updated successfully");
      setShowEditModal(false);
    }
  });

  const resetForm = () => {
    setBomName("");
    setKitQuantity(1);
    setSelectedItems([]);
  };

  const addItem = (mat: any) => {
    if (selectedItems.find(i => i.materialId === mat.id)) return;
    setSelectedItems([...selectedItems, { 
      materialId: mat.id, 
      quantity: 1, 
      name: mat.name, 
      stock: mat.quantity 
    }]);
  };

  const updateQty = (id: string, qty: number) => {
    setSelectedItems(selectedItems.map(i => i.materialId === id ? { ...i, quantity: qty } : i));
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.materialId !== id));
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <Layers className="w-8 h-8 text-accent" />
            Bill of Materials (BOM)
          </h1>
          <p className="text-[#526B91] mt-2">Bundle materials into kits and automatically manage inventory consumption.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-accent/20"
        >
          <Plus className="w-5 h-5" />
          Assemble New Batch
        </button>
      </div>

      {bomsLoading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-xs font-bold text-[#526B91] uppercase tracking-widest">Loading Assembly History...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(boms || []).map((bom: any) => (
            <div key={bom.id} className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] hover:border-accent/20 transition-all group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-accent/10 transition-all" />
              
              <div className="flex items-center justify-between mb-6 relative">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#F4F9FF] rounded-xl flex items-center justify-center text-accent border border-[#D8E8FA]">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B2148] leading-tight">{bom.name}</h3>
                    <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mt-1">Processed {new Date(bom.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <button 
                        onClick={() => { 
                          setEditingBom(bom); 
                          setBomName(bom.name);
                          setSelectedItems(bom.items.map((i: any) => {
                            const mat = materials?.find((m: any) => m.id === i.material.id);
                            return {
                              materialId: i.material.id,
                              quantity: i.quantity,
                              name: i.material.name,
                              stock: mat ? mat.quantity : 0
                            };
                          }));
                          setShowEditModal(true); 
                        }}
                        className="p-2 hover:bg-[#EAF5FF] rounded-lg text-[#526B91] hover:text-white transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button 
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this BOM batch? This will NOT return materials to stock.")) {
                            deleteBomMutation.mutate(bom.id);
                          }
                        }}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-[#526B91] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
              </div>
              
              <div className="space-y-3 mb-6 relative">
                {bom.items.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-xs bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA]">
                    <span className="text-[#526B91] truncate pr-4">{item.material.name}</span>
                    <span className="text-[#0B2148] font-mono font-bold">x{item.quantity}</span>
                  </div>
                ))}
                {bom.items.length > 3 && <p className="text-[10px] text-[#526B91] font-bold italic pl-2">+{bom.items.length - 3} more items...</p>}
              </div>

              <div className="pt-4 border-t border-[#D8E8FA] relative">
                <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mb-1">Batch Trace ID</p>
                <p className="text-xs font-mono text-[#526B91] truncate">{bom.id}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit BOM Modal */}
      <AnimatePresence>
        {showEditModal && editingBom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowEditModal(false); resetForm(); }} className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-[98vw] h-[92vh] flex flex-col rounded-3xl relative z-10 border border-[#D8E8FA] overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-[#D8E8FA] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                    <Edit className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-[#0B2148] tracking-tight">Edit Production Batch</h2>
                    <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mt-0.5">Update BOM and Components</p>
                  </div>
                </div>
                <button onClick={() => { setShowEditModal(false); resetForm(); }} className="p-2 hover:bg-[#F4F9FF] rounded-lg text-[#526B91] transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Material Selection (Left Side) */}
                <div className="w-4/12 p-6 border-r border-[#D8E8FA] overflow-auto space-y-4 bg-[#020617]/50">
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                    <input placeholder="Search catalog..." className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-xs focus:border-accent/30 focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-3">
                    {(materials || []).filter((mat: any) => mat.isPriceVerified).map((mat: any) => (
                      <div 
                        key={mat.id} 
                        onClick={() => addItem(mat)} 
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                          selectedItems.find(i => i.materialId === mat.id) 
                          ? "bg-accent/5 border-accent/20 opacity-50 pointer-events-none" 
                          : "bg-white/[0.01] border-[#D8E8FA] hover:border-accent/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F4F9FF] flex items-center justify-center text-[#526B91] group-hover:text-accent transition-colors">
                            <Box className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs text-[#0B2148] font-bold group-hover:text-[#0B2148]">{mat.name}</p>
                            <p className="text-[9px] text-[#526B91] font-bold uppercase tracking-wider">{mat.sku} • Stock: <span className={mat.quantity <= mat.minStock ? "text-red-500" : "text-emerald-500"}>{mat.quantity}</span></p>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-800 group-hover:text-accent transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Batch Configuration (Right Side) */}
                <div className="w-8/12 p-8 bg-white/[0.01] overflow-auto flex flex-col">
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="col-span-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1">Batch Label / Reference</label>
                      <input 
                        value={bomName}
                        onChange={e => setBomName(e.target.value)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/30 focus:outline-none transition-all" 
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1">Description / Notes</label>
                      <textarea 
                        value={editingBom.description || ""}
                        onChange={e => setEditingBom({ ...editingBom, description: e.target.value })}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/30 focus:outline-none transition-all h-[46px]" 
                      />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Selected Components</label>
                    </div>
                    
                    <div className="flex-1 overflow-auto space-y-2 pr-2">
                      {selectedItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 border border-[#D8E8FA] border-dashed rounded-3xl">
                          <Package className="w-12 h-12 text-slate-800 mb-3" />
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">No Selection</p>
                        </div>
                      )}
                      
                      {selectedItems.map((item) => {
                        return (
                          <motion.div 
                            key={item.materialId} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-4 p-3 rounded-xl border bg-[#F4F9FF] border-[#D8E8FA] transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-[#0B2148] truncate">{item.name}</p>
                              <p className="text-[9px] text-[#526B91] font-bold uppercase">In Stock: {item.stock}</p>
                            </div>
                            
                            <div className="flex items-center bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] p-0.5">
                              <button onClick={() => updateQty(item.materialId, Math.max(1, item.quantity - 1))} className="px-2 py-1 text-[#526B91] hover:text-white">-</button>
                              <span className="w-8 text-center text-[10px] font-mono font-bold text-[#0B2148]">{item.quantity}</span>
                              <button onClick={() => updateQty(item.materialId, item.quantity + 1)} className="px-2 py-1 text-[#526B91] hover:text-white">+</button>
                            </div>

                            <button onClick={() => removeItem(item.materialId)} className="p-1.5 text-slate-700 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-[#D8E8FA] flex items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="w-4 h-4" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">Inventory is not auto-adjusted on edit.</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => updateBomMutation.mutate({ id: editingBom.id, name: bomName, description: editingBom.description, items: selectedItems })}
                      disabled={!bomName || selectedItems.length === 0 || updateBomMutation.isPending}
                      className="px-12 py-3 bg-accent hover:bg-accent/90 disabled:opacity-30 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center gap-2 text-xs uppercase tracking-widest"
                    >
                      {updateBomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Save Changes</span></>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create BOM Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-[98vw] h-[92vh] flex flex-col rounded-3xl relative z-10 border border-[#D8E8FA] overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-[#D8E8FA] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-[#0B2148] tracking-tight">Assemble Production Batch</h2>
                    <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest mt-0.5">Industrial Assembly Pipeline</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-[#F4F9FF] rounded-lg text-[#526B91] transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Material Selection (Left Side) */}
                <div className="w-4/12 p-6 border-r border-[#D8E8FA] overflow-auto space-y-4 bg-[#020617]/50">
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                    <input placeholder="Search catalog..." className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-xs focus:border-accent/30 focus:outline-none transition-all" />
                  </div>
                  <div className="space-y-3">
                    {(materials || []).filter((mat: any) => mat.isPriceVerified).map((mat: any) => (
                      <div 
                        key={mat.id} 
                        onClick={() => addItem(mat)} 
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                          selectedItems.find(i => i.materialId === mat.id) 
                          ? "bg-accent/5 border-accent/20 opacity-50 pointer-events-none" 
                          : "bg-white/[0.01] border-[#D8E8FA] hover:border-accent/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#F4F9FF] flex items-center justify-center text-[#526B91] group-hover:text-accent transition-colors">
                            <Box className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs text-[#0B2148] font-bold group-hover:text-[#0B2148]">{mat.name}</p>
                            <p className="text-[9px] text-[#526B91] font-bold uppercase tracking-wider">{mat.sku} • Stock: <span className={mat.quantity <= mat.minStock ? "text-red-500" : "text-emerald-500"}>{mat.quantity}</span></p>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-800 group-hover:text-accent transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Batch Configuration (Right Side) */}
                <div className="w-8/12 p-8 bg-white/[0.01] overflow-auto flex flex-col">
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1">Batch Label / Reference</label>
                      <input 
                        value={bomName}
                        onChange={e => setBomName(e.target.value)}
                        placeholder="e.g. Standard 13S Kit #001" 
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/30 focus:outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1">Batch Size (Kits)</label>
                      <div className="flex items-center bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl overflow-hidden h-[46px]">
                        <button onClick={() => setKitQuantity(Math.max(1, kitQuantity - 1))} className="w-12 h-full hover:bg-[#F4F9FF] text-[#526B91]">-</button>
                        <input 
                          type="number"
                          value={kitQuantity}
                          onChange={e => setKitQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="flex-1 bg-transparent text-center text-sm font-bold text-white focus:outline-none"
                        />
                        <button onClick={() => setKitQuantity(kitQuantity + 1)} className="w-12 h-full hover:bg-[#F4F9FF] text-[#526B91]">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Selected Components</label>
                    </div>
                    
                    <div className="flex-1 overflow-auto space-y-2 pr-2">
                      {selectedItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 border border-[#D8E8FA] border-dashed rounded-3xl">
                          <Package className="w-12 h-12 text-slate-800 mb-3" />
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">No Selection</p>
                        </div>
                      )}
                      
                      {selectedItems.map((item) => {
                        const totalNeeded = item.quantity * kitQuantity;
                        const isInsufficient = item.stock < totalNeeded;

                        return (
                          <motion.div 
                            key={item.materialId} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                              isInsufficient ? "bg-red-500/5 border-red-500/10" : "bg-[#F4F9FF] border-[#D8E8FA]"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-[#0B2148] truncate">{item.name}</p>
                              <p className="text-[9px] text-[#526B91] font-bold uppercase">In Stock: {item.stock}</p>
                            </div>
                            
                            <div className="flex items-center bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] p-0.5">
                              <button onClick={() => updateQty(item.materialId, Math.max(1, item.quantity - 1))} className="px-2 py-1 text-[#526B91] hover:text-white">-</button>
                              <span className="w-8 text-center text-[10px] font-mono font-bold text-[#0B2148]">{item.quantity}</span>
                              <button onClick={() => updateQty(item.materialId, item.quantity + 1)} className="px-2 py-1 text-[#526B91] hover:text-white">+</button>
                            </div>

                            <div className="w-20 text-right">
                              <p className={`text-xs font-mono font-bold ${isInsufficient ? "text-red-500" : "text-accent"}`}>
                                {totalNeeded}
                              </p>
                            </div>

                            <button onClick={() => removeItem(item.materialId)} className="p-1.5 text-slate-700 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-[#D8E8FA] flex items-center justify-between gap-6">
                    <div className="flex-1">
                      {selectedItems.some(i => i.quantity * kitQuantity > i.stock) ? (
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertTriangle className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Insufficient Stock</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[#526B91]">
                          <Info className="w-4 h-4" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">Stock will be auto-deducted</p>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => createBomMutation.mutate({ name: bomName, kitQuantity, items: selectedItems })}
                      disabled={!bomName || selectedItems.length === 0 || selectedItems.some(i => i.quantity * kitQuantity > i.stock) || createBomMutation.isPending}
                      className="px-12 py-3 bg-accent hover:bg-accent/90 disabled:opacity-30 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center gap-2 text-xs uppercase tracking-widest"
                    >
                      {createBomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Finalize Batch</span></>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
