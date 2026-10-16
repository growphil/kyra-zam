"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ClipboardList, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  AlertTriangle, 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  X,
  ExternalLink,
  Eye
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function SalesOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  // Search, Filter & Pagination State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Customer Payment Ledger Modal State
  const [selectedOrderForPayments, setSelectedOrderForPayments] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // --- DATA FETCHING ---
  const { data: dashboardData } = useQuery({
    queryKey: ["sales-orders-dashboard"],
    queryFn: async () => (await api.get("/crm/sales-orders/dashboard")).data,
    refetchInterval: 10000
  });

  const { data: listData, isLoading, isRefetching } = useQuery({
    queryKey: ["sales-orders-list", search, status, paymentStatus, priority, page, limit],
    queryFn: async () => {
      const res = await api.get("/crm/sales-orders", {
        params: { 
          search: search || undefined, 
          status: status || undefined, 
          paymentStatus: paymentStatus || undefined,
          priority: priority || undefined, 
          page, 
          limit 
        }
      });
      return res.data;
    }
  });

  const orders = listData?.orders || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const stats = dashboardData?.stats || {};

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentStatus("");
    setPriority("");
    setPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      if (start === 1) {
        end = maxVisiblePages;
      } else if (end === totalPages) {
        start = totalPages - maxVisiblePages + 1;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const isFilterActive = search || status || paymentStatus || priority;
  const startRange = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalCount);

  // Helper to calculate payment amounts
  const getOrderPaymentBreakdown = (o: any) => {
    const grandTotal = Number(o.grandTotal || 0);
    const paymentsList = o.payments || [];
    const verifiedPayments = paymentsList.filter((p: any) => 
      ["VERIFIED", "APPROVED", "ACCEPTED", "CONFIRMED"].includes(p.status)
    );

    let paidAmount = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    if (paidAmount === 0 && o.paymentStatus === "PAID") {
      paidAmount = grandTotal;
    } else if (paidAmount === 0 && o.paymentStatus === "PARTIALLY_PAID") {
      paidAmount = grandTotal * 0.5;
    }

    const balanceDue = Math.max(0, grandTotal - paidAmount);
    return {
      grandTotal,
      paidAmount,
      balanceDue,
      paymentsCount: paymentsList.length
    };
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4 text-[#0B2148]">
      
      {/* 1. Page Header */}
      <div className="flex-none flex items-center justify-between py-2 border-b border-[#D8E8FA]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B2148] flex items-center gap-2">
            Sales Orders
            <span className="text-xs font-normal text-[#526B91] bg-[#F4F9FF] border border-[#D8E8FA] px-2.5 py-0.5 rounded-full">
              {totalCount} active
            </span>
          </h1>
          <p className="text-xs text-[#526B91] mt-0.5">Track and manage formal customer sales orders and payment records</p>
        </div>
      </div>

      {/* 2. Compact KPI Summary Panel */}
      <div className="flex-none flex flex-wrap gap-8 items-center py-3 px-6 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl text-xs">
        
        {/* KPI 1: Total Orders */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Total Backlog</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-[#0B2148]">{stats.total || 0}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Orders in queue</span>
          </div>
        </div>
        
        <div className="h-6 w-px bg-[#D8E8FA]" />

        {/* KPI 2: Ready to Fulfill */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Ready to Fulfill</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-[#166534]">{stats.readyFulfillment || 0}</span>
            <span className="text-[10px] text-[#526B91] font-medium">Approved release</span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#D8E8FA]" />

        {/* KPI 3: Overdue Delivery */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Overdue Delivery</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-base font-bold ${stats.overdueCount > 0 ? "text-rose-700 animate-pulse" : "text-[#0B2148]"}`}>
              {stats.overdueCount || 0}
            </span>
            <span className="text-[10px] text-[#526B91] font-medium">Past delivery target</span>
          </div>
        </div>

        <div className="h-6 w-px bg-[#D8E8FA]" />

        {/* KPI 4: Order Value */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Order Value</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-purple-700 font-mono">
              ₹ {(stats.totalOrderValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#526B91] font-medium">Total pipeline value</span>
          </div>
        </div>
      </div>

      {/* 3. Search + Filter Toolbar */}
      <div className="flex-none flex flex-wrap gap-2.5 items-center py-1">
        
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search orders, customer, code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
          />
        </div>

        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all cursor-pointer"
        >
          <option value="">Status: All</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PAYMENT_PENDING">Payment Pending</option>
          <option value="READY_FOR_FULFILLMENT">Ready for Fulfillment</option>
          <option value="IN_FULFILLMENT">In Fulfillment</option>
          <option value="PARTIALLY_FULFILLED">Partially Fulfilled</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="ON_HOLD">On Hold</option>
        </select>

        <select 
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all cursor-pointer"
        >
          <option value="">Payment: All</option>
          <option value="PAID">Paid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="UNPAID">Unpaid</option>
        </select>

        <select 
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all cursor-pointer"
        >
          <option value="">Priority: All</option>
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        {isFilterActive && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* 4. Professional Data Table Container */}
      <div className="flex-1 bg-white border border-[#D8E8FA] rounded-2xl overflow-hidden flex flex-col shadow-xs">
        
        <div className="flex-1 overflow-auto">
          {isLoading || isRefetching ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-[#0878F9] animate-spin" />
              <span className="text-[11px] text-[#526B91] font-medium">Loading sales orders...</span>
            </div>
          ) : orders.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                  <th className="py-3 px-4 font-bold">Order ID</th>
                  <th className="py-3 px-4 font-bold">Customer Account</th>
                  <th className="py-3 px-4 font-bold">Order Date</th>
                  <th className="py-3 px-4 font-bold">Required Delivery</th>
                  <th className="py-3 px-4 font-bold">Grand Total</th>
                  <th className="py-3 px-4 font-bold">Customer Payment</th>
                  <th className="py-3 px-4 font-bold">Priority</th>
                  <th className="py-3 px-4 font-bold">Payment Status</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {orders.map((o: any) => {
                  const isOverdue = new Date(o.requiredDeliveryDate) < new Date() && o.status !== "FULFILLED" && o.status !== "CANCELLED";
                  const pCalc = getOrderPaymentBreakdown(o);

                  return (
                    <tr key={o.id} className="hover:bg-[#F4F9FF] transition-colors group">
                      
                      {/* Order ID */}
                      <td className="py-3 px-4 font-mono font-bold text-xs text-[#0B2148]">
                        <span className="bg-[#EAF5FF] text-[#0878F9] px-2 py-0.5 rounded-lg border border-[#0878F9]/20">
                          {o.salesOrderNumber}
                        </span>
                      </td>

                      {/* Customer Account */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#0B2148] group-hover:text-[#0878F9] transition-colors">
                            {o.customer?.name}
                          </span>
                          <span className="text-[10px] text-[#526B91] mt-0.5">
                            Code: {o.customer?.customerCode}
                          </span>
                        </div>
                      </td>

                      {/* Order Date */}
                      <td className="py-3 px-4 font-medium text-[#0B2148] font-mono">
                        {new Date(o.orderDate).toLocaleDateString("en-IN")}
                      </td>

                      {/* Required Delivery */}
                      <td className="py-3 px-4 font-semibold font-mono">
                        <span className={isOverdue ? "text-rose-700 inline-flex items-center gap-1.5 font-bold" : "text-[#0B2148]"}>
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                          {new Date(o.requiredDeliveryDate).toLocaleDateString("en-IN")}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0B2148]">
                        {o.currency || "INR"} {parseFloat(o.grandTotal.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Customer Payment Record */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                          <span className="text-[#166534] font-bold">
                            Paid: ₹{pCalc.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          {pCalc.balanceDue > 0 ? (
                            <span className="text-amber-800 text-[10px] font-semibold">
                              Due: ₹{pCalc.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-[#166534] text-[10px] font-bold">Full Cleared</span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          o.priority === "URGENT" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          o.priority === "HIGH" ? "bg-orange-50 text-orange-800 border border-orange-200" :
                          o.priority === "NORMAL" ? "bg-blue-50 text-[#0878F9] border border-blue-200" :
                          "bg-slate-100 text-[#526B91] border border-slate-200"
                        }`}>
                          {o.priority}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          o.paymentStatus === "PAID" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                          o.paymentStatus === "PARTIALLY_PAID" ? "bg-amber-50 text-amber-800 border-amber-200" :
                          "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {o.paymentStatus?.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold border uppercase ${
                          o.status === "FULFILLED" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                          o.status === "CANCELLED" || o.status === "ON_HOLD" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          o.status === "IN_FULFILLMENT" || o.status === "PARTIALLY_FULFILLED" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                          o.status === "READY_FOR_FULFILLMENT" ? "bg-emerald-50 text-[#166534] border border-emerald-200" :
                          o.status === "CONFIRMED" ? "bg-blue-50 text-[#0878F9] border border-blue-200" :
                          "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}>
                          {o.status?.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForPayments(o);
                              setIsPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#526B91] hover:text-[#0878F9] hover:bg-[#EAF5FF] hover:border-[#0878F9]/40 transition-all cursor-pointer px-2.5 py-1 rounded-lg bg-white border border-[#D8E8FA] shadow-xs"
                            title="View Customer Payment Ledger"
                          >
                            <Receipt className="w-3.5 h-3.5 text-[#0878F9]" />
                            <span>Payments</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => router.push(`/${roleSlug}/sales/orders/${o.id}`)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#0878F9] hover:bg-[#0665d0] px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                          >
                            <span>Manage</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-[#526B91]">
              <ClipboardList className="w-10 h-10 mb-2 opacity-30 text-[#526B91]" />
              <p className="font-semibold text-[#0B2148]">No Sales Orders Found</p>
              <p className="text-xs mt-0.5 text-[#526B91]">Refine search query filters or convert an approved quotation.</p>
              {isFilterActive && (
                <button
                  onClick={resetFilters}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148] text-xs font-semibold transition-all cursor-pointer shadow-xs"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Pagination Area */}
        <div className="flex-none py-3 px-4 border-t border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
          
          {/* Left: Range count */}
          <div className="text-xs text-[#526B91] font-medium">
            Showing <span className="font-semibold text-[#0B2148]">{startRange}–{endRange}</span> of <span className="font-semibold text-[#0B2148]">{totalCount}</span> orders
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg border border-[#D8E8FA] bg-white hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  page === p 
                    ? "bg-[#0878F9] text-white shadow-xs" 
                    : "bg-white text-[#526B91] border border-[#D8E8FA] hover:bg-[#EAF5FF] hover:text-[#0878F9]"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-[#D8E8FA] bg-white hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* 6. Customer Payment Records Modal (Light Theme) */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedOrderForPayments && (() => {
          const breakdown = getOrderPaymentBreakdown(selectedOrderForPayments);
          const payments = selectedOrderForPayments.payments || [];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061B3A]/40 backdrop-blur-sm animate-in fade-in duration-200">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 sm:p-8 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl w-full space-y-5 text-[#0B2148] shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#D8E8FA]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#166534] flex items-center justify-center shadow-xs">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                        <span>Customer Payment Record</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[#EAF5FF] border border-[#0878F9]/20 text-[#0878F9] font-bold">
                          {selectedOrderForPayments.salesOrderNumber}
                        </span>
                      </h3>
                      <p className="text-xs text-[#526B91]">
                        {selectedOrderForPayments.customer?.name} ({selectedOrderForPayments.customer?.customerCode})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      setSelectedOrderForPayments(null);
                    }}
                    className="w-8 h-8 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-3 p-3.5 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA] text-center">
                  <div className="p-2 bg-white rounded-xl border border-[#D8E8FA]">
                    <span className="text-[10px] uppercase font-bold text-[#526B91] block">Order Value</span>
                    <p className="text-sm font-bold font-mono text-[#0B2148] mt-0.5">
                      ₹{breakdown.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-[#166534] block">Total Paid</span>
                    <p className="text-sm font-bold font-mono text-[#166534] mt-0.5">
                      ₹{breakdown.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">Balance Due</span>
                    <p className="text-sm font-bold font-mono text-amber-800 mt-0.5">
                      ₹{breakdown.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#526B91]">
                    Payment Transactions ({payments.length})
                  </h4>

                  {payments.length > 0 ? (
                    <div className="border border-[#D8E8FA] rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91]">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Reference / UTR</th>
                            <th className="py-2.5 px-3">Mode</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8F1FC] font-mono text-[11px] text-[#0B2148]">
                          {payments.map((p: any) => (
                            <tr key={p.id} className="hover:bg-[#F4F9FF]">
                              <td className="py-2.5 px-3 text-[#0B2148]">
                                {new Date(p.paymentDate || p.createdAt).toLocaleDateString("en-IN")}
                              </td>
                              <td className="py-2.5 px-3 text-[#0B2148] font-semibold">
                                {p.referenceNumber || "N/A"}
                              </td>
                              <td className="py-2.5 px-3 text-[#0B2148] uppercase">
                                {p.paymentMethod?.replace(/_/g, " ") || "BANK"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#166534]">
                                ₹{Number(p.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase ${
                                  ["VERIFIED", "APPROVED", "ACCEPTED", "CONFIRMED"].includes(p.status) ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                                  p.status === "REJECTED" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                  "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] text-center text-[#526B91] text-xs">
                      No payment records logged for this order yet.
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-[#D8E8FA]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      router.push(`/${roleSlug}/sales/orders/${selectedOrderForPayments.id}`);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Open Order Details</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false);
                      setSelectedOrderForPayments(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148] text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
