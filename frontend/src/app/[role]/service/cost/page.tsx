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
  IndianRupee,
  FileText,
  Printer,
  Edit3,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";

interface ServiceCost {
  id?: string;
  serviceType: string;
  materialCost: number;
  labourCost: number;
  marginPercentage: number;
  marginAmount: number;
  totalCost: number;
  amountPaid: number;
  notes?: string;
  generatedBySystem: boolean;
  overrideReason?: string;
}

interface ServiceBattery {
  id: string;
  serviceId: string;
  serialNumber: string;
  customerName: string;
  customerMobile: string;
  batteryModel: string;
  status: string;
  warrantyStatus?: string;
  serviceType?: string;
  createdAt: string;
  serviceCost?: ServiceCost | null;
}

export default function ServiceCostPage() {
  const { data: session } = useSession();
  
  const userRoles = (session?.user as any)?.roles || [];
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const isAuthorized = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState<"override" | "print" | null>(null);
  const [selectedBattery, setSelectedBattery] = useState<ServiceBattery | null>(null);
  const queryClient = useQueryClient();

  const [overrideForm, setOverrideForm] = useState({
    materialCost: 0,
    labourCost: 0,
    marginPercentage: 0,
    marginAmount: 0,
    totalCost: 0,
    amountPaid: 0,
    notes: "",
    overrideReason: ""
  });

  useEffect(() => { setMounted(true); }, []);

  // Fetch all service batteries with costs included
  const { data: batteries, isLoading, refetch } = useQuery({
    queryKey: ["service-batteries-costs-master"],
    queryFn: async () => {
      const res = await api.get("/service/battery");
      return res.data as ServiceBattery[];
    },
    enabled: mounted,
  });

  // Override cost mutation (Restricted to SUPERADMIN)
  const overrideCostMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => api.patch(`/service/cost/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-costs-master"] });
      toast.success("Cost overridden successfully by Superadmin");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Override request rejected")
  });

  const closeModal = () => {
    setShowModal(null);
    setSelectedBattery(null);
    setOverrideForm({
      materialCost: 0,
      labourCost: 0,
      marginPercentage: 0,
      marginAmount: 0,
      totalCost: 0,
      amountPaid: 0,
      notes: "",
      overrideReason: ""
    });
  };

  const openOverrideModal = (battery: ServiceBattery) => {
    if (!battery.serviceCost) {
      toast.error("Cost details can only be overridden after system generation.");
      return;
    }
    setSelectedBattery(battery);
    setOverrideForm({
      materialCost: Number(battery.serviceCost.materialCost),
      labourCost: Number(battery.serviceCost.labourCost),
      marginPercentage: Number(battery.serviceCost.marginPercentage),
      marginAmount: Number(battery.serviceCost.marginAmount),
      totalCost: Number(battery.serviceCost.totalCost),
      amountPaid: Number(battery.serviceCost.amountPaid),
      notes: battery.serviceCost.notes || "",
      overrideReason: ""
    });
    setShowModal("override");
  };

  // Auto recalculate overrides
  useEffect(() => {
    if (showModal === "override") {
      const mat = Number(overrideForm.materialCost);
      const lab = Number(overrideForm.labourCost);
      const pct = Number(overrideForm.marginPercentage);
      const marginAmt = (mat + lab) * pct / 100;
      const total = mat + lab + marginAmt;
      
      if (
        overrideForm.marginAmount !== marginAmt ||
        overrideForm.totalCost !== total
      ) {
        setOverrideForm(prev => ({
          ...prev,
          marginAmount: marginAmt,
          totalCost: total
        }));
      }
    }
  }, [overrideForm.materialCost, overrideForm.labourCost, overrideForm.marginPercentage, showModal]);

  const handlePrint = (battery: ServiceBattery) => {
    setSelectedBattery(battery);
    setShowModal("print");
  };

  const triggerPrintWindow = () => {
    const printContent = document.getElementById("printable-invoice");
    if (!printContent) return;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent.innerHTML;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  if (!mounted) return null;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold text-[#0B2148]">Access Denied</h2>
        <p className="text-[#526B91] text-sm">Only Admin and Super Admin users can view service costing reports.</p>
      </div>
    );
  }

  const filteredBatteries = (batteries || []).filter((b: ServiceBattery) => {
    return b.customerName.toLowerCase().includes(search.toLowerCase()) || 
      b.serviceId.toLowerCase().includes(search.toLowerCase()) ||
      b.batteryModel.toLowerCase().includes(search.toLowerCase()) ||
      (b.serialNumber && b.serialNumber.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-4 max-w-[1700px] pb-8">
      <PageHeader
        title="Industrial Service Costing"
        subtitle="Automated pricing master engine & billing"
        icon={<IndianRupee className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => refetch()}
            title="Refresh"
            className="p-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-all cursor-pointer shadow-xs"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        }
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer, Serial, Model or Service ID..." 
            className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-10 pr-4 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none transition-all placeholder:text-[#526B91] shadow-xs" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Cost Dashboard...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Customer</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Material Cost</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Labour Cost</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Margin %</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Margin Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Total Cost</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC]">
                {filteredBatteries.map((bat: ServiceBattery) => {
                  const cost = bat.serviceCost;
                  const total = cost ? Number(cost.totalCost) : 0;
                  
                  return (
                    <tr key={bat.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-[#0B2148] group-hover:text-[#0B2148] transition-colors">{bat.serviceId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-[#0B2148] block">{bat.customerName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-[#526B91] block uppercase">
                          {cost ? cost.serviceType : (bat.serviceType || "Not Selected")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#526B91]">₹{cost ? Number(cost.materialCost).toFixed(2) : "0.00"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#526B91]">₹{cost ? Number(cost.labourCost).toFixed(2) : "0.00"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#526B91]">{cost ? Number(cost.marginPercentage) : 0}%</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#526B91]">₹{cost ? Number(cost.marginAmount).toFixed(2) : "0.00"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${cost?.generatedBySystem ? "text-[#166534]" : "text-amber-400"}`}>
                          ₹{total.toFixed(2)}
                        </span>
                        {!cost?.generatedBySystem && cost && (
                          <span className="text-[8px] uppercase tracking-wider block text-amber-500 font-bold mt-0.5">Overridden</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          bat.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          bat.status === "READY_FOR_DELIVERY" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" :
                          "bg-slate-500/10 text-[#526B91] border-slate-500/20"
                        }`}>
                          {bat.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {cost && isSuperAdmin && (
                            <button 
                              onClick={() => openOverrideModal(bat)}
                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg transition-all"
                              title="Override Cost (Superadmin Only)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {cost && (
                            <button 
                              onClick={() => handlePrint(bat)}
                              className="p-1.5 bg-slate-500/10 hover:bg-slate-500 text-[#526B91] hover:text-white rounded-lg transition-all"
                              title="Print Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override Modal (SUPERADMIN Only) */}
      <AnimatePresence>
        {showModal === "override" && selectedBattery && selectedBattery.serviceCost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Superadmin Cost Override</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#526B91]">
                    You are overriding the system-calculated pricing rules. All manual adjustments require an override justification and will be fully audited.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Material Cost (₹)</label>
                    <input 
                      type="number"
                      value={overrideForm.materialCost}
                      onChange={e => setOverrideForm({...overrideForm, materialCost: Number(e.target.value)})}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Labour Cost (₹)</label>
                    <input 
                      type="number"
                      value={overrideForm.labourCost}
                      onChange={e => setOverrideForm({...overrideForm, labourCost: Number(e.target.value)})}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Margin Percentage (%)</label>
                    <input 
                      type="number"
                      value={overrideForm.marginPercentage}
                      onChange={e => setOverrideForm({...overrideForm, marginPercentage: Number(e.target.value)})}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Amount Paid (₹)</label>
                    <input 
                      type="number"
                      value={overrideForm.amountPaid}
                      onChange={e => setOverrideForm({...overrideForm, amountPaid: Number(e.target.value)})}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Override Reason</label>
                  <input 
                    value={overrideForm.overrideReason}
                    onChange={e => setOverrideForm({...overrideForm, overrideReason: e.target.value})}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none"
                    placeholder="Enter reason for cost override"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Internal Notes</label>
                  <textarea 
                    value={overrideForm.notes}
                    onChange={e => setOverrideForm({...overrideForm, notes: e.target.value})}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-4 text-sm text-white focus:border-accent/50 focus:outline-none h-16"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#526B91]">Calculated Margin Amount:</span>
                    <span className="text-[#0B2148]">₹{overrideForm.marginAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-t border-[#D8E8FA] pt-2">
                    <span className="text-[#0B2148]">New Total Cost:</span>
                    <span className="text-accent">₹{overrideForm.totalCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => {
                    if (selectedBattery.serviceCost?.id) {
                      overrideCostMutation.mutate({ id: selectedBattery.serviceCost.id, data: overrideForm });
                    }
                  }} 
                  disabled={!overrideForm.overrideReason || overrideCostMutation.isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 py-3 rounded-xl text-white font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {overrideCostMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Apply Override</span></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Print Preview Modal */}
      <AnimatePresence>
        {showModal === "print" && selectedBattery && selectedBattery.serviceCost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/95 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-3xl p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6 print:hidden">
                <h2 className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
                  <Printer className="w-5 h-5 text-accent" />
                  Print Estimate Invoice
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div id="printable-invoice" className="bg-white text-slate-900 p-8 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">KYRA ZAM SERVICES</h1>
                    <p className="text-xs text-[#526B91] mt-1">BATTERY PACK DIAGNOSIS & REPAIRS ESTIMATE</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#526B91] block">Service ID: {selectedBattery.serviceId}</span>
                    <span className="text-[10px] text-[#526B91] block">Date: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 my-6 text-xs text-[#526B91]">
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Customer Details</h3>
                    <p className="font-medium text-slate-900">{selectedBattery.customerName}</p>
                    <p>Phone: {selectedBattery.customerMobile}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Battery Specifications</h3>
                    <p className="font-medium text-slate-900">Model: {selectedBattery.batteryModel}</p>
                    {selectedBattery.serialNumber && <p>Serial Number: {selectedBattery.serialNumber}</p>}
                    <p className="capitalize">Service Type: {selectedBattery.serviceCost.serviceType}</p>
                  </div>
                </div>

                <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-2 font-bold text-slate-700">Cost Center</th>
                        <th className="px-4 py-2 font-bold text-slate-700">Description</th>
                        <th className="px-4 py-2 text-right font-bold text-slate-700">Total Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">Materials & Spare Parts</td>
                        <td className="px-4 py-3 text-[#526B91]">Component replacements and cell integrations</td>
                        <td className="px-4 py-3 text-right text-slate-900 font-medium">₹{Number(selectedBattery.serviceCost.materialCost).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">Labour Cost</td>
                        <td className="px-4 py-3 text-[#526B91]">Technical diagnostics, battery assembly, and calibration</td>
                        <td className="px-4 py-3 text-right text-slate-900 font-medium">₹{Number(selectedBattery.serviceCost.labourCost).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-800">Margin Billed ({Number(selectedBattery.serviceCost.marginPercentage)}%)</td>
                        <td className="px-4 py-3 text-[#526B91]">Industrial processing margin fee</td>
                        <td className="px-4 py-3 text-right text-slate-900 font-medium">₹{Number(selectedBattery.serviceCost.marginAmount).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {selectedBattery.serviceCost.notes && (
                  <div className="mt-6 p-4 bg-slate-50 border border-slate-150 rounded-lg text-xs">
                    <span className="font-bold text-slate-700 block mb-1">Diagnosis Notes:</span>
                    <p className="text-[#526B91] italic">{selectedBattery.serviceCost.notes}</p>
                  </div>
                )}

                <div className="mt-8 flex justify-end">
                  <div className="w-64 space-y-2 text-xs">
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                      <span className="text-slate-800">Total Invoice:</span>
                      <span className="text-slate-900">₹{Number(selectedBattery.serviceCost.totalCost).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#526B91]">
                      <span>Amount Paid:</span>
                      <span>₹{Number(selectedBattery.serviceCost.amountPaid).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold border-t border-slate-100 pt-2">
                      <span className="text-slate-700">Amount Due:</span>
                      <span className="text-slate-900">
                        ₹{(Number(selectedBattery.serviceCost.totalCost) - Number(selectedBattery.serviceCost.amountPaid)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-12 text-center text-[10px] text-[#526B91] border-t border-slate-150 pt-4">
                  Thank you for your business. For any service queries, contact support@kyrazam.com.
                </div>
              </div>

              <div className="mt-8 flex gap-3 print:hidden">
                <button onClick={closeModal} className="flex-1 py-3 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Close</button>
                <button 
                  onClick={triggerPrintWindow}
                  className="flex-1 bg-accent hover:bg-accent/90 py-3 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Printer className="w-4 h-4" /> <span>Print Invoice</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
