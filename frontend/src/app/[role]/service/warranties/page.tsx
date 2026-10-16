"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Shield, 
  Search, 
  Loader2, 
  Plus, 
  ClipboardList,
  ArrowUpRight
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";

export default function WarrantiesRegistryPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  // Form State
  const [customerId, setCustomerId] = useState("");
  const [paxSerial, setPaxSerial] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState(12);
  const [coverage, setCoverage] = useState("FULL");
  const [terms, setTerms] = useState("");
  const [exclusions, setExclusions] = useState("");

  // --- DATA FETCHING ---
  const { data: warranties, isLoading } = useQuery({
    queryKey: ["service-warranties-list"],
    queryFn: async () => (await api.get("/crm/warranty/warranties")).data || []
  });

  const { data: customers } = useQuery({
    queryKey: ["crm-customers-all"],
    queryFn: async () => (await api.get("/crm/customers")).data || []
  });

  // --- MUTATIONS ---
  const registerMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/warranty/warranties", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-warranties-list"] });
      queryClient.invalidateQueries({ queryKey: ["service-dashboard-stats"] });
      setShowAddDrawer(false);
      setCustomerId("");
      setPaxSerial("");
      setSalesOrderId("");
      setInvoiceId("");
      setTerms("");
      setExclusions("");
      toast.success("Warranty registered and active!");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Registration failed")
  });

  const filtered = warranties?.filter((w: any) => 
    w.warrantyNumber.toLowerCase().includes(search.toLowerCase()) ||
    w.paxSerial.toLowerCase().includes(search.toLowerCase()) ||
    w.customer?.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !paxSerial) {
      toast.error("Customer and PAX Serial are required");
      return;
    }
    registerMutation.mutate({
      customerId,
      paxSerial,
      salesOrderId: salesOrderId || null,
      invoiceId: invoiceId || null,
      deliveryDate,
      warrantyDurationMonths: duration,
      coverageType: coverage,
      terms: terms || null,
      exclusions: exclusions || null
    });
  };

  return (
    <div className="space-y-4 max-w-[1700px] pb-8">
      {/* Header */}
      <PageHeader
        title="Warranty Registry"
        subtitle="Active Warranty coverage records and claims validation"
        icon={<Shield className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button 
            onClick={() => setShowAddDrawer(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] text-white font-bold text-xs hover:bg-[#0667DB] transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Register Warranty Manual
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-4 items-center bg-white border border-[#D8E8FA] p-3 rounded-2xl shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            type="text" 
            placeholder="Search warranties (WAR, Pax Serial, Customer Name)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-[#0878F9]"
          />
        </div>
      </div>

      {/* Registry Grid */}
      <div className="glass-panel rounded-[2.5rem] border border-[#D8E8FA] bg-[#F4F9FF] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                <th className="p-6">Warranty Number</th>
                <th className="p-6">Customer Name</th>
                <th className="p-6">PAX Serial</th>
                <th className="p-6">Start Date</th>
                <th className="p-6">End Date</th>
                <th className="p-6">Coverage</th>
                <th className="p-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
              {filtered.map((w: any) => (
                <tr key={w.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-6 font-mono font-bold text-[#0B2148] text-sm">{w.warrantyNumber}</td>
                  <td className="p-6 font-semibold text-[#0B2148]">{w.customer?.name}</td>
                  <td className="p-6 font-mono text-xs">{w.paxSerial}</td>
                  <td className="p-6 text-[#526B91]">
                    {new Date(w.warrantyStartDate).toLocaleDateString()}
                  </td>
                  <td className="p-6 text-[#526B91] font-semibold">
                    {new Date(w.warrantyEndDate).toLocaleDateString()}
                  </td>
                  <td className="p-6 uppercase font-bold text-indigo-400">{w.coverageType}</td>
                  <td className="p-6">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      w.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" :
                      w.status === "EXPIRED" ? "bg-red-500/15 text-red-400" :
                      "bg-slate-500/15 text-[#0B2148]"
                    }`}>
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 text-[#526B91]">
            <ClipboardList className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-base font-semibold">No warranties found</p>
          </div>
        )}
      </div>

      {/* Manual register warranty dialog */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-xs">
          <div className="p-8 max-w-lg w-full bg-white border border-[#D8E8FA] rounded-3xl space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-display font-bold text-[#0B2148]">Register warranty manually</h3>
            
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Customer *</label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm text-[#0B2148]"
                >
                  <option value="">Select Claimant Customer</option>
                  {customers?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">PAX Battery Serial *</label>
                <input 
                  type="text" 
                  required
                  placeholder="PAX-000XXX"
                  value={paxSerial}
                  onChange={(e) => setPaxSerial(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm text-[#0B2148] font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Delivery Date</label>
                  <input 
                    type="date" 
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm text-[#0B2148]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Duration (Months)</label>
                  <input 
                    type="number" 
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm text-[#0B2148]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Coverage Type</label>
                <select
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2.5 text-sm text-[#0B2148]"
                >
                  <option value="FULL">Full Coverage (Parts + Labor)</option>
                  <option value="PARTS_ONLY">Parts Only</option>
                  <option value="LABOUR_ONLY">Labor Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#526B91] font-bold uppercase tracking-wider">Special Terms / Exclusions</label>
                <textarea 
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Specify warranty conditions..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2 text-sm text-[#0B2148] placeholder-[#64748B] h-20 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-[#D8E8FA]">
                <button type="button" onClick={() => setShowAddDrawer(false)} className="px-4 py-2 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl text-[#0B2148] text-xs font-semibold hover:bg-[#EAF5FF]">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#0878F9] hover:bg-[#0878F9]/90 text-white font-bold rounded-xl text-xs shadow-md shadow-[#0878F9]/20">
                  Register Warranty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
