"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Link as LinkIcon, X, Check, Loader2, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useTestingStore } from "@/store/testingStore";

interface ManualLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineSerial: string;
  onLinkSuccess?: (dbSerial: string) => void;
}

export default function ManualLinkModal({
  isOpen,
  onClose,
  machineSerial,
  onLinkSuccess
}: ManualLinkModalProps) {
  const [search, setSearch] = useState("");
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const { updateResult } = useTestingStore();

  const { data: rawCellsData, isLoading } = useQuery({
    queryKey: ["serialized-raw-cells-for-link", search],
    queryFn: async () => {
      const res = await api.get("/cells", {
        params: { status: "RAW", search: search || undefined, limit: 30 }
      });
      return res.data;
    },
    enabled: isOpen
  });

  if (!isOpen) return null;

  const handleConfirmLink = async () => {
    if (!selectedSerial) {
      toast.error("Please select a serialized cell to link");
      return;
    }

    setLinking(true);
    try {
      await api.post("/testing/manual-link", {
        fileSerial: machineSerial,
        dbSerial: selectedSerial
      });
      
      updateResult(machineSerial, {
        cellSerial: selectedSerial,
        confidence: 1.0
      });

      toast.success(`Linked machine serial '${machineSerial}' to cell '${selectedSerial}'`);
      onLinkSuccess?.(selectedSerial);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to link serial");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061B3A]/40 backdrop-blur-xs">
      <div className="bg-white border border-[#D8E8FA] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-[#D8E8FA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF5FF] text-[#0878F9] flex items-center justify-center border border-[#D8E8FA]">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B2148]">Manual Serial Match</h3>
              <p className="text-xs text-[#526B91]">
                Match machine record <span className="font-mono text-[#0878F9] font-bold">{machineSerial}</span> with a serialized cell
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#526B91] hover:text-[#0B2148] rounded-xl hover:bg-[#EAF5FF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serialized cells in inventory..."
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-accent"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-[#526B91] text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#0878F9]" />
                <span>Loading available serialized cells...</span>
              </div>
            ) : !rawCellsData?.cells || rawCellsData.cells.length === 0 ? (
              <div className="py-8 text-center text-[#526B91] text-xs space-y-1">
                <AlertCircle className="w-6 h-6 text-[#526B91] mx-auto" />
                <p>No un-tested serialized cells found.</p>
                <p className="text-[10px] text-[#526B91]">Ensure cells are serialized first at /test-engineer/cells</p>
              </div>
            ) : (
              rawCellsData.cells.map((cell: any) => {
                const isSelected = selectedSerial === cell.serialNumber;
                return (
                  <div
                    key={cell.serialNumber}
                    onClick={() => setSelectedSerial(cell.serialNumber)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-[#EAF5FF] border-[#0878F9] text-[#0878F9] shadow-xs"
                        : "bg-[#F4F9FF] border-[#D8E8FA] hover:bg-white hover:border-[#0878F9]/30 text-[#0B2148]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#0B2148]">
                          {cell.serialNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-[#D8E8FA] text-[#0B2148] font-medium">
                          {cell.partNumber || "CELL"}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#526B91] mt-0.5">
                        Batch: {cell.batchNumber || "N/A"} • Voltage: {cell.voltage}V
                      </p>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? "bg-[#0878F9] border-[#0878F9] text-white" : "border-[#D8E8FA] bg-white"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 bg-[#F4F9FF] border-t border-[#D8E8FA]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#526B91] hover:text-[#0B2148] hover:bg-white border border-transparent hover:border-[#D8E8FA] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmLink}
            disabled={!selectedSerial || linking}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0878F9] hover:bg-[#0667DB] text-white transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm Match
          </button>
        </div>
      </div>
    </div>
  );
}
