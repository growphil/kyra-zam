"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import api from "@/lib/api";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  X,
  ArrowRight,
  Download,
  Layers,
  Hash
} from "lucide-react";
import { motion } from "framer-motion";

interface BulkPreviewRow {
  partNumber: string;
  quantity: number;
  batchNumber: string;
  category: string;
  voltage: number;
  cycles: number;
  notes?: string | null;
}

interface BulkInwardProps {
  onSuccess?: () => void;
}

export default function BulkInward({ onSuccess }: BulkInwardProps) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    rows: BulkPreviewRow[];
    summary: {
      totalBatches: number;
      totalQuantity: number;
      errorCount: number;
      totalRows: number;
    };
    errors?: string[];
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const downloadTemplate = () => {
    const headers = ["PartNumber", "Quantity", "BatchNumber", "Category", "Voltage", "Cycles", "Notes"];
    const rows = [
      ["CELL-LFP-3200", "500", "BATCH-SEP-001", "LFP 3.2V", "3.2", "0", "Vendor A Shipment #1"],
      ["CELL-LFP-2800", "300", "BATCH-SEP-002", "LFP 3.2V", "3.2", "0", "Vendor A Shipment #1"],
      ["CELL-NMC-21700", "200", "BATCH-SEP-003", "NMC 3.7V", "3.7", "0", "High Capacity Test Lot"],
    ];
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "cell_inward_manifest_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Quantity Inward CSV Template downloaded!");
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await api.post("/cells/inward-batches/bulk-preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreviewData(res.data);
      if (res.data.errors && res.data.errors.length > 0) {
        toast.warning(`File parsed with ${res.data.errors.length} row warning(s). Please review.`);
      } else {
        toast.success(`Manifest parsed: ${res.data.summary.totalBatches} batches ready for inward.`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to parse bulk manifest file");
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const handleCommit = async () => {
    if (!previewData || previewData.rows.length === 0) return;
    setUploading(true);
    try {
      const res = await api.post("/cells/inward-batches/bulk-commit", { batches: previewData.rows });
      toast.success(`Successfully inwarded ${res.data.created} batch(es) totaling ${res.data.totalQuantity.toLocaleString()} physical cells!`);
      setPreviewData(null);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to commit bulk inventory");
    } finally {
      setUploading(false);
    }
  };

  if (previewData) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-8 rounded-3xl space-y-6 border border-[#D8E8FA]"
      >
        <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-[#0B2148] flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
              Review Bulk Cell Manifest
            </h2>
            <p className="text-sm text-[#526B91] mt-1">
              Verify batch quantities and specifications before committing to stock.
            </p>
          </div>
          <button 
            onClick={() => setPreviewData(null)}
            className="p-2 hover:bg-[#EAF5FF] rounded-full text-[#526B91] hover:text-[#0B2148] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Inward Batches
            </p>
            <p className="text-2xl font-display font-bold text-[#0B2148] mt-1">{previewData.summary.totalBatches}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-[10px] text-[#166534] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />
              Total Physical Cells
            </p>
            <p className="text-2xl font-display font-bold text-[#166534] mt-1">{previewData.summary.totalQuantity.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] text-center">
            <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-widest">Parsed Rows</p>
            <p className="text-2xl font-display font-bold text-[#0B2148] mt-1">{previewData.summary.totalRows}</p>
          </div>
        </div>

        {/* Errors list if any */}
        {previewData.errors && previewData.errors.length > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              Row Processing Warnings ({previewData.errors.length})
            </div>
            <ul className="text-xs text-amber-300/80 space-y-1 max-h-24 overflow-auto custom-scrollbar list-disc pl-4">
              {previewData.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Staging Table */}
        <div className="max-h-96 overflow-auto border border-[#D8E8FA] rounded-2xl custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#F4F9FF] border-b border-[#D8E8FA] z-10">
              <tr>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">#</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Part Number (SKU)</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Quantity</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Batch Number</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Category</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Voltage</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Cycles</th>
                <th className="px-4 py-3 font-bold text-[#526B91] uppercase text-[10px] tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {previewData.rows.map((row, i) => (
                <tr key={i} className="hover:bg-[#F4F9FF] transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-[#526B91]">{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-[#0B2148] font-mono">{row.partNumber}</td>
                  <td className="px-4 py-3 font-bold text-[#166534]">{row.quantity.toLocaleString()} pcs</td>
                  <td className="px-4 py-3 text-[#0B2148] font-mono text-xs">{row.batchNumber}</td>
                  <td className="px-4 py-3 text-[#0B2148]">{row.category}</td>
                  <td className="px-4 py-3 text-[#526B91]">{row.voltage} V</td>
                  <td className="px-4 py-3 text-[#526B91]">{row.cycles}</td>
                  <td className="px-4 py-3 text-[#526B91] text-xs truncate max-w-xs">{row.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={() => setPreviewData(null)}
            className="px-6 py-3 rounded-xl bg-white border border-[#D8E8FA] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-bold text-sm transition-all cursor-pointer shadow-xs"
          >
            Cancel & Re-upload
          </button>
          <button
            onClick={handleCommit}
            disabled={uploading || previewData.rows.length === 0}
            className="bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 text-white font-bold py-3.5 px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Committing {previewData.summary.totalQuantity.toLocaleString()} Cells...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Commit {previewData.summary.totalBatches} Inward Batches to Inventory</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div 
      {...getRootProps()} 
      className={`glass-panel p-12 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
        isDragActive ? "border-[#0878F9] bg-[#EAF5FF]" : "border-[#D8E8FA] hover:border-[#0878F9] hover:bg-[#F4F9FF]"
      }`}
    >
      <input {...getInputProps()} />
      <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 relative">
        {loading ? (
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
        ) : (
          <>
            <Upload className="w-9 h-9 text-[#0878F9]" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full border border-[#D8E8FA] flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-4 h-4 text-[#166534]" />
            </div>
          </>
        )}
      </div>

      <h3 className="text-xl font-display font-bold text-[#0B2148] mb-2">
        {isDragActive ? "Drop the manifest file here" : "Upload Bulk Cell Inward Manifest"}
      </h3>
      <p className="text-[#526B91] max-w-md mb-8 text-sm leading-relaxed">
        Upload a CSV or Excel file with <span className="text-[#0B2148] font-bold">Part Number, Quantity, and Batch Number</span>. Physical serial numbers are not required during inward.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2 bg-[#0878F9] hover:bg-[#0667DB] px-6 py-3 rounded-xl text-white font-bold shadow-sm transition-all">
          <span>{loading ? "Parsing Manifest..." : "Select File"}</span>
          <ArrowRight className="w-4 h-4" />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadTemplate();
          }}
          className="text-[#166534] hover:text-[#166534] text-sm font-bold flex items-center gap-2 transition-colors bg-[#DCFCE7] px-5 py-3 rounded-xl border border-[#BBF7D0] hover:bg-[#BBF7D0] cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download Quantity Template (CSV)
        </button>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-6 items-center text-xs text-[#526B91] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Quantity-Based Inward
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Automatic SKU Matching
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Atomic Transaction Commit
        </div>
      </div>
    </div>
  );
}
