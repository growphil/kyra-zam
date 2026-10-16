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
  Truck,
  User,
  CreditCard,
  FileText,
  AlertTriangle,
  Lock,
  Unlock,
  Play
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";

interface ServiceBattery {
  id: string;
  serviceId: string;
  customerName: string;
  batteryModel: string;
  status: string;
  createdAt: string;
  warrantyStatus?: string;
  version: number;
  serviceCost?: {
    materialCost: number;
    labourCost: number;
    marginPercentage: number;
    marginAmount: number;
    totalCost: number;
    amountPaid: number;
  } | null;
}

export default function ServiceDeliveryPage() {
  const { data: session } = useSession();
  
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER");
  const isSuperAdmin = userRoles.includes("SUPERADMIN");
  const canManageDelivery = isAdmin || isInventoryManager;

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState<"delivery" | null>(null);
  const [selectedBattery, setSelectedBattery] = useState<ServiceBattery | null>(null);
  const queryClient = useQueryClient();

  const [deliveryData, setDeliveryData] = useState({
    customerSignature: "",
    paymentStatus: "PAID",
    warrantyUpdate: "EXTENDED_6_MONTHS",
    overrideReason: ""
  });

  useEffect(() => { setMounted(true); }, []);

  // Fetch Service Batteries ready for delivery
  const { data: batteries, isLoading, refetch } = useQuery({
    queryKey: ["service-batteries-delivery"],
    queryFn: async () => {
      const res = await api.get("/service/battery");
      return res.data.filter((b: ServiceBattery) => 
        ["READY_FOR_DELIVERY", "PAYMENT_PENDING"].includes(b.status)
      );
    },
    enabled: mounted,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: string, version: number }) => 
      api.patch(`/service/battery/${selectedBattery?.id}/status`, {
        status: data.status,
        version: data.version
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-delivery"] });
      toast.success("Battery advanced to PAYMENT PENDING");
      closeModal();
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast.error("Stale data. Please refresh and retry.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update status");
      }
    }
  });

  const submitDeliveryMutation = useMutation({
    mutationFn: (data: any) => api.post("/service/delivery", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-delivery"] });
      toast.success("Battery marked as delivered successfully");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Delivery dispatch failed")
  });

  const closeModal = () => {
    setShowModal(null);
    setSelectedBattery(null);
    setDeliveryData({
      customerSignature: "",
      paymentStatus: "PAID",
      warrantyUpdate: "EXTENDED_6_MONTHS",
      overrideReason: ""
    });
  };

  if (!mounted) return null;

  const filteredBatteries = (batteries || []).filter((b: ServiceBattery) => {
    return b.customerName.toLowerCase().includes(search.toLowerCase()) || 
      b.serviceId.toLowerCase().includes(search.toLowerCase()) ||
      b.batteryModel.toLowerCase().includes(search.toLowerCase());
  });

  const getDuesInfo = (bat: ServiceBattery) => {
    if (!bat.serviceCost) return { due: 0, hasDues: false };
    const isWarranty = bat.warrantyStatus && ["true", "warranty", "in_warranty"].includes(bat.warrantyStatus.toLowerCase());
    if (isWarranty) return { due: 0, hasDues: false };

    const due = Number(bat.serviceCost.totalCost) - Number(bat.serviceCost.amountPaid);
    return { due, hasDues: due > 0 };
  };

  return (
    <div className="space-y-4 font-sans max-w-[1700px] pb-8">
      <PageHeader
        title="Service Delivery Terminal"
        subtitle="Dispatch & Completion Tracking"
        icon={<Truck className="w-5 h-5 text-[#0878F9]" />}
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
            placeholder="Search by Customer or Service ID..." 
            className="w-full bg-white border border-[#D8E8FA] rounded-xl py-2 pl-10 pr-4 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none transition-all placeholder:text-[#526B91] shadow-xs" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Dispatch Queue...</p>
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
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                      bat.status === "READY_FOR_DELIVERY" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    }`}>
                      {bat.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canManageDelivery && (
                        <>
                          {bat.status === "READY_FOR_DELIVERY" && (
                            <button 
                              onClick={() => {
                                setSelectedBattery(bat);
                                updateStatusMutation.mutate({ status: "PAYMENT_PENDING", version: bat.version });
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5" /> Initialize Payment
                            </button>
                          )}
                          {bat.status === "PAYMENT_PENDING" && (
                            <button 
                              onClick={() => { setSelectedBattery(bat); setShowModal("delivery"); }}
                              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" /> Complete Dispatch
                            </button>
                          )}
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

      {/* Delivery Modal */}
      <AnimatePresence>
        {showModal === "delivery" && selectedBattery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-lg p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><Truck className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Confirm Customer Delivery</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                <p className="text-xs text-[#526B91]">Delivering battery for <span className="text-[#0B2148] font-bold">{selectedBattery.serviceId}</span></p>

                {/* Billing Summary */}
                <div className="p-4 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2 text-xs">
                  <span className="font-bold text-[#526B91] block uppercase tracking-wider text-[10px]">Service Billing Status</span>
                  {selectedBattery.serviceCost ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#526B91]">Total Cost:</span>
                        <span className="text-[#0B2148]">₹{Number(selectedBattery.serviceCost.totalCost).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#526B91]">Amount Paid:</span>
                        <span className="text-[#166534]">₹{Number(selectedBattery.serviceCost.amountPaid).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#D8E8FA] pt-1.5 font-bold">
                        <span className="text-[#0B2148]">Amount Due:</span>
                        <span className={getDuesInfo(selectedBattery).hasDues ? "text-amber-400" : "text-[#166534]"}>
                          ₹{getDuesInfo(selectedBattery).due.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[#526B91] italic">No service cost registered yet.</p>
                  )}
                </div>

                {/* Dues and Overrides */}
                {getDuesInfo(selectedBattery).hasDues && deliveryData.paymentStatus !== "PAID" && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-[#0B2148] block">Outstanding Dues Block</span>
                        <span className="text-[10px] text-[#526B91] block mt-0.5">
                          Only a Superadmin can override this block and complete delivery with outstanding dues.
                        </span>
                      </div>
                    </div>
                    {isSuperAdmin ? (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Superadmin Override Reason</label>
                        <input 
                          value={deliveryData.overrideReason} 
                          onChange={e => setDeliveryData({...deliveryData, overrideReason: e.target.value})} 
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-red-500/50" 
                          placeholder="Provide justification for override..."
                        />
                      </div>
                    ) : (
                      <div className="text-[10px] text-red-400 font-bold uppercase tracking-widest text-center py-1">Delivery blocked for standard users</div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Customer Signature (Name)</label>
                  <input value={deliveryData.customerSignature} onChange={e => setDeliveryData({...deliveryData, customerSignature: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" placeholder="Enter customer name who received" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Payment Status</label>
                  <select value={deliveryData.paymentStatus} onChange={e => setDeliveryData({...deliveryData, paymentStatus: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none appearance-none font-sans">
                    <option value="PAID" className="bg-[#020617]">Paid</option>
                    <option value="PENDING" className="bg-[#020617]">Pending</option>
                    <option value="WARRANTY_FREE" className="bg-[#020617]">Free (In Warranty)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Warranty Update</label>
                  <select value={deliveryData.warrantyUpdate} onChange={e => setDeliveryData({...deliveryData, warrantyUpdate: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none appearance-none font-sans">
                    <option value="EXTENDED_6_MONTHS" className="bg-[#020617]">Extended 6 Months</option>
                    <option value="EXTENDED_1_YEAR" className="bg-[#020617]">Extended 1 Year</option>
                    <option value="NO_CHANGE" className="bg-[#020617]">No Change</option>
                  </select>
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => submitDeliveryMutation.mutate({ serviceBatteryId: selectedBattery.id, ...deliveryData })} 
                  disabled={
                    !deliveryData.customerSignature || 
                    submitDeliveryMutation.isPending || 
                    (getDuesInfo(selectedBattery).hasDues && 
                     deliveryData.paymentStatus !== "PAID" && 
                     !isSuperAdmin) ||
                    (getDuesInfo(selectedBattery).hasDues && 
                     deliveryData.paymentStatus !== "PAID" && 
                     isSuperAdmin && 
                     !deliveryData.overrideReason)
                  }
                  className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {submitDeliveryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    getDuesInfo(selectedBattery).hasDues && deliveryData.paymentStatus !== "PAID" ? (
                      <><Lock className="w-4 h-4" /> <span>Override & Deliver</span></>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> <span>Complete Delivery</span></>
                    )
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
