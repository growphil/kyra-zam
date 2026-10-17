"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl, downloadAuthenticatedFile } from "@/lib/api";
import { 
  IndianRupee, 
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
  TrendingUp,
  CreditCard,
  Plus,
  FileDown,
  Zap
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Workflow Dialog/Modal state
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [refNo, setRefNo] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // --- DATA FETCHING ---
  const { data: inv, isLoading } = useQuery({
    queryKey: ["finance-invoice-details", invoiceId],
    queryFn: async () => (await api.get(`/crm/finance/invoices/${invoiceId}`)).data
  });

  // --- MUTATIONS ---
  const issueMutation = useMutation({
    mutationFn: () => api.put(`/crm/finance/invoices/${invoiceId}/issue`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoice-details"] });
      toast.success("Invoice issued successfully. Amounts are locked.");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Issuance failed")
  });

  const voidMutation = useMutation({
    mutationFn: () => api.put(`/crm/finance/invoices/${invoiceId}/void`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoice-details"] });
      toast.success("Invoice marked as VOID");
    },
    onError: (err: any) => toast.error("Cancellation failed")
  });

  const quickClearMutation = useMutation({
    mutationFn: (data: any) => api.post(`/crm/finance/invoices/${invoiceId}/quick-clear`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoice-details"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard-stats"] });
      toast.success("Invoice fully cleared & verified payment auto-generated!");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to auto-clear invoice")
  });

  const payMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/finance/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoice-details"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard-stats"] });
      setIsPayOpen(false);
      setPayAmount(0);
      setRefNo("");
      setPayNotes("");
      toast.success("Payment recorded successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to record payment")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Invoice file not found</p>
      </div>
    );
  }

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      toast.error("Valid positive payment amount is required");
      return;
    }
    payMutation.mutate({
      customerId: inv.customerId,
      invoiceId: inv.id,
      amount: payAmount,
      paymentMethod: payMethod,
      referenceNumber: refNo || null,
      notes: payNotes || null
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 text-[#0B2148] print:p-0 print:bg-white print:text-black">
      
      {/* Controls */}
      <div className="flex items-center justify-between print:hidden">
        <button 
          onClick={() => router.push(`/${roleSlug}/finance/invoices`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-white font-bold text-sm bg-[#F4F9FF] border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Registry
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                toast.info("Preparing invoice PDF...");
                await downloadAuthenticatedFile(`/crm/finance/invoices/${invoiceId}/pdf`, `invoice-${invoice?.invoiceNumber || invoiceId}.pdf`);
                toast.success("Downloaded invoice PDF");
              } catch {
                toast.error("Failed to download invoice PDF");
              }
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Download Invoice PDF
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 text-[#0B2148] hover:text-white font-bold text-sm bg-[#F4F9FF] border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Print
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column Overview */}
        <div className="lg:col-span-1 space-y-6 print:col-span-3">
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6 print:border-none print:bg-transparent">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest font-mono">Invoice Number</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono print:text-black">{inv.invoiceNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                inv.status === "PAID" ? "bg-emerald-500/15 text-emerald-400" :
                inv.status === "ISSUED" ? "bg-blue-500/15 text-blue-400" :
                "bg-slate-500/15 text-[#0B2148]"
              }`}>
                {inv.status}
              </span>
            </div>

            <div className="space-y-4 text-xs border-t border-[#D8E8FA] pt-4 print:text-black">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148] print:text-black">{inv.customer?.name}</p>
                  <p className="text-[#526B91]">Customer</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="font-semibold text-[#0B2148] print:text-black">{inv.billingAddressSnapshot}</p>
                  <p className="text-[#526B91] text-[10px]">Billing address snapshot</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-[#D8E8FA] pt-4">
                <div>
                  <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">Invoice Date</p>
                  <p className="text-[#0B2148] font-mono print:text-black">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">Due Date</p>
                  <p className="text-[#0B2148] font-mono print:text-black">{new Date(inv.dueDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Workflow controls */}
            <div className="border-t border-[#D8E8FA] pt-6 space-y-3 print:hidden">
              {inv.status === "DRAFT" && (
                <button
                  onClick={() => issueMutation.mutate()}
                  className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Issue Invoice
                </button>
              )}

              {inv.status !== "DRAFT" && inv.status !== "VOID" && inv.status !== "PAID" && (
                <div className="space-y-2">
                  <button
                    onClick={() => quickClearMutation.mutate({
                      paymentMethod: "BANK_TRANSFER",
                      referenceNumber: `CLEAR-${inv.invoiceNumber}`,
                      notes: `Direct full clearance for ${inv.invoiceNumber}`
                    })}
                    disabled={quickClearMutation.isPending}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    {quickClearMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>Auto-Clear & Pay Full (₹{parseFloat(inv.outstandingAmount).toLocaleString()})</span>
                  </button>

                  <button
                    onClick={() => {
                      setPayAmount(parseFloat(inv.outstandingAmount));
                      setIsPayOpen(true);
                    }}
                    className="w-full py-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] text-[#0B2148] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Custom / Partial Payment
                  </button>
                  <button
                    onClick={() => voidMutation.mutate()}
                    className="w-full py-2.5 bg-red-600/10 border border-red-500/20 text-red-400 font-bold text-xs rounded-xl hover:bg-red-500/20 transition-all cursor-pointer"
                  >
                    Void Invoice
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column details */}
        <div className="lg:col-span-2 space-y-6 print:col-span-3">
          
          {/* Invoice line items */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 print:border-none print:bg-transparent">
            <h3 className="text-lg font-display font-bold text-[#0B2148] print:text-black">Invoice Line Items</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold GHM-th-invoice uppercase tracking-wider print:text-black">
                  <th className="pb-3">Blueprint / Item</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Qty</th>
                  <th className="pb-3">Unit Price</th>
                  <th className="pb-3">Discount</th>
                  <th className="pb-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148] print:text-black print:divide-black/10">
                {inv.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4 font-bold text-[#0B2148] print:text-black font-mono">{item.productRef || "Bulk Item"}</td>
                    <td className="py-4 text-[#526B91] print:text-black max-w-xs">{item.description}</td>
                    <td className="py-4 font-mono">{item.quantity}</td>
                    <td className="py-4 font-mono">₹ {parseFloat(item.unitPrice).toLocaleString()}</td>
                    <td className="py-4 font-mono text-red-400">₹ {parseFloat(item.discount).toLocaleString()}</td>
                    <td className="py-4 text-right font-mono font-bold text-[#0B2148] print:text-black">
                      ₹ {parseFloat(item.lineTotal).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing calculations card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:col-span-3">
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 print:border-none print:bg-transparent print:text-black">
              <h3 className="text-sm font-display font-bold text-[#0B2148] uppercase tracking-wider print:text-black">Tax & Discounts</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Gross Subtotal:</span>
                  <span className="font-mono text-[#0B2148] print:text-black">₹ {parseFloat(inv.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">BOM/Sales Discount:</span>
                  <span className="font-mono text-red-400">₹ {parseFloat(inv.discount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Sales Tax (GST):</span>
                  <span className="font-mono text-[#0B2148] print:text-black">₹ {parseFloat(inv.tax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-[#D8E8FA] pt-2 font-bold text-sm">
                  <span className="text-[#0B2148] print:text-black">Grand Total:</span>
                  <span className="font-mono text-accent">₹ {parseFloat(inv.grandTotal).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 print:border-none print:bg-transparent print:text-black">
              <h3 className="text-sm font-display font-bold text-[#0B2148] uppercase tracking-wider print:text-black">Receivable Balance</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Amounts Settled (Paid):</span>
                  <span className="font-mono text-[#166534]">₹ {parseFloat(inv.paidAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-[#D8E8FA] pt-2 font-bold text-sm">
                  <span className="text-[#0B2148] print:text-black">Outstanding Balance:</span>
                  <span className="font-mono text-amber-400">₹ {parseFloat(inv.outstandingAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment receipt history */}
          {inv.payments && inv.payments.length > 0 && (
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 print:border-none print:bg-transparent">
              <h3 className="text-sm font-display font-bold text-[#0B2148] uppercase tracking-wider print:text-black">Collections History</h3>
              <div className="space-y-3">
                {inv.payments.map((pay: any) => (
                  <div key={pay.id} className="p-4 rounded-xl border border-[#D8E8FA] bg-[#F4F9FF] flex justify-between text-xs text-[#0B2148] print:text-black print:border-black/10">
                    <div>
                      <span className="font-bold text-[#0B2148] font-mono block print:text-black">{pay.paymentReference}</span>
                      <p className="mt-1">Method: {pay.paymentMethod} | Ref: {pay.referenceNumber || "-"}</p>
                      <p className="text-[#526B91] text-[10px]">Recorded by: {pay.recordedBy?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#166534]">₹ {parseFloat(pay.amount).toLocaleString()}</p>
                      <p className="text-[10px] text-[#526B91] mt-1">{new Date(pay.paymentDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Payment Drawer Modal */}
      {isPayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4">
          <div className="p-6 max-w-md w-full bg-white border border-[#D8E8FA] rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-base font-display font-bold text-[#0B2148]">Record Payment Receipt</h3>
            
            <form onSubmit={handlePaySubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Amount Received (₹) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value))}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] font-mono focus:border-[#0878F9] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="CASH">Cash Deposit</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="OTHER">Other Method</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Reference / Transaction Number</label>
                <input 
                  type="text" 
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="UTR or Cheque Number"
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none placeholder-[#64748B]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Collection Notes</label>
                <input 
                  type="text" 
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Payment receipt remarks..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none placeholder-[#64748B]"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button type="button" onClick={() => setIsPayOpen(false)} className="px-3.5 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] text-xs font-semibold cursor-pointer transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer">
                  Save Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
