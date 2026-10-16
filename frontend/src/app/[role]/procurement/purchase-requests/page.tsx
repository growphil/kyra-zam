"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ClipboardList, 
  Search, 
  Plus, 
  X, 
  Loader2, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Trash,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

export default function PurchaseRequestsPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [source, setSource] = useState("MANUAL");
  const [sourceReferenceId, setSourceReferenceId] = useState("");
  const [reqPriority, setReqPriority] = useState("NORMAL");
  const [requiredDate, setRequiredDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([
    { materialId: "", requestedQuantity: 1, requiredDate: "", specification: "", notes: "" }
  ]);

  // --- DATA FETCHING ---
  const { data: dashboardData } = useQuery({
    queryKey: ["procurement-dashboard"],
    queryFn: async () => (await api.get("/crm/procurement/dashboard")).data
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ["procurement-pr-list", search, status, priority, page],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/purchase-requests", {
        params: { search, status, priority, page, limit: 10 }
      });
      return res.data;
    }
  });

  const { data: materials } = useQuery({
    queryKey: ["procurement-materials-dropdown"],
    queryFn: async () => (await api.get("/inventory/materials")).data || []
  });

  // --- MUTATIONS ---
  const createPRMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/procurement/purchase-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procurement-pr-list"] });
      queryClient.invalidateQueries({ queryKey: ["procurement-dashboard"] });
      toast.success("Purchase Request Draft created");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to create PR");
    }
  });

  const resetForm = () => {
    setSource("MANUAL");
    setSourceReferenceId("");
    setReqPriority("NORMAL");
    setRequiredDate("");
    setReason("");
    setNotes("");
    setItems([{ materialId: "", requestedQuantity: 1, requiredDate: "", specification: "", notes: "" }]);
  };

  const handleAddItem = () => {
    setItems([...items, { materialId: "", requestedQuantity: 1, requiredDate: "", specification: "", notes: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const prs = listData?.requests || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / 10) || 1;
  const stats = dashboardData?.stats || {};

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredDate || items.some(it => !it.materialId || !it.requiredDate)) {
      toast.error("Please fill in PR Required Date and all item details.");
      return;
    }
    createPRMutation.mutate({
      source,
      sourceReferenceId: sourceReferenceId || null,
      priority: reqPriority,
      requiredDate,
      reason: reason || null,
      notes: notes || null,
      items
    });
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      {/* Header */}
      <PageHeader
        title="Purchase Requests"
        subtitle={`Active Indents: ${totalCount} Registered Requests`}
        icon={<ClipboardList className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Purchase Request
          </button>
        }
      />

      {/* Stats Widgets */}
      {/* KPI Stats row */}
      <div className="flex-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: stats.totalPR || 0, bg: "bg-[#DBEAFE]/40", text: "text-[#1D4ED8]" },
          { label: "Draft Requests", value: stats.draftPR || 0, bg: "bg-[#F1F5F9]", text: "text-[#475569]" },
          { label: "Pending Approvals", value: stats.pendingPR || 0, bg: "bg-[#FEF3C7]/50", text: "text-[#92400E]" },
          { label: "Approved Requests", value: stats.approvedPR || 0, bg: "bg-[#DCFCE7]/50", text: "text-[#166534]" }
        ].map(stat => (
          <div key={stat.label} className={`p-3.5 rounded-xl border border-[#D8E8FA] bg-white shadow-2xs`}>
            <p className="text-[#526B91] text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
            <h4 className={`text-xl font-display font-bold mt-0.5 ${stat.text}`}>{stat.value}</h4>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex-none flex gap-4 items-center bg-white border border-[#D8E8FA] p-3.5 rounded-xl shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search requests (Number)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg pl-10 pr-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
          />
        </div>

        <select 
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-[#0878F9]"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="ORDERED">Ordered</option>
          <option value="PARTIALLY_RECEIVED">Partially Received</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select 
          value={priority}
          onChange={(e) => { setPriority(e.target.value); setPage(1); }}
          className="bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148] rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-[#0878F9]"
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      {/* Main Grid */}
      <div className="flex-1 bg-white rounded-xl border border-[#D8E8FA] overflow-hidden flex flex-col shadow-2xs">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            </div>
          ) : prs.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">PR Number</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Required Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-xs text-[#0B2148]">
                {prs.map((pr: any) => (
                  <tr key={pr.id} className="hover:bg-[#F4F9FF]/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B2148] text-xs">{pr.prNumber}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded text-[10px] font-bold text-[#526B91]">
                        {pr.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#0B2148] font-semibold">{pr.requestedBy?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center ${
                        pr.priority === "URGENT" ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]" :
                        pr.priority === "HIGH" ? "bg-[#FFEDD5] text-[#9A3412] border border-[#FED7AA]" :
                        pr.priority === "NORMAL" ? "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]" :
                        "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                      }`}>
                        {pr.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#526B91] font-medium">
                      {new Date(pr.requiredDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
                        pr.status === "COMPLETED" || pr.status === "APPROVED" ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]" :
                        pr.status === "REJECTED" || pr.status === "CANCELLED" ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]" :
                        pr.status === "PENDING_APPROVAL" ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" :
                        "bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]"
                      }`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a 
                        href={`/${roleSlug}/procurement/purchase-requests/${pr.id}`} 
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0878F9] hover:underline"
                      >
                        Details
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-16 text-[#526B91]">
              <ClipboardList className="w-10 h-10 mb-3 opacity-40 text-[#526B91]" />
              <p className="text-sm font-semibold text-[#0B2148]">No Purchase Requests Found</p>
              <p className="text-xs text-[#526B91] mt-1">Create a new purchase request or adjust your filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex-none px-4 py-3 border-t border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
          <p className="text-xs text-[#526B91] font-semibold">
            Showing Page {page} of {totalPages} ({totalCount} Total PRs)
          </p>
          <div className="flex gap-1.5">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 bg-white border border-[#D8E8FA] rounded-lg text-[#0B2148] disabled:opacity-40 hover:bg-[#EAF5FF] transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 bg-white border border-[#D8E8FA] rounded-lg text-[#0B2148] disabled:opacity-40 hover:bg-[#EAF5FF] transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Create Drawer */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#061B3A]/40 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setIsCreateOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-white border-l border-[#D8E8FA] h-full flex flex-col shadow-2xl p-6 z-10 overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-4 border-b border-[#D8E8FA]">
                <div>
                  <h2 className="text-lg font-display font-bold text-[#0B2148]">Create Purchase Request</h2>
                  <p className="text-xs text-[#526B91] mt-0.5">Specify material requirements and timelines.</p>
                </div>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 bg-[#F4F9FF] rounded-lg border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="flex-1 py-4 space-y-5">
                
                {/* Meta details */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Source *</label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="MANUAL">Manual Request</option>
                      <option value="SALES_ORDER">Sales Order Shortage</option>
                      <option value="LOW_STOCK">Low Stock Re-order</option>
                      <option value="SERVICE">Service Backing</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Required Target Date *</label>
                    <input 
                      type="date"
                      required
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Priority *</label>
                    <select
                      value={reqPriority}
                      onChange={(e) => setReqPriority(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Reason and notes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Reason for Purchase Request</label>
                    <input 
                      type="text"
                      placeholder="e.g. Backlog fulfillment for PAX packs"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#526B91] uppercase tracking-wider">Notes</label>
                    <input 
                      type="text"
                      placeholder="Internal remarks..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-3 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                {/* Items Box */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#D8E8FA]">
                    <h3 className="text-xs font-bold text-[#526B91] uppercase tracking-wider">PR Requested Items</h3>
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg text-xs font-bold text-[#0878F9] hover:bg-[#EAF5FF] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-[#D8E8FA] bg-[#F4F9FF] space-y-2">
                        <div className="grid grid-cols-12 gap-2.5 items-center">
                          <div className="col-span-4">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Choose Material *</label>
                            <select
                              required
                              value={item.materialId}
                              onChange={(e) => handleItemChange(idx, "materialId", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            >
                              <option value="">Select Material SKU</option>
                              {materials?.map((m: any) => <option key={m.id} value={m.id}>{m.sku} - {m.name} (Qty: {m.quantity})</option>)}
                            </select>
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Qty *</label>
                            <input 
                              type="number"
                              required
                              min={1}
                              value={item.requestedQuantity}
                              onChange={(e) => handleItemChange(idx, "requestedQuantity", parseInt(e.target.value, 10))}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-3">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Item Required Date *</label>
                            <input 
                              type="date"
                              required
                              value={item.requiredDate}
                              onChange={(e) => handleItemChange(idx, "requiredDate", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">Specs</label>
                            <input 
                              type="text"
                              placeholder="e.g. Dimensions"
                              value={item.specification || ""}
                              onChange={(e) => handleItemChange(idx, "specification", e.target.value)}
                              className="w-full mt-1 bg-white border border-[#D8E8FA] rounded-md px-2 py-1 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>

                          <div className="col-span-1 flex justify-center pt-4">
                            <button 
                              type="button" 
                              disabled={items.length === 1}
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 disabled:opacity-30 cursor-pointer"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={createPRMutation.isPending}
                  className="w-full py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {createPRMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Save Draft Purchase Request"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
