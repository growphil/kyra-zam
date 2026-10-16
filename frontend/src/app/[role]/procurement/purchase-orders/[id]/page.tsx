"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  FileText, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  AlertTriangle,
  Check,
  X,
  Building2,
  Bookmark,
  MapPin,
  Archive
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Workflow Dialog states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // --- DATA FETCHING ---
  const { data: po, isLoading } = useQuery({
    queryKey: ["procurement-po-details", poId],
    queryFn: async () => (await api.get(`/crm/procurement/purchase-orders/${poId}`)).data
  });

  // --- MUTATIONS ---
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/procurement/purchase-orders/${poId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-po-details"] });
      toast.success("Purchase Order status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Status update failed")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Purchase Order File Not Found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/procurement/purchase-orders`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-white font-bold text-sm bg-[#F4F9FF] border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Purchase order ID</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{po.poNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                po.status === "RECEIVED" || po.status === "CLOSED" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                po.status === "CANCELLED" || po.status === "REJECTED" ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                po.status === "APPROVED" || po.status === "SENT" ? "bg-teal-500/15 text-teal-400 border border-teal-500/20" :
                po.status === "PARTIALLY_RECEIVED" ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                "bg-slate-500/15 text-[#526B91] border border-slate-500/20"
              }`}>
                {po.status}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">{po.vendor?.name}</p>
                  <p className="text-xs text-[#526B91]">Vendor Profile</p>
                </div>
              </div>

              {po.purchaseRequest && (
                <div className="flex items-start gap-3">
                  <Bookmark className="w-4 h-4 text-accent mt-0.5" />
                  <div>
                    <a 
                      href={`/${roleSlug}/procurement/purchase-requests/${po.purchaseRequestId}`}
                      className="font-bold text-white hover:underline text-xs"
                    >
                      PR Source: {po.purchaseRequest.prNumber}
                    </a>
                  </div>
                </div>
              )}

              {/* Address Snapshots */}
              <div className="border-t border-[#D8E8FA] pt-4 space-y-3">
                <div>
                  <p className="text-xs text-[#526B91] font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Billing Address
                  </p>
                  <p className="text-xs text-[#0B2148] mt-1">{po.billingAddress}</p>
                </div>
                <div>
                  <p className="text-xs text-[#526B91] font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Delivery Target Address
                  </p>
                  <p className="text-xs text-[#0B2148] mt-1">{po.deliveryAddress}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91] border-t border-[#D8E8FA] pt-4">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Date Created</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(po.orderDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Expected Delivery</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(po.expectedDeliveryDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-3">
            <h3 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Order Control Panel</h3>
            
            {po.status === "DRAFT" && (
              <>
                <button 
                  onClick={() => updateStatusMutation.mutate("PENDING_APPROVAL")}
                  className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all"
                >
                  Submit for Internal Approval
                </button>
                <button 
                  onClick={() => updateStatusMutation.mutate("CANCELLED")}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-bold transition-all"
                >
                  Cancel Order
                </button>
              </>
            )}

            {po.status === "PENDING_APPROVAL" && (
              <>
                <button 
                  onClick={() => updateStatusMutation.mutate("APPROVED")}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all"
                >
                  Approve Order
                </button>
                <button 
                  onClick={() => updateStatusMutation.mutate("REJECTED")}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all"
                >
                  Reject Order
                </button>
              </>
            )}

            {po.status === "APPROVED" && (
              <button 
                onClick={() => updateStatusMutation.mutate("SENT")}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all"
              >
                Mark as SENT to Vendor
              </button>
            )}

            {(po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") && (
              <button 
                onClick={() => router.push(`/${roleSlug}/procurement/goods-receipts?poId=${po.id}`)}
                className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all flex items-center justify-center gap-2"
              >
                <Archive className="w-4 h-4" />
                Spawn Goods Receipt
              </button>
            )}
          </div>
        </div>

        {/* Right Column requested items list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-lg font-display font-bold text-[#0B2148]">Purchase Order Items</h3>
            
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider">
                  <th className="pb-3">Material SKU / Name</th>
                  <th className="pb-3">Qty Ordered</th>
                  <th className="pb-3">Qty Received</th>
                  <th className="pb-3 text-accent font-bold">Qty Pending</th>
                  <th className="pb-3">Unit Price</th>
                  <th className="pb-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {po.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <div className="font-bold text-white">{item.material?.name}</div>
                      <div className="text-[10px] text-[#526B91] font-mono mt-0.5">SKU: {item.material?.sku}</div>
                    </td>
                    <td className="py-4 font-mono">{item.quantityOrdered}</td>
                    <td className="py-4 font-mono">{item.quantityReceived}</td>
                    <td className="py-4 font-mono font-bold text-accent">{item.quantityPending}</td>
                    <td className="py-4 font-mono">{po.currency} {parseFloat(item.unitPrice.toString()).toFixed(2)}</td>
                    <td className="py-4 text-right font-bold text-[#0B2148] font-mono">
                      {po.currency} {parseFloat(item.lineTotal.toString()).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing calculations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h4 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">PO Commercial Terms</h4>
              <div className="space-y-3 text-xs text-[#0B2148]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Delivery Terms</p>
                  <p className="mt-0.5 font-semibold text-[#0B2148]">{po.deliveryTerms}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Payment Terms</p>
                  <p className="mt-0.5 font-semibold text-[#0B2148]">{po.paymentTerms}</p>
                </div>
                {po.notes && (
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Order Notes</p>
                    <p className="mt-0.5 text-[#526B91]">{po.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h4 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Financial Summary</h4>
              <div className="space-y-3 text-xs text-[#526B91]">
                <div className="flex justify-between">
                  <span>Subtotal sum:</span>
                  <span className="font-mono text-[#0B2148]">INR {parseFloat(po.subtotal.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discounts:</span>
                  <span className="font-mono text-[#0B2148]">- INR {parseFloat(po.discount.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (GST):</span>
                  <span className="font-mono text-[#0B2148]">INR {parseFloat(po.tax.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-[#D8E8FA]">
                  <span>Grand Total amount:</span>
                  <span className="font-mono text-accent">INR {parseFloat(po.grandTotal.toString()).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
