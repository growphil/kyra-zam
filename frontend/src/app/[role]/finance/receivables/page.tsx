"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  IndianRupee,
  Clock,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  Users,
  Search,
  FileText,
  ExternalLink,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  Receipt,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";

// Aging calculation helper
function getAgingDetails(dueDateStr: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      bucket: "CURRENT",
      label: "Current (Not Due)",
      days: Math.abs(diffDays),
      isOverdue: false,
      badgeColor: "bg-emerald-50 text-[#166534] border-emerald-200"
    };
  } else if (diffDays <= 30) {
    return {
      bucket: "1-30",
      label: `${diffDays}d Overdue`,
      days: diffDays,
      isOverdue: true,
      badgeColor: "bg-blue-50 text-[#0878F9] border-blue-200"
    };
  } else if (diffDays <= 60) {
    return {
      bucket: "31-60",
      label: `${diffDays}d Overdue`,
      days: diffDays,
      isOverdue: true,
      badgeColor: "bg-amber-50 text-amber-800 border-amber-200"
    };
  } else if (diffDays <= 90) {
    return {
      bucket: "61-90",
      label: `${diffDays}d Overdue`,
      days: diffDays,
      isOverdue: true,
      badgeColor: "bg-orange-50 text-orange-800 border-orange-200"
    };
  } else {
    return {
      bucket: "90+",
      label: `${diffDays}d Overdue`,
      days: diffDays,
      isOverdue: true,
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200"
    };
  }
}

const bucketConfig: Record<string, { label: string; color: string; icon: any; bg: string; border: string }> = {
  CURRENT: { label: "Current (Not Due)", color: "text-[#166534]", icon: Clock, bg: "bg-emerald-50/50", border: "border-emerald-200" },
  "1-30": { label: "1–30 Days", color: "text-[#0878F9]", icon: Clock, bg: "bg-blue-50/50", border: "border-blue-200" },
  "31-60": { label: "31–60 Days", color: "text-amber-800", icon: AlertTriangle, bg: "bg-amber-50/50", border: "border-amber-200" },
  "61-90": { label: "61–90 Days", color: "text-orange-800", icon: AlertCircle, bg: "bg-orange-50/50", border: "border-orange-200" },
  "90+": { label: "90+ Days Critical", color: "text-rose-700", icon: TrendingDown, bg: "bg-rose-50/50", border: "border-rose-200" },
};

export default function ReceivablesPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [activeTab, setActiveTab] = useState<"INVOICES" | "CUSTOMERS">("INVOICES");
  const [statusView, setStatusView] = useState<"ALL" | "OUTSTANDING" | "SETTLED">("ALL");
  const [search, setSearch] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<string>("ALL");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Fetch Invoices & Sales Orders
  const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices, isRefetching: isRefetchingInvoices } = useQuery({
    queryKey: ["finance-invoices-receivables"],
    queryFn: async () => {
      const res = await api.get("/crm/finance/invoices");
      return res.data || [];
    },
  });

  const { data: rawOrders, isLoading: isLoadingOrders, refetch: refetchOrders, isRefetching: isRefetchingOrders } = useQuery({
    queryKey: ["approved-transactions-receivables"],
    queryFn: async () => {
      const res = await api.get("/crm/finance/approved-transactions");
      return res.data || [];
    },
  });

  const isLoading = isLoadingInvoices || isLoadingOrders;
  const isRefetching = isRefetchingInvoices || isRefetchingOrders;
  const refetch = () => {
    refetchInvoices();
    refetchOrders();
  };

  // Comprehensive Billing & Receivable Ledger Items
  const allLedgerItems = useMemo(() => {
    const items: any[] = [];
    const invoicedOrderIds = new Set<string>();

    // 1. Invoices
    (invoices || []).forEach((inv: any) => {
      if (inv.salesOrderId) invoicedOrderIds.add(inv.salesOrderId);
      const totalAmt = parseFloat(inv.grandTotal || 0);
      let paidAmt = parseFloat(inv.paidAmount || 0);
      let outAmt = parseFloat(inv.outstandingAmount || 0);

      // Reconcile with sales order verified payments if available
      const linkedSo = (rawOrders || []).find((o: any) => o.id === inv.salesOrderId);
      if (linkedSo) {
        const soVerifiedPaid = (linkedSo.payments || [])
          .filter((p: any) => p.status === "VERIFIED")
          .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0);

        if (soVerifiedPaid > paidAmt || linkedSo.isFinancialCleared || linkedSo.paymentStatus === "PAID") {
          paidAmt = Math.max(paidAmt, soVerifiedPaid, linkedSo.isFinancialCleared ? totalAmt : 0);
          paidAmt = Math.min(totalAmt, paidAmt);
          outAmt = Math.max(0, totalAmt - paidAmt);
        }
      }

      const isSettled = inv.status === "PAID" || outAmt <= 0 || linkedSo?.isFinancialCleared;
      const aging = isSettled
        ? { bucket: "SETTLED", label: "Fully Settled", days: 0, isOverdue: false, badgeColor: "bg-emerald-50 text-[#166534] border-emerald-200" }
        : getAgingDetails(inv.dueDate || inv.createdAt);

      items.push({
        id: inv.id,
        type: "INVOICE",
        invoiceNumber: inv.invoiceNumber,
        salesOrderId: inv.salesOrderId,
        salesOrderNumber: inv.salesOrder?.salesOrderNumber || linkedSo?.salesOrderNumber || "N/A",
        customerId: inv.customerId,
        customerName: inv.customer?.name || linkedSo?.customer?.name || "Unknown Customer",
        customerCode: inv.customer?.customerCode || linkedSo?.customer?.customerCode || "",
        createdAt: inv.createdAt,
        dueDate: inv.dueDate,
        paymentTerms: inv.paymentTerms || "Standard Terms",
        parsedTotal: totalAmt,
        parsedPaid: paidAmt,
        parsedOutstanding: outAmt,
        isSettled,
        aging
      });
    });

    // 2. Sales Orders (accounting for un-invoiced or direct order payments)
    (rawOrders || []).forEach((order: any) => {
      const grandTotal = parseFloat(order.grandTotal?.toString() || "0");
      const verifiedPaid = (order.payments || [])
        .filter((p: any) => p.status === "VERIFIED")
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"), 0);
      
      const invoicePaid = (order.invoices || [])
        .reduce((sum: number, i: any) => sum + parseFloat(i.paidAmount?.toString() || "0"), 0);
      
      const totalPaid = Math.max(verifiedPaid, invoicePaid);
      const remainingBalance = Math.max(0, grandTotal - totalPaid);
      const isSettled = remainingBalance <= 0 || order.paymentStatus === "PAID" || (order.isFinancialCleared && totalPaid >= grandTotal);

      // Check if not already represented in active invoices list
      const hasActiveInvoice = items.some((item) => item.salesOrderId === order.id);
      if (!hasActiveInvoice) {
        const aging = isSettled
          ? { bucket: "SETTLED", label: "Fully Settled", days: 0, isOverdue: false, badgeColor: "bg-emerald-50 text-[#166534] border-emerald-200" }
          : getAgingDetails(order.requiredDeliveryDate || order.createdAt);

        items.push({
          id: order.id,
          type: "SALES_ORDER",
          invoiceNumber: `SO: ${order.salesOrderNumber}`,
          salesOrderId: order.id,
          salesOrderNumber: order.salesOrderNumber,
          customerId: order.customerId,
          customerName: order.customer?.name || "Unknown Customer",
          customerCode: order.customer?.customerCode || "",
          createdAt: order.createdAt,
          dueDate: order.requiredDeliveryDate || order.createdAt,
          paymentTerms: order.paymentTerms || "Standard Terms",
          parsedTotal: grandTotal,
          parsedPaid: totalPaid,
          parsedOutstanding: remainingBalance,
          isSettled,
          aging
        });
      }
    });

    return items;
  }, [invoices, rawOrders]);

  // Outstanding only subset for aging totals
  const outstandingInvoices = useMemo(() => {
    return allLedgerItems.filter((item) => !item.isSettled && item.parsedOutstanding > 0);
  }, [allLedgerItems]);

  // Calculations for KPI cards
  const bucketTotals = useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {
      CURRENT: { amount: 0, count: 0 },
      "1-30": { amount: 0, count: 0 },
      "31-60": { amount: 0, count: 0 },
      "61-90": { amount: 0, count: 0 },
      "90+": { amount: 0, count: 0 }
    };

    outstandingInvoices.forEach((inv: any) => {
      const b = inv.aging.bucket;
      if (totals[b]) {
        totals[b].amount += inv.parsedOutstanding;
        totals[b].count += 1;
      }
    });

    return totals;
  }, [outstandingInvoices]);

  const totalBilledVolume = useMemo(() => {
    return allLedgerItems.reduce((sum: number, inv: any) => sum + inv.parsedTotal, 0);
  }, [allLedgerItems]);

  const totalCollectedVolume = useMemo(() => {
    return allLedgerItems.reduce((sum: number, inv: any) => sum + inv.parsedPaid, 0);
  }, [allLedgerItems]);

  const grandTotalReceivables = useMemo(() => {
    return outstandingInvoices.reduce((sum: number, inv: any) => sum + inv.parsedOutstanding, 0);
  }, [outstandingInvoices]);

  const totalOverdueAmount = useMemo(() => {
    return outstandingInvoices
      .filter((inv: any) => inv.aging.isOverdue)
      .reduce((sum: number, inv: any) => sum + inv.parsedOutstanding, 0);
  }, [outstandingInvoices]);

  // Customer Aggregation
  const customerAgingList = useMemo(() => {
    const map: Record<string, {
      customerId: string;
      customerName: string;
      customerCode: string;
      invoiceCount: number;
      totalBilled: number;
      totalPaid: number;
      buckets: Record<string, number>;
      totalOutstanding: number;
      invoices: any[];
    }> = {};

    allLedgerItems.forEach((inv: any) => {
      const custId = inv.customerId || "unknown";
      const custName = inv.customerName || "Unknown Customer";
      const custCode = inv.customerCode || "";
      const b = inv.aging.bucket;

      if (!map[custId]) {
        map[custId] = {
          customerId: custId,
          customerName: custName,
          customerCode: custCode,
          invoiceCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          buckets: { CURRENT: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
          totalOutstanding: 0,
          invoices: []
        };
      }

      map[custId].invoiceCount += 1;
      map[custId].totalBilled += inv.parsedTotal;
      map[custId].totalPaid += inv.parsedPaid;
      if (map[custId].buckets[b] !== undefined) {
        map[custId].buckets[b] += inv.parsedOutstanding;
      }
      map[custId].totalOutstanding += inv.parsedOutstanding;
      map[custId].invoices.push(inv);
    });

    return Object.values(map).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [allLedgerItems]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return allLedgerItems.filter((inv: any) => {
      const matchesStatus =
        statusView === "ALL"
          ? true
          : statusView === "OUTSTANDING"
          ? !inv.isSettled
          : inv.isSettled;

      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (inv.salesOrderNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (inv.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
        (inv.customerCode || "").toLowerCase().includes(search.toLowerCase());

      const matchesBucket =
        selectedBucket === "ALL"
          ? true
          : inv.aging.bucket === selectedBucket;

      const matchesOverdue = onlyOverdue ? inv.aging.isOverdue : true;

      return matchesStatus && matchesSearch && matchesBucket && matchesOverdue;
    });
  }, [allLedgerItems, statusView, search, selectedBucket, onlyOverdue]);

  // Filtered Customer Ledger
  const filteredCustomers = useMemo(() => {
    return customerAgingList.filter((cust: any) => {
      const matchesStatus =
        statusView === "ALL"
          ? true
          : statusView === "OUTSTANDING"
          ? cust.totalOutstanding > 0
          : cust.totalOutstanding === 0;

      const matchesSearch = 
        cust.customerName.toLowerCase().includes(search.toLowerCase()) ||
        cust.customerCode.toLowerCase().includes(search.toLowerCase());

      const matchesBucket =
        selectedBucket === "ALL"
          ? true
          : cust.buckets[selectedBucket] !== undefined && cust.buckets[selectedBucket] > 0;

      const matchesOverdue = onlyOverdue ? (cust.totalOutstanding - cust.buckets.CURRENT) > 0 : true;

      return matchesStatus && matchesSearch && matchesBucket && matchesOverdue;
    });
  }, [customerAgingList, statusView, search, selectedBucket, onlyOverdue]);

  // CSV Export
  const handleExportCSV = () => {
    if (allLedgerItems.length === 0) {
      toast.error("No billing ledger records to export");
      return;
    }

    const headers = [
      "Document / Reference",
      "Sales Order",
      "Customer",
      "Created Date",
      "Due Date",
      "Status",
      "Aging Bucket",
      "Days Overdue",
      "Billed Amount",
      "Paid Amount",
      "Outstanding Due",
      "Payment Terms"
    ];

    const rows = allLedgerItems.map((inv: any) => [
      inv.invoiceNumber,
      inv.salesOrderNumber || "N/A",
      `"${inv.customerName || "N/A"}"`,
      new Date(inv.createdAt).toLocaleDateString("en-IN"),
      new Date(inv.dueDate).toLocaleDateString("en-IN"),
      inv.isSettled ? "SETTLED" : "OUTSTANDING",
      inv.aging.bucket,
      inv.aging.isOverdue ? `${inv.aging.days} days` : "0 (Current)",
      inv.parsedTotal.toFixed(2),
      inv.parsedPaid.toFixed(2),
      inv.parsedOutstanding.toFixed(2),
      `"${inv.paymentTerms || "Standard"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KYRA_ZAM_Billing_Ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Billing & Accounts Receivable CSV exported successfully");
  };

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="Accounts Receivable & Aging Ledger"
        description="Track customer billing ledgers, outstanding dues, aging periods, and payment settlements across all client accounts."
        icon={<IndianRupee className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-50 text-purple-700 border border-purple-200">
            Financial Clearance
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="px-3.5 py-2 bg-white hover:bg-[#F4F9FF] text-[#0B2148] border border-[#D8E8FA] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#526B91] ${isRefetching ? "animate-spin text-[#0878F9]" : ""}`} />
              Refresh
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#0878F9] hover:bg-[#0665d0] text-white border border-[#0878F9] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* 2. KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Billed Volume */}
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Total Billed Volume</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-display font-bold text-[#0B2148] font-mono">
              ₹ {totalBilledVolume.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              {allLedgerItems.length} total billing {allLedgerItems.length === 1 ? "record" : "records"}
            </p>
          </div>
        </div>

        {/* Total Collections */}
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Verified Collections</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-display font-bold text-[#166534] font-mono">
              ₹ {totalCollectedVolume.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              {totalBilledVolume > 0 ? ((totalCollectedVolume / totalBilledVolume) * 100).toFixed(0) : 0}% collection efficiency
            </p>
          </div>
        </div>

        {/* Total Outstanding Receivables */}
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Outstanding Receivables</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-display font-bold font-mono ${grandTotalReceivables > 0 ? "text-amber-800" : "text-[#166534]"}`}>
              ₹ {grandTotalReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              {outstandingInvoices.length} active {outstandingInvoices.length === 1 ? "receivable" : "receivables"}
            </p>
          </div>
        </div>

        {/* Overdue Total */}
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Overdue Balance</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-display font-bold font-mono ${totalOverdueAmount > 0 ? "text-rose-700" : "text-[#526B91]"}`}>
              ₹ {totalOverdueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-[#526B91] mt-1 font-medium">
              {totalOverdueAmount > 0 ? "Requires collection follow-up" : "All payments current & on time"}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Aging Period Quick Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(bucketConfig).map(([key, cfg]) => {
          const isSelected = selectedBucket === key;
          const stat = bucketTotals[key] || { amount: 0, count: 0 };
          return (
            <button
              key={key}
              onClick={() => setSelectedBucket(isSelected ? "ALL" : key)}
              className={`rounded-2xl border p-3.5 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? `border-[#0878F9] bg-[#EAF5FF] ring-2 ring-[#0878F9]/20 shadow-xs`
                  : `border-[#D8E8FA] bg-white hover:bg-[#F4F9FF] hover:border-[#0878F9]/40`
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">{cfg.label}</span>
                </div>
                {stat.count > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.bg} ${cfg.color}`}>
                    {stat.count}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <p className={`text-base font-display font-bold font-mono ${cfg.color}`}>
                  ₹ {stat.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Control Bar: View Mode, Status Filters, Search */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white border border-[#D8E8FA] p-3 rounded-2xl shadow-xs">
        {/* Left: View Mode Tabs & Status Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA]">
            <button
              onClick={() => setActiveTab("INVOICES")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "INVOICES"
                  ? "bg-[#0878F9] text-white shadow-xs"
                  : "text-[#526B91] hover:text-[#0B2148]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Transactions ({allLedgerItems.length})
            </button>
            <button
              onClick={() => setActiveTab("CUSTOMERS")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "CUSTOMERS"
                  ? "bg-[#0878F9] text-white shadow-xs"
                  : "text-[#526B91] hover:text-[#0B2148]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Customer Ledger ({customerAgingList.length})
            </button>
          </div>

          {/* Status Switcher */}
          <div className="flex items-center bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA] text-xs">
            <button
              onClick={() => setStatusView("ALL")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusView === "ALL" ? "bg-white text-[#0B2148] shadow-xs" : "text-[#526B91] hover:text-[#0B2148]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusView("OUTSTANDING")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusView === "OUTSTANDING" ? "bg-amber-50 text-amber-800 border border-amber-200" : "text-[#526B91] hover:text-[#0B2148]"
              }`}
            >
              Outstanding ({outstandingInvoices.length})
            </button>
            <button
              onClick={() => setStatusView("SETTLED")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusView === "SETTLED" ? "bg-emerald-50 text-[#166534] border border-emerald-200" : "text-[#526B91] hover:text-[#0B2148]"
              }`}
            >
              Settled ({allLedgerItems.filter((i) => i.isSettled).length})
            </button>
          </div>
        </div>

        {/* Right: Search & Quick Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
            <input
              type="text"
              placeholder="Search reference, SO, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
            />
          </div>

          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-1.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
          >
            <option value="ALL">All Aging Buckets</option>
            <option value="CURRENT">Current (Not Due)</option>
            <option value="1-30">1–30 Days Overdue</option>
            <option value="31-60">31–60 Days Overdue</option>
            <option value="61-90">61–90 Days Overdue</option>
            <option value="90+">90+ Days Critical</option>
          </select>

          <button
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              onlyOverdue
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-[#F4F9FF] text-[#526B91] border-[#D8E8FA] hover:text-[#0B2148]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Overdue Only
          </button>
        </div>
      </div>

      {/* 5. Main Content Area */}
      <div className="rounded-3xl border border-[#D8E8FA] bg-white overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-[#0878F9] border-t-transparent rounded-full mx-auto" />
            <p className="text-[#526B91] mt-3 text-xs font-mono">Loading Accounts Receivable ledger...</p>
          </div>
        ) : activeTab === "INVOICES" ? (
          /* ==================================================== */
          /* TAB 1: ITEMIZED INVOICE & ORDER LEDGER TABLE         */
          /* ==================================================== */
          filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                    <th className="p-3.5 px-4">Billing Reference</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Due Date & Terms</th>
                    <th className="p-3.5 text-center">Settlement Status</th>
                    <th className="p-3.5 text-right">Billed Total</th>
                    <th className="p-3.5 text-right">Verified Paid</th>
                    <th className="p-3.5 text-right font-bold text-[#0B2148]">Outstanding Due</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                  {filteredInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-[#F4F9FF] transition-colors">
                      {/* Reference */}
                      <td className="p-3.5 px-4">
                        <div className="font-mono font-bold text-[#0B2148] text-xs flex items-center gap-1.5">
                          {inv.invoiceNumber}
                        </div>
                        {inv.salesOrderNumber && inv.salesOrderNumber !== "N/A" && (
                          <div className="text-[10px] text-[#526B91] font-mono mt-0.5">
                            SO: {inv.salesOrderNumber}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="font-semibold text-[#0B2148]">{inv.customerName}</div>
                        {inv.customerCode && (
                          <div className="text-[10px] text-[#526B91] font-mono mt-0.5">
                            {inv.customerCode} • Created: {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                          </div>
                        )}
                      </td>

                      {/* Due Date & Terms */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 font-medium text-[#0B2148]">
                          <Calendar className="w-3.5 h-3.5 text-[#526B91]" />
                          {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                        </div>
                        <div className="text-[10px] text-[#526B91] italic mt-0.5">
                          {inv.paymentTerms || "Standard Terms"}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center">
                        {inv.isSettled ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-[#166534] border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Fully Settled (100% Paid)
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${inv.aging.badgeColor}`}>
                            {inv.aging.isOverdue && <AlertCircle className="w-3 h-3" />}
                            {inv.aging.label}
                          </span>
                        )}
                      </td>

                      {/* Billed Total */}
                      <td className="p-3.5 text-right font-mono text-[#0B2148]">
                        ₹ {inv.parsedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Paid Amount */}
                      <td className="p-3.5 text-right font-mono text-[#166534] font-semibold">
                        ₹ {inv.parsedPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Outstanding Due */}
                      <td className="p-3.5 text-right">
                        <div className={`font-mono font-bold text-xs ${inv.parsedOutstanding > 0 ? "text-amber-800" : "text-[#526B91]"}`}>
                          ₹ {inv.parsedOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {inv.type === "INVOICE" ? (
                            <button
                              onClick={() => router.push(`/${roleSlug}/finance/invoices/${inv.id}`)}
                              title="View Invoice Document"
                              className="px-2.5 py-1 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-[#0878F9]" />
                              Invoice
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push(`/${roleSlug}/sales/orders/${inv.salesOrderId}`)}
                              title="View Sales Order"
                              className="px-2.5 py-1 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-purple-700 border border-[#D8E8FA] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 text-purple-700" />
                              Order
                            </button>
                          )}

                          <button
                            onClick={() => router.push(`/${roleSlug}/finance/payments`)}
                            title="Audit Payments & Deposits"
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#166534] border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Audit Pay
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#D8E8FA] bg-[#F4F9FF] font-bold text-xs">
                    <td colSpan={4} className="p-3.5 px-4 text-[#526B91] uppercase text-[10px]">
                      Ledger Summary ({filteredInvoices.length} {filteredInvoices.length === 1 ? "Record" : "Records"})
                    </td>
                    <td className="p-3.5 text-right font-mono text-[#0B2148]">
                      ₹ {filteredInvoices.reduce((s: number, i: any) => s + i.parsedTotal, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-[#166534]">
                      ₹ {filteredInvoices.reduce((s: number, i: any) => s + i.parsedPaid, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-amber-800 font-bold">
                      ₹ {filteredInvoices.reduce((s: number, i: any) => s + i.parsedOutstanding, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto" />
              <p className="text-sm font-semibold text-[#0B2148] mt-3">No matching billing records found</p>
              <p className="text-[#526B91] text-xs mt-1">Try switching between Outstanding, Settled, or All filters.</p>
            </div>
          )
        ) : (
          /* ==================================================== */
          /* TAB 2: CONSOLIDATED CUSTOMER AGING MATRIX            */
          /* ==================================================== */
          filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                    <th className="p-3.5 px-4">Customer Account</th>
                    <th className="p-3.5 text-center">Open Invoices</th>
                    <th className="p-3.5 text-right text-[#166534]">Current (Not Due)</th>
                    <th className="p-3.5 text-right text-[#0878F9]">1–30 Days</th>
                    <th className="p-3.5 text-right text-amber-800">31–60 Days</th>
                    <th className="p-3.5 text-right text-orange-800">61–90 Days</th>
                    <th className="p-3.5 text-right text-rose-700">90+ Days Critical</th>
                    <th className="p-3.5 text-right font-bold text-[#0B2148]">Total Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.customerId} className="hover:bg-[#F4F9FF] transition-colors">
                      {/* Customer Info */}
                      <td className="p-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-[#0B2148] text-xs block">{cust.customerName}</span>
                            <span className="text-[10px] text-[#526B91] font-mono">
                              {cust.customerCode ? `Code: ${cust.customerCode}` : `ID: ${cust.customerId.slice(0, 8)}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Open Invoices Count */}
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-0.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-full text-[10px] font-bold text-[#0B2148] font-mono">
                          {cust.invoiceCount} {cust.invoiceCount === 1 ? "invoice" : "invoices"}
                        </span>
                      </td>

                      {/* Current */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={cust.buckets.CURRENT > 0 ? "text-[#166534] font-bold" : "text-[#526B91]"}>
                          {cust.buckets.CURRENT > 0 ? `₹ ${cust.buckets.CURRENT.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>

                      {/* 1-30 Days */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={cust.buckets["1-30"] > 0 ? "text-[#0878F9] font-bold" : "text-[#526B91]"}>
                          {cust.buckets["1-30"] > 0 ? `₹ ${cust.buckets["1-30"].toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>

                      {/* 31-60 Days */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={cust.buckets["31-60"] > 0 ? "text-amber-800 font-bold" : "text-[#526B91]"}>
                          {cust.buckets["31-60"] > 0 ? `₹ ${cust.buckets["31-60"].toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>

                      {/* 61-90 Days */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={cust.buckets["61-90"] > 0 ? "text-orange-800 font-bold" : "text-[#526B91]"}>
                          {cust.buckets["61-90"] > 0 ? `₹ ${cust.buckets["61-90"].toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>

                      {/* 90+ Days */}
                      <td className="p-3.5 text-right font-mono">
                        <span className={cust.buckets["90+"] > 0 ? "text-rose-700 font-bold" : "text-[#526B91]"}>
                          {cust.buckets["90+"] > 0 ? `₹ ${cust.buckets["90+"].toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                      </td>

                      {/* Total Outstanding */}
                      <td className="p-3.5 text-right">
                        <span className="font-mono font-bold text-[#0B2148] text-xs">
                          ₹ {cust.totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#D8E8FA] bg-[#F4F9FF] font-bold text-xs">
                    <td colSpan={2} className="p-3.5 px-4 text-[#526B91] uppercase text-[10px]">
                      Ledger Grand Total ({filteredCustomers.length} Accounts)
                    </td>
                    <td className="p-3.5 text-right font-mono text-[#166534]">
                      ₹ {filteredCustomers.reduce((s: number, c: any) => s + c.buckets.CURRENT, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-[#0878F9]">
                      ₹ {filteredCustomers.reduce((s: number, c: any) => s + c.buckets["1-30"], 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-amber-800">
                      ₹ {filteredCustomers.reduce((s: number, c: any) => s + c.buckets["31-60"], 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-orange-800">
                      ₹ {filteredCustomers.reduce((s: number, c: any) => s + c.buckets["61-90"], 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-rose-700">
                      ₹ {filteredCustomers.reduce((s: number, c: any) => s + c.buckets["90+"], 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-[#0B2148] font-bold">
                      ₹ {filteredCustomers.reduce((s: number, c: any) => s + c.totalOutstanding, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-[#526B91]/40 mx-auto" />
              <p className="text-sm font-semibold text-[#0B2148] mt-3">No customer accounts with matching outstanding balance</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
