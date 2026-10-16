"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import { 
  Loader2, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Zap, 
  Copy, 
  FileSpreadsheet,
  ArrowRight,
  Database,
  Scan,
  QrCode
} from "lucide-react";
import { motion } from "framer-motion";

interface InwardRow {
  serialNumber: string;
  batchNumber: string;
  voltage: string;
  category: string;
  cycles: string;
}

export default function QuickInward() {
  const { data: categories } = useQuery({
    queryKey: ["cell-categories"],
    queryFn: async () => (await api.get("/admin/cell-categories")).data,
  });

  const [rows, setRows] = useState<InwardRow[]>(
    Array(50).fill(null).map(() => ({
      serialNumber: "",
      batchNumber: "",
      voltage: "3.2",
      category: "",
      cycles: "0",
    }))
  );
  
  const [loading, setLoading] = useState(false);
  const [scanModeActive, setScanModeActive] = useState(false);
  const [scannerBuffer, setScannerBuffer] = useState("");
  const [bulkValues, setBulkValues] = useState({
    batchNumber: "",
    voltage: "3.2",
    category: "",
    cycles: "0",
  });

  // Update initial categories once they load
  useEffect(() => {
    if (categories && categories.length > 0) {
      const firstCat = categories[0].name;
      setBulkValues(prev => ({ ...prev, category: firstCat }));
      setRows(prev => prev.map(row => ({ ...row, category: firstCat })));
    }
  }, [categories]);

  // Keep hidden scanner input focused when Scan Mode is active
  useEffect(() => {
    if (scanModeActive) {
      const focusScanner = () => {
        const input = document.getElementById("hidden-scanner-input");
        if (input) (input as HTMLInputElement).focus();
      };
      
      focusScanner();
      
      // Auto-refocus scanner input on click anywhere on page
      window.addEventListener("click", focusScanner);
      return () => window.removeEventListener("click", focusScanner);
    }
  }, [scanModeActive]);

  const handleRowChange = (index: number, field: keyof InwardRow, value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handlePasteSerials = (index: number, e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData("text");
    if (!pasteData) return;

    const lines = pasteData.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
    if (lines.length <= 1) return; // Regular paste for single value

    e.preventDefault();
    const newRows = [...rows];
    lines.forEach((line, i) => {
      if (index + i < newRows.length) {
        newRows[index + i] = { ...newRows[index + i], serialNumber: line };
      } else {
        newRows.push({
          serialNumber: line,
          batchNumber: bulkValues.batchNumber,
          voltage: bulkValues.voltage,
          category: bulkValues.category,
          cycles: bulkValues.cycles,
        });
      }
    });
    setRows(newRows);
    toast.success(`Pasted ${lines.length} serial numbers`);
  };

  const applyBulk = () => {
    const newRows = rows.map(row => {
      // Only apply bulk values to rows that have a serial number or are empty
      // but if the user wants to bulk apply, they usually want it for everything they are about to enter
      return {
        ...row,
        batchNumber: bulkValues.batchNumber || row.batchNumber,
        voltage: bulkValues.voltage || row.voltage,
        category: bulkValues.category || row.category,
        cycles: bulkValues.cycles || row.cycles,
      };
    });
    setRows(newRows);
    toast.info("Applied bulk values to all rows");
  };

  const clearRows = () => {
    setRows(Array(50).fill(null).map(() => ({
      serialNumber: "",
      batchNumber: "",
      voltage: "3.2",
      category: categories?.[0]?.name || "",
      cycles: "0",
    })));
  };

  const handleSubmit = async () => {
    const validRows = rows.filter(row => row.serialNumber.trim() !== "");
    
    if (validRows.length === 0) {
      toast.error("Please enter at least one serial number");
      return;
    }

    // Validation
    for (const row of validRows) {
      if (!row.voltage || isNaN(parseFloat(row.voltage))) {
        toast.error(`Invalid voltage for serial ${row.serialNumber}`);
        return;
      }
      if (!row.cycles || isNaN(parseInt(row.cycles))) {
        toast.error(`Invalid cycles for serial ${row.serialNumber}`);
        return;
      }
    }

    setLoading(true);
    try {
      const formattedRows = validRows.map(row => ({
        ...row,
        voltage: parseFloat(row.voltage),
        cycles: parseInt(row.cycles),
      }));

      const res = await api.post("/cells/bulk-inward", { rows: formattedRows });
      toast.success(`Successfully inwarded ${res.data.created} cells!`);
      clearRows();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to inward cells");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bulk Controls */}
      <div className="glass-panel p-6 rounded-2xl border border-[#D8E8FA] flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Bulk Batch</label>
          <input 
            value={bulkValues.batchNumber}
            onChange={(e) => setBulkValues({...bulkValues, batchNumber: e.target.value})}
            placeholder="Set Batch for all"
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-sm text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent"
          />
        </div>
        <div className="w-24 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Bulk Voltage</label>
          <input 
            value={bulkValues.voltage}
            onChange={(e) => setBulkValues({...bulkValues, voltage: e.target.value})}
            placeholder="3.2"
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-sm text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent"
          />
        </div>
        <div className="w-48 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Bulk Category</label>
          <select 
            value={bulkValues.category}
            onChange={(e) => setBulkValues({...bulkValues, category: e.target.value})}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-sm text-[#0B2148] focus:outline-none focus:bg-white focus:border-accent appearance-none cursor-pointer"
          >
            {categories?.map((cat: any) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
            {(!categories || categories.length === 0) && (
              <option value="">No Categories</option>
            )}
          </select>
        </div>
        <div className="w-20 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] ml-1">Bulk Cycles</label>
          <input 
            value={bulkValues.cycles}
            onChange={(e) => setBulkValues({...bulkValues, cycles: e.target.value})}
            placeholder="0"
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-sm text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent"
          />
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setScanModeActive(!scanModeActive)}
            className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border cursor-pointer ${
              scanModeActive 
                ? "bg-[#EAF5FF] text-[#0878F9] border-[#0878F9] animate-pulse" 
                : "bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] border-[#D8E8FA]"
            }`}
          >
            <Scan className="w-4 h-4 text-accent" />
            <span>{scanModeActive ? "Scan Active" : "Scan Mode"}</span>
          </button>

          <button 
            onClick={applyBulk}
            className="bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] border border-[#D8E8FA] p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            Apply All
          </button>
          <button 
            onClick={clearRows}
            className="bg-[#FEE2E2] hover:bg-red-200 text-[#991B1B] border border-[#FECACA] p-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 text-white p-2.5 px-6 rounded-xl transition-all flex items-center gap-2 text-sm font-bold shadow-sm cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Commit Data</span>
              </>
            )}
          </button>
        </div>
      </div>

      {scanModeActive && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-accent/10 border-2 border-dashed border-accent/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-accent/5 animate-pulse pointer-events-none" />
          <QrCode className="w-12 h-12 text-accent animate-pulse" />
          <div>
            <h4 className="text-[#0B2148] font-bold text-sm uppercase tracking-wider flex items-center gap-2 justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Continuous Barcode Scanner Mode Active
            </h4>
            <p className="text-xs text-[#526B91] mt-1 max-w-md">
              Point your hardware barcode scanner and scan cells consecutively. The scanned serial numbers will automatically fill the next available rows in the grid below. Click anywhere on the page to focus the scanner.
            </p>
          </div>
          
          <input
            id="hidden-scanner-input"
            type="text"
            value={scannerBuffer}
            onChange={(e) => setScannerBuffer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const scanValue = scannerBuffer.trim();
                if (scanValue) {
                  // Find first empty row
                  const nextEmptyIndex = rows.findIndex(r => r.serialNumber.trim() === "");
                  if (nextEmptyIndex !== -1) {
                    handleRowChange(nextEmptyIndex, "serialNumber", scanValue);
                    toast.success(`Scanned Cell #${nextEmptyIndex + 1}: ${scanValue}`);
                  } else {
                    // Append new row
                    setRows(prev => [...prev, {
                      serialNumber: scanValue,
                      batchNumber: bulkValues.batchNumber,
                      voltage: bulkValues.voltage,
                      category: bulkValues.category,
                      cycles: bulkValues.cycles,
                    }]);
                    toast.success(`Scanned & Appended: ${scanValue}`);
                  }
                  setScannerBuffer("");
                }
              }
            }}
            placeholder="Scanning area..."
            className="bg-white border border-[#D8E8FA] rounded-xl px-4 py-2 text-xs font-mono text-[#166534] text-center w-64 focus:outline-none focus:border-[#0878F9]"
          />
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="glass-panel rounded-3xl border border-[#D8E8FA] overflow-hidden">
        <div className="max-h-[600px] overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#F4F9FF] border-b border-[#D8E8FA] z-20">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-[#526B91] uppercase tracking-widest w-12">#</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#526B91] uppercase tracking-widest min-w-[200px]">Serial Number</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Batch Number</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#526B91] uppercase tracking-widest w-24">Voltage</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#526B91] uppercase tracking-widest w-48">Category</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#526B91] uppercase tracking-widest w-24">Cycles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-[#F4F9FF] transition-colors group">
                  <td className="px-4 py-2 text-xs font-mono text-[#526B91]">{i + 1}</td>
                  <td className="px-2 py-1">
                    <input 
                      id={`serial-input-${i}`}
                      value={row.serialNumber}
                      onChange={(e) => handleRowChange(i, "serialNumber", e.target.value)}
                      onPaste={(e) => handlePasteSerials(i, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const nextInput = document.getElementById(`serial-input-${i + 1}`);
                          if (nextInput) {
                            (nextInput as HTMLInputElement).focus();
                          }
                        }
                      }}
                      autoFocus={i === 0}
                      placeholder={i === 0 ? "Paste or type serials here..." : "Serial"}
                      className="w-full bg-transparent border-none py-2 px-2 text-sm text-[#0B2148] font-mono focus:ring-1 focus:ring-accent/50 rounded-lg placeholder-[#64748B]"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input 
                      value={row.batchNumber}
                      onChange={(e) => handleRowChange(i, "batchNumber", e.target.value)}
                      placeholder="Batch"
                      className="w-full bg-transparent border-none py-2 px-2 text-sm text-[#0B2148] focus:ring-1 focus:ring-accent/50 rounded-lg placeholder-[#64748B]"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input 
                      value={row.voltage}
                      onChange={(e) => handleRowChange(i, "voltage", e.target.value)}
                      className="w-full bg-transparent border-none py-2 px-2 text-sm text-[#0B2148] font-mono focus:ring-1 focus:ring-accent/50 rounded-lg"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select 
                      value={row.category}
                      onChange={(e) => handleRowChange(i, "category", e.target.value)}
                      className="w-full bg-transparent border-none py-2 px-2 text-sm text-[#0B2148] focus:ring-1 focus:ring-accent/50 rounded-lg appearance-none cursor-pointer"
                    >
                      {categories?.map((cat: any) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input 
                      value={row.cycles}
                      onChange={(e) => handleRowChange(i, "cycles", e.target.value)}
                      className="w-full bg-transparent border-none py-2 px-2 text-sm text-[#0B2148] font-mono focus:ring-1 focus:ring-accent/50 rounded-lg"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[#526B91] text-sm">
          <Database className="w-4 h-4 text-[#0878F9]" />
          <span>{rows.filter(r => r.serialNumber.trim() !== "").length} rows ready to inward</span>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 text-white font-bold px-8 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm min-w-[240px] cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Commit Inward Data</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
