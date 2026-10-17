"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl, downloadAuthenticatedFile } from "@/lib/api";
import { 
  IndianRupee, 
  Search, 
  Loader2, 
  ChevronRight,
  ClipboardList,
  FileDown,
  Eye,
  Plus,
  Zap,
  CheckCircle2,
  Trash2,
  X,
  FileText,
  Building2,
  Calendar,
  AlertCircle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";

interface LineItemInput {
  productRef: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export default function InvoicesRegistryPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuickClearOpen, setIsQuickClearOpen] = useState(false);
  const [selectedInvoiceToClear, setSelectedInvoiceToClear] = useState<any>(null);

  // Quick Clear Form state
  const [clearMethod, setClearMethod] = useState("BANK_TRANSFER");
  const [clearRef, setClearRef] = useState("");
  const [clearNotes, setClearNotes] = useState("");

  // Create Invoice Form State
  const [createMode, setCreateMode] = useState<"SALES_ORDER" | "MANUAL">("SALES_ORDER");
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [paymentTerms, setPaymentTerms] = useState("Net 15 Days");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<"ISSUED" | "DRAFT">("ISSUED");

  // Manual items state
  const [manualItems, setManualItems] = useState<LineItemInput[]>([
    {
      productRef: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      taxRate: 18
    }
  ]);

  // --- DATA FETCHING ---
  const { data: rawInvoices, isLoading } = useQuery({
    queryKey: ["finance-invoices-list", statusFilter],
    queryFn: async () => {
      const res = await api.get("/crm/finance/invoices", {
        params: { status: statusFilter || undefined }
      });
      return res.data;
    }
  });

  const { data: rawCustomers } = useQuery({
    queryKey: ["crm-customers-for-invoice"],
    queryFn: async () => {
      const res = await api.get("/crm/customers", { params: { limit: 100 } });
      return res.data;
    },
    enabled: isCreateOpen
  });

  const { data: rawSalesOrders } = useQuery({
    queryKey: ["crm-sales-orders-for-invoice"],
    queryFn: async () => {
      const res = await api.get("/crm/sales-orders", { params: { limit: 100 } });
      return res.data;
    },
    enabled: isCreateOpen
  });

  const invoices: any[] = Array.isArray(rawInvoices) ? rawInvoices : (rawInvoices?.invoices || []);
  const customers: any[] = Array.isArray(rawCustomers) ? rawCustomers : (rawCustomers?.customers || []);
  const salesOrders: any[] = Array.isArray(rawSalesOrders) ? rawSalesOrders : (rawSalesOrders?.orders || []);

  // --- MUTATIONS ---
  const quickClearMutation = useMutation({
    mutationFn: async ({ invoiceId, data }: { invoiceId: string; data: any }) => {
      return (await api.post(`/crm/finance/invoices/${invoiceId}/quick-clear`, data)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard-stats"] });
      toast.success(data?.message || "Invoice cleared and verified payment auto-generated!");
      setIsQuickClearOpen(false);
      setSelectedInvoiceToClear(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to auto-clear invoice");
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      return (await api.post("/crm/finance/invoices", payload)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-list"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard-stats"] });
      toast.success(`Invoice ${data.invoiceNumber} created successfully!`);
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create invoice");
    }
  });

  const resetCreateForm = () => {
    setSelectedSalesOrderId("");
    setSelectedCustomerId("");
    setBillingAddress("");
    setShippingAddress("");
    setAdditionalCharges(0);
    setInvoiceNotes("");
    setInvoiceStatus("ISSUED");
    setManualItems([
      {
        productRef: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 18
      }
    ]);
  };

  // Handle Sales Order Selection
  const handleSalesOrderSelect = (soId: string) => {
    setSelectedSalesOrderId(soId);
    const so = salesOrders?.find((o: any) => o.id === soId);
    if (so) {
      setSelectedCustomerId(so.customerId || "");
      setBillingAddress(so.billingAddressSnapshot || so.customer?.billingAddress || "");
      setShippingAddress(so.shippingAddressSnapshot || so.customer?.shippingAddress || "");
      setPaymentTerms(so.paymentTerms || "Full Advance");
      setAdditionalCharges(Number(so.additionalCharges || 0));
      if (so.items && so.items.length > 0) {
        setManualItems(
          so.items.map((it: any) => ({
            productRef: it.productRef || "",
            description: it.description || "",
            quantity: Number(it.quantityOrdered || 1),
            unitPrice: Number(it.unitPrice || 0),
            discount: Number(it.discount || 0),
            taxRate: Number(it.taxRate || 18)
          }))
        );
      }
    }
  };

  // Handle Customer Selection in Manual Mode
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const c = customers?.find((item: any) => item.id === custId);
    if (c) {
      setBillingAddress(`${c.billingAddress || ""}, ${c.city || ""}, ${c.state || ""} - ${c.postalCode || ""}`);
      setShippingAddress(`${c.shippingAddress || ""}, ${c.city || ""}, ${c.state || ""} - ${c.postalCode || ""}`);
    }
  };

  // Item management in manual list
  const handleAddItemRow = () => {
    setManualItems([
      ...manualItems,
      {
        productRef: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 18
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (manualItems.length <= 1) return;
    setManualItems(manualItems.filter((_, i) => i !== idx));
  };

  const handleUpdateItem = (idx: number, field: keyof LineItemInput, val: any) => {
    const updated = [...manualItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setManualItems(updated);
  };

  // Real-time calculation helpers
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    manualItems.forEach((it) => {
      const lineSub = Number(it.quantity || 0) * Number(it.unitPrice || 0);
      const disc = Number(it.discount || 0);
      const taxable = Math.max(0, lineSub - disc);
      const tax = (taxable * Number(it.taxRate || 0)) / 100;

      subtotal += lineSub;
      totalDiscount += disc;
      totalTax += tax;
    });

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const grandTotal = taxableAmount + totalTax + Number(additionalCharges || 0);

    return { subtotal, totalDiscount, taxableAmount, totalTax, grandTotal };
  };

  const totals = calculateTotals();

  // Handle Quick Clear Submit
  const handleConfirmQuickClear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceToClear) return;
    quickClearMutation.mutate({
      invoiceId: selectedInvoiceToClear.id,
      data: {
        paymentMethod: clearMethod,
        referenceNumber: clearRef || `CLEAR-${selectedInvoiceToClear.invoiceNumber}`,
        notes: clearNotes || `Instant settlement for ${selectedInvoiceToClear.invoiceNumber}`
      }
    });
  };

  // Handle Create Invoice Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (manualItems.some((it) => !it.description || it.quantity <= 0 || it.unitPrice <= 0)) {
      toast.error("Please ensure all line items have description, valid quantity, and unit price");
      return;
    }

    const payload: any = {
      customerId: selectedCustomerId,
      salesOrderId: createMode === "SALES_ORDER" && selectedSalesOrderId ? selectedSalesOrderId : null,
      dueDate: new Date(dueDate).toISOString(),
      currency: "INR",
      additionalCharges: Number(additionalCharges || 0),
      paymentTerms: paymentTerms || "Full Advance",
      billingAddressSnapshot: billingAddress || "N/A",
      shippingAddressSnapshot: shippingAddress || "N/A",
      notes: invoiceNotes || null,
      status: invoiceStatus,
      items: manualItems.map((it) => ({
        productRef: it.productRef || null,
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount || 0),
        taxRate: Number(it.taxRate || 0)
      }))
    };

    createInvoiceMutation.mutate(payload);
  };

  const filtered = invoices?.filter((inv: any) => 
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.salesOrder?.salesOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalOutstandingSum = invoices?.reduce((acc: number, cur: any) => acc + (cur.status !== 'PAID' && cur.status !== 'VOID' ? parseFloat(cur.outstandingAmount || 0) : 0), 0) || 0;
  const unpaidCount = invoices?.filter((i: any) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID').length || 0;

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      {/* Header */}
      <PageHeader
        title="Invoice Registry"
        subtitle="Billing manifests, sales taxing, automated clearance & payment collections"
        icon={<IndianRupee className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-3 bg-white border border-[#D8E8FA] px-3 py-1.5 rounded-xl shadow-xs">
              <div>
                <p className="text-[9px] uppercase font-bold text-[#526B91]">Outstanding</p>
                <p className="text-xs font-mono font-bold text-amber-600">₹{totalOutstandingSum.toLocaleString()}</p>
              </div>
              <div className="h-5 w-px bg-[#D8E8FA]" />
              <div>
                <p className="text-[9px] uppercase font-bold text-[#526B91]">Unpaid</p>
                <p className="text-xs font-mono font-bold text-[#0B2148]">{unpaidCount}</p>
              </div>
            </div>

            <button
              onClick={() => {
                resetCreateForm();
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-[#F4F9FF] border border-[#D8E8FA] p-4 rounded-3xl">
        <div className="relative flex-1 w-full min-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search billing invoices by (INV #, SO #, Customer)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm text-[#0B2148] focus:outline-none focus:border-accent/50 transition-colors w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued / Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Fully Paid</option>
          <option value="VOID">Voided</option>
        </select>
      </div>

      {/* Registry Grid */}
      <div className="glass-panel rounded-[2.5rem] border border-[#D8E8FA] bg-[#F4F9FF] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-white/[0.01]">
                  <th className="p-6">Invoice Number</th>
                  <th className="p-6">Sales Order</th>
                  <th className="p-6">Customer</th>
                  <th className="p-6">Invoice Date</th>
                  <th className="p-6">Due Date</th>
                  <th className="p-6">Grand Total</th>
                  <th className="p-6">Outstanding</th>
                  <th className="p-6">Status</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {filtered.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-white/[0.015] transition-colors">
                    <td className="p-6 font-mono font-bold text-[#0B2148] text-sm">{inv.invoiceNumber}</td>
                    <td className="p-6 font-mono text-xs text-[#526B91]">{inv.salesOrder?.salesOrderNumber || "Direct / Custom"}</td>
                    <td className="p-6 font-semibold text-[#0B2148]">{inv.customer?.name}</td>
                    <td className="p-6 text-[#526B91]">
                      {new Date(inv.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="p-6 text-[#526B91] font-semibold">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="p-6 font-mono font-bold text-[#0B2148]">₹ {parseFloat(inv.grandTotal).toLocaleString()}</td>
                    <td className="p-6 font-mono font-bold text-amber-400">
                      ₹ {parseFloat(inv.outstandingAmount).toLocaleString()}
                    </td>
                    <td className="p-6">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                        inv.status === "PAID" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                        inv.status === "PARTIALLY_PAID" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                        inv.status === "ISSUED" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                        "bg-slate-500/15 text-[#0B2148] border border-slate-500/20"
                      }`}>
                        {inv.status === "PAID" && <CheckCircle2 className="w-3 h-3" />}
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        {/* Auto-generate payment / Clear Invoice Button */}
                        {inv.status !== "PAID" && inv.status !== "VOID" && (
                          <button 
                            onClick={() => {
                              setSelectedInvoiceToClear(inv);
                              setClearRef(`CLEAR-${inv.invoiceNumber}`);
                              setClearNotes(`Instant settlement for ${inv.invoiceNumber}`);
                              setIsQuickClearOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10"
                            title="Auto-generate Payment & Clear Invoice"
                          >
                            <Zap className="w-3.5 h-3.5 fill-emerald-400/20" />
                            <span>Auto-Clear</span>
                          </button>
                        )}

                        <button 
                          onClick={() => router.push(`/${roleSlug}/finance/invoices/${inv.id}`)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] hover:text-white rounded-lg border border-[#D8E8FA] transition-all flex items-center gap-1.5 cursor-pointer"
                          title="View Invoice Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#526B91]" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              toast.info(`Preparing PDF for invoice ${inv.invoiceNumber}...`);
                              await downloadAuthenticatedFile(`/crm/finance/invoices/${inv.id}/pdf`, `invoice-${inv.invoiceNumber || inv.id}.pdf`);
                              toast.success(`Downloaded PDF for invoice ${inv.invoiceNumber}`);
                            } catch {
                              toast.error(`Failed to download PDF for invoice ${inv.invoiceNumber}`);
                            }
                          }}
                          className="p-1.5 text-[#526B91] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg border border-[#D8E8FA] transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                          title="Download Invoice PDF"
                        >
                          <FileDown className="w-3.5 h-3.5 text-blue-400" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 text-[#526B91]">
            <ClipboardList className="w-12 h-12 mb-4 opacity-50" />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: AUTO-GENERATE PAYMENT & CLEAR CUSTOMER INVOICE   */}
      {/* ========================================================= */}
      {isQuickClearOpen && selectedInvoiceToClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="p-6 max-w-lg w-full bg-white border border-[#D8E8FA] rounded-2xl space-y-5 shadow-2xl relative">
            <button 
              onClick={() => setIsQuickClearOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#166534]">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-[#0B2148]">Auto-Clear Customer Invoice</h3>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Instantly record verified payment & mark invoice fully settled
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#526B91]">Invoice:</span>
                <span className="font-mono font-bold text-[#0B2148]">{selectedInvoiceToClear.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#526B91]">Customer:</span>
                <span className="font-semibold text-[#0B2148]">{selectedInvoiceToClear.customer?.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#526B91]">Sales Order Ref:</span>
                <span className="font-mono text-[#0B2148]">{selectedInvoiceToClear.salesOrder?.salesOrderNumber || "Direct Invoice"}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-[#D8E8FA] pt-2 font-bold">
                <span className="text-[#0B2148]">Amount to Auto-Clear:</span>
                <span className="font-mono text-[#166534] text-sm">
                  ₹ {parseFloat(selectedInvoiceToClear.outstandingAmount).toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmQuickClear} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Payment Method</label>
                <select
                  value={clearMethod}
                  onChange={(e) => setClearMethod(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI / Instant Pay</option>
                  <option value="CASH">Cash Deposit</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="OTHER">Other Method</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Transaction Reference Number</label>
                <input 
                  type="text" 
                  value={clearRef}
                  onChange={(e) => setClearRef(e.target.value)}
                  placeholder="UTR / Cheque / Bank Txn Ref"
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] placeholder-[#64748B]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Clearance Notes</label>
                <input 
                  type="text" 
                  value={clearNotes}
                  onChange={(e) => setClearNotes(e.target.value)}
                  placeholder="Settlement notes..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] placeholder-[#64748B]"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button 
                  type="button" 
                  onClick={() => setIsQuickClearOpen(false)}
                  className="px-3.5 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={quickClearMutation.isPending}
                  className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  {quickClearMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirm & Auto-Clear Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CREATE INVOICE MODAL                             */}
      {/* ========================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="p-6 max-w-4xl w-full bg-white border border-[#D8E8FA] rounded-2xl space-y-5 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-[#0B2148]">Generate Customer Tax Invoice</h3>
                <p className="text-xs text-[#526B91] mt-0.5">
                  Generate billing manifest from approved sales order or create direct invoice
                </p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex gap-2 p-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setCreateMode("SALES_ORDER")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  createMode === "SALES_ORDER"
                    ? "bg-[#0878F9] text-white shadow-xs"
                    : "text-[#526B91] hover:text-[#0878F9]"
                }`}
              >
                From Approved Sales Order
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("MANUAL")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  createMode === "MANUAL"
                    ? "bg-[#0878F9] text-white shadow-xs"
                    : "text-[#526B91] hover:text-[#0878F9]"
                }`}
              >
                Direct / Custom Items
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              
              {/* Sales Order / Customer Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {createMode === "SALES_ORDER" ? (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Select Sales Order *</label>
                    <select
                      required
                      value={selectedSalesOrderId}
                      onChange={(e) => handleSalesOrderSelect(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="">-- Choose Sales Order --</option>
                      {(salesOrders || [])
                        .filter((so: any) => so && so.status !== "CANCELLED")
                        .map((so: any) => (
                          <option key={so.id} value={so.id}>
                            {so.salesOrderNumber} - {so.customer?.name || "Customer"} (₹{parseFloat(so.grandTotal || 0).toLocaleString()}) [{so.status}]
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Select Customer *</label>
                    <select
                      required
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="">-- Choose Customer --</option>
                      {(customers || []).map((c: any) => c ? (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.customerCode ? `(${c.customerCode})` : ""} - {c.city || ""}
                        </option>
                      ) : null)}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Invoice Due Date *</label>
                  <input 
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Payment Terms</label>
                  <input 
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. Net 30 Days, 100% Advance"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Billing Address Snapshot</label>
                  <textarea 
                    rows={2}
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Billing street address, city, state, postal code..."
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Shipping Address Snapshot</label>
                  <textarea 
                    rows={2}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Shipping terminal / site address..."
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] resize-none"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B2148]">
                    Line Items & Tax Rates
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-xs font-bold text-[#0878F9] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {manualItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] text-[#526B91] uppercase font-bold">Product / Part Code</label>
                        <input 
                          type="text"
                          placeholder="e.g. KZ-BATT-48V"
                          value={item.productRef}
                          onChange={(e) => handleUpdateItem(idx, "productRef", e.target.value)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-md px-2.5 py-1 text-xs text-[#0B2148] font-mono focus:border-[#0878F9] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] text-[#526B91] uppercase font-bold">Description *</label>
                        <input 
                          type="text"
                          required
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(idx, "description", e.target.value)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-md px-2.5 py-1 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] text-[#526B91] uppercase font-bold">Qty *</label>
                        <input 
                          type="number"
                          min={1}
                          required
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono text-center focus:border-[#0878F9] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] text-[#526B91] uppercase font-bold">Unit Price (₹) *</label>
                        <input 
                          type="number"
                          step="0.01"
                          min={0}
                          required
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-md px-2.5 py-1 text-xs text-[#0B2148] font-mono focus:border-[#0878F9] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] text-[#526B91] uppercase font-bold">GST %</label>
                        <input 
                          type="number"
                          min={0}
                          max={100}
                          value={item.taxRate}
                          onChange={(e) => handleUpdateItem(idx, "taxRate", parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono text-center focus:border-[#0878F9] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] text-[#526B91] uppercase font-bold">Disc (₹)</label>
                        <input 
                          type="number"
                          min={0}
                          value={item.discount}
                          onChange={(e) => handleUpdateItem(idx, "discount", parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono text-center focus:border-[#0878F9] focus:outline-none"
                        />
                      </div>

                      <div className="md:col-span-1 flex justify-center pb-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={manualItems.length <= 1}
                          className="p-1 text-[#526B91] hover:text-[#991B1B] disabled:opacity-20 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra charges & Calculation summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Freight & Logistics Charges (₹)</label>
                    <input 
                      type="number" 
                      min={0}
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-[#D8E8FA] rounded-md px-2.5 py-1.5 text-xs text-[#0B2148] font-mono focus:border-[#0878F9] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Invoice Notes / Bank Remarks</label>
                    <input 
                      type="text"
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      placeholder="Payment instructions or PO reference notes..."
                      className="w-full bg-white border border-[#D8E8FA] rounded-md px-2.5 py-1.5 text-xs text-[#0B2148] focus:border-[#0878F9] focus:outline-none placeholder-[#64748B]"
                    />
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Initial Status</label>
                    <div className="flex gap-4 items-center text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-[#0B2148]">
                        <input 
                          type="radio" 
                          name="invStatus"
                          checked={invoiceStatus === "ISSUED"}
                          onChange={() => setInvoiceStatus("ISSUED")}
                          className="accent-[#0878F9]"
                        />
                        <span>Issue Immediately</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-[#0B2148]">
                        <input 
                          type="radio" 
                          name="invStatus"
                          checked={invoiceStatus === "DRAFT"}
                          onChange={() => setInvoiceStatus("DRAFT")}
                          className="accent-[#0878F9]"
                        />
                        <span>Save as Draft</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs border-l border-[#D8E8FA] pl-4 flex flex-col justify-center">
                  <div className="flex justify-between text-[#526B91]">
                    <span>Gross Subtotal:</span>
                    <span className="font-mono text-[#0B2148]">₹ {totals.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#526B91]">
                    <span>Discount:</span>
                    <span className="font-mono text-[#991B1B]">- ₹ {totals.totalDiscount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#526B91]">
                    <span>GST Taxes:</span>
                    <span className="font-mono text-[#0B2148]">₹ {totals.totalTax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#526B91]">
                    <span>Freight / Shipping:</span>
                    <span className="font-mono text-[#0B2148]">₹ {Number(additionalCharges || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#D8E8FA] pt-2 text-sm font-bold">
                    <span className="text-[#0B2148]">Grand Total:</span>
                    <span className="font-mono text-[#0878F9] text-base">₹ {totals.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-lg text-[#0B2148] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createInvoiceMutation.isPending}
                  className="px-5 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  {createInvoiceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Create Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
