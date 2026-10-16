"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Box, 
  Loader2, 
  RefreshCcw,
  X,
  CheckCircle2,
  FileText,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Check,
  Clipboard,
  AlertCircle,
  Clock,
  Trash2,
  Play,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

interface ServiceBattery {
  id: string;
  serviceId: string;
  serialNumber: string;
  customerName: string;
  batteryModel: string;
  issueDescription: string;
  status: string;
  createdAt: string;
  version: number;
}

interface Material {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export default function AssemblyServicePage() {
  const { data: session } = useSession();
  
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isAssemblyTech = userRoles.includes("ASSEMBLY_TECHNICIAN");
  const canManageAssy = isAdmin || isAssemblyTech;

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState<"diagnose" | "material" | "scrap" | "hold" | null>(null);
  const [selectedBattery, setSelectedBattery] = useState<ServiceBattery | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<{materialId: string, quantity: number}[]>([]);
  const queryClient = useQueryClient();

  const [diagnosisData, setDiagnosisData] = useState({
    notes: "",
    status: "DIAGNOSIS_PENDING",
    serviceType: ""
  });

  const [scrapReason, setScrapReason] = useState("");
  const [scrapRemarks, setScrapRemarks] = useState("");
  const [holdReason, setHoldReason] = useState("");

  useEffect(() => { setMounted(true); }, []);

  // Fetch active service batteries assigned to assembly
  const { data: batteries, isLoading, refetch } = useQuery({
    queryKey: ["service-batteries-assy"],
    queryFn: async () => {
      const res = await api.get("/service/battery");
      return res.data.filter((b: ServiceBattery) => 
        [
          "RECEIVED", "DIAGNOSIS_PENDING", "DIAGNOSIS_COMPLETED", 
          "ESTIMATE_GENERATED", "WAITING_FOR_CUSTOMER_APPROVAL",
          "MATERIAL_REQUESTED", "MATERIAL_APPROVED", "MATERIAL_ISSUED", 
          "REPAIR_IN_PROGRESS", "REPAIR_COMPLETED", "QC_PENDING", 
          "QC_IN_PROGRESS", "TEST_FAILED", "ON_HOLD", "REOPENED"
        ].includes(b.status)
      );
    },
    enabled: mounted,
  });

  // Fetch Materials for request
  const { data: materials } = useQuery({
    queryKey: ["materials-for-request"],
    queryFn: async () => {
      const res = await api.get("/inventory/materials");
      return res.data;
    },
    enabled: mounted && showModal === "material",
  });

  // Fetch pricing rules for select list
  const { data: pricingRules } = useQuery({
    queryKey: ["service-pricing-rules-selection"],
    queryFn: async () => {
      const res = await api.get("/service/pricing-master");
      return (res.data as any[]).filter(r => r.isActive);
    },
    enabled: mounted && showModal === "diagnose",
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: string, notes?: string, serviceType?: string, holdReason?: string, version: number }) => 
      api.patch(`/service/battery/${selectedBattery?.id}/status`, {
        status: data.status,
        notes: data.notes,
        serviceType: data.serviceType,
        holdReason: data.holdReason,
        version: data.version
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-assy"] });
      toast.success("Status updated successfully");
      closeModal();
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast.error("Stale database state. Please refresh the page and try again.");
      } else {
        toast.error(err.response?.data?.error || "Operation failed");
      }
    }
  });

  const materialRequestMutation = useMutation({
    mutationFn: (data: any) => api.post("/service/material-request", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-assy"] });
      toast.success("Material request submitted successfully");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to submit request")
  });

  const scrapRecommendMutation = useMutation({
    mutationFn: () => api.post("/service/scrap-recommend", {
      serviceBatteryId: selectedBattery?.id,
      reason: scrapReason,
      remarks: scrapRemarks
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-assy"] });
      toast.success("Scrap recommendation submitted for admin review");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to submit recommendation")
  });

  const closeModal = () => {
    setShowModal(null);
    setSelectedBattery(null);
    setSelectedMaterials([]);
    setScrapReason("");
    setScrapRemarks("");
    setHoldReason("");
    setDiagnosisData({ notes: "", status: "DIAGNOSIS_PENDING", serviceType: "" });
  };

  if (!mounted) return null;

  const filteredBatteries = (batteries || []).filter((b: ServiceBattery) => {
    return b.customerName.toLowerCase().includes(search.toLowerCase()) || 
      b.serviceId.toLowerCase().includes(search.toLowerCase()) ||
      b.batteryModel.toLowerCase().includes(search.toLowerCase());
  });

  const handleMaterialSelect = (materialId: string) => {
    const exists = selectedMaterials.find(m => m.materialId === materialId);
    if (exists) {
      setSelectedMaterials(selectedMaterials.filter(m => m.materialId !== materialId));
    } else {
      setSelectedMaterials([...selectedMaterials, { materialId, quantity: 1 }]);
    }
  };

  const handleQuantityChange = (materialId: string, quantity: number) => {
    setSelectedMaterials(selectedMaterials.map(m => 
      m.materialId === materialId ? { ...m, quantity: Math.max(1, quantity) } : m
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <Wrench className="w-7 h-7 text-accent" />
            Assembly Service Terminal
          </h1>
          <p className="text-xs text-[#526B91] mt-1 uppercase tracking-widest font-bold">Diagnosis & Repair Workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="p-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-white transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer or Service ID..." 
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-sm focus:border-accent/30 focus:outline-none transition-all placeholder:text-slate-700" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Assigned Batteries...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Battery Model</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {filteredBatteries.map((bat: ServiceBattery) => (
                <tr key={bat.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148] group-hover:text-[#0B2148] transition-colors">{bat.serviceId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148]">{bat.customerName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-[#526B91]">{bat.batteryModel}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-block ${
                      bat.status === "RECEIVED" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      bat.status === "DIAGNOSIS_PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      bat.status === "DIAGNOSIS_COMPLETED" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                      bat.status === "MATERIAL_REQUESTED" ? "bg-pink-500/10 text-pink-400 border-pink-500/20" :
                      bat.status === "REPAIR_IN_PROGRESS" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                      bat.status === "REPAIR_COMPLETED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      bat.status === "TEST_FAILED" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      bat.status === "ON_HOLD" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                      "bg-slate-500/10 text-[#526B91] border-slate-500/20"
                    }`}>
                      {bat.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {/* Global Hold state toggles */}
                      {bat.status !== "ON_HOLD" && (
                        <button 
                          onClick={() => { setSelectedBattery(bat); setShowModal("hold"); }}
                          className="px-2.5 py-1 bg-[#F4F9FF] border border-[#D8E8FA] hover:bg-[#EAF5FF] text-[#526B91] rounded-lg text-xs"
                        >
                          Hold
                        </button>
                      )}
                      {bat.status === "ON_HOLD" && (
                        <button 
                          onClick={() => {
                            setSelectedBattery(bat);
                            updateStatusMutation.mutate({ status: "RESUME", version: bat.version });
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                        >
                          Resume
                        </button>
                      )}

                      {bat.status === "RECEIVED" && (
                        <button 
                          onClick={() => {
                            setSelectedBattery(bat);
                            updateStatusMutation.mutate({ status: "DIAGNOSIS_PENDING", notes: "Diagnosis started", version: bat.version });
                          }}
                          className="px-3 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Start Diagnosis
                        </button>
                      )}
                      
                      {bat.status === "DIAGNOSIS_PENDING" && (
                        <>
                          <button 
                            onClick={() => { setSelectedBattery(bat); setShowModal("diagnose"); }}
                            className="px-3 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Complete Diagnosis
                          </button>
                          <button 
                            onClick={() => { setSelectedBattery(bat); setShowModal("scrap"); }}
                            className="px-3 py-1.5 bg-red-650/10 hover:bg-red-650 text-red-400 hover:text-white rounded-lg text-xs font-bold"
                          >
                            Recommend Scrap
                          </button>
                        </>
                      )}

                      {bat.status === "DIAGNOSIS_COMPLETED" && (
                        <span className="text-[10px] text-[#526B91] italic uppercase font-bold tracking-wider mr-2">Waiting for estimate & approval</span>
                      )}

                      {bat.status === "MATERIAL_REQUESTED" && (
                        <button 
                          onClick={() => { setSelectedBattery(bat); setShowModal("material"); }}
                          className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Request Materials
                        </button>
                      )}

                      {bat.status === "MATERIAL_APPROVED" && (
                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mr-2">Waiting for stock issuance</span>
                      )}

                      {bat.status === "REPAIR_IN_PROGRESS" && (
                        <button 
                          onClick={() => {
                            setSelectedBattery(bat);
                            updateStatusMutation.mutate({ status: "REPAIR_COMPLETED", notes: "Repair completed", version: bat.version });
                          }}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Complete Repair
                        </button>
                      )}

                      {bat.status === "REPAIR_COMPLETED" && (
                        <button 
                          onClick={() => {
                            setSelectedBattery(bat);
                            updateStatusMutation.mutate({ status: "QC_PENDING", notes: "Submitted for QC test", version: bat.version });
                          }}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Request QC Testing
                        </button>
                      )}

                      {bat.status === "TEST_FAILED" && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedBattery(bat);
                              updateStatusMutation.mutate({ status: "REPAIR_IN_PROGRESS", notes: "Rework started after QC failure", version: bat.version });
                            }}
                            className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Start Rework
                          </button>
                          <button 
                            onClick={() => { setSelectedBattery(bat); setShowModal("scrap"); }}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Recommend Scrap
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Diagnosis Modal */}
      <AnimatePresence>
        {showModal === "diagnose" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><ClipboardList className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Battery Diagnosis</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="text-xs text-[#526B91]">Service ID: <span className="text-[#0B2148] font-bold">{selectedBattery?.serviceId}</span></p>
                  <p className="text-xs text-[#526B91]">Reported Issue: <span className="text-[#0B2148] font-medium">{selectedBattery?.issueDescription}</span></p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Service Type</label>
                  <select 
                    value={diagnosisData.serviceType}
                    onChange={e => setDiagnosisData({...diagnosisData, serviceType: e.target.value})}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none appearance-none font-sans"
                  >
                    <option value="" className="bg-[#020617]">-- Select Repair Type --</option>
                    {(pricingRules || []).map((rule: any) => (
                      <option key={rule.id} value={rule.serviceType} className="bg-[#020617]">
                        {rule.serviceType} (Labour: ₹{Number(rule.labourCost)}, Margin: {Number(rule.marginPercentage)}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Diagnosis Notes</label>
                  <textarea 
                    value={diagnosisData.notes} 
                    onChange={e => setDiagnosisData({...diagnosisData, notes: e.target.value})} 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none h-28" 
                    placeholder="Describe the root cause and required fix..."
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => updateStatusMutation.mutate({ 
                    status: "DIAGNOSIS_COMPLETED", 
                    notes: diagnosisData.notes, 
                    serviceType: diagnosisData.serviceType,
                    version: selectedBattery?.version || 1
                  })} 
                  disabled={!diagnosisData.notes || !diagnosisData.serviceType || updateStatusMutation.isPending}
                  className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> <span>Submit Diagnosis</span></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Material Request Modal */}
      <AnimatePresence>
        {showModal === "material" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-2xl p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl font-sans">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400"><Clipboard className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Request Materials</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                <p className="text-xs text-[#526B91]">Requesting components for <span className="text-[#0B2148] font-bold">{selectedBattery?.serviceId}</span></p>

                <div className="max-h-[40vh] overflow-auto border border-[#D8E8FA] rounded-xl divide-y divide-[#E8F1FC]">
                  {(materials || []).map((mat: Material) => {
                    const isSelected = selectedMaterials.some(m => m.materialId === mat.id);
                    const selectedItem = selectedMaterials.find(m => m.materialId === mat.id);
                    
                    return (
                      <div key={mat.id} className={`p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors ${isSelected ? "bg-[#F4F9FF]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleMaterialSelect(mat.id)}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-purple-500 border-purple-500 text-white" : "border-[#D8E8FA] text-transparent"}`}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <div>
                            <p className="text-sm font-bold text-[#0B2148]">{mat.name}</p>
                            <p className="text-[10px] text-[#526B91]">Available: {mat.quantity} {mat.unit}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-[#526B91]">Qty:</label>
                            <input 
                              type="number" 
                              value={selectedItem?.quantity || 1} 
                              onChange={e => handleQuantityChange(mat.id, parseInt(e.target.value))}
                              className="w-16 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg py-1 px-2 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                              min="1"
                              max={mat.quantity}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => materialRequestMutation.mutate({ serviceBatteryId: selectedBattery?.id, items: selectedMaterials })} 
                  disabled={selectedMaterials.length === 0 || materialRequestMutation.isPending}
                  className="flex-1 bg-purple-500 hover:bg-purple-500/90 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {materialRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Clipboard className="w-4 h-4" /> <span>Send Request</span></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scrap Recommend Modal */}
      <AnimatePresence>
        {showModal === "scrap" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl font-sans">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400"><Trash2 className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Recommend Scrap</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Reason for Scrap</label>
                  <input 
                    placeholder="e.g. Critical internal corrosion, safety leak..." 
                    value={scrapReason} 
                    onChange={e => setScrapReason(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-red-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Additional Remarks</label>
                  <textarea 
                    placeholder="Details to support the recommendation..." 
                    value={scrapRemarks} 
                    onChange={e => setScrapRemarks(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-red-500/50 h-24"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => scrapRecommendMutation.mutate()} 
                  disabled={!scrapReason || scrapRecommendMutation.isPending}
                  className="flex-1 bg-red-650 hover:bg-red-700 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {scrapRecommendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Recommend Scrap</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hold Reason Modal */}
      <AnimatePresence>
        {showModal === "hold" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl font-sans">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400"><Clock className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Place Service ON HOLD</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Reason for Hold</label>
                  <input 
                    placeholder="e.g. Waiting for client response, spare parts backlog..." 
                    value={holdReason} 
                    onChange={e => setHoldReason(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => updateStatusMutation.mutate({ 
                    status: "ON_HOLD", 
                    holdReason,
                    version: selectedBattery?.version || 1
                  })} 
                  disabled={!holdReason || updateStatusMutation.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Hold Service</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
