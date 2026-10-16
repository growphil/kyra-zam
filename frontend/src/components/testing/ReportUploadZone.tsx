"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, Loader2, CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { useTestingStore } from "@/store/testingStore";
import { toast } from "sonner";

export default function ReportUploadZone() {
  const { setResults, setIsLoading, isLoading } = useTestingStore();
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
    disabled: isLoading,
  });

  const handleAnalyze = async () => {
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/testing/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(response.data);
      const totalRows = response.data?.length || 0;
      const matched = response.data?.filter((r: any) => r.cellSerial !== "UNMATCHED").length || 0;
      toast.success(`Machine report analyzed! ${totalRows} records found (${matched} matched to serialized cells).`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to process machine test report");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div 
          {...getRootProps()} 
          className={`relative group cursor-pointer transition-all ${
            isDragActive ? "scale-[0.99]" : ""
          }`}
        >
          <input {...getInputProps()} />
          
          <div className={`
            p-6 rounded-2xl border-2 border-dashed flex flex-col items-center text-center transition-all
            ${isDragActive ? "border-accent bg-accent/5" : "border-[#D8E8FA] hover:border-accent/40 bg-[#F4F9FF] hover:bg-[#EAF5FF]"}
            ${isLoading ? "opacity-50 pointer-events-none" : ""}
          `}>
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all shadow-xs
              ${isDragActive ? "bg-[#0878F9] text-white scale-110" : "bg-white text-[#526B91] group-hover:text-[#0878F9] group-hover:bg-[#EAF5FF] border border-[#D8E8FA]"}
            `}>
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            </div>
            
            <h4 className="text-sm font-bold text-[#0B2148] mb-1">
              {isDragActive ? "Drop machine report here" : "Upload Machine Test Report"}
            </h4>
            <p className="text-xs text-[#526B91] max-w-xs">
              Drag & Drop report here or <span className="text-[#0878F9] font-medium underline">browse file</span> (.xlsx, .xls, .csv)
            </p>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#EAF5FF] border border-[#D8E8FA] rounded-xl flex items-center justify-center text-[#0878F9] shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B2148] truncate max-w-[220px]">{file.name}</p>
              <p className="text-[10px] text-[#526B91] font-mono">
                {(file.size / 1024).toFixed(1)} KB • Ready for analysis
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFile(null)}
              disabled={isLoading}
              className="p-2 hover:bg-[#EAF5FF] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
            <button 
              onClick={handleAnalyze}
              disabled={isLoading}
              className="bg-[#0878F9] hover:bg-[#0667DB] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Analyze Report</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
