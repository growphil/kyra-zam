"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  Zap, 
  Cpu, 
  FileSpreadsheet, 
  User, 
  Calendar,
  Layers,
  Thermometer,
  Gauge,
  Barcode
} from "lucide-react";

interface CellDetailDrawerProps {
  cell: any | null;
  isOpen: boolean;
  onClose: () => void;
  thresholdProfileName?: string;
}

export default function CellDetailDrawer({
  cell,
  isOpen,
  onClose,
  thresholdProfileName = "Configured QC Hierarchy"
}: CellDetailDrawerProps) {
  if (!isOpen || !cell) return null;

  const result = cell.status === "CELL_TESTED" ? "PASS" : cell.status === "RETEST_REQUIRED" ? "RETEST" : cell.status === "REJECTED" ? "FAIL" : cell.status;
  const isPass = result === "PASS";
  const isRetest = result === "RETEST";
  const isFail = result === "FAIL";
  const isHold = result === "HOLD";

  const woNumber = cell.testingRequirement?.workOrder?.workOrderNumber || cell.workOrderNumber || "WO-GENERAL";
  const productRef = cell.testingRequirement?.workOrder?.productRef || cell.productRef || "Battery Pack Assembly";
  const partNumber = cell.partNumber || cell.testingRequirement?.cellSku || "CELL-LFP-3200";
  const testMethod = cell.machineId?.toLowerCase().includes("upload") || cell.inwardBatchId ? "Machine Report" : "Manual Validation";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-[#061B3A]/40 backdrop-blur-xs">
        {/* Backdrop click */}
        <div className="flex-1" onClick={onClose} />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="w-full max-w-md bg-white border-l border-[#D8E8FA] h-full overflow-y-auto custom-scrollbar flex flex-col justify-between p-6 shadow-2xl"
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#526B91]">
                    Cell Validation Detail
                  </span>
                  <h2 className="text-base font-mono font-bold text-[#0B2148]">
                    {cell.serialNumber}
                  </h2>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[#526B91] hover:text-[#0878F9] hover:bg-[#F4F9FF] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QC Result Badge Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              isPass
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : isRetest
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : isFail
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}>
              <div className="flex items-center gap-2.5">
                {isPass ? <CheckCircle2 className="w-5 h-5" /> : isRetest ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Validation Result</p>
                  <p className="text-lg font-black tracking-wide">{result}</p>
                </div>
              </div>

              {cell.grade && (
                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase tracking-wider block opacity-80">Grade</span>
                  <span className="text-base font-mono font-black px-2.5 py-0.5 rounded-lg bg-white border border-[#D8E8FA] text-[#0B2148]">
                    {cell.grade}
                  </span>
                </div>
              )}
            </div>

            {/* Traceability & Context */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#526B91]">
                Traceability & Order
              </h3>
              
              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Cell SKU:</span>
                  <span className="text-[#0B2148] font-bold">{partNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Production Order:</span>
                  <span className="text-accent font-bold">{woNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Product:</span>
                  <span className="text-[#0B2148] truncate max-w-[200px]" title={productRef}>{productRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Batch Number:</span>
                  <span className="text-[#0B2148]">{cell.batchNumber || cell.inwardBatch?.batchNumber || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Validation Date:</span>
                  <span className="text-[#0B2148]">
                    {cell.updatedAt ? new Date(cell.updatedAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Test Engineer:</span>
                  <span className="text-[#0B2148] font-medium">{cell.machineOperator || "Test Engineer"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Test Method:</span>
                  <span className="text-[#0B2148]">{testMethod}</span>
                </div>
              </div>
            </div>

            {/* Test Values */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#526B91]">
                Measured Test Values
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[10px] text-[#526B91] font-bold uppercase block">Capacity (AH)</span>
                  <span className="text-xl font-display font-bold text-[#0B2148] mt-1 block">
                    {cell.ahValue ? `${cell.ahValue.toFixed(2)} AH` : "—"}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[10px] text-[#526B91] font-bold uppercase block">Resistance (IR)</span>
                  <span className="text-xl font-display font-bold text-[#0B2148] mt-1 block">
                    {cell.irValue ? `${cell.irValue.toFixed(1)} mΩ` : "—"}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[10px] text-[#526B91] font-bold uppercase block">Voltage</span>
                  <span className="text-sm font-mono font-bold text-[#0B2148] mt-1 block">
                    {cell.voltage ? `${cell.voltage.toFixed(2)} V` : "3.20 V"}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA]">
                  <span className="text-[10px] text-[#526B91] font-bold uppercase block">Machine ID</span>
                  <span className="text-sm font-mono font-bold text-[#0B2148] mt-1 block">
                    {cell.machineId || "MAC-004"}
                  </span>
                </div>
              </div>
            </div>

            {/* QC Evaluation Profile */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#526B91]">
                QC Threshold Profile
              </h3>

              <div className="p-3.5 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Profile:</span>
                  <span className="text-[#0B2148] font-bold">{thresholdProfileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526B91]">Retest Count:</span>
                  <span className="text-[#0B2148]">{cell.retestCount ?? 0}</span>
                </div>
                {cell.qcDecisionHistory && cell.qcDecisionHistory.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#526B91]">Decision History:</span>
                    <span className="text-[#0B2148] font-mono">
                      {cell.qcDecisionHistory.join(" → ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#D8E8FA]">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] text-xs font-bold text-[#0B2148] transition-all cursor-pointer"
            >
              Close Detail
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
