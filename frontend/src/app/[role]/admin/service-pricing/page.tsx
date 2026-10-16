"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Loader2, 
  RefreshCcw,
  X,
  CheckCircle2,
  Settings,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface PricingRule {
  id: string;
  serviceType: string;
  labourCost: number;
  marginPercentage: number;
  description?: string;
  isActive: boolean;
}

export default function ServicePricingMasterPage() {
  const { data: session } = useSession();
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    serviceType: "",
    labourCost: 0,
    marginPercentage: 0,
    description: "",
    isActive: true
  });

  useEffect(() => { setMounted(true); }, []);

  // Fetch Pricing Master rules
  const { data: rules, isLoading, refetch } = useQuery({
    queryKey: ["service-pricing-rules"],
    queryFn: async () => {
      const res = await api.get("/service/pricing-master");
      return res.data as PricingRule[];
    },
    enabled: mounted,
  });

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (data: any) => api.post("/service/pricing-master", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-pricing-rules"] });
      toast.success("Pricing rule created successfully");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to create rule")
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.patch(`/service/pricing-master/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-pricing-rules"] });
      toast.success("Pricing rule updated successfully");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to update rule")
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string, isActive: boolean }) => api.patch(`/service/pricing-master/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-pricing-rules"] });
      toast.success("Pricing status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  const closeModal = () => {
    setShowModal(null);
    setSelectedRule(null);
    setFormData({
      serviceType: "",
      labourCost: 0,
      marginPercentage: 0,
      description: "",
      isActive: true
    });
  };

  const openModal = (mode: "create" | "edit", rule?: PricingRule) => {
    if (mode === "edit" && rule) {
      setSelectedRule(rule);
      setFormData({
        serviceType: rule.serviceType,
        labourCost: Number(rule.labourCost),
        marginPercentage: Number(rule.marginPercentage),
        description: rule.description || "",
        isActive: rule.isActive
      });
    } else {
      setFormData({
        serviceType: "",
        labourCost: 0,
        marginPercentage: 0,
        description: "",
        isActive: true
      });
    }
    setShowModal(mode);
  };

  if (!mounted) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold text-[#0B2148]">Access Denied</h2>
        <p className="text-[#526B91] text-sm">Only Administrators and Super Administrators can manage pricing configurations.</p>
      </div>
    );
  }

  const filteredRules = (rules || []).filter((rule: PricingRule) => {
    return rule.serviceType.toLowerCase().includes(search.toLowerCase()) ||
      (rule.description && rule.description.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <Settings className="w-7 h-7 text-accent" />
            Service Pricing Master
          </h1>
          <p className="text-xs text-[#526B91] mt-1 uppercase tracking-widest font-bold">Centrally configure labour & margin rates</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="p-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-white transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => openModal("create")}
            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-accent/20"
          >
            <Plus className="w-4 h-4" />
            Create Service Type
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Service Type or Description..." 
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-sm focus:border-accent/30 focus:outline-none transition-all placeholder:text-slate-700" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Pricing Rules...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service Type</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Labour Cost</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Margin (%)</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Description</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {filteredRules.map((rule: PricingRule) => (
                <tr key={rule.id} className={`hover:bg-white/[0.01] transition-colors group ${!rule.isActive ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148] group-hover:text-[#0B2148] transition-colors">{rule.serviceType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[#0B2148] font-medium">₹{Number(rule.labourCost).toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[#0B2148] font-medium">{Number(rule.marginPercentage)}%</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-[#526B91]">{rule.description || "N/A"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="p-1 rounded-lg text-[#526B91] hover:text-white transition-all"
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-[#526B91]" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openModal("edit", rule)}
                        className="p-2 rounded-lg hover:bg-[#F4F9FF] text-[#526B91] hover:text-accent transition-all"
                        title="Edit pricing rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pricing Rule Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><Settings className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">
                    {showModal === "create" ? "Add Service Pricing Rule" : "Update Pricing Rule"}
                  </h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Service Type</label>
                  <input 
                    value={formData.serviceType} 
                    onChange={e => setFormData({...formData, serviceType: e.target.value})} 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none read-only:opacity-50" 
                    readOnly={showModal === "edit"}
                    placeholder="e.g. PCB Replacement, Terminal Repair" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Labour Cost (₹)</label>
                    <input 
                      type="number"
                      value={formData.labourCost} 
                      onChange={e => setFormData({...formData, labourCost: Number(e.target.value)})} 
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Margin Percentage (%)</label>
                    <input 
                      type="number"
                      value={formData.marginPercentage} 
                      onChange={e => setFormData({...formData, marginPercentage: Number(e.target.value)})} 
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" 
                      placeholder="0.00" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Description</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none h-24" 
                    placeholder="Short description of this repair type" 
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => {
                    const trimmedData = {
                      ...formData,
                      serviceType: formData.serviceType.trim(),
                      description: formData.description?.trim()
                    };
                    if (showModal === "create") {
                      createRuleMutation.mutate(trimmedData);
                    } else if (showModal === "edit" && selectedRule) {
                      updateRuleMutation.mutate({ id: selectedRule.id, data: trimmedData });
                    }
                  }} 
                  disabled={!formData.serviceType.trim() || createRuleMutation.isPending || updateRuleMutation.isPending}
                  className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {createRuleMutation.isPending || updateRuleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Save Rule</span></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
