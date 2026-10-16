"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  FileText,
  IndianRupee,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Eye,
  Banknote,
  Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

export default function ApprovedTransactionsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["approved-transactions"],
    queryFn: async () => (await api.get("/crm/finance/approved-transactions")).data,
  });

  const [invoiceModal, setInvoiceModal] = useState<any>(null);
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/finance/invoices", data),
    onSuccess: () => {
      toast.success("Invoice created and issued successfully");
      queryClient.invalidateQueries({ queryKey: ["approved-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      setInvoiceModal(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to create invoice"),
  });

  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    referenceNumber: "",
    notes: "",
  });
  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/finance/payments", data),
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["approved-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      setPaymentModal(null);
      setPaymentForm({ amount: "", paymentMethod: "BANK_TRANSFER", referenceNumber: "", notes: "" });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to record payment"),
  });

  const clearOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.put(`/crm/finance/sales-orders/${orderId}/clear`, {}),
    onSuccess: () => {
      toast.success("Order financially cleared! Production can now proceed.");
      queryClient.invalidateQueries({ queryKey: ["approved-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to clear order"),
  });

  const filtered = orders?.filter((o: any) => {
    const matchSearch =
      !search ||
      o.salesOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PENDING" && !o.isFinancialCleared) ||
      (statusFilter === "CLEARED" && o.isFinancialCleared);
    return matchSearch && matchStatus;
  });

  const totalOrders = orders?.length || 0;
  const clearedOrders = orders?.filter((o: any) => o.isFinancialCleared).length || 0;
  const pendingOrders = totalOrders - clearedOrders;
  const totalOutstanding = orders?.reduce((sum: number, o: any) => {
    const outstanding = o.invoices?.reduce(
      (s: number, inv: any) => s + parseFloat(inv.outstandingAmount || 0),
      0
    ) || 0;
    return sum + outstanding;
  }, 0) || 0;

  const getPaymentBadge = (order: any) => {
    if (!order.invoices || order.invoices.length === 0) return { label: "No Invoice", color: "bg-slate-500/15 text-[#526B91] border-slate-500/20" };
    const allPaid = order.invoices.every((i: any) => i.status === "PAID");
    const anyPaid = order.invoices.some((i: any) => parseFloat(i.paidAmount) > 0);
    if (allPaid) return { label: "Fully Paid", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
    if (anyPaid) return { label: "Partially Paid", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
    return { label: "Unpaid", color: "bg-red-500/15 text-red-400 border-red-500/20" };
  };

  return (
    <div className="space-y-4 text-[#0B2148]">
      <PageHeader
        title="Approved Transactions"
        description="Review confirmed sales orders, manage invoicing, and process financial clearances."
        icon={<Banknote className="w-5 h-5 text-[#0878F9]" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: totalOrders, icon: FileText, color: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400" },
          { label: "Pending Clearance", value: pendingOrders, icon: Clock, color: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-400" },
          { label: "Cleared", value: clearedOrders, icon: CheckCircle2, color: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-[#166534]" },
          { label: "Outstanding", value: `₹${totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, icon: IndianRupee, color: "from-purple-500/20 to-purple-600/5", iconColor: "text-purple-400" },
        ].map((card) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-[#D8E8FA] bg-gradient-to-br ${card.color} p-5`}>
            <div className="flex items-center gap-3">
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">{card.label}</span>
            </div>
            <p className="text-2xl font-display font-bold text-[#0B2148] mt-3">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by SO number or customer..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] text-white text-sm placeholder:text-[#64748B] focus:outline-none focus:border-accent/50" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] text-white text-sm focus:outline-none">
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending Clearance</option>
          <option value="CLEARED">Cleared</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-[#526B91] mt-4 text-sm">Loading transactions...</p>
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="rounded-2xl border border-[#D8E8FA] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8E8FA]">
                  {["SO Number", "Customer", "Grand Total", "Invoices", "Payment", "Outstanding", "Clearance", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold text-[#526B91] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order: any) => {
                  const paymentBadge = getPaymentBadge(order);
                  const totalOutstandingForOrder = order.invoices?.reduce((s: number, inv: any) => s + parseFloat(inv.outstandingAmount || 0), 0) || 0;
                  const allPaid = order.invoices?.length > 0 && order.invoices.every((i: any) => i.status === "PAID");
                  return (
                    <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-b border-white/[0.03] hover:bg-[#F4F9FF] transition-colors">
                      <td className="px-5 py-4"><span className="font-mono font-bold text-[#0B2148] text-xs">{order.salesOrderNumber}</span></td>
                      <td className="px-5 py-4 text-[#0B2148] text-xs">{order.customer?.name || "—"}</td>
                      <td className="px-5 py-4 text-[#0B2148] font-semibold text-xs">₹{parseFloat(order.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-4"><span className="text-xs text-[#0B2148]">{order.invoices?.length || 0} issued</span></td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${paymentBadge.color}`}>{paymentBadge.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`font-semibold text-xs ${totalOutstandingForOrder > 0 ? "text-red-400" : "text-[#166534]"}`}>
                          ₹{totalOutstandingForOrder.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {order.isFinancialCleared ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/20 flex items-center gap-1 w-fit">
                            <ShieldCheck className="w-3 h-3" /> Cleared
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/20 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => router.push(`/${roleSlug}/sales/orders/${order.id}`)}
                            className="p-1.5 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-white transition-all" title="View Order">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {order.invoices?.length === 0 && (
                            <button onClick={() => { setInvoiceModal(order); const d = new Date(); d.setDate(d.getDate() + 30); setInvoiceDueDate(d.toISOString().split("T")[0]); }}
                              className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all" title="Create Invoice">
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {order.invoices?.length > 0 && !allPaid && (
                            <button onClick={() => {
                              const activeInvoice = order.invoices.find((i: any) => i.status !== "PAID" && i.status !== "VOID");
                              if (activeInvoice) {
                                setPaymentModal({ order, invoice: activeInvoice });
                                setPaymentForm({ amount: parseFloat(activeInvoice.outstandingAmount).toString(), paymentMethod: "BANK_TRANSFER", referenceNumber: "", notes: "" });
                              }
                            }} className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-[#166534] transition-all" title="Record Payment">
                              <Banknote className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {allPaid && !order.isFinancialCleared && (
                            <button onClick={() => clearOrderMutation.mutate(order.id)}
                              className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 transition-all" title="Clear Order">
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl border border-[#D8E8FA] bg-white">
          <FileText className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-base font-semibold text-[#526B91] mt-4">No transactions found</p>
          <p className="text-[#526B91] text-sm mt-1">Confirmed sales orders will appear here</p>
        </div>
      )}

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {invoiceModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4" onClick={() => setInvoiceModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-white border border-[#D8E8FA] rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
              <h3 className="text-lg font-display font-bold text-[#0B2148] flex items-center gap-2"><Receipt className="w-5 h-5 text-[#0878F9]" />Create Invoice</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs"><span className="text-[#526B91]">Sales Order</span><span className="text-[#0B2148] font-mono font-bold">{invoiceModal.salesOrderNumber}</span></div>
                <div className="flex justify-between text-xs"><span className="text-[#526B91]">Customer</span><span className="text-[#0B2148] font-semibold">{invoiceModal.customer?.name}</span></div>
                <div className="flex justify-between text-xs"><span className="text-[#526B91]">Grand Total</span><span className="text-[#0B2148] font-bold">₹{parseFloat(invoiceModal.grandTotal).toLocaleString("en-IN")}</span></div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Due Date</label>
                  <input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] text-xs focus:outline-none focus:border-[#0878F9]" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setInvoiceModal(null)}
                  className="px-3.5 py-2 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] text-[#0B2148] text-xs font-semibold transition-colors cursor-pointer">Cancel</button>
                <button onClick={() => createInvoiceMutation.mutate({ salesOrderId: invoiceModal.id, customerId: invoiceModal.customerId, dueDate: invoiceDueDate })}
                  disabled={createInvoiceMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer">
                  {createInvoiceMutation.isPending ? "Creating..." : "Create & Issue Invoice"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {paymentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4" onClick={() => setPaymentModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-white border border-[#D8E8FA] rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
              <h3 className="text-lg font-display font-bold text-[#0B2148] flex items-center gap-2"><Banknote className="w-5 h-5 text-[#166534]" />Record Payment</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs"><span className="text-[#526B91]">Invoice</span><span className="text-[#0B2148] font-mono font-bold">{paymentModal.invoice.invoiceNumber}</span></div>
                <div className="flex justify-between text-xs"><span className="text-[#526B91]">Outstanding</span><span className="text-[#991B1B] font-bold">₹{parseFloat(paymentModal.invoice.outstandingAmount).toLocaleString("en-IN")}</span></div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Amount (₹)</label>
                  <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] font-mono text-xs focus:outline-none focus:border-[#0878F9]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Payment Method</label>
                  <select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] text-xs focus:outline-none focus:border-[#0878F9]">
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Reference Number</label>
                  <input value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    placeholder="Transaction ID, Cheque No., etc."
                    className="w-full px-3 py-2 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] text-xs placeholder:text-[#64748B] focus:outline-none focus:border-[#0878F9]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Notes</label>
                  <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] text-xs placeholder:text-[#64748B] focus:outline-none focus:border-[#0878F9] resize-none" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setPaymentModal(null)}
                  className="px-3.5 py-2 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] text-[#0B2148] text-xs font-semibold transition-colors cursor-pointer">Cancel</button>
                <button onClick={() => recordPaymentMutation.mutate({
                    invoiceId: paymentModal.invoice.id, customerId: paymentModal.order.customerId,
                    amount: parseFloat(paymentForm.amount), paymentMethod: paymentForm.paymentMethod,
                    referenceNumber: paymentForm.referenceNumber || undefined, notes: paymentForm.notes || undefined,
                  })}
                  disabled={recordPaymentMutation.isPending || !paymentForm.amount}
                  className="px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer">
                  {recordPaymentMutation.isPending ? "Processing..." : "Record Payment"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
