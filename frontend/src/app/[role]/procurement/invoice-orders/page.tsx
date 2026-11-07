"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  FileCheck2,
  Search,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Boxes,
  FileText,
  DollarSign,
  Package,
  Eye,
  Filter,
  RefreshCw,
  Edit
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function InvoiceOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params.role as string) || "admin";
  const { data: session } = useSession();

  const userRoles = ((session?.user as any)?.roles || []) as string[];
  const isAdmin = userRoles.includes("ADMIN") || userRoles.includes("SUPERADMIN");
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER") || roleSlug === "inventory-manager";

  // Filter and pagination state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [invoiceType, setInvoiceType] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  // Data Query
  const { data: listData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["procurement-io-list", search, status, invoiceType, paymentStatus, page],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/invoice-orders", {
        params: {
          search: search.trim() || undefined,
          status: status === "ALL" ? undefined : status,
          invoiceType: invoiceType === "ALL" ? undefined : invoiceType,
          paymentStatus: paymentStatus === "ALL" ? undefined : paymentStatus,
          page,
          limit: 15,
        },
      });
      return res.data;
    },
  });

  const orders = listData?.items || [];
  const metrics = listData?.metrics || {
    totalCount: 0,
    totalValue: 0,
    pendingInventoryCount: 0,
    pendingAdminCount: 0,
    qcPendingCount: 0,
    readyToStockCount: 0,
    stockedCount: 0,
    totalPaid: 0,
    totalOutstanding: 0,
  };
  const totalCount = listData?.total || 0;
  const totalPages = listData?.totalPages || 1;

  // Status badge styling
  const getStatusBadge = (st: string) => {
    switch (st) {
      case "DRAFT":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">DRAFT</span>;
      case "PENDING_INVENTORY":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> PENDING INWARD</span>;
      case "INVENTORY_VERIFIED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> INVENTORY VERIFIED</span>;
      case "PENDING_ADMIN_APPROVAL":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> PENDING ADMIN</span>;
      case "APPROVED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">APPROVED</span>;
      case "QC_PENDING":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5" /> QC PENDING</span>;
      case "READY_TO_STOCK":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">READY TO STOCK</span>;
      case "STOCKED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">STOCKED</span>;
      case "CORRECTION_REQUIRED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">CORRECTION REQ</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-800 border border-red-300">REJECTED</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">{st}</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto pb-10">
      {/* Page Header */}
      <PageHeader
        title="Invoice Orders & Goods Inward"
        description="Dual-role Invoice Order workflow: Independent creation by Admin and Inventory Manager, physical verification, Admin authorization & stock posting"
        icon={<FileCheck2 className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Procurement", href: `/${roleSlug}/procurement/purchase-orders` },
          { label: "Invoice Orders" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 border border-[#D8E8FA] rounded-xl hover:bg-[#F4F9FF] text-[#526B91] transition-all"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-[#0878F9]" : ""}`} />
            </button>
            <button
              onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/create`)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0878F9] hover:bg-[#0766D0] text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice Order</span>
            </button>
          </div>
        }
      />

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => { setStatus("ALL"); setPage(1); }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            status === "ALL" ? "bg-white border-[#0878F9] shadow-sm" : "bg-white/70 border-[#D8E8FA] hover:border-[#0878F9]/50"
          }`}
        >
          <div className="text-[11px] font-semibold text-[#526B91]">Total Orders</div>
          <div className="text-xl font-bold text-[#0B2148] mt-1">{metrics.totalCount}</div>
          <div className="text-[10px] text-[#526B91] mt-0.5">₹{metrics.totalValue.toLocaleString()}</div>
        </button>

        <button
          onClick={() => { setStatus("PENDING_INVENTORY"); setPage(1); }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            status === "PENDING_INVENTORY" ? "bg-amber-50/70 border-amber-400 shadow-sm" : "bg-white/70 border-[#D8E8FA] hover:border-amber-400"
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-700 flex items-center justify-between">
            <span>Pending Inward</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-amber-900 mt-1">{metrics.pendingInventoryCount}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Physical count required</div>
        </button>

        <button
          onClick={() => { setStatus("PENDING_ADMIN_APPROVAL"); setPage(1); }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            status === "PENDING_ADMIN_APPROVAL" ? "bg-purple-50/70 border-purple-400 shadow-sm" : "bg-white/70 border-[#D8E8FA] hover:border-purple-400"
          }`}
        >
          <div className="text-[11px] font-semibold text-purple-700 flex items-center justify-between">
            <span>Pending Admin</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-purple-900 mt-1">{metrics.pendingAdminCount}</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Final authorization</div>
        </button>

        <button
          onClick={() => { setStatus("QC_PENDING"); setPage(1); }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            status === "QC_PENDING" ? "bg-orange-50/70 border-orange-400 shadow-sm" : "bg-white/70 border-[#D8E8FA] hover:border-orange-400"
          }`}
        >
          <div className="text-[11px] font-semibold text-orange-700 flex items-center justify-between">
            <span>Awaiting QC</span>
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-orange-900 mt-1">{metrics.qcPendingCount}</div>
          <div className="text-[10px] text-orange-600 mt-0.5">QTZ Quarantine</div>
        </button>

        <button
          onClick={() => { setStatus("STOCKED"); setPage(1); }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            status === "STOCKED" ? "bg-emerald-50/70 border-emerald-400 shadow-sm" : "bg-white/70 border-[#D8E8FA] hover:border-emerald-400"
          }`}
        >
          <div className="text-[11px] font-semibold text-emerald-700 flex items-center justify-between">
            <span>Stocked</span>
            <Boxes className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-emerald-900 mt-1">{metrics.stockedCount}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Posted to usable stock</div>
        </button>

        <div className="p-3.5 rounded-2xl border border-[#D8E8FA] bg-white/70 text-left">
          <div className="text-[11px] font-semibold text-[#526B91]">Outstanding Pay</div>
          <div className="text-xl font-bold text-rose-700 mt-1">₹{metrics.totalOutstanding.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Paid: ₹{metrics.totalPaid.toLocaleString()}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-[#D8E8FA] bg-white flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search IO #, Vendor, PO #, Invoice Number..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] placeholder-[#526B91] focus:outline-none focus:ring-2 focus:ring-[#0878F9]/30 focus:border-[#0878F9] transition-all"
          />
        </div>

        {/* Status Dropdown */}
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:outline-none focus:ring-2 focus:ring-[#0878F9]/30"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_INVENTORY">Pending Inward</option>
          <option value="INVENTORY_VERIFIED">Inventory Verified</option>
          <option value="PENDING_ADMIN_APPROVAL">Pending Admin</option>
          <option value="CORRECTION_REQUIRED">Correction Required</option>
          <option value="APPROVED">Approved</option>
          <option value="QC_PENDING">QC Pending</option>
          <option value="READY_TO_STOCK">Ready to Stock</option>
          <option value="STOCKED">Stocked</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {/* Invoice Type Dropdown */}
        <select
          value={invoiceType}
          onChange={(e) => { setInvoiceType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:outline-none focus:ring-2 focus:ring-[#0878F9]/30"
        >
          <option value="ALL">All Document Types</option>
          <option value="FINAL_TAX_INVOICE">Final Tax Invoice</option>
          <option value="PROFORMA">Proforma Invoice</option>
          <option value="CREDIT_NOTE">Credit Note</option>
          <option value="DEBIT_NOTE">Debit Note</option>
        </select>

        {/* Payment Status Dropdown */}
        <select
          value={paymentStatus}
          onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs bg-[#F8FAFC] border border-[#D8E8FA] rounded-xl text-[#0B2148] focus:outline-none focus:ring-2 focus:ring-[#0878F9]/30"
        >
          <option value="ALL">All Payment Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Fully Paid</option>
        </select>
      </div>

      {/* Invoice Orders Data Table */}
      <div className="rounded-2xl border border-[#D8E8FA] bg-white overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            <span className="text-xs text-[#526B91]">Loading Invoice Orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-[#0B2148]">No Invoice Orders found</div>
            <p className="text-xs text-[#526B91] max-w-sm mx-auto">
              Create an Invoice Order against an approved Purchase Order to begin physical verification and stock inwarding.
            </p>
            <button
              onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/create`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0878F9] text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Invoice Order</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] bg-[#F8FAFC] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">IO Number</th>
                  <th className="py-3 px-3">PO Reference</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Supplier Invoice #</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Grand Total</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Created By</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {orders.map((io: any) => (
                  <tr
                    key={io.id}
                    onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/${io.id}`)}
                    className="hover:bg-[#F4F9FF]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[#0878F9] font-mono">{io.ioNumber}</div>
                      <div className="text-[10px] text-[#526B91]">
                        {new Date(io.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-mono font-semibold text-[#0B2148]">
                        {io.purchaseOrder?.poNumber || "N/A"}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-semibold truncate max-w-[180px]">{io.vendor?.name}</div>
                      <div className="text-[10px] text-[#526B91]">{io.vendor?.phone || io.vendor?.email}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-mono font-bold text-slate-800">{io.supplierInvoiceNumber}</div>
                      <div className="text-[10px] text-[#526B91]">
                        {new Date(io.invoiceDate).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        io.invoiceType === "PROFORMA" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {io.invoiceType === "FINAL_TAX_INVOICE" ? "TAX INVOICE" : io.invoiceType}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 font-mono font-bold">
                      {io.currency} {Number(io.grandTotal).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${
                          io.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 font-mono"
                            : io.paymentStatus === "PARTIALLY_PAID"
                            ? "bg-blue-50 text-blue-700 font-mono"
                            : "bg-rose-50 text-rose-700 font-mono"
                        }`}>
                          {io.paymentStatus}
                        </span>
                        <span className="text-[10px] text-[#526B91] font-mono">
                          Mode: {io.paymentMode}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      {getStatusBadge(io.status)}
                    </td>

                    <td className="py-3.5 px-3 text-[11px] text-[#526B91]">
                      <div>{io.createdBy?.name || "System"}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {io.createdBy?.roles?.[0] || ""}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {["DRAFT", "CORRECTION_REQUIRED"].includes(io.status) && (
                          <button
                            onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/create?edit=${io.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="Edit Draft Invoice Order"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/${io.id}`)}
                          className="p-1.5 hover:bg-[#EAF5FF] text-[#0878F9] rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[#D8E8FA] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#526B91]">
            <div>
              Showing Page <span className="font-bold text-[#0B2148]">{page}</span> of{" "}
              <span className="font-bold text-[#0B2148]">{totalPages}</span> ({totalCount} total)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-[#D8E8FA] rounded-lg hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-[#D8E8FA] rounded-lg hover:bg-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

