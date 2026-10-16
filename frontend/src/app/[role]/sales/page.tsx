"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShoppingBag, 
  Search, 
  DollarSign, 
  Truck, 
  User, 
  CheckCircle2, 
  Loader2,
  Package,
  Zap,
  ChevronRight,
  TrendingUp,
  Tag,
  X,
  Plus,
  ArrowUpRight,
  Info,
  Calendar,
  Box,
  Building2,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SalesPage() {
  const [search, setSearch] = useState("");
  const [sellingPax, setSellingPax] = useState<any>(null);
  const queryClient = useQueryClient();

  // --- DATA FETCHING ---
  const { data: paxData, isLoading } = useQuery({
    queryKey: ["pax-sales-list", search],
    queryFn: async () => (await api.get("/pax", { params: { status: "READY_FOR_SALE" } })).data
  });

  const { data: vendors } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => (await api.get("/admin/vendors")).data
  });

  const recordSaleMutation = useMutation({
    mutationFn: (data: any) => api.post("/sales", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pax-sales-list"] });
      toast.success("Transaction Secured Successfully");
      setSellingPax(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Transaction failed")
  });

  const calculateStats = (pax: any) => {
    if (!pax || !pax.cells) return { ah: 0, ir: 0 };
    const ahValues = pax.cells.map((c: any) => c.cell.ahValue);
    const irValues = pax.cells.map((c: any) => c.cell.irValue);
    return {
      ah: ahValues.reduce((a: number, b: number) => a + b, 0) / ahValues.length,
      ir: irValues.reduce((a: number, b: number) => a + b, 0) / irValues.length,
    };
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col space-y-4 max-w-[1700px] mx-auto overflow-hidden pb-4">
      {/* Header Section */}
      <PageHeader
        title="Sales & Dispatch"
        subtitle="Inventory Management Active"
        icon={<ShoppingBag className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-[#D8E8FA] shadow-xs">
              <div>
                <p className="text-[9px] font-bold text-[#526B91] uppercase tracking-wider">Ready Stock</p>
                <p className="text-xs font-bold text-[#0B2148]">{paxData?.total || 0} Units</p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search serial or model..." 
                className="w-full bg-white border border-[#D8E8FA] rounded-xl py-1.5 pl-9 pr-3 text-xs font-mono text-[#0B2148] focus:border-[#0878F9] outline-none transition-all placeholder:text-[#526B91] uppercase shadow-xs" 
              />
            </div>
          </div>
        }
      />

      {/* Main Inventory Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-panel h-64 rounded-3xl animate-pulse bg-[#F4F9FF]" />
            ))}
          </div>
        ) : paxData?.packs?.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-32">
             <div className="w-24 h-24 bg-[#F4F9FF] rounded-[2.5rem] flex items-center justify-center mb-8 text-slate-800">
                <Box className="w-12 h-12" />
             </div>
             <h3 className="text-2xl font-display font-bold text-[#0B2148] mb-2">Out of Stock</h3>
             <p className="text-[#526B91]">All authorized battery packs have been dispatched.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            <AnimatePresence mode="popLayout">
              {paxData.packs.map((pax: any) => {
                const stats = calculateStats(pax);
                return (
                  <motion.div
                    layout
                    key={pax.paxSerial}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group glass-panel p-6 rounded-[2.5rem] border border-[#D8E8FA] hover:border-accent/20 transition-all flex flex-col relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-6">
                       <div className="w-12 h-12 bg-[#F4F9FF] rounded-2xl flex items-center justify-center text-[#526B91] group-hover:bg-accent group-hover:text-white transition-all shadow-inner">
                          <Package className="w-6 h-6" />
                       </div>
                       <div className="text-right">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[9px] font-bold uppercase tracking-widest">Available</span>
                          <p className="text-[9px] font-mono text-[#526B91] mt-2 uppercase">Verified: {new Date(pax.approvedAt).toLocaleDateString()}</p>
                       </div>
                    </div>

                    <div className="flex-1">
                       <h4 className="text-lg font-mono font-bold text-[#0B2148] mb-1 uppercase tracking-tighter">{pax.paxSerial}</h4>
                       <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">{pax.paxType.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                       <div className="p-3 bg-black/20 rounded-xl border border-[#D8E8FA]">
                          <p className="text-[8px] font-bold text-[#526B91] uppercase mb-1 tracking-widest">Avg Capacity</p>
                          <p className="text-xs font-mono text-[#0B2148] font-bold">{stats.ah.toFixed(2)} AH</p>
                       </div>
                       <div className="p-3 bg-black/20 rounded-xl border border-[#D8E8FA]">
                          <p className="text-[8px] font-bold text-[#526B91] uppercase mb-1 tracking-widest">Avg Res</p>
                          <p className="text-xs font-mono text-[#0B2148] font-bold">{stats.ir.toFixed(1)} mΩ</p>
                       </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100">
                       <button 
                         onClick={() => setSellingPax(pax)}
                         className="w-full py-3.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                       >
                          <CreditCard className="w-4 h-4" />
                          Record Transaction
                       </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <AnimatePresence>
        {sellingPax && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSellingPax(null)} 
              className="absolute inset-0 bg-white backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 40 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 40 }} 
              className="bg-white w-full max-w-2xl p-10 rounded-[3rem] relative z-10 border border-slate-200 shadow-2xl overflow-hidden text-slate-900"
            >
              <div className="absolute top-0 right-0 p-8">
                 <button onClick={() => setSellingPax(null)} className="p-2 hover:bg-slate-100 rounded-full text-[#526B91] hover:text-slate-700 transition-all cursor-pointer">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex items-center gap-6 mb-10">
                <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-[1.5rem] flex items-center justify-center text-blue-600">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Record Sale</h2>
                  <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-[0.2em] mt-1">Industrial Dispatch Workflow</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[9px] font-bold text-[#526B91] uppercase tracking-widest mb-1">Serial Number</p>
                    <p className="text-sm font-mono font-bold text-slate-900 uppercase">{sellingPax.paxSerial}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-[9px] font-bold text-[#526B91] uppercase tracking-widest mb-1">Configuration</p>
                    <p className="text-sm font-mono font-bold text-slate-900 uppercase">{sellingPax.paxType.name}</p>
                 </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                recordSaleMutation.mutate({
                  paxSerial: sellingPax.paxSerial,
                  saleType: formData.get("saleType"),
                  vendorId: formData.get("vendorId"),
                  customerName: formData.get("customerName"),
                  amount: parseFloat(formData.get("amount") as string),
                });
              }} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1 flex items-center gap-2">
                        <ArrowUpRight className="w-3 h-3 text-blue-600" />
                        Sale Channel
                     </label>
                     <select name="saleType" className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-900 focus:border-blue-600 outline-none cursor-pointer">
                       <option value="VENDOR">Vendor Distribution</option>
                       <option value="CUSTOMER">Direct Customer</option>
                     </select>
                   </div>

                   <div className="space-y-3">
                     <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-blue-600" />
                        Select Vendor
                     </label>
                     <select name="vendorId" className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-900 focus:border-blue-600 outline-none cursor-pointer">
                       <option value="">None / Direct</option>
                       {vendors?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                     </select>
                   </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1 flex items-center gap-2">
                     <User className="w-3 h-3 text-blue-600" />
                     End Customer Name (Reference)
                  </label>
                  <input name="customerName" placeholder="ENTER CUSTOMER DETAILS..." className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-900 focus:border-blue-600 outline-none" />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest ml-1 flex items-center gap-2">
                     <DollarSign className="w-3 h-3 text-blue-600" />
                     Sale Amount (₹)
                  </label>
                  <div className="relative">
                     <input name="amount" type="number" step="0.01" required placeholder="0.00" className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 pl-10 text-sm text-slate-900 focus:border-blue-600 outline-none font-mono" />
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#526B91] font-mono">₹</span>
                  </div>
                </div>

                <div className="pt-8 flex gap-4">
                  <button type="button" onClick={() => setSellingPax(null)} className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-[#526B91] font-bold hover:bg-slate-100 transition-all text-xs uppercase tracking-wider cursor-pointer">Discard</button>
                  <button 
                    disabled={recordSaleMutation.isPending}
                    className="flex-[2] bg-blue-600 py-3.5 rounded-2xl text-white font-semibold hover:bg-blue-700 transition-all text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {recordSaleMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirm & Dispatch
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
