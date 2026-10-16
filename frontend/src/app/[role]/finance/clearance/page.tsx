"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  Eye,
  IndianRupee,
  FileText,
  ArrowRight,
  Zap,
  Search,
  AlertTriangle,
  CreditCard,
  Building2,
  Calendar,
  ExternalLink,
  Receipt,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

export default function FinancialClearancePage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"pending" | "ready" | "cleared" | "all">("pending");
  const [search, setSearch] = useState("");

  const { data: rawOrders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["approved-transactions"],
    queryFn: async () => (await api.get("/crm/finance/approved-transactions")).data,
  });

  const clearOrderMutation = useMutation({
    mutationFn: (orderId: string) => api.put(`/crm/finance/sales-orders/${orderId}/clear`, {}),
    onSuccess: () => {
      toast.success("Order financially cleared! Production requirement is now unlocked.");
      queryClient.invalidateQueries({ queryKey: ["approved-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["approved-transactions-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Failed to clear order"),
  });

  // Calculate authoritative payment & receivables metrics per order
  const orders = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.map((order: any) => {
      const grandTotal = parseFloat(order.grandTotal?.toString() || "0");

      // Verified Payments from order payments
      const verifiedPaymentsSum = (order.payments || [])
        .filter((p: any) => p.status === "VERIFIED")
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0);

      // Payments from invoices
      const invoicePaidSum = (order.invoices || [])
        .reduce((sum: number, inv: any) => sum + parseFloat(inv.paidAmount?.toString() || "0"), 0);

      const totalPaid = Math.max(verifiedPaymentsSum, invoicePaidSum);

      // Outstanding receivable on this order
      const totalOutstanding = Math.max(0, grandTotal - totalPaid);

      // Pending verification payments
      const pendingVerificationSum = (order.payments || [])
        .filter((p: any) => p.status === "PENDING_VERIFICATION")
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0);

      // Invoice status
      const hasInvoices = (order.invoices || []).length > 0;
      const allInvoicesPaid = hasInvoices && order.invoices.every((i: any) => i.status === "PAID");

      // Paid in full condition
      const isPaidInFull = (totalPaid >= grandTotal && grandTotal > 0) || allInvoicesPaid;

      // Ready to clear: Not yet cleared, and either paid in full or ready
      const isReadyToClear = !order.isFinancialCleared && isPaidInFull;

      return {
        ...order,
        grandTotalNum: grandTotal,
        totalPaidNum: totalPaid,
        totalOutstandingNum: totalOutstanding,
        pendingVerificationNum: pendingVerificationSum,
        isPaidInFull,
        isReadyToClear,
        hasInvoices
      };
    });
  }, [rawOrders]);

  const pending = useMemo(() => orders.filter((o: any) => !o.isFinancialCleared), [orders]);
  const readyToClear = useMemo(() => pending.filter((o: any) => o.isReadyToClear), [pending]);
  const cleared = useMemo(() => orders.filter((o: any) => o.isFinancialCleared), [orders]);

  // Total metrics
  const totalPendingReceivables = useMemo(() => {
    return pending.reduce((sum: number, o: any) => sum + o.totalOutstandingNum, 0);
  }, [pending]);

  const totalClearedVolume = useMemo(() => {
    return cleared.reduce((sum: number, o: any) => sum + o.grandTotalNum, 0);
  }, [cleared]);

  // Filter list
  const displayed = useMemo(() => {
    let list = tab === "pending" ? pending : tab === "ready" ? readyToClear : tab === "cleared" ? cleared : orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o: any) =>
        (o.salesOrderNumber || "").toLowerCase().includes(q) ||
        (o.customer?.name || "").toLowerCase().includes(q) ||
        (o.paymentTerms || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tab, pending, readyToClear, cleared, orders, search]);

  const handleCopyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard`);
  };

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="Financial Clearance Desk"
        description="Audit customer payments, verify advance receipt settlements, and grant financial clearance to unlock factory manufacturing."
        icon={<ShieldCheck className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Production Authorization
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {readyToClear.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-[#0878F9]">
                <Zap className="w-3.5 h-3.5 text-[#0878F9]" />
                <span>{readyToClear.length} Ready for Clearance</span>
              </div>
            )}
            
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="px-3.5 py-2 bg-white hover:bg-[#F4F9FF] text-[#0B2148] border border-[#D8E8FA] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#526B91] ${isRefetching ? "animate-spin text-[#0878F9]" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* 2. KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Pending Clearance */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending Clearance</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-display font-bold text-amber-800 font-mono">{pending.length}</p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              ₹ {totalPendingReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2 })} pending receivables
            </p>
          </div>
        </div>

        {/* Ready to Clear */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#0878F9] uppercase tracking-wider">Ready to Clear (100% Paid)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-300 flex items-center justify-center text-[#0878F9]">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-display font-bold text-[#0878F9] font-mono">{readyToClear.length}</p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              Payment confirmed • Awaiting accountant authorization
            </p>
          </div>
        </div>

        {/* Cleared Orders */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">Cleared & In Production</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-[#166534]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-display font-bold text-[#166534] font-mono">{cleared.length}</p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              ₹ {totalClearedVolume.toLocaleString("en-IN", { minimumFractionDigits: 2 })} manufacturing unlocked
            </p>
          </div>
        </div>

        {/* Total SO Volume */}
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Total Sales Orders</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-display font-bold text-[#0B2148] font-mono">{orders.length}</p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              {((cleared.length / (orders.length || 1)) * 100).toFixed(0)}% overall clearance rate
            </p>
          </div>
        </div>
      </div>

      {/* 3. Control Bar: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-[#D8E8FA] p-3 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA] text-xs">
          <button
            onClick={() => setTab("pending")}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "pending"
                ? "bg-amber-50 text-amber-800 border border-amber-300 shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            Pending Clearance ({pending.length})
          </button>

          <button
            onClick={() => setTab("ready")}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "ready"
                ? "bg-blue-50 text-[#0878F9] border border-blue-300 shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#0878F9]" />
            Ready to Clear ({readyToClear.length})
          </button>

          <button
            onClick={() => setTab("cleared")}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "cleared"
                ? "bg-emerald-50 text-[#166534] border border-emerald-300 shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" />
            Cleared Orders ({cleared.length})
          </button>

          <button
            onClick={() => setTab("all")}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "all"
                ? "bg-[#0878F9] text-white shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            All Orders ({orders.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
          <input
            type="text"
            placeholder="Search order number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* 4. Orders List */}
      {isLoading ? (
        <div className="text-center py-20 rounded-3xl border border-[#D8E8FA] bg-white">
          <div className="animate-spin w-8 h-8 border-2 border-[#0878F9] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#526B91] mt-3 text-xs font-mono">Loading financial transactions...</p>
        </div>
      ) : displayed.length > 0 ? (
        <div className="space-y-3">
          {displayed.map((order: any) => (
            <div
              key={order.id}
              className={`rounded-2xl border p-5 transition-all shadow-xs ${
                order.isFinancialCleared
                  ? "border-emerald-200 bg-white"
                  : order.isReadyToClear
                  ? "border-blue-200 bg-[#F4F9FF]"
                  : "border-[#D8E8FA] bg-white hover:bg-[#F4F9FF]/50"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Left: Identifiers & Customer */}
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
                      order.isFinancialCleared
                        ? "bg-emerald-50 text-[#166534] border-emerald-200"
                        : order.isReadyToClear
                        ? "bg-blue-50 text-[#0878F9] border-blue-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {order.isFinancialCleared ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : order.isReadyToClear ? (
                      <Zap className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0B2148] text-sm">
                        {order.salesOrderNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(order.salesOrderNumber)}
                        className="text-[#526B91] hover:text-[#0B2148] transition-colors"
                        title="Copy SO Number"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {order.isFinancialCleared ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-[#166534] border border-emerald-200 uppercase">
                          Cleared
                        </span>
                      ) : order.isReadyToClear ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-[#0878F9] border border-blue-200 uppercase animate-pulse">
                          Ready for Clearance
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                          Payment Pending
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#526B91] mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[#0B2148]">{order.customer?.name}</span>
                      <span>•</span>
                      <span>Terms: {order.paymentTerms || "Standard"}</span>
                      {order.hasInvoices && (
                        <>
                          <span>•</span>
                          <span className="text-[#526B91]">{order.invoices.length} {order.invoices.length === 1 ? "invoice" : "invoices"}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: Financial Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2.5 px-4 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] text-xs">
                  {/* Order Grand Total */}
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Order Value</p>
                    <p className="font-mono font-bold text-[#0B2148] text-xs mt-0.5">
                      ₹ {order.grandTotalNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Verified Paid */}
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Verified Paid</p>
                    <p className="font-mono font-bold text-[#166534] text-xs mt-0.5">
                      ₹ {order.totalPaidNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Pending Audit */}
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Pending Audit</p>
                    <p className={`font-mono font-bold text-xs mt-0.5 ${order.pendingVerificationNum > 0 ? "text-amber-800" : "text-[#526B91]"}`}>
                      {order.pendingVerificationNum > 0
                        ? `₹ ${order.pendingVerificationNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "₹ 0.00"}
                    </p>
                  </div>

                  {/* Outstanding Receivable */}
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Receivable Due</p>
                    <p className={`font-mono font-bold text-xs mt-0.5 ${order.totalOutstandingNum > 0 ? "text-rose-700" : "text-[#166534]"}`}>
                      ₹ {order.totalOutstandingNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <button
                    onClick={() => router.push(`/${roleSlug}/sales/orders/${order.id}`)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F4F9FF] text-[#0B2148] border border-[#D8E8FA] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="View Order Details & Line Items"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#526B91]" />
                    View Order
                  </button>

                  {order.pendingVerificationNum > 0 && (
                    <button
                      onClick={() => router.push(`/${roleSlug}/finance/payments`)}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Audit pending payment receipt"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Verify Pay
                    </button>
                  )}

                  {!order.isFinancialCleared && (
                    <button
                      onClick={() => clearOrderMutation.mutate(order.id)}
                      disabled={clearOrderMutation.isPending || !order.isPaidInFull}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        order.isPaidInFull
                          ? "bg-[#0878F9] hover:bg-[#0665d0] text-white shadow-xs cursor-pointer"
                          : "bg-[#F4F9FF] text-[#526B91] border border-[#D8E8FA] cursor-not-allowed opacity-60"
                      }`}
                      title={order.isPaidInFull ? "Authorize order for manufacturing" : "Requires full payment settlement before clearance"}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Clear for Production
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {order.isFinancialCleared && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#166534] border border-emerald-200 text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Cleared</span>
                      {order.financialClearedAt && (
                        <span className="text-[10px] text-[#166534]/70 font-mono">
                          • {new Date(order.financialClearedAt).toLocaleDateString("en-IN")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-3xl border border-[#D8E8FA] bg-white shadow-xs">
          <ShieldCheck className="w-10 h-10 text-[#526B91]/40 mx-auto" />
          <p className="text-sm font-semibold text-[#0B2148] mt-3">
            {tab === "pending" ? "No sales orders pending financial clearance" : "No cleared sales orders found"}
          </p>
          <p className="text-[#526B91] text-xs mt-1">
            {tab === "pending" ? "All customer orders have received financial clearance." : "Orders will appear here once cleared by Accountant."}
          </p>
        </div>
      )}
    </div>
  );
}
