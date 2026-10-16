"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Trash2, 
  ShieldAlert, 
  Lock, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Database,
  Archive,
  History,
  ShoppingCart,
  Wrench,
  Zap,
  X
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function MaintenanceTab() {
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    targetId: string;
    targetTitle: string;
    description: string;
  }>({
    isOpen: false,
    targetId: "",
    targetTitle: "",
    description: ""
  });

  const [confirmKeywordInput, setConfirmKeywordInput] = useState("");

  const purgeMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.wipeAllData) {
        return (await api.post("/admin/wipe-all-data")).data;
      }
      return (await api.delete("/admin/clear-data", { data: payload })).data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries();
      toast.success(data?.message || "Operation completed successfully");
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      setConfirmKeywordInput("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Execution failed");
    }
  });

  const purgeOperations = [
    { 
      id: "wipeAllData", 
      label: "Wipe All Data (Keep Only Seed Users)", 
      icon: Database,
      isMaster: true,
      sub: "Complete database wipe. Permanently purges all transactional records, leads, customers, quotations, sales, inventory, packs, and logs. Preserves ONLY the 12 clean seed users." 
    },
    { 
      id: "clearPax", 
      label: "Wipe All PAX Battery Packs", 
      icon: Database,
      isMaster: false,
      sub: "Deletes all assembled battery pack records, pack cells, and returns associated serialized cells to active stock." 
    },
    { 
      id: "clearSales", 
      label: "Clear Sales & Quotations Ledger", 
      icon: ShoppingCart,
      isMaster: false,
      sub: "Deletes all sales orders, customer quotations, invoices, payment history, and commercial records." 
    },
    { 
      id: "clearAuditLogs", 
      label: "Flush Audit & Operational Logs", 
      icon: History,
      isMaster: false,
      sub: "Purges historical action audit logs, testing logs, and machine telemetry history." 
    },
    { 
      id: "clearCells", 
      label: "Reset Raw & Tested Cell Stock", 
      icon: Zap,
      isMaster: false,
      sub: "Deletes all serialized cells across testing, QC, and inward batches from the database." 
    },
    { 
      id: "clearService", 
      label: "Clear Service & RMA Records", 
      icon: Wrench,
      isMaster: false,
      sub: "Deletes all service intake tickets, repair logs, test certificates, and customer warranty records." 
    },
    { 
      id: "clearScrap", 
      label: "Purge Scrap Management Archive", 
      icon: Archive,
      isMaster: false,
      sub: "Deletes all reported, approved, and disposed scrap cell ledgers and material loss records." 
    },
  ];

  const handleOpenDialog = (item: any) => {
    setConfirmDialog({
      isOpen: true,
      targetId: item.id,
      targetTitle: item.label,
      description: item.sub
    });
    setConfirmKeywordInput("");
  };

  const handleExecutePurge = () => {
    if (!confirmDialog.targetId) return;
    if (confirmKeywordInput.trim().toUpperCase() !== "PURGE") {
      toast.error("Please type 'PURGE' to confirm irreversible deletion.");
      return;
    }
    if (confirmDialog.targetId === "wipeAllData") {
      purgeMutation.mutate({ wipeAllData: true });
    } else {
      purgeMutation.mutate({ [confirmDialog.targetId]: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Purge Production Data Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#D8E8FA] space-y-5 shadow-sm"
        >
          <div className="flex items-center gap-3.5 pb-5 border-b border-[#D8E8FA]">
            <div className="w-11 h-11 bg-[#FEE2E2] border border-[#FECACA] rounded-xl flex items-center justify-center text-[#991B1B]">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0B2148]">Purge Production Data</h3>
              <p className="text-xs font-bold text-[#991B1B] uppercase tracking-wider mt-0.5">Permanent Deletion • Irreversible Database Operations</p>
            </div>
          </div>

          <div className="space-y-3">
            {purgeOperations.map((item, idx: number) => (
              <div 
                key={item.id} 
                className={`p-4 rounded-xl flex items-center justify-between gap-4 group transition-all ${
                  item.isMaster
                    ? "bg-[#FEE2E2] border-2 border-[#FECACA]"
                    : "bg-[#F4F9FF] border border-[#D8E8FA] hover:border-[#DC2626]/40 hover:bg-[#FEE2E2]/30"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`w-6 h-6 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-1.5 border ${
                    item.isMaster 
                      ? "bg-[#991B1B] text-white border-[#7F1D1D]" 
                      : "bg-white text-[#526B91] border-[#D8E8FA]"
                  }`}>
                    #{idx + 1}
                  </span>
                  <div 
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                      item.isMaster
                        ? "bg-[#991B1B] text-white"
                        : "bg-white border border-[#D8E8FA] text-[#526B91] group-hover:text-[#991B1B] group-hover:border-[#FECACA]"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-bold ${item.isMaster ? "text-[#991B1B]" : "text-[#0B2148] group-hover:text-[#991B1B]"} transition-colors`}>
                        {item.label}
                      </p>
                      {item.isMaster && (
                        <span className="px-2 py-0.5 rounded bg-[#991B1B] text-white text-[9px] font-extrabold tracking-wider uppercase">
                          SuperAdmin Master Wipe
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 leading-relaxed font-medium ${item.isMaster ? "text-[#7F1D1D]" : "text-[#526B91]"}`}>
                      {item.sub}
                    </p>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => handleOpenDialog(item)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex-shrink-0 shadow-sm cursor-pointer ${
                    item.isMaster
                      ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                      : "bg-[#FEE2E2] hover:bg-[#DC2626] text-[#991B1B] hover:text-white border border-[#FECACA]"
                  }`}
                >
                  {item.isMaster ? "Wipe All Data" : "Purge"}
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Safety Protocol & Security Notice */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }} 
          className="lg:col-span-5 space-y-5"
        >
          <div className="bg-[#FEF3C7] p-6 rounded-2xl border border-[#FDE68A] shadow-sm space-y-4 text-[#0B2148]">
            <div className="flex items-center gap-3.5 pb-4 border-b border-[#FDE68A]">
              <div className="w-11 h-11 bg-white border border-[#FDE68A] rounded-xl flex items-center justify-center text-[#92400E]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#92400E]">System Safety Protocols</h3>
                <p className="text-xs font-bold text-[#78350F] uppercase tracking-wider mt-0.5">Destructive Command Safeguards</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#78350F] leading-relaxed">
              <p>
                These purging utilities are engineered strictly for <strong className="text-[#92400E]">pre-production commissioning, factory reset, or unit testing environments</strong>.
              </p>
              <p>
                Executing any of these operations in a live production environment will permanently destroy serial genealogy chains, battery pack matching records, and QC audit logs.
              </p>

              <div className="p-3.5 rounded-xl bg-white/80 border border-[#FDE68A] space-y-1.5 mt-3">
                <p className="text-xs font-bold text-[#92400E] flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  SuperAdmin Level Authorization Required
                </p>
                <p className="text-[11px] text-[#78350F] leading-normal font-medium">
                  All purge executions run inside atomic database transactions with automatic rollback guards on unexpected failure.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D8E8FA] flex items-center gap-4 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-[#EAF5FF] border border-[#BFDBFE] flex items-center justify-center text-[#0878F9] flex-shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B2148]">Continuous Audit Logging</p>
              <p className="text-xs text-[#526B91] mt-0.5 font-medium">Maintenance purge events generate permanent, timestamped AuditLog entries.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* High-Security Two-Factor Confirmation Modal */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} 
              className="absolute inset-0 bg-[#061B3A]/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-2xl bg-white border border-[#D8E8FA] rounded-2xl shadow-2xl p-6 z-10 space-y-5 text-[#0B2148]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#D8E8FA]">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[#991B1B] flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0B2148]">Confirm Irreversible Purge</h3>
                    <p className="text-xs font-bold text-[#991B1B] uppercase tracking-wider mt-0.5">Permanent Data Destruction</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 hover:bg-[#EAF5FF] rounded-xl text-[#526B91] hover:text-[#0878F9] cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] space-y-1">
                <p className="text-sm font-bold text-[#991B1B]">{confirmDialog.targetTitle}</p>
                <p className="text-xs text-[#7F1D1D] leading-relaxed font-medium">{confirmDialog.description}</p>
              </div>

              {/* Type-to-Confirm Safeguard */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center justify-between">
                  <span>Type <span className="text-[#991B1B] font-mono font-bold">PURGE</span> to confirm *</span>
                  <span className="text-[#526B91] font-normal lowercase">Case-insensitive</span>
                </label>
                <input 
                  type="text" 
                  value={confirmKeywordInput}
                  onChange={(e) => setConfirmKeywordInput(e.target.value)}
                  placeholder="Type PURGE here..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-4 text-[#0B2148] font-mono placeholder-[#64748B] focus:border-[#DC2626] focus:bg-white focus:ring-2 focus:ring-[#DC2626]/20 outline-none transition-all text-sm font-bold" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#D8E8FA] text-[#0B2148] font-bold text-xs uppercase tracking-wider hover:bg-[#EAF5FF] hover:text-[#0878F9] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleExecutePurge}
                  disabled={purgeMutation.isPending || confirmKeywordInput.trim().toUpperCase() !== "PURGE"}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  {purgeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Execute Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
