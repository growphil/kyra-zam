"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiBaseUrl } from "@/lib/api";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Receipt,
  Search,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal,
  Eye,
  AlertCircle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function SuperadminApprovalsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;

  // Modal states
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "VIEW" | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["expenses-superadmin-pending"],
    queryFn: async () => (await api.get("/expenses/pending")).data
  });

  const pendingExpenses = data?.pendingExpenses || [];
  const count = data?.count || 0;
  const activeThreshold = data?.threshold || 5000;
  const thresholdCurrency = data?.thresholdCurrency || "ZMW";

  const totalPendingAmount = pendingExpenses.reduce(
    (sum: number, exp: any) => sum + parseFloat(exp.amount?.toString() || "0"),
    0
  );

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [proofFilter, setProofFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"DATE_ASC" | "DATE_DESC" | "AMOUNT_DESC" | "AMOUNT_ASC">("DATE_ASC");

  // Fetch categories for filter dropdown
  const { data: catData } = useQuery({
    queryKey: ["expenses-categories-active"],
    queryFn: async () => (await api.get("/expenses/categories", { params: { activeOnly: "true" } })).data
  });
  const categories: any[] = catData?.categories || [];

  const isFilterActive =
    searchQuery.trim() !== "" ||
    categoryFilter !== "ALL" ||
    roleFilter !== "ALL" ||
    proofFilter !== "ALL" ||
    sortBy !== "DATE_ASC";

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("ALL");
    setRoleFilter("ALL");
    setProofFilter("ALL");
    setSortBy("DATE_ASC");
  };

  const filteredExpenses = pendingExpenses
    .filter((exp: any) => {
      // 1. Text Search matching Voucher #, Title, Description, Vendor, Submitter, Category
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = exp.expenseNumber?.toLowerCase().includes(q);
        const matchTitle = exp.title?.toLowerCase().includes(q);
        const matchDesc = exp.description?.toLowerCase().includes(q);
        const matchVendor = exp.vendorName?.toLowerCase().includes(q);
        const matchSubmitter = exp.submittedBy?.name?.toLowerCase().includes(q);
        const matchCategory = exp.category?.name?.toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchDesc && !matchVendor && !matchSubmitter && !matchCategory) {
          return false;
        }
      }

      // 2. Category filter
      if (categoryFilter !== "ALL" && exp.categoryId !== categoryFilter && exp.category?.name !== categoryFilter) {
        return false;
      }

      // 3. Submitter role filter
      if (roleFilter !== "ALL") {
        const roles: string[] = exp.submittedBy?.roles || [];
        if (!roles.includes(roleFilter)) return false;
      }

      // 4. Proof filter
      if (proofFilter === "WITH_PROOF" && (!exp.attachments || exp.attachments.length === 0)) {
        return false;
      }
      if (proofFilter === "NO_PROOF" && exp.attachments && exp.attachments.length > 0) {
        return false;
      }

      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "DATE_ASC") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "DATE_DESC") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "AMOUNT_DESC") {
        return parseFloat(b.amount?.toString() || "0") - parseFloat(a.amount?.toString() || "0");
      }
      if (sortBy === "AMOUNT_ASC") {
        return parseFloat(a.amount?.toString() || "0") - parseFloat(b.amount?.toString() || "0");
      }
      return 0;
    });

  const filteredTotalAmount = filteredExpenses.reduce(
    (sum: number, exp: any) => sum + parseFloat(exp.amount?.toString() || "0"),
    0
  );

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) =>
      (await api.post(`/expenses/${id}/approve`, { notes })).data,
    onSuccess: (res) => {
      toast.success(res.message || "Expense approved.");
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-ledger"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to approve expense.");
    }
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/expenses/${id}/reject`, { reason })).data,
    onSuccess: (res) => {
      toast.success(res.message || "Expense rejected.");
      closeModal();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to reject expense.");
    }
  });

  const closeModal = () => {
    setSelectedExpense(null);
    setActionType(null);
    setShowRejectBox(false);
    setNotes("");
    setReason("");
  };

  const calculateAge = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "1 day ago";
    return `${diff} days ago`;
  };

  return (
    <div className="space-y-6 max-w-[1500px] pb-16">
      <PageHeader
        title="Superadmin Verification Queue"
        subtitle="Review, audit, and approve above-threshold and pending operational expense claims"
        icon={<ShieldCheck className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => router.push(`/${roleSlug}/expenses`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Pending Verifications</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{count}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Awaiting Superadmin sign-off</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Total Pending Value</span>
            <Receipt className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600">
            {thresholdCurrency} {totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Liquidity awaiting authorization</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Configured Auto-Threshold</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {thresholdCurrency} {Number(activeThreshold).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Expenses exceeding this enter this queue</p>
        </div>
      </div>

      {/* Search, Filter & Controls Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher #, title, description, submitter, vendor, category..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 bg-slate-50/50 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{filteredExpenses.length}</span> of{" "}
              <span className="font-bold text-slate-900">{pendingExpenses.length}</span>
              {isFilterActive && (
                <span className="text-blue-600 font-bold ml-1.5">
                  ({thresholdCurrency} {filteredTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </span>
              )}
            </span>
            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold transition-all cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submitting Role Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Submitter Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Submitter Roles</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="ADMIN">Administrator</option>
              <option value="SUPERADMIN">Super Admin</option>
            </select>
          </div>

          {/* Proof Status Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Proof Status</label>
            <select
              value={proofFilter}
              onChange={(e) => setProofFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Proof Status</option>
              <option value="WITH_PROOF">With Supporting Proof</option>
              <option value="NO_PROOF">No Proof Attached</option>
            </select>
          </div>

          {/* Sort By Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="DATE_ASC">Oldest First (FIFO)</option>
              <option value="DATE_DESC">Newest First</option>
              <option value="AMOUNT_DESC">Highest Amount</option>
              <option value="AMOUNT_ASC">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pending Table */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800">
            Pending Review Requests ({filteredExpenses.length})
          </h3>
          <span className="text-xs text-slate-500">
            {sortBy === "DATE_ASC" && "Sorted: Oldest first (FIFO review)"}
            {sortBy === "DATE_DESC" && "Sorted: Newest first"}
            {sortBy === "AMOUNT_DESC" && "Sorted: Highest amount first"}
            {sortBy === "AMOUNT_ASC" && "Sorted: Lowest amount first"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="p-3">Expense ID</th>
                <th className="p-3">Submitted By</th>
                <th className="p-3">Title & Category</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Submission Age</th>
                <th className="p-3">Supporting Proof</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp: any) => {
                const isSelf = exp.submittedById === currentUserId;
                return (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">{exp.expenseNumber}</td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{exp.submittedBy?.name}</p>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {exp.submittedBy?.roles?.[0]}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800">{exp.title}</p>
                      <p className="text-[11px] text-slate-500">{exp.category?.name}</p>
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {exp.currency} {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-slate-600 font-medium">
                      {calculateAge(exp.createdAt)}
                    </td>
                    <td className="p-3">
                      {exp.attachments && exp.attachments.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {exp.attachments.map((att: any, i: number) => {
                            const apiBase = getApiBaseUrl();
                            const fileUrl = att.fileUrl.startsWith("http") ? att.fileUrl : `${apiBase}${att.fileUrl}`;
                            return (
                              <a
                                key={att.id || i}
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600 font-bold text-[10px] flex items-center gap-1 hover:bg-blue-100"
                              >
                                <span>Proof #{i + 1}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No proof</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedExpense(exp);
                          setActionType("VIEW");
                          setShowRejectBox(false);
                          setNotes("");
                          setReason("");
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pendingExpenses.length > 0 && filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                    <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 mb-1">No matching pending expenses found</p>
                    <p className="text-slate-500 mb-3">Try adjusting your search query or filter options.</p>
                    <button
                      onClick={resetFilters}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  </td>
                </tr>
              )}
              {pendingExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    All above-threshold and pending operational expenses have been cleared!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPENSE VIEW & VERIFICATION MODAL */}
      {selectedExpense && actionType === "VIEW" && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                    {selectedExpense.expenseNumber}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending Verification
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedExpense.title}</h3>
                <p className="text-xs text-slate-500">
                  Submitted by <strong className="text-slate-800">{selectedExpense.submittedBy?.name}</strong> (
                  {selectedExpense.submittedBy?.roles?.[0]}) • {calculateAge(selectedExpense.createdAt)}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Threshold & Amount Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Voucher Claim Amount</p>
                <p className="text-2xl font-black text-slate-900">
                  {selectedExpense.currency} {Number(selectedExpense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Auto-Threshold</p>
                <p className="text-base font-bold text-slate-700">
                  {thresholdCurrency} {Number(activeThreshold).toLocaleString()}
                </p>
                {Number(selectedExpense.amount) > Number(activeThreshold) && (
                  <p className="text-[10px] font-bold text-amber-700 mt-0.5">
                    Exceeds threshold by {selectedExpense.currency} {(Number(selectedExpense.amount) - Number(activeThreshold)).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Separation of Duties Notice if Self-Submitted */}
            {selectedExpense.submittedById === currentUserId && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Self-Approval Prohibited Under Financial Governance</p>
                  <p className="opacity-90 mt-0.5">
                    You created this expense voucher. The dual-control (four-eyes) governance policy strictly requires an independent authorized secondary approver to verify this claim.
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description</label>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedExpense.description || "No description provided."}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Category</p>
                <p className="font-bold text-slate-800 truncate">{selectedExpense.category?.name || "N/A"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Department</p>
                <p className="font-bold text-slate-800 truncate">{selectedExpense.department || "Operations"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Expense Date</p>
                <p className="font-bold text-slate-800">
                  {new Date(selectedExpense.expenseDate).toLocaleDateString()}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Vendor Name</p>
                <p className="font-bold text-slate-800 truncate">{selectedExpense.vendorName || "None listed"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Invoice / Bill #</p>
                <p className="font-mono font-bold text-slate-800 truncate">{selectedExpense.invoiceNumber || "None"}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Payment Status</p>
                <p className="font-bold text-slate-800">{selectedExpense.paymentStatus}</p>
              </div>
            </div>

            {/* Supporting Document Proofs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Supporting Document Proof ({selectedExpense.attachments?.length || 0})
                </label>
                <span className="text-[10px] text-slate-400">Auditable proof attachments</span>
              </div>

              {selectedExpense.attachments && selectedExpense.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedExpense.attachments.map((att: any, i: number) => {
                    const apiBase = getApiBaseUrl();
                    const fileUrl = att.fileUrl.startsWith("http") ? att.fileUrl : `${apiBase}${att.fileUrl}`;
                    return (
                      <a
                        key={att.id || i}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-200 hover:bg-blue-100/70 transition-all text-xs group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="truncate">
                            <p className="font-bold text-slate-800 group-hover:text-blue-700 truncate">{att.fileName}</p>
                            <p className="text-[10px] text-slate-500">{(att.fileSize / 1024).toFixed(1)} KB • {att.documentType}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400 italic">
                  No supporting documents attached to this claim.
                </div>
              )}
            </div>

            {/* Rejection / Approval Action Area */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              {showRejectBox ? (
                <div className="space-y-3 p-4 rounded-xl bg-rose-50/60 border border-rose-200">
                  <div className="flex items-center gap-2 text-rose-800">
                    <XCircle className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Mandatory Rejection Justification</h4>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Provide specific feedback or reason for rejecting this claim (e.g. Missing valid tax invoice, duplicate claim, unbudgeted expenditure)..."
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-xs focus:outline-hidden focus:border-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectBox(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      Back to Review
                    </button>
                    <button
                      type="button"
                      disabled={rejectMutation.isPending || !reason.trim()}
                      onClick={() => rejectMutation.mutate({ id: selectedExpense.id, reason })}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {rejectMutation.isPending ? "Rejecting..." : "Confirm & Reject Voucher"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Approval Remarks / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Budget authorization verified with Department Head."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/${roleSlug}/expenses/${selectedExpense.id}`)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Full Voucher Page</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Close
                      </button>

                      {selectedExpense.submittedById !== currentUserId && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowRejectBox(true)}
                            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs border border-rose-200 cursor-pointer transition-all"
                          >
                            Reject Claim
                          </button>
                          <button
                            type="button"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate({ id: selectedExpense.id, notes })}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {approveMutation.isPending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Approving...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Expense</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
