"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Loader2, 
  RefreshCcw,
  X,
  CheckCircle2,
  Beaker,
  FileText,
  Upload,
  Check,
  Ban,
  Play
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface ServiceBattery {
  id: string;
  serviceId: string;
  customerName: string;
  batteryModel: string;
  status: string;
  createdAt: string;
  version: number;
}

export default function PaxTestingServicePage() {
  const { data: session } = useSession();
  
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isTestEngineer = userRoles.includes("PAX_TEST_ENGINEER");
  const canManageTesting = isAdmin || isTestEngineer;

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState<"test" | null>(null);
  const [selectedBattery, setSelectedBattery] = useState<ServiceBattery | null>(null);
  const queryClient = useQueryClient();

  const [testData, setTestData] = useState({
    voltageTest: "",
    loadTest: "",
    thermalTest: "",
    chargingTest: "",
    dischargeTest: "",
    finalObservation: "",
    status: "PASSED" as "PASSED" | "FAILED"
  });

  useEffect(() => { setMounted(true); }, []);

  // Fetch Service Batteries ready for testing/QC
  const { data: batteries, isLoading, refetch } = useQuery({
    queryKey: ["service-batteries-testing"],
    queryFn: async () => {
      const res = await api.get("/service/battery");
      return res.data.filter((b: ServiceBattery) => 
        ["REPAIR_COMPLETED", "QC_PENDING", "QC_IN_PROGRESS", "TEST_FAILED", "READY_FOR_DELIVERY"].includes(b.status)
      );
    },
    enabled: mounted,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: string, version: number }) => 
      api.patch(`/service/battery/${selectedBattery?.id}/status`, {
        status: data.status,
        version: data.version
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-testing"] });
      toast.success("Status updated to QC IN PROGRESS");
      closeModal();
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        toast.error("Stale database state. Please refresh the page and try again.");
      } else {
        toast.error(err.response?.data?.error || "Operation failed");
      }
    }
  });

  const submitTestMutation = useMutation({
    mutationFn: (data: any) => api.post("/service/test-report", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-batteries-testing"] });
      toast.success("Test report submitted successfully");
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to submit test report")
  });

  const closeModal = () => {
    setShowModal(null);
    setSelectedBattery(null);
    setTestData({
      voltageTest: "",
      loadTest: "",
      thermalTest: "",
      chargingTest: "",
      dischargeTest: "",
      finalObservation: "",
      status: "PASSED"
    });
  };

  if (!mounted) return null;

  const filteredBatteries = (batteries || []).filter((b: ServiceBattery) => {
    return b.customerName.toLowerCase().includes(search.toLowerCase()) || 
      b.serviceId.toLowerCase().includes(search.toLowerCase()) ||
      b.batteryModel.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "REPAIR_COMPLETED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "QC_PENDING": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "QC_IN_PROGRESS": return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "TEST_FAILED": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "READY_FOR_DELIVERY": return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      default: return "bg-slate-500/10 text-[#526B91] border-slate-500/20";
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <Beaker className="w-7 h-7 text-accent" />
            PAX Service Testing Terminal
          </h1>
          <p className="text-xs text-[#526B91] mt-1 uppercase tracking-widest font-bold">Quality Control & Validation</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="p-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-white transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer or Service ID..." 
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-sm focus:border-accent/30 focus:outline-none transition-all placeholder:text-slate-700" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Repaired Batteries...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Battery Model</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {filteredBatteries.map((bat: ServiceBattery) => (
                <tr key={bat.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148] group-hover:text-[#0B2148] transition-colors">{bat.serviceId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148]">{bat.customerName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-[#526B91]">{bat.batteryModel}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${getStatusColor(bat.status)}`}>
                      {bat.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canManageTesting && (
                        <>
                          {(bat.status === "REPAIR_COMPLETED" || bat.status === "QC_PENDING") && (
                            <button 
                              onClick={() => {
                                setSelectedBattery(bat);
                                updateStatusMutation.mutate({ status: "QC_IN_PROGRESS", version: bat.version });
                              }}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5" /> Start QC Test
                            </button>
                          )}
                          {bat.status === "QC_IN_PROGRESS" && (
                            <button 
                              onClick={() => { setSelectedBattery(bat); setShowModal("test"); }}
                              className="px-3 py-1.5 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            >
                              <Beaker className="w-3.5 h-3.5" /> Record Results
                            </button>
                          )}
                          {bat.status === "READY_FOR_DELIVERY" && (
                            <span className="text-[#166534] font-bold text-xs">QC PASSED</span>
                          )}
                          {bat.status === "TEST_FAILED" && (
                            <span className="text-red-400 font-bold text-xs">QC FAILED</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Test Modal */}
      <AnimatePresence>
        {showModal === "test" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="glass-panel w-full max-w-2xl p-8 rounded-3xl relative z-10 border border-[#D8E8FA] shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><Beaker className="w-5 h-5" /></div>
                  <h2 className="text-xl font-display font-bold text-[#0B2148]">Record Test Results</h2>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-[#F4F9FF] rounded-full text-[#526B91]"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                <p className="text-xs text-[#526B91]">Testing for <span className="text-[#0B2148] font-bold">{selectedBattery?.serviceId}</span></p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Voltage Test</label>
                    <input value={testData.voltageTest} onChange={e => setTestData({...testData, voltageTest: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" placeholder="e.g. 54.2V - OK" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Load Test</label>
                    <input value={testData.loadTest} onChange={e => setTestData({...testData, loadTest: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" placeholder="e.g. 10A for 10 mins" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Thermal Test</label>
                    <input value={testData.thermalTest} onChange={e => setTestData({...testData, thermalTest: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" placeholder="e.g. Max 35°C" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Charging Test</label>
                    <input value={testData.chargingTest} onChange={e => setTestData({...testData, chargingTest: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" placeholder="e.g. Full charge in 4h" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Discharge Test</label>
                  <input value={testData.dischargeTest} onChange={e => setTestData({...testData, dischargeTest: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Final Observation</label>
                  <textarea value={testData.finalObservation} onChange={e => setTestData({...testData, finalObservation: e.target.value})} className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-sm text-white focus:border-accent/50 focus:outline-none h-24" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Test Result</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setTestData({...testData, status: "PASSED"})}
                      className={`flex-1 py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all ${testData.status === "PASSED" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:text-white"}`}
                    >
                      Passed
                    </button>
                    <button 
                      onClick={() => setTestData({...testData, status: "FAILED"})}
                      className={`flex-1 py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all ${testData.status === "FAILED" ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20" : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:text-white"}`}
                    >
                      Failed
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 rounded-xl border border-[#D8E8FA] text-[#526B91] font-bold hover:bg-[#F4F9FF] transition-all text-xs uppercase tracking-widest">Cancel</button>
                <button 
                  onClick={() => submitTestMutation.mutate({ serviceBatteryId: selectedBattery?.id, ...testData })} 
                  disabled={submitTestMutation.isPending}
                  className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-30 py-3.5 rounded-xl text-white font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                >
                  {submitTestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> <span>Submit Test Report</span></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
