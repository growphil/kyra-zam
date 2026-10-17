"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { 
  IndianRupee, 
  Search, 
  Loader2, 
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  ExternalLink,
  AlertTriangle,
  Building2,
  Calendar,
  CreditCard,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Receipt,
  Download,
  RefreshCw,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

export default function PaymentsRegistryPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  const [statusTab, setStatusTab] = useState<"ALL" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED">("PENDING_VERIFICATION");
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");

  // Review & Verification Modal
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Reject Dialog
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Payment Proof Image Fullscreen Modal
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const { data: payments, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["finance-payments-list", methodFilter, statusTab],
    queryFn: async () => {
      const res = await api.get("/crm/finance/payments");
      return res.data || [];
    }
  });

  // --- MUTATIONS ---
  const verifyPaymentMutation = useMutation({
    mutationFn: (paymentId: string) => api.put(`/crm/finance/payments/${paymentId}/verify`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["approved-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["approved-transactions-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Payment verified & accepted successfully");
      setIsReviewModalOpen(false);
      setSelectedPayment(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Payment verification failed");
    }
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => 
      api.put(`/crm/finance/payments/${paymentId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-payments-list"] });
      queryClient.invalidateQueries({ queryKey: ["approved-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["approved-transactions-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices-receivables"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Payment rejected with reason recorded");
      setIsRejectDialogOpen(false);
      setRejectPaymentId(null);
      setRejectReason("");
      setIsReviewModalOpen(false);
      setSelectedPayment(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Payment rejection failed");
    }
  });

  // Calculate metrics
  const verifiedPayments = payments?.filter((p: any) => p.status === "VERIFIED") || [];
  const totalVerified = verifiedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
  
  const pendingPayments = payments?.filter((p: any) => p.status === "PENDING_VERIFICATION") || [];
  const totalPendingAmount = pendingPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
  
  const rejectedPayments = payments?.filter((p: any) => p.status === "REJECTED") || [];
  const rejectedCount = rejectedPayments.length;

  // Filter list
  const filtered = payments?.filter((pay: any) => {
    const matchesStatus = statusTab === "ALL" ? true : pay.status === statusTab;
    const matchesMethod = methodFilter ? pay.paymentMethod === methodFilter : true;
    const matchesSearch = 
      pay.paymentReference.toLowerCase().includes(search.toLowerCase()) ||
      (pay.salesOrder?.salesOrderNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (pay.invoice?.invoiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (pay.customer?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (pay.customer?.customerCode || "").toLowerCase().includes(search.toLowerCase()) ||
      (pay.referenceNumber || "").toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesMethod && matchesSearch;
  }) || [];

  const handleOpenReview = (payment: any) => {
    setSelectedPayment(payment);
    setIsReviewModalOpen(true);
  };

  const handleOpenReject = (paymentId: string) => {
    setRejectPaymentId(paymentId);
    setRejectReason("");
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectPaymentId) return;
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    rejectPaymentMutation.mutate({ paymentId: rejectPaymentId, reason: rejectReason.trim() });
  };

  const handleCopyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard`);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!payments || payments.length === 0) {
      toast.error("No payment records to export");
      return;
    }

    const headers = [
      "Payment Ref",
      "Sales Order / Invoice",
      "Customer",
      "Payment Method",
      "Txn / UTR Ref",
      "Payment Date",
      "Amount (INR)",
      "Status",
      "Recorded By",
      "Verified By",
      "Rejection Reason"
    ];

    const rows = payments.map((p: any) => [
      p.paymentReference,
      p.salesOrder?.salesOrderNumber || p.invoice?.invoiceNumber || "Direct",
      `"${p.customer?.name || "N/A"}"`,
      p.paymentMethod,
      `"${p.referenceNumber || "-"}"`,
      new Date(p.paymentDate).toLocaleDateString("en-IN"),
      parseFloat(p.amount).toFixed(2),
      p.status,
      `"${p.recordedBy?.name || "N/A"}"`,
      `"${p.verifiedBy?.name || "N/A"}"`,
      `"${p.rejectionReason || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KYRA_ZAM_Payments_Registry_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Payments registry exported successfully");
  };

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="Financial Clearance & Payment Verification"
        description="Verify customer payment transactions, audit deposit proofs, and grant financial clearance for production."
        icon={<ShieldCheck className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Accountant Desk
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#F4F9FF] border border-[#D8E8FA] px-3.5 py-1.5 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span className="text-xs font-bold text-[#0B2148]">
                <strong className="text-amber-700 font-mono text-xs">{pendingPayments.length}</strong> Verification Requests Pending
              </span>
            </div>

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
        <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Total Verified Receipts</p>
              <h3 className="text-2xl font-bold font-mono text-[#0B2148] mt-1">₹ {totalVerified.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534]">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-[#166534] font-medium mt-3 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {verifiedPayments.length} fully credited transactions
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/50 relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Verification</p>
              <h3 className="text-2xl font-bold font-mono text-amber-800 mt-1">₹ {totalPendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-amber-800 font-medium mt-3 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {pendingPayments.length} payment {pendingPayments.length === 1 ? "entry" : "entries"} awaiting review
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Rejected Submissions</p>
              <h3 className="text-2xl font-bold font-mono text-rose-700 mt-1">{rejectedCount}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-[#526B91] font-medium mt-3 flex items-center gap-1">
            Returned for correction or proof discrepancy
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-[#D8E8FA] bg-white relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">Total Entries Logged</p>
              <h3 className="text-2xl font-bold font-mono text-[#0B2148] mt-1">{payments?.length || 0}</h3>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0878F9]">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-[#526B91] font-medium mt-3 flex items-center gap-1">
            Across Sales Orders & Invoices
          </p>
        </div>
      </div>

      {/* 3. Filter Bar: Status Tabs, Search & Method Filter */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-white border border-[#D8E8FA] p-3 rounded-2xl shadow-xs">
        {/* Status Tabs */}
        <div className="flex gap-1.5 bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA] w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusTab("PENDING_VERIFICATION")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusTab === "PENDING_VERIFICATION"
                ? "bg-amber-50 text-amber-800 border border-amber-300 shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            Pending Review
            {pendingPayments.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusTab === "PENDING_VERIFICATION" ? "bg-amber-200 text-amber-900" : "bg-amber-100 text-amber-800"
              }`}>
                {pendingPayments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusTab("VERIFIED")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusTab === "VERIFIED"
                ? "bg-emerald-50 text-[#166534] border border-emerald-300 shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 text-[#166534]" />
            Verified & Cleared ({verifiedPayments.length})
          </button>

          <button
            onClick={() => setStatusTab("REJECTED")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusTab === "REJECTED"
                ? "bg-rose-50 text-rose-700 border border-rose-300 shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-700" />
            Rejected ({rejectedCount})
          </button>

          <button
            onClick={() => setStatusTab("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              statusTab === "ALL"
                ? "bg-[#0878F9] text-white shadow-xs"
                : "text-[#526B91] hover:text-[#0B2148]"
            }`}
          >
            All Entries ({payments?.length || 0})
          </button>
        </div>

        {/* Search & Method Filter */}
        <div className="flex gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#526B91]" />
            <input 
              type="text" 
              placeholder="Search ref, SO, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-1.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] cursor-pointer"
          >
            <option value="">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
            <option value="UPI">UPI Payment</option>
            <option value="CHEQUE">Cheque / DD</option>
            <option value="CARD">Debit / Credit Card</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* 4. Main Table */}
      <div className="rounded-3xl border border-[#D8E8FA] bg-white overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-3">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            <p className="text-xs text-[#526B91] font-medium">Loading financial ledger...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[950px]">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                  <th className="p-3.5 px-4">Payment Ref</th>
                  <th className="p-3.5">Sales Order / Invoice</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Method & Trans Ref</th>
                  <th className="p-3.5">Date & Submitter</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Proof</th>
                  <th className="p-3.5 text-center">Verification Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {filtered.map((pay: any) => {
                  const isPending = pay.status === "PENDING_VERIFICATION";
                  const isVerified = pay.status === "VERIFIED";
                  const isRejected = pay.status === "REJECTED";

                  return (
                    <tr key={pay.id} className="hover:bg-[#F4F9FF] transition-colors">
                      
                      {/* Payment Ref */}
                      <td className="p-3.5 px-4 font-mono font-bold text-[#0B2148] text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-[#EAF5FF] text-[#0878F9] border border-[#0878F9]/30 px-2 py-0.5 rounded-lg text-xs">
                            {pay.paymentReference}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyRef(pay.paymentReference)}
                            className="text-[#526B91] hover:text-[#0B2148] transition-colors"
                            title="Copy Reference"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Sales Order / Invoice */}
                      <td className="p-3.5">
                        {pay.salesOrder ? (
                          <div>
                            <button
                              onClick={() => router.push(`/${roleSlug}/sales/orders/${pay.salesOrderId}`)}
                              className="font-bold text-[#0878F9] hover:underline flex items-center gap-1 transition-colors text-xs font-mono cursor-pointer"
                            >
                              {pay.salesOrder.salesOrderNumber}
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </button>
                            <span className="text-[10px] text-[#526B91] font-mono">
                              Total: ₹{parseFloat(pay.salesOrder.grandTotal).toLocaleString()}
                            </span>
                          </div>
                        ) : pay.invoice ? (
                          <div className="font-mono text-xs text-[#0B2148]">
                            {pay.invoice.invoiceNumber}
                          </div>
                        ) : (
                          <span className="text-[#526B91] text-[10px]">Direct Receipt</span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="p-3.5">
                        <div className="font-semibold text-[#0B2148]">{pay.customer?.name || "Customer"}</div>
                        {pay.customer?.customerCode && (
                          <div className="text-[10px] text-[#526B91] font-mono">{pay.customer.customerCode}</div>
                        )}
                      </td>

                      {/* Method & Ref */}
                      <td className="p-3.5">
                        <div className="font-bold text-[#0B2148] uppercase text-[11px] flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[#526B91]" />
                          {pay.paymentMethod.replace(/_/g, " ")}
                        </div>
                        {pay.referenceNumber && (
                          <div className="text-[10px] text-[#526B91] font-mono mt-0.5">
                            Ref: {pay.referenceNumber}
                          </div>
                        )}
                      </td>

                      {/* Date & Submitter */}
                      <td className="p-3.5">
                        <div className="text-[#0B2148] font-mono text-xs">{new Date(pay.paymentDate).toLocaleDateString("en-IN")}</div>
                        <div className="text-[10px] text-[#526B91] flex items-center gap-1 mt-0.5">
                          by {pay.recordedBy?.name || "Sales User"}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-mono font-bold text-xs text-[#166534]">
                        ₹ {parseFloat(pay.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          isVerified ? "bg-emerald-50 text-[#166534] border border-emerald-200" :
                          isPending ? "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse" :
                          "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {isVerified && <CheckCircle className="w-3 h-3" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {isRejected && <XCircle className="w-3 h-3" />}
                          {isVerified ? "Verified" : isPending ? "Pending Review" : "Rejected"}
                        </span>
                        {isRejected && pay.rejectionReason && (
                          <div className="text-[9px] text-rose-600 italic mt-0.5 max-w-[140px] truncate mx-auto" title={pay.rejectionReason}>
                            Reason: {pay.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Payment Proof */}
                      <td className="p-3.5 text-center">
                        {pay.paymentProofUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewProofUrl(pay.paymentProofUrl)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] hover:border-[#0878F9]/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            <FileText className="w-3 h-3 text-[#0878F9]" />
                            View Proof
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#526B91] italic">No File</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenReview(pay)}
                            className="px-2.5 py-1 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0B2148] border border-[#D8E8FA] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye className="w-3 h-3 text-[#526B91]" />
                            Inspect
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => verifyPaymentMutation.mutate(pay.id)}
                                disabled={verifyPaymentMutation.isPending}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                                title="Accept and Verify Payment"
                              >
                                {verifyPaymentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Accept
                              </button>

                              <button
                                onClick={() => handleOpenReject(pay.id)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Reject Payment"
                              >
                                <X className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 text-[#526B91]">
            <ClipboardList className="w-10 h-10 mb-3 text-[#526B91]/40" />
            <p className="text-sm font-bold text-[#0B2148]">No payment records found</p>
            <p className="text-xs text-[#526B91] mt-1">There are no payment records matching your current filter criteria.</p>
          </div>
        )}
      </div>

      {/* Review & Verification Inspection Modal */}
      {isReviewModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 sm:p-8 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl w-full mx-auto space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0B2148]">Payment Transaction Audit</h3>
                  <p className="text-xs text-[#526B91] font-mono">
                    Ref: {selectedPayment.paymentReference} • Created {new Date(selectedPayment.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Financial Overview in Modal */}
            <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider block">Submitted Amount</span>
                <span className="font-mono font-bold text-sm text-[#166534]">
                  ₹ {parseFloat(selectedPayment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider block">Payment Method</span>
                <span className="font-semibold text-xs text-[#0B2148] uppercase">
                  {selectedPayment.paymentMethod.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider block">Payment Date</span>
                <span className="font-mono text-xs text-[#0B2148]">
                  {new Date(selectedPayment.paymentDate).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider block">Status</span>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  selectedPayment.status === "VERIFIED" ? "bg-emerald-50 text-[#166534] border border-emerald-200" :
                  selectedPayment.status === "PENDING_VERIFICATION" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                  "bg-rose-50 text-rose-700 border border-rose-200"
                }`}>
                  {selectedPayment.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Detailed Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3 p-4 rounded-2xl bg-white border border-[#D8E8FA]">
                <h4 className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider pb-1 border-b border-[#D8E8FA]">
                  Commercial Account Link
                </h4>
                <div>
                  <span className="text-[10px] text-[#526B91] block">Customer</span>
                  <span className="font-bold text-[#0B2148]">{selectedPayment.customer?.name || "N/A"}</span>
                </div>
                {selectedPayment.salesOrder && (
                  <div>
                    <span className="text-[10px] text-[#526B91] block">Sales Order Number</span>
                    <span className="font-mono font-bold text-[#0878F9]">{selectedPayment.salesOrder.salesOrderNumber}</span>
                  </div>
                )}
                {selectedPayment.invoice && (
                  <div>
                    <span className="text-[10px] text-[#526B91] block">Invoice Reference</span>
                    <span className="font-mono font-bold text-[#0B2148]">{selectedPayment.invoice.invoiceNumber}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-white border border-[#D8E8FA]">
                <h4 className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider pb-1 border-b border-[#D8E8FA]">
                  Transaction & Bank Details
                </h4>
                <div>
                  <span className="text-[10px] text-[#526B91] block">Transaction / UTR / Cheque Ref</span>
                  <span className="font-mono font-bold text-[#0B2148]">{selectedPayment.referenceNumber || "None specified"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#526B91] block">Bank Account Deposited To</span>
                  <span className="font-medium text-[#0B2148]">{selectedPayment.bankAccountDetails || "Primary Operating Account"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#526B91] block">Submitted By</span>
                  <span className="text-[#0B2148]">{selectedPayment.recordedBy?.name || "Sales User"}</span>
                </div>
              </div>
            </div>

            {/* Proof Attachment */}
            {selectedPayment.paymentProofUrl && (
              <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0878F9]" />
                  <span className="text-xs font-mono text-[#0B2148]">
                    {selectedPayment.paymentProofUrl.split("/").pop()}
                  </span>
                </div>
                <a
                  href={getMediaUrl(selectedPayment.paymentProofUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-white hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Document
                </a>
              </div>
            )}

            {/* Notes */}
            {selectedPayment.notes && (
              <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] text-xs">
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1">Remarks & Notes</span>
                <p className="text-[#0B2148] italic">{selectedPayment.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-[#D8E8FA]">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 bg-white border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>

              {selectedPayment.status === "PENDING_VERIFICATION" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewModalOpen(false);
                      handleOpenReject(selectedPayment.id);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer transition-all"
                  >
                    Reject Submission
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyPaymentMutation.mutate(selectedPayment.id)}
                    disabled={verifyPaymentMutation.isPending}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {verifyPaymentMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Accept & Verify Payment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Confirmation Dialog */}
      {isRejectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl border border-rose-200 bg-white max-w-lg w-full mx-auto space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700 pb-2 border-b border-[#D8E8FA]">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2148]">Reject Payment Submission</h3>
            </div>

            <p className="text-xs text-[#0B2148]">
              Please enter the audit reason for rejecting this payment submission. The submitter will receive this feedback to provide corrected payment evidence.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                  Rejection Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Attached receipt proof does not match transaction UTR, deposit slip unreadable..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectDialogOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectPaymentMutation.isPending}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {rejectPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Proof Viewer Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl w-full mx-auto space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0878F9]" />
                <h3 className="text-sm font-bold text-[#0B2148] font-mono">Payment Proof Document</h3>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="w-8 h-8 rounded-full bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-center p-2 bg-[#F4F9FF] rounded-2xl max-h-[70vh] overflow-auto border border-[#D8E8FA]">
              {previewProofUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img 
                  src={getMediaUrl(previewProofUrl)} 
                  alt="Payment Proof" 
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm" 
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.style.opacity = "0.4";
                  }}
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <FileText className="w-12 h-12 text-[#0878F9] mx-auto" />
                  <p className="text-xs text-[#0B2148] font-mono">{previewProofUrl.split("/").pop()}</p>
                  <a
                    href={getMediaUrl(previewProofUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0878F9] text-white font-bold text-xs rounded-xl hover:bg-[#0665d0] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Document in New Tab
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8E8FA]">
              <a
                href={getMediaUrl(previewProofUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] hover:border-[#0878F9]/40 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open File
              </a>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="px-4 py-2 bg-[#0878F9] text-white font-bold text-xs rounded-xl hover:bg-[#0665d0] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
