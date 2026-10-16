"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Truck, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  CheckCircle2,
  Package,
  FileText,
  MapPin,
  ClipboardList,
  ChevronRight,
  TrendingUp
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DispatchOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Workflow Modal/Control States
  const [pickSerials, setPickSerials] = useState<string>("");
  const [isPackOpen, setIsPackOpen] = useState(false);
  const [packWeight, setPackWeight] = useState(15.5);
  const [packDim, setPackDim] = useState("40x40x30 cm");
  const [packType, setPackType] = useState("BOX");

  const [isShipOpen, setIsShipOpen] = useState(false);
  const [carrier, setCarrier] = useState("Bluedart");
  const [shipMethod, setShipMethod] = useState("Express Air");
  const [trackingNo, setTrackingNo] = useState("");
  const [expDelivery, setExpDelivery] = useState("");

  const [isDeliverOpen, setIsDeliverOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [contact, setContact] = useState("");
  const [delNotes, setDelNotes] = useState("");

  const [isExceptionOpen, setIsExceptionOpen] = useState(false);
  const [excepDesc, setExcepDesc] = useState("");

  // --- DATA FETCHING ---
  const { data: order, isLoading } = useQuery({
    queryKey: ["dispatch-order-details", orderId],
    queryFn: async () => (await api.get(`/crm/dispatch/orders/${orderId}`)).data
  });

  // --- MUTATIONS ---
  const pickMutation = useMutation({
    mutationFn: (data: { serials: string[] }) => api.put(`/crm/dispatch/orders/${orderId}/pick`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-order-details"] });
      toast.success("Picking confirmed for serialized items");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Picking verification failed")
  });

  const packMutation = useMutation({
    mutationFn: (data: any) => api.put(`/crm/dispatch/orders/${orderId}/pack`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-order-details"] });
      setIsPackOpen(false);
      toast.success("Package dimensions & weight recorded");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Packing failed")
  });

  const shipMutation = useMutation({
    mutationFn: (data: any) => api.put(`/crm/dispatch/orders/${orderId}/ship`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-order-details"] });
      setIsShipOpen(false);
      toast.success("Shipment dispatched. Carrier tracking assigned.");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Shipment release failed")
  });

  const deliverMutation = useMutation({
    mutationFn: (data: any) => api.put(`/crm/dispatch/orders/${orderId}/deliver`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-order-details"] });
      setIsDeliverOpen(false);
      toast.success("Proof of Delivery logged. DO Completed.");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Delivery log failed")
  });

  const exceptionMutation = useMutation({
    mutationFn: (data: { description: string }) => api.put(`/crm/dispatch/orders/${orderId}/exception`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-order-details"] });
      setIsExceptionOpen(false);
      toast.success("Delivery Exception report filed");
    },
    onError: (err: any) => toast.error("Failed to log exception")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Dispatch Order file not found</p>
      </div>
    );
  }

  const handlePickConfirm = () => {
    // Pick the list of serials allocated
    const serialsList = order.items.map((i: any) => i.paxSerial).filter(Boolean);
    pickMutation.mutate({ serials: serialsList });
  };

  const handlePackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    packMutation.mutate({ weight: packWeight, dimensions: packDim, packageType: packType });
  };

  const handleShipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDelivery) {
      toast.error("Expected delivery date is required");
      return;
    }
    shipMutation.mutate({ carrier, shippingMethod: shipMethod, trackingNumber: trackingNo, expectedDeliveryDate: expDelivery });
  };

  const handleDeliverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient) {
      toast.error("Recipient name is required");
      return;
    }
    deliverMutation.mutate({ recipientName: recipient, recipientContact: contact, deliveryNotes: delNotes });
  };

  const handleExceptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!excepDesc) return;
    exceptionMutation.mutate({ description: excepDesc });
  };

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      
      {/* Back button row */}
      <div className="flex items-center justify-between pb-2 border-b border-[#D8E8FA]">
        <button 
          onClick={() => router.push(`/${roleSlug}/dispatch/orders`)}
          className="flex items-center gap-2 text-[#0B2148] hover:bg-[#EAF5FF] font-semibold text-xs bg-white border border-[#D8E8FA] px-3.5 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#526B91]" />
          Back to DO Registry
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-5 rounded-xl border border-[#D8E8FA] bg-white space-y-5 shadow-2xs">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest font-mono">DO Number</span>
                <h2 className="text-xl font-display font-bold text-[#0B2148] mt-0.5 font-mono">{order.dispatchNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
                order.status === "DELIVERED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
                order.status === "IN_TRANSIT" ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]" :
                order.status === "PACKED" || order.status === "PICKED" ? "bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D5FF]" :
                "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
              }`}>
                {order.status}
              </span>
            </div>

            <div className="space-y-3 text-xs border-t border-[#D8E8FA] pt-3.5">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-[#0878F9] mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-[#0B2148]">{order.customer?.name}</p>
                  <p className="text-[#526B91] text-[11px]">Customer</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#0878F9] mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-[#0B2148] leading-snug">{order.deliveryAddressSnapshot}</p>
                  <p className="text-[#526B91] text-[10px]">Delivery address snapshot</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[#D8E8FA] pt-3">
                <div>
                  <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">Priority</p>
                  <p className="text-[#0B2148] font-bold text-xs">{order.priority}</p>
                </div>
                <div>
                  <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">Planned Date</p>
                  <p className="text-[#0B2148] font-mono text-xs">{new Date(order.plannedDispatchDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Status-dependent buttons */}
            <div className="border-t border-[#D8E8FA] pt-4 space-y-2">
              {order.status === "READY_TO_PICK" && (
                <button
                  onClick={handlePickConfirm}
                  disabled={pickMutation.isPending}
                  className="w-full py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {pickMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Confirm Picking Scan"}
                </button>
              )}

              {order.status === "PICKED" && (
                <button
                  onClick={() => setIsPackOpen(true)}
                  className="w-full py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Record Packing Parameters
                </button>
              )}

              {order.status === "PACKED" && (
                <button
                  onClick={() => setIsShipOpen(true)}
                  className="w-full py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Dispatch Shipment
                </button>
              )}

              {order.status === "IN_TRANSIT" && (
                <div className="space-y-2">
                  <button
                    onClick={() => setIsDeliverOpen(true)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Confirm Delivery (POD)
                  </button>
                  <button
                    onClick={() => setIsExceptionOpen(true)}
                    className="w-full py-2.5 bg-[#FEE2E2] hover:bg-[#FEE2E2]/80 border border-[#FECACA] text-[#991B1B] font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Record Delivery Exception
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column details */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Dispatch line items */}
          <div className="p-5 rounded-xl border border-[#D8E8FA] bg-white space-y-3 shadow-2xs">
            <h3 className="text-sm font-display font-bold text-[#0B2148] uppercase tracking-wider">Dispatched Line Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-3.5 py-2.5">Product Ref</th>
                    <th className="px-3.5 py-2.5">Ordered Qty</th>
                    <th className="px-3.5 py-2.5">Dispatch Qty</th>
                    <th className="px-3.5 py-2.5 font-bold text-[#0878F9]">Allocated Serial</th>
                    <th className="px-3.5 py-2.5 text-right">Picked Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                  {order.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#F4F9FF]/60 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-[#0B2148]">{item.productRef}</td>
                      <td className="px-3.5 py-2.5 font-mono">{item.quantityOrdered}</td>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-[#0B2148]">{item.quantityDispatched}</td>
                      <td className="px-3.5 py-2.5 font-mono text-[#0878F9]">{item.paxSerial || "Bulk Material"}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono">{item.quantityPicked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Package manifests list */}
          {order.packages && order.packages.length > 0 && (
            <div className="p-5 rounded-xl border border-[#D8E8FA] bg-white space-y-3 shadow-2xs">
              <h3 className="text-sm font-display font-bold text-[#0B2148] uppercase tracking-wider">Packages Manifest</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {order.packages.map((pkg: any) => (
                  <div key={pkg.id} className="p-3.5 rounded-lg border border-[#D8E8FA] bg-[#F4F9FF] text-xs text-[#0B2148]">
                    <span className="font-bold text-[#0B2148] font-mono block">{pkg.packageNumber}</span>
                    <p className="mt-1 text-[#526B91]">Weight: <span className="font-semibold text-[#0B2148]">{pkg.weight} kg</span> | Size: <span className="font-semibold text-[#0B2148]">{pkg.dimensions}</span></p>
                    <p className="text-[#526B91] mt-0.5 uppercase text-[10px] font-bold">Type: {pkg.packageType}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Packing Dialog Modal */}
      {isPackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#D8E8FA] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-display font-bold text-[#0B2148]">Record Package Specs</h3>
            
            <form onSubmit={handlePackSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Weight (kg) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={packWeight}
                  onChange={(e) => setPackWeight(parseFloat(e.target.value))}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Dimensions (L x W x H) *</label>
                <input 
                  type="text" 
                  required
                  value={packDim}
                  onChange={(e) => setPackDim(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Package Container Type</label>
                <select
                  value={packType}
                  onChange={(e) => setPackType(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                >
                  <option value="BOX">Corrugated Box</option>
                  <option value="PALLET">Wooden Pallet</option>
                  <option value="CRATE">Structured Crate</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setIsPackOpen(false)} className="px-3.5 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] font-semibold text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer">
                  Save Packing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipment Dispatch Modal */}
      {isShipOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#D8E8FA] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-display font-bold text-[#0B2148]">Carrier Dispatch Manifest</h3>
            
            <form onSubmit={handleShipSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Carrier / Courier Name *</label>
                <input 
                  type="text" 
                  required
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Shipping Method / Service *</label>
                <input 
                  type="text" 
                  required
                  value={shipMethod}
                  onChange={(e) => setShipMethod(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Tracking Reference Number</label>
                <input 
                  type="text" 
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  placeholder="AWB Tracking #"
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Expected Delivery Date *</label>
                <input 
                  type="date" 
                  required
                  value={expDelivery}
                  onChange={(e) => setExpDelivery(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setIsShipOpen(false)} className="px-3.5 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] font-semibold text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer">
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof of Delivery Modal */}
      {isDeliverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#D8E8FA] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-display font-bold text-[#0B2148]">Record Proof of Delivery</h3>
            
            <form onSubmit={handleDeliverSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Recipient Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Recipient Contact Phone</label>
                <input 
                  type="text" 
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Delivery Notes</label>
                <input 
                  type="text" 
                  value={delNotes}
                  onChange={(e) => setDelNotes(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setIsDeliverOpen(false)} className="px-3.5 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] font-semibold text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer">
                  Confirm Delivered
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Modal */}
      {isExceptionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#D8E8FA] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-display font-bold text-[#991B1B]">Record Delivery Exception</h3>
            
            <form onSubmit={handleExceptionSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Exception Description *</label>
                <textarea
                  required
                  placeholder="Address unavailable, courier delayed, package damaged..."
                  value={excepDesc}
                  onChange={(e) => setExcepDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setIsExceptionOpen(false)} className="px-3.5 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] font-semibold text-xs transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#991B1B] hover:bg-[#7F1D1D] text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer">
                  Record Exception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
