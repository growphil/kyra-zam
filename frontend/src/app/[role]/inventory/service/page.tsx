"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, 
  Plus, 
  Search, 
  Box, 
  Loader2, 
  RefreshCcw,
  AlertTriangle,
  X,
  CheckCircle2,
  Tag,
  Edit2,
  Trash2,
  Archive,
  Settings2,
  Layers,
  QrCode,
  Printer,
  User,
  Phone,
  Battery,
  FileText,
  Clock,
  History,
  AlertCircle,
  Undo2,
  DollarSign,
  Lock,
  Unlock,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

interface ServiceBattery {
  id: string;
  serviceId: string;
  serialNumber: string;
  customerName: string;
  customerMobile: string;
  batteryModel: string;
  originalBatterySerial?: string;
  issueDescription: string;
  status: string;
  warrantyStatus?: string;
  createdAt: string;
  version: number;
  serviceCost?: {
    materialCost: number;
    labourCost: number;
    marginPercentage: number;
    marginAmount: number;
    totalCost: number;
    amountPaid: number;
    notes?: string;
  } | null;
}

export default function ServiceInventoryPage() {
  const { data: session } = useSession();
  const params = useParams();
  const role = params?.role as string;
  
  const userRoles = (session?.user as any)?.roles || [];
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const isAdmin = userRoles.includes("ADMIN") || isSuperAdmin;
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER");
  const isTechnician = userRoles.includes("ASSEMBLY_TECHNICIAN");
  const canManageService = isAdmin || isInventoryManager;

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState<"add" | "view" | "qr" | null>(null);
  const [selectedBattery, setSelectedBattery] = useState<ServiceBattery | null>(null);
  const [createdBattery, setCreatedBattery] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"details" | "actions" | "timeline">("details");
  const queryClient = useQueryClient();

  // Add Form State
  const [formData, setFormData] = useState({
    customerName: "",
    customerMobile: "",
    batteryModel: "",
    originalBatterySerial: "",
    warrantyStatus: "IN_WARRANTY",
    batteryType: "INTERNAL",
    issueDescription: "",
    images: []
  });

  // Action States
  const [holdReason, setHoldReason] = useState("");
  const [estimateForm, setEstimateForm] = useState({
    materialCost: 0,
    labourCost: 0,
    marginAmount: 0,
    remarks: ""
  });
  const [approvalMethod, setApprovalMethod] = useState<"PHONE_CALL" | "WHATSAPP" | "EMAIL" | "IN_PERSON">("PHONE_CALL");
  const [scrapReason, setScrapReason] = useState("");
  const [scrapRemarks, setScrapRemarks] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenWarranty, setReopenWarranty] = useState(false);
  const [deliveryOverrideReason, setDeliveryOverrideReason] = useState("");

  useEffect(() => { setMounted(true); }, []);

  // Fetch Service Batteries
  const { data: batteries, isLoading, refetch } = useQuery({
    queryKey: ["service-batteries", search],
    queryFn: async () => {
      const res = await api.get("/service/battery");
      return res.data;
    },
    enabled: mounted,
  });

  // Detailed Battery fetch inside view modal
  const { data: batteryDetail, refetch: refetchDetail } = useQuery({
    queryKey: ["service-battery-detail", selectedBattery?.id],
    queryFn: async () => {
      const res = await api.get(`/service/battery/${selectedBattery?.id}`);
      return res.data;
    },
    enabled: !!selectedBattery?.id,
  });

  // Chronological timeline
  const { data: timelineData, refetch: refetchTimeline } = useQuery({
    queryKey: ["service-timeline", selectedBattery?.id],
    queryFn: async () => {
      const res = await api.get(`/service/battery/${selectedBattery?.id}/timeline`);
      return res.data;
    },
    enabled: !!selectedBattery?.id,
  });

  // Mutations
  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/service/battery", data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      toast.success("Service entry created successfully");
      setCreatedBattery(data);
      setShowModal("qr");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { status: string; holdReason?: string; version: number }) => {
      await api.patch(`/service/battery/${selectedBattery?.id}/status`, {
        status: payload.status,
        holdReason: payload.holdReason,
        version: payload.version
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success("Battery status updated successfully");
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast.error("Conflict error: Stale database state. Please refresh the page.");
      } else {
        toast.error(err.response?.data?.error || "Status update failed");
      }
    }
  });

  const createEstimateMutation = useMutation({
    mutationFn: async (data: any) => {
      const total = Number(data.materialCost) + Number(data.labourCost) + Number(data.marginAmount);
      await api.post("/service/estimate", {
        serviceBatteryId: selectedBattery?.id,
        materialCost: data.materialCost,
        labourCost: data.labourCost,
        marginAmount: data.marginAmount,
        totalEstimate: total,
        remarks: data.remarks
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success("Customer estimate generated successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to generate estimate")
  });

  const approveEstimateMutation = useMutation({
    mutationFn: async () => {
      await api.post("/service/estimate/approve", {
        serviceBatteryId: selectedBattery?.id,
        approvalMethod
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success("Estimate approved by customer");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to approve estimate")
  });

  const materialRequestActionMutation = useMutation({
    mutationFn: async (payload: { requestId: string; status: string }) => {
      await api.patch(`/service/material-request/${payload.requestId}`, {
        status: payload.status
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success(`Material request ${variables.status.toLowerCase()} successfully`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  const recommendScrapMutation = useMutation({
    mutationFn: async () => {
      await api.post("/service/scrap-recommend", {
        serviceBatteryId: selectedBattery?.id,
        reason: scrapReason,
        remarks: scrapRemarks
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success("Scrap recommendation submitted");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  const approveScrapMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      await api.post("/service/scrap-approve", {
        serviceBatteryId: selectedBattery?.id,
        approved,
        remarks: "Approved by Admin"
      });
    },
    onSuccess: (_, approved) => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success(`Scrap recommendation ${approved ? "approved" : "rejected"}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  const reopenServiceMutation = useMutation({
    mutationFn: async () => {
      await api.post("/service/reopen", {
        serviceBatteryId: selectedBattery?.id,
        reason: reopenReason,
        warrantyCovered: reopenWarranty
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success("Service reopened under warranty");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to reopen service")
  });

  const completeDeliveryMutation = useMutation({
    mutationFn: async (payload: { paymentStatus: string; overrideReason?: string }) => {
      await api.post("/service/delivery", {
        serviceBatteryId: selectedBattery?.id,
        paymentStatus: payload.paymentStatus,
        overrideReason: payload.overrideReason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries"] });
      refetchDetail();
      refetchTimeline();
      toast.success("Battery delivered successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Delivery failed")
  });

  const closeModal = () => {
    setShowModal(null);
    setSelectedBattery(null);
    setCreatedBattery(null);
    setActiveTab("details");
    setHoldReason("");
    setEstimateForm({ materialCost: 0, labourCost: 0, marginAmount: 0, remarks: "" });
    setScrapReason("");
    setScrapRemarks("");
    setReopenReason("");
    setReopenWarranty(false);
    setDeliveryOverrideReason("");
    setFormData({
      customerName: "",
      customerMobile: "",
      batteryModel: "",
      originalBatterySerial: "",
      warrantyStatus: "IN_WARRANTY",
      batteryType: "INTERNAL",
      issueDescription: "",
      images: []
    });
  };

  if (!mounted) return null;

  const filteredBatteries = (batteries || []).filter((b: ServiceBattery) => {
    return b.customerName.toLowerCase().includes(search.toLowerCase()) || 
      b.serviceId.toLowerCase().includes(search.toLowerCase()) ||
      b.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.batteryModel.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RECEIVED": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "DIAGNOSIS_PENDING": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "DIAGNOSIS_COMPLETED": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "ESTIMATE_GENERATED": return "bg-pink-500/10 text-pink-400 border-pink-500/20";
      case "WAITING_FOR_CUSTOMER_APPROVAL": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "MATERIAL_REQUESTED": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "MATERIAL_APPROVED": return "bg-violet-500/10 text-violet-400 border-violet-500/20";
      case "MATERIAL_ISSUED": return "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20";
      case "REPAIR_IN_PROGRESS": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "REPAIR_COMPLETED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "QC_PENDING": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "QC_IN_PROGRESS": return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "TEST_FAILED": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "READY_FOR_DELIVERY": return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "PAYMENT_PENDING": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "DELIVERED": return "bg-slate-500/10 text-[#526B91] border-slate-500/20";
      case "SCRAP_RECOMMENDED": return "bg-red-950/20 text-red-400 border-red-900/30";
      case "SCRAP": return "bg-red-600/10 text-red-500 border-red-500/20";
      case "CANCELLED": return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
      case "ON_HOLD": return "bg-orange-600/10 text-orange-500 border-orange-500/20";
      default: return "bg-slate-500/10 text-[#526B91] border-slate-500/20";
    }
  };

  const getDuesInfo = () => {
    if (!batteryDetail?.serviceCost) return { due: 0, hasDues: false };
    const cost = batteryDetail.serviceCost;
    const isWarranty = batteryDetail.warrantyStatus && ["true", "warranty", "in_warranty"].includes(batteryDetail.warrantyStatus.toLowerCase());
    if (isWarranty) return { due: 0, hasDues: false };

    const due = Number(cost.totalCost) - Number(cost.amountPaid);
    return { due, hasDues: due > 0 };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <Archive className="w-7 h-7 text-accent" />
            Service Battery Management
          </h1>
          <p className="text-xs text-[#526B91] mt-1 uppercase tracking-widest font-bold">Battery Service & Repair Module</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="p-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-white transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          {canManageService && (
            <button 
              onClick={() => setShowModal("add")}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-accent/20"
            >
              <Plus className="w-4 h-4" />
              Add New Battery
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer, Service ID, or Serial..." 
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-sm focus:border-accent/30 focus:outline-none transition-all placeholder:text-slate-700 animate-pulse-slow" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Service Entries...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service ID / Serial</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Battery Model</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {filteredBatteries.map((bat: ServiceBattery) => (
                <tr key={bat.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#0B2148] group-hover:text-[#0B2148] transition-colors">{bat.serviceId}</span>
                      <span className="text-[10px] font-mono text-[#526B91]">{bat.serialNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[#0B2148]">{bat.customerName}</span>
                      <span className="text-xs text-[#526B91]">{bat.customerMobile}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-[#526B91]">{bat.batteryModel}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${getStatusColor(bat.status)}`}>
                      {bat.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-[#526B91]">{new Date(bat.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => { setSelectedBattery(bat); setShowModal("view"); }} 
                        className="p-2 rounded-lg hover:bg-[#F4F9FF] text-[#526B91] hover:text-accent transition-all"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 rounded-lg hover:bg-[#F4F9FF] text-[#526B91] hover:text-accent transition-all"
                        onClick={() => { setSelectedBattery(bat); setCreatedBattery(bat); setShowModal("qr"); }}
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showModal === "add" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><Battery className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Add New Service Entry</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Customer Name</label>
                    <input value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Mobile Number</label>
                    <input value={formData.customerMobile} onChange={e => setFormData({...formData, customerMobile: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Battery Model</label>
                    <input value={formData.batteryModel} onChange={e => setFormData({...formData, batteryModel: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Original Serial No.</label>
                    <input value={formData.originalBatterySerial} onChange={e => setFormData({...formData, originalBatterySerial: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none font-mono uppercase" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Warranty Status</label>
                    <select value={formData.warrantyStatus} onChange={e => setFormData({...formData, warrantyStatus: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none appearance-none">
                      <option value="IN_WARRANTY" className="bg-[#020617]">In Warranty</option>
                      <option value="OUT_OF_WARRANTY" className="bg-[#020617]">Out of Warranty</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Battery Type</label>
                    <select value={formData.batteryType} onChange={e => setFormData({...formData, batteryType: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none appearance-none">
                      <option value="INTERNAL" className="bg-[#020617]">Internal Battery</option>
                      <option value="EXTERNAL" className="bg-[#020617]">External Battery</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Problem Description</label>
                  <textarea value={formData.issueDescription} onChange={e => setFormData({...formData, issueDescription: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none h-24" />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => createServiceMutation.mutate(formData)} 
                  disabled={!formData.customerName || !formData.customerMobile || !formData.batteryModel || createServiceMutation.isPending}
                  className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {createServiceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Create Entry</span></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* QR Modal */}
        {showModal === "qr" && createdBattery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-md p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl text-center">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-bold text-[#0B2148]">Service QR Code</h2>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div id="qr-section" className="bg-white p-6 rounded-2xl inline-block mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${createdBattery.serviceId}`} 
                  alt="QR Code"
                  className="w-48 h-48"
                />
                <p className="text-xs font-mono font-bold text-slate-900 mt-2">{createdBattery.serviceId}</p>
              </div>

              <div className="space-y-2 text-left mb-6">
                <p className="text-sm text-[#526B91]"><span className="font-bold text-[#0B2148]">Customer:</span> {createdBattery.customerName}</p>
                <p className="text-sm text-[#526B91]"><span className="font-bold text-[#0B2148]">Model:</span> {createdBattery.batteryModel}</p>
                <p className="text-sm text-[#526B91]"><span className="font-bold text-[#0B2148]">Serial:</span> {createdBattery.serialNumber}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Close</button>
                <button 
                  onClick={() => {
                    const printContent = document.getElementById("qr-section");
                    const WindowPrt = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
                    if (WindowPrt && printContent) {
                      WindowPrt.document.write(`
                        <html>
                          <head>
                            <title>Print QR Code</title>
                            <style>
                              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                              .qr-container { text-align: center; border: 1px solid #ccc; padding: 20px; border-radius: 10px; }
                              p { margin-top: 10px; font-weight: bold; font-family: monospace; }
                            </style>
                          </head>
                          <body>
                            <div class="qr-container">
                              ${printContent.innerHTML}
                            </div>
                            <script>
                              window.onload = function() {
                                window.print();
                                window.close();
                              }
                            </script>
                          </body>
                        </html>
                      `);
                      WindowPrt.document.close();
                    }
                  }} 
                  className="flex-1 bg-accent hover:bg-accent/90 py-3 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Printer className="w-4 h-4" /> <span>Print Label</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* View Modal */}
        {showModal === "view" && selectedBattery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-2xl p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><FileText className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Service Battery Manager</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-[#D8E8FA] pb-4 mb-6">
                <button onClick={() => setActiveTab("details")} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === "details" ? "bg-accent text-white" : "text-[#526B91] hover:bg-[#F4F9FF]"}`}>Details</button>
                <button onClick={() => setActiveTab("actions")} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === "actions" ? "bg-accent text-white" : "text-[#526B91] hover:bg-[#F4F9FF]"}`}>Workflows & Actions</button>
                <button onClick={() => setActiveTab("timeline")} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === "timeline" ? "bg-accent text-white" : "text-[#526B91] hover:bg-[#F4F9FF]"}`}>Audit Log Timeline</button>
              </div>

              <div className="space-y-6 text-sm text-[#0B2148]">
                {activeTab === "details" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 border-b border-[#D8E8FA] pb-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Service ID</span>
                        <span className="text-[#0B2148] font-bold text-base">{selectedBattery.serviceId}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Status</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block mt-1 ${getStatusColor(batteryDetail?.status || selectedBattery.status)}`}>
                          {(batteryDetail?.status || selectedBattery.status).replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Customer Name</span>
                        <span className="text-[#0B2148] font-medium">{selectedBattery.customerName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Mobile</span>
                        <span className="text-[#0B2148] font-medium">{selectedBattery.customerMobile}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Battery Model</span>
                        <span className="text-[#0B2148] font-medium">{selectedBattery.batteryModel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#526B91] block">Serial Number</span>
                        <span className="text-[#0B2148] font-mono">{selectedBattery.serialNumber}</span>
                      </div>
                    </div>

                    {batteryDetail?.holdReason && (
                      <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider block">Hold Reason</span>
                        <p className="mt-1 text-xs">{batteryDetail.holdReason}</p>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#526B91] block">Issue Description</span>
                      <p className="text-[#0B2148] mt-1 bg-[#F4F9FF] p-3 rounded-xl border border-[#D8E8FA] italic">
                        "{selectedBattery.issueDescription}"
                      </p>
                    </div>

                    {batteryDetail?.estimate && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Customer Estimate Invoice</span>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#526B91]">Material Cost:</span>
                            <span className="text-[#0B2148] font-medium">₹{Number(batteryDetail.estimate.materialCost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#526B91]">Labour Cost:</span>
                            <span className="text-[#0B2148] font-medium">₹{Number(batteryDetail.estimate.labourCost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#526B91]">Margin Amount:</span>
                            <span className="text-[#0B2148] font-medium">₹{Number(batteryDetail.estimate.marginAmount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-sm border-t border-[#D8E8FA] pt-2">
                            <span className="text-[#0B2148]">Estimated Total:</span>
                            <span className="text-accent">₹{Number(batteryDetail.estimate.totalEstimate).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2 border-t border-[#D8E8FA] pt-2 text-[10px] font-mono">
                            <span className="text-[#526B91]">Customer Approval:</span>
                            <span className={batteryDetail.estimate.approvedByCustomer ? "text-[#166534]" : "text-amber-400"}>
                              {batteryDetail.estimate.approvedByCustomer ? `APPROVED (${batteryDetail.estimate.approvalMethod})` : "PENDING"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {batteryDetail?.serviceCost && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Final Billing Summary</span>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#526B91]">Material Cost Snapshot:</span>
                            <span className="text-[#0B2148] font-medium">₹{Number(batteryDetail.serviceCost.materialCostSnapshot || batteryDetail.serviceCost.materialCost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#526B91]">Labour Cost Snapshot:</span>
                            <span className="text-[#0B2148] font-medium">₹{Number(batteryDetail.serviceCost.labourCostSnapshot || batteryDetail.serviceCost.labourCost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm font-bold border-t border-[#D8E8FA] pt-2">
                            <span className="text-[#0B2148]">Total Billing Cost:</span>
                            <span className="text-accent">₹{Number(batteryDetail.serviceCost.totalCost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-[#526B91]">Amount Paid:</span>
                            <span className="text-[#166534]">₹{Number(batteryDetail.serviceCost.amountPaid).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-[#526B91]">Balance Due:</span>
                            <span className={getDuesInfo().hasDues ? "text-amber-400 font-bold" : "text-[#166534] font-bold"}>
                              ₹{getDuesInfo().due.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "actions" && (
                  <div className="space-y-6">
                    {/* Hold / Resume global widget */}
                    <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                      <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Hold Controls</span>
                      {batteryDetail?.status !== "ON_HOLD" ? (
                        <div className="flex gap-2">
                          <input 
                            placeholder="Hold reason..." 
                            value={holdReason} 
                            onChange={e => setHoldReason(e.target.value)} 
                            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs flex-1 text-white focus:outline-none"
                          />
                          <button 
                            onClick={() => {
                              updateStatusMutation.mutate({ status: "ON_HOLD", holdReason, version: batteryDetail?.version });
                              setHoldReason("");
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
                          >
                            Put on Hold
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => updateStatusMutation.mutate({ status: "RESUME", version: batteryDetail?.version })}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                        >
                          <Unlock className="w-4 h-4" /> Resume Work
                        </button>
                      )}
                    </div>

                    {/* Estimate creation (Admins) */}
                    {isAdmin && batteryDetail?.status === "DIAGNOSIS_COMPLETED" && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-4">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Generate Customer Estimate</span>
                        <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="number" 
                            placeholder="Material cost" 
                            value={estimateForm.materialCost || ""} 
                            onChange={e => setEstimateForm({...estimateForm, materialCost: Number(e.target.value)})}
                            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white"
                          />
                          <input 
                            type="number" 
                            placeholder="Labour cost" 
                            value={estimateForm.labourCost || ""} 
                            onChange={e => setEstimateForm({...estimateForm, labourCost: Number(e.target.value)})}
                            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white"
                          />
                          <input 
                            type="number" 
                            placeholder="Margin amount" 
                            value={estimateForm.marginAmount || ""} 
                            onChange={e => setEstimateForm({...estimateForm, marginAmount: Number(e.target.value)})}
                            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <input 
                          placeholder="Estimate remarks..." 
                          value={estimateForm.remarks}
                          onChange={e => setEstimateForm({...estimateForm, remarks: e.target.value})}
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <button 
                          onClick={() => createEstimateMutation.mutate(estimateForm)}
                          className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-2.5 rounded-xl text-xs"
                        >
                          Generate Estimate
                        </button>
                      </div>
                    )}

                    {/* Customer Approval Flow (Admins) */}
                    {isAdmin && batteryDetail?.status === "ESTIMATE_GENERATED" && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-4">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Log Customer Approval Status</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => updateStatusMutation.mutate({ status: "WAITING_FOR_CUSTOMER_APPROVAL", version: batteryDetail?.version })}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs"
                          >
                            Mark Waiting for Approval
                          </button>
                        </div>
                      </div>
                    )}

                    {isAdmin && batteryDetail?.status === "WAITING_FOR_CUSTOMER_APPROVAL" && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-4">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Record Customer Consent</span>
                        <select 
                          value={approvalMethod} 
                          onChange={e => setApprovalMethod(e.target.value as any)}
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white appearance-none"
                        >
                          <option value="PHONE_CALL" className="bg-[#020617]">Phone Call</option>
                          <option value="WHATSAPP" className="bg-[#020617]">WhatsApp Message</option>
                          <option value="EMAIL" className="bg-[#020617]">Email Notification</option>
                          <option value="IN_PERSON" className="bg-[#020617]">In Person Consent</option>
                        </select>
                        <button 
                          onClick={() => approveEstimateMutation.mutate()}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs"
                        >
                          Approve Estimate (Advance to Material requested)
                        </button>
                      </div>
                    )}

                    {/* Material Request Approvals and Reservation (Inventory Manager) */}
                    {isInventoryManager && batteryDetail?.materialRequests && (
                      <div className="space-y-4">
                        {batteryDetail.materialRequests.map((req: any) => {
                          if (req.status === "PENDING" && batteryDetail.status === "MATERIAL_REQUESTED") {
                            return (
                              <div key={req.id} className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                                <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Review Material Request</span>
                                <div className="space-y-1">
                                  {req.items.map((it: any) => (
                                    <p key={it.id} className="text-xs text-[#0B2148]">{it.material.name} - Qty: {it.quantity}</p>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => materialRequestActionMutation.mutate({ requestId: req.id, status: "APPROVED" })}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs"
                                  >
                                    Approve Request (Reserve Inventory)
                                  </button>
                                  <button 
                                    onClick={() => materialRequestActionMutation.mutate({ requestId: req.id, status: "REJECTED" })}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          if (req.status === "APPROVED" && batteryDetail.status === "MATERIAL_APPROVED") {
                            return (
                              <div key={req.id} className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                                <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Issue Reserved Stock</span>
                                <div className="space-y-1">
                                  {req.items.map((it: any) => (
                                    <p key={it.id} className="text-xs text-[#0B2148]">{it.material.name} - Qty: {it.quantity} (Status: RESERVED)</p>
                                  ))}
                                </div>
                                <button 
                                  onClick={() => materialRequestActionMutation.mutate({ requestId: req.id, status: "ISSUED" })}
                                  className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-2.5 rounded-xl text-xs"
                                >
                                  Issue Inventory & Start Repair
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}

                    {/* Scrap Approval Workflow (Admins) */}
                    {isAdmin && batteryDetail?.status === "SCRAP_RECOMMENDED" && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-3">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Scrap Request Approval</span>
                        <p className="text-xs text-red-400">Scrap recommendation logged by technician: "{batteryDetail?.scrapApproval?.reason}"</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => approveScrapMutation.mutate(true)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs"
                          >
                            Approve (Move to SCRAP)
                          </button>
                          <button 
                            onClick={() => approveScrapMutation.mutate(false)}
                            className="flex-1 bg-[#F4F9FF] border border-[#D8E8FA] hover:bg-[#EAF5FF] text-white font-bold py-2 rounded-xl text-xs"
                          >
                            Reject & Diagnosis Pending
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Payment verification and delivery controls */}
                    {canManageService && (batteryDetail?.status === "READY_FOR_DELIVERY" || batteryDetail?.status === "PAYMENT_PENDING") && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-4">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Deliver Battery</span>
                        
                        {batteryDetail?.status === "READY_FOR_DELIVERY" ? (
                          <button 
                            onClick={() => updateStatusMutation.mutate({ status: "PAYMENT_PENDING", version: batteryDetail?.version })}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs"
                          >
                            Set status to PAYMENT_PENDING
                          </button>
                        ) : (
                          <>
                            {getDuesInfo().hasDues ? (
                              <div className="space-y-3">
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                  <AlertCircle className="w-4 h-4 inline mr-2" />
                                  Outstanding amount: <strong>₹{getDuesInfo().due.toFixed(2)}</strong>. Complete payment or Superadmin authorization is required.
                                </div>
                                {isSuperAdmin ? (
                                  <div className="space-y-3 pt-2">
                                    <input 
                                      placeholder="Superadmin dues override reason..." 
                                      value={deliveryOverrideReason}
                                      onChange={e => setDeliveryOverrideReason(e.target.value)}
                                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white"
                                    />
                                    <button 
                                      onClick={() => completeDeliveryMutation.mutate({ paymentStatus: "OVERRIDDEN", overrideReason: deliveryOverrideReason })}
                                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                                    >
                                      <Lock className="w-4 h-4" /> Authorize & Deliver
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-[#526B91] uppercase font-bold tracking-widest text-center mt-2">Delivery Locked for this Role</div>
                                )}
                              </div>
                            ) : (
                              <button 
                                onClick={() => completeDeliveryMutation.mutate({ paymentStatus: "PAID" })}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs"
                              >
                                Mark Paid & Deliver to Customer
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Warranty Reopen Flow */}
                    {canManageService && batteryDetail?.status === "DELIVERED" && (
                      <div className="p-5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-4">
                        <span className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider block">Warranty Reopen</span>
                        <input 
                          placeholder="Warranty claim description / issue..." 
                          value={reopenReason}
                          onChange={e => setReopenReason(e.target.value)}
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <label className="flex items-center gap-2 text-xs text-[#526B91]">
                          <input 
                            type="checkbox" 
                            checked={reopenWarranty} 
                            onChange={e => setReopenWarranty(e.target.checked)} 
                            className="bg-[#F4F9FF] rounded"
                          />
                          Covered under warranty
                        </label>
                        <button 
                          onClick={() => reopenServiceMutation.mutate()}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                        >
                          <Undo2 className="w-4 h-4" /> Reopen Service (Diagnosis Pending)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "timeline" && (
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {timelineData && timelineData.length > 0 ? (
                      <div className="relative pl-6 border-l border-[#D8E8FA] space-y-6">
                        {timelineData.map((t: any) => (
                          <div key={t.id} className="relative">
                            <span className="absolute -left-[30px] top-1.5 w-3.5 h-3.5 bg-[#020617] border-2 border-accent rounded-full flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
                            </span>
                            <div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#0B2148] uppercase tracking-wider">{t.action.replace(/_/g, ' ')}</span>
                                <span className="text-[#526B91] text-[10px]">{new Date(t.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="text-[#526B91] text-xs mt-1">By: <strong>{t.userName}</strong></p>
                              {t.remarks && <p className="text-[#526B91] text-xs italic mt-0.5">"{t.remarks}"</p>}
                              {t.newStatus && (
                                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                                  <span className="text-[#526B91] font-bold uppercase">Status change:</span>
                                  {t.prevStatus && <span className="text-[#526B91]">{t.prevStatus}</span>}
                                  {t.prevStatus && <span className="text-[#526B91]">→</span>}
                                  <span className="text-accent font-bold">{t.newStatus}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#526B91] italic text-center p-4">No timeline logs found.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 flex border-t border-[#D8E8FA] pt-4">
                <button onClick={closeModal} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Close View</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
