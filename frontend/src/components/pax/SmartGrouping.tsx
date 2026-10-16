"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Zap, 
  BrainCircuit, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface SmartGroupingProps {
  paxTypeId: string;
  selectedType?: any;
  onSelectPack: (cells: { serial: string; grade: string }[]) => void;
}

export default function SmartGrouping({ paxTypeId, selectedType, onSelectPack }: SmartGroupingProps) {
  const [params, setParams] = useState({ ahVariation: 0.05, irVariation: 3.0 });

  // Sync variations with selected configuration
  useEffect(() => {
    if (selectedType) {
      setParams({
        ahVariation: selectedType.maxAhDifference || 0.05,
        irVariation: selectedType.maxIrDifference || 3.0
      });
    }
  }, [selectedType]);

  const { data, isLoading } = useQuery({
    queryKey: ["pax-recommendations", paxTypeId, params.ahVariation, params.irVariation],
    queryFn: async () => (await api.get("/pax/recommendations", { 
      params: { 
        paxTypeId, 
        ahVariation: params.ahVariation, 
        irVariation: params.irVariation 
      } 
    })).data,
    enabled: !!paxTypeId
  });

  if (!paxTypeId) return null;

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI Intelligent Cell Grouping</h3>
              <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Balanced Pack Clusters</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
               <p className="text-[9px] font-bold text-[#526B91] uppercase tracking-widest">Active Bounds</p>
               <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">±{params.ahVariation} AH</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">±{params.irVariation} mΩ</span>
               </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-[#526B91] font-medium">Analyzing inventory clusters with machine algorithm...</p>
          </div>
        ) : (
          <div className="space-y-4">
             {/* Summary Stats */}
             <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <TrendingUp className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-[9px] font-bold text-[#526B91] uppercase">Suggested Packs</p>
                  <p className="text-lg font-mono font-bold text-slate-900">{data?.summary?.totalPacks || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                  <p className="text-[9px] font-bold text-[#526B91] uppercase">Grouped Cells</p>
                  <p className="text-lg font-mono font-bold text-slate-900">{data?.summary?.totalCellsGrouped || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <AlertCircle className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                  <p className="text-[9px] font-bold text-[#526B91] uppercase">Loose Cells</p>
                  <p className="text-lg font-mono font-bold text-slate-900">{data?.summary?.looseCount || 0}</p>
                </div>
             </div>

             {/* Packs List */}
             <div className="space-y-2.5 max-h-[380px] overflow-auto pr-1 custom-scrollbar">
                {data?.packs?.map((pack: any, i: number) => (
                  <button
                    key={pack.id || i}
                    onClick={() => onSelectPack(pack.cells.map((c: any) => ({ serial: c.serialNumber, grade: c.grade })))}
                    className="w-full text-left p-3.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 transition-all group flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          Suggested Pack #{i + 1}
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Grade {pack.grade}
                          </span>
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-[#526B91]">
                          <span>Avg AH: {pack.avgAh.toFixed(2)}</span>
                          <span>•</span>
                          <span>Avg IR: {pack.avgIr.toFixed(2)} mΩ</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right text-[10px] font-mono">
                        <p className="text-emerald-700 font-bold">ΔAH: {pack.ahSpread.toFixed(3)}</p>
                        <p className="text-emerald-700 font-bold">ΔIR: {pack.irSpread.toFixed(2)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#526B91] group-hover:text-slate-700 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                ))}

                {(!data?.packs || data?.packs?.length === 0) && (
                  <div className="py-10 text-center text-[#526B91] text-xs">
                    No balanced packs could be formed with current variations. Use manual pick or auto-fill.
                  </div>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
