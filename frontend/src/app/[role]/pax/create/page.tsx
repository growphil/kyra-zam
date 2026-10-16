"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import api from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { 
  Battery, 
  Plus, 
  X, 
  Zap, 
  CheckCircle2, 
  Loader2, 
  PackageCheck,
  LayoutGrid,
  Info,
  QrCode,
  Scan,
  AlertCircle,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  Layers,
  Check,
  ArrowLeft,
  ArrowRight,
  Wrench,
  Boxes,
  Sparkles,
  ShieldAlert,
  Search,
  Filter,
  CheckCheck,
  RotateCcw,
  SlidersHorizontal,
  PackageOpen,
  Cpu,
  Printer,
  Copy,
  Download,
  Barcode,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import SmartGrouping from "@/components/pax/SmartGrouping";
import { useFormattedSerial } from "@/hooks/useFormattedSerial";

export default function CreatePaxPage() {
  const { formatSerial } = useFormattedSerial();
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const workOrderId = searchParams.get("workOrderId") || "";

  const role = params?.role as string;
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedCells, setSelectedCells] = useState<{ serial: string; grade: string; ah: number; ir: number }[]>([]);
  const [cellSearch, setCellSearch] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("ALL");
  const [scanInput, setScanInput] = useState("");
  const [mode, setMode] = useState<"manual" | "smart">("manual");
  const [verifiedBomItems, setVerifiedBomItems] = useState<string[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Modal State for Generated QR Code & Barcode Passport
  const [createdPackData, setCreatedPackData] = useState<{
    paxSerial: string;
    paxType: any;
    workOrderNumber?: string;
    productRef?: string;
    cells: { position: number; serial: string; grade: string; ah: number; ir: number }[];
    bom: {
      name: string;
      items: { name: string; sku: string; quantity: number }[];
    } | null;
    stats: {
      avgAh: number;
      avgIr: number;
      ahSpread: number;
      irSpread: number;
      grade: string | null;
    };
    operatorName?: string;
    assembledAt: string;
  } | null>(null);

  const [activeModalTab, setActiveModalTab] = useState<"all" | "cells" | "bom" | "raw">("all");

  // --- DATA FETCHING ---
  const { 
    data: paxTypes, 
    isLoading: loadingPaxTypes 
  } = useQuery({
    queryKey: ["pax-types"],
    queryFn: async () => (await api.get("/admin/pax-types")).data
  });

  const { data: workOrderDetails } = useQuery({
    queryKey: ["pax-workorder-prefill", workOrderId],
    queryFn: async () => {
      if (!workOrderId) return null;
      return (await api.get(`/crm/production/work-orders/${workOrderId}`)).data;
    },
    enabled: !!workOrderId
  });

  const { 
    data: boms, 
    isLoading: loadingBoms, 
    isError: isBomError, 
    refetch: refetchBoms 
  } = useQuery({
    queryKey: ["boms-list"],
    queryFn: async () => (await api.get("/bom")).data
  });

  useEffect(() => {
    if (workOrderDetails && paxTypes) {
      const matched = paxTypes.find((t: any) => 
        t.name.toLowerCase().includes(workOrderDetails.productRef?.toLowerCase() || "") ||
        t.id === workOrderDetails.paxTypeId
      );
      if (matched) {
        setSelectedTypeId(matched.id);
      }
    }
  }, [workOrderDetails, paxTypes]);

  const filteredPaxTypes = useMemo(() => {
    if (!paxTypes) return [];
    const upperRole = (role || "").toString().toUpperCase();
    if (upperRole === "ASSEMBLY_TECHNICIAN" || upperRole === "ASSEMBLY-TECHNICIAN") {
      return paxTypes.filter((type: any) => type.isProductionActive);
    }
    return paxTypes;
  }, [paxTypes, role]);

  const selectedType = useMemo(() => {
    return filteredPaxTypes?.find((t: any) => t.id === selectedTypeId) || filteredPaxTypes?.[0] || null;
  }, [filteredPaxTypes, selectedTypeId]);

  // Automatically resolve active BOM strictly from the selected product / work order
  const activeBom = useMemo(() => {
    if (!selectedType && !workOrderDetails) return null;

    // 1. Direct BOM relation attached to PaxType
    if (selectedType?.bom?.items?.length) {
      return selectedType.bom;
    }

    // 2. Direct BOM relation on linked Work Order
    if (workOrderDetails?.bom?.items?.length) {
      return workOrderDetails.bom;
    }

    // 3. Match by bomId if present on selectedType
    if (selectedType?.bomId && boms && boms.length > 0) {
      const found = boms.find((b: any) => b.id === selectedType.bomId);
      if (found) return found;
    }

    // 4. Match by BOM name / product name correspondence from available active BOMs
    if (selectedType && boms && boms.length > 0) {
      const cleanTypeName = selectedType.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const found = boms.find((b: any) => {
        const cleanBomName = (b.name || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        return cleanBomName.includes(cleanTypeName) || cleanTypeName.includes(cleanBomName.replace("bom", ""));
      });
      if (found) return found;
    }

    return null;
  }, [selectedType, workOrderDetails, boms]);

  // Reset verified items when product or resolved BOM changes
  useEffect(() => {
    setVerifiedBomItems([]);
  }, [selectedTypeId, activeBom?.id]);

  useEffect(() => {
    if (filteredPaxTypes && filteredPaxTypes.length > 0 && !selectedTypeId) {
      const prodActive = filteredPaxTypes.find((t: any) => t.isProductionActive);
      if (prodActive) {
        setSelectedTypeId(prodActive.id);
      } else if (filteredPaxTypes.length > 0) {
        setSelectedTypeId(filteredPaxTypes[0].id);
      }
    }
  }, [filteredPaxTypes, selectedTypeId]);

  const { data: availableCells, isLoading: loadingCells } = useQuery({
    queryKey: ["available-cells", selectedTypeId],
    queryFn: async () => {
      if (!selectedTypeId) return [];
      const res = await api.get("/cells", { 
        params: { 
          status: "CELL_TESTED", 
          compatibleWithPaxTypeId: selectedTypeId,
          includeAssigned: "false",
          qcApprovedOnly: "true",
          limit: 100 
        } 
      });
      return res.data.cells;
    },
    enabled: !!selectedTypeId
  });

  const queryClient = useQueryClient();
  const createPaxMutation = useMutation({
    mutationFn: (data: any) => api.post("/pax", data),
    onSuccess: (res: any) => {
      const createdSerial = res?.data?.paxSerial || `PAX-${Date.now()}`;
      
      const payloadData = {
        paxSerial: createdSerial,
        paxType: selectedType,
        workOrderNumber: workOrderDetails?.workOrderNumber,
        productRef: workOrderDetails?.productRef,
        cells: selectedCells.map((c, idx) => ({
          position: idx + 1,
          serial: c.serial,
          grade: c.grade,
          ah: c.ah,
          ir: c.ir
        })),
        bom: activeBom ? {
          name: activeBom.name,
          items: (activeBom.items || []).map((it: any) => ({
            name: it.material?.name || it.name || "BOM Component",
            sku: it.material?.sku || it.sku || "BOM-SKU",
            quantity: it.quantity || 1
          }))
        } : null,
        stats: { ...stats },
        operatorName: session?.user?.name || "Assembly Technician",
        assembledAt: new Date().toISOString()
      };

      setCreatedPackData(payloadData);
      setActiveModalTab("all");

      toast.success(`PAX Pack ${createdSerial} successfully created & submitted!`, {
        description: `QR Code and Barcode generated with ${selectedCells.length} bound cells and verified BOM.`
      });

      setSelectedCells([]);
      setVerifiedBomItems([]);
      queryClient.invalidateQueries({ queryKey: ["available-cells"] });
      queryClient.invalidateQueries({ queryKey: ["pax-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["assembly-dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["all-pax"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || err.response?.data?.message || "Assembly failed")
  });

  // Complete JSON payload string encoded directly into the generated QR Code
  const qrPayloadString = useMemo(() => {
    if (!createdPackData) return "";
    return JSON.stringify({
      kz: "KYRA_ZAM_2.0",
      paxSerial: createdPackData.paxSerial,
      model: createdPackData.paxType?.name,
      config: createdPackData.paxType?.configuration || `${createdPackData.paxType?.cellCount}S1P`,
      voltage: createdPackData.paxType?.nominalVoltage || 48,
      nominalCapacityAh: createdPackData.paxType?.nominalCapacity || Number((createdPackData.stats.avgAh * (createdPackData.paxType?.cellCount || 1)).toFixed(1)),
      avgAh: Number(createdPackData.stats.avgAh.toFixed(2)),
      avgIr: Number(createdPackData.stats.avgIr.toFixed(2)),
      deltaAh: Number(createdPackData.stats.ahSpread.toFixed(3)),
      deltaIr: Number(createdPackData.stats.irSpread.toFixed(2)),
      grade: createdPackData.stats.grade,
      cellCount: createdPackData.cells.length,
      cells: createdPackData.cells.map(c => ({
        pos: `P${c.position}`,
        serial: c.serial,
        grade: c.grade,
        ah: Number(c.ah.toFixed(2)),
        ir: Number(c.ir.toFixed(2))
      })),
      bom: createdPackData.bom ? {
        name: createdPackData.bom.name,
        items: createdPackData.bom.items.map(b => ({
          name: b.name,
          sku: b.sku,
          quantity: b.quantity
        }))
      } : null,
      workOrder: createdPackData.workOrderNumber || "MANUAL_WO",
      operator: createdPackData.operatorName,
      assembledAt: createdPackData.assembledAt,
      status: "READY_FOR_PAX_TEST"
    }, null, 2);
  }, [createdPackData]);

  const handlePrintLabel = () => {
    window.print();
  };

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const count = selectedCells.length;
    if (!count) {
      return { avgAh: 0, avgIr: 0, ahSpread: 0, irSpread: 0, grade: null };
    }
    const avgAh = selectedCells.reduce((acc, c) => acc + c.ah, 0) / count;
    const avgIr = selectedCells.reduce((acc, c) => acc + c.ir, 0) / count;
    const ahSpread = count > 1 ? Math.max(...selectedCells.map(c => c.ah)) - Math.min(...selectedCells.map(c => c.ah)) : 0;
    const irSpread = count > 1 ? Math.max(...selectedCells.map(c => c.ir)) - Math.min(...selectedCells.map(c => c.ir)) : 0;
    return {
      avgAh,
      avgIr,
      ahSpread,
      irSpread,
      grade: selectedCells[0]?.grade || null
    };
  }, [selectedCells]);

  const targetCellCount = selectedType?.cellCount || 2;
  const isCellCountComplete = selectedCells.length === targetCellCount;
  const isAhDeltaValid = selectedCells.length <= 1 || stats.ahSpread <= (selectedType?.maxAhDifference || 0.05);
  const isIrDeltaValid = selectedCells.length <= 1 || stats.irSpread <= (selectedType?.maxIrDifference || 3.0);
  const isGradeValid = !!stats.grade;
  
  // Strict BOM requirement: active BOM must exist with components and all items must be verified
  const hasActiveBom = !!(activeBom && activeBom.items && activeBom.items.length > 0);
  const isBomComplete = hasActiveBom && activeBom.items.every((it: any) => verifiedBomItems.includes(it.id || it.materialId));

  const isAssemblyValid = isCellCountComplete && isAhDeltaValid && isIrDeltaValid && isGradeValid && isBomComplete;

  const toggleCell = (serial: string, grade: string, ah: number, ir: number) => {
    const isSelected = selectedCells.some(c => c.serial === serial);
    
    if (isSelected) {
      setSelectedCells(s => s.filter(x => x.serial !== serial));
      toast.info(`Cell ${serial} removed from slot`);
    } else {
      if (selectedType && selectedCells.length >= targetCellCount) {
        toast.error(`Pack Full (${targetCellCount}/${targetCellCount} Cells Slotted)`);
        return;
      }

      if (selectedType && !selectedType.allowedGrades.includes(grade)) {
        toast.error(`Incompatible Grade ${grade}. Required: ${selectedType.allowedGrades.join(", ")}`);
        return;
      }

      if (selectedCells.length > 0) {
        const firstGrade = selectedCells[0].grade;
        if (grade !== firstGrade) {
          toast.error(`Grade Mismatch: Cannot mix Grade ${grade} with Grade ${firstGrade}`);
          return;
        }
      }

      setSelectedCells(s => [...s, { serial, grade, ah, ir }]);
      toast.success(`Cell ${serial} slotted into Position P${selectedCells.length + 1}`);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    
    const cleanSerial = scanInput.trim().toUpperCase();
    const cell = availableCells?.find((c: any) => c.serialNumber.toUpperCase() === cleanSerial || c.serialNumber.toUpperCase().includes(cleanSerial));
    
    if (cell) {
      const isSelected = selectedCells.some(c => c.serial === cell.serialNumber);
      if (isSelected) {
        toast.error(`Cell ${cell.serialNumber} is already in the pack`);
      } else {
        toggleCell(cell.serialNumber, cell.grade, cell.ahValue, cell.irValue);
      }
    } else {
      try {
        const checkRes = await api.get(`/cells/${cleanSerial}`);
        const foundCell = checkRes.data?.cell;
        if (foundCell) {
          if (foundCell.status === "CELL_TESTED" && (!foundCell.qcDecisionHistory || !foundCell.qcDecisionHistory.includes("QC_APPROVED"))) {
            toast.error(`QC Approval Required: Cell '${cleanSerial}' is tested but pending QC approval. Cannot move to PAX until approved by Quality Control.`);
          } else if (foundCell.status === "RAW") {
            toast.error(`Testing Required: Cell '${cleanSerial}' is in RAW status and has not completed cell testing yet.`);
          } else if (foundCell.status === "REJECTED") {
            toast.error(`Cell '${cleanSerial}' was REJECTED during testing/QC.`);
          } else if (foundCell.paxCell) {
            toast.error(`Cell '${cleanSerial}' is already assembled into pack ${foundCell.paxCell.paxSerial}.`);
          } else {
            toast.error(`Cell '${cleanSerial}' is not eligible for PAX model (${selectedType?.name || 'Selected'}).`);
          }
        } else {
          toast.error(`Cell '${cleanSerial}' not found in QC-approved inventory`);
        }
      } catch {
        toast.error(`Cell '${cleanSerial}' not found in QC-approved inventory`);
      }
    }
    setScanInput("");
    scanInputRef.current?.focus();
  };

  const handleAutoFill = () => {
    if (!availableCells || availableCells.length === 0) {
      toast.error("No available cells to auto-fill");
      return;
    }

    const needed = targetCellCount - selectedCells.length;
    if (needed <= 0) {
      toast.info("Pack is already fully slotted");
      return;
    }

    // Filter available unassigned cells matching current grade if any already selected
    const unselected = availableCells.filter((c: any) => !selectedCells.some(s => s.serial === c.serialNumber));
    const targetGrade = selectedCells.length > 0 ? selectedCells[0].grade : (unselected[0]?.grade || "A+");
    const compatible = unselected.filter((c: any) => c.grade === targetGrade);

    if (compatible.length < needed) {
      toast.error(`Need ${needed} cells with Grade ${targetGrade}, but only ${compatible.length} available.`);
      return;
    }

    const toAdd = compatible.slice(0, needed).map((c: any) => ({
      serial: c.serialNumber,
      grade: c.grade,
      ah: c.ahValue,
      ir: c.irValue
    }));

    setSelectedCells(s => [...s, ...toAdd]);
    toast.success(`Auto-filled ${toAdd.length} Grade ${targetGrade} cells into pack!`);
  };

  const toggleBomItem = (id: string) => {
    setVerifiedBomItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const verifyAllBomItems = () => {
    if (!activeBom?.items) return;
    const allIds = activeBom.items.map((it: any) => it.id || it.materialId);
    setVerifiedBomItems(allIds);
    toast.success("All BOM hardware components marked verified!");
  };

  const getGradeBadge = (grade: string) => {
    switch(grade) {
      case "A+":
        return "bg-emerald-50 text-emerald-700 border-emerald-300";
      case "A":
        return "bg-cyan-50 text-cyan-700 border-cyan-300";
      case "B+":
        return "bg-blue-50 text-blue-700 border-blue-300";
      case "B":
        return "bg-amber-50 text-amber-700 border-amber-300";
      default:
        return "bg-slate-100 text-[#526B91] border-slate-200";
    }
  };

  // Filtered cells list based on search and grade
  const displayedCells = useMemo(() => {
    if (!availableCells) return [];
    return availableCells.filter((c: any) => {
      const matchSearch = !cellSearch || 
        c.serialNumber.toLowerCase().includes(cellSearch.toLowerCase()) ||
        (c.partNumber && c.partNumber.toLowerCase().includes(cellSearch.toLowerCase()));
      const matchGrade = selectedGradeFilter === "ALL" || c.grade === selectedGradeFilter;
      return matchSearch && matchGrade;
    });
  }, [availableCells, cellSearch, selectedGradeFilter]);

  const uniqueGrades = useMemo(() => {
    if (!availableCells) return [];
    const grades = new Set<string>(availableCells.map((c: any) => c.grade).filter(Boolean));
    return Array.from(grades);
  }, [availableCells]);

  return (
    <div className="min-h-screen flex flex-col space-y-4 max-w-[1720px] mx-auto pb-10 text-[#0B2148]">
      
      {/* ── TOP COCKPIT HEADER ────────────────────────────────────────────────── */}
      <div className="flex-none p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Back & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/${role}`)}
            className="w-10 h-10 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] flex items-center justify-center text-[#526B91] hover:text-[#0878F9] transition-all border border-[#D8E8FA] shadow-2xs group cursor-pointer"
            title="Back to Assembly Queue"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          
          <div className="w-11 h-11 bg-[#EAF5FF] border border-[#0878F9]/20 rounded-xl flex items-center justify-center text-[#0878F9]">
            <Boxes className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-display font-bold text-[#0B2148] tracking-tight">PAX Pack Assembly Line</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#166534] border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Station
              </span>
            </div>
            <p className="text-xs text-[#526B91] mt-0.5 flex items-center gap-2">
              <span>Shift: <strong className="text-[#0B2148]">{new Date().toLocaleDateString()}</strong></span>
              <span>•</span>
              <span>Operator: <strong className="text-[#0B2148]">Assembly Technician</strong></span>
            </p>
          </div>
        </div>

        {/* Right: Selected Model & Slotting Progress */}
        <div className="flex items-center gap-6">
          {selectedType && (
            <div className="hidden sm:flex items-center gap-6 pr-6 border-r border-[#D8E8FA] text-right">
              <div>
                <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Active Product</p>
                <p className="text-sm font-bold text-[#0B2148] flex items-center justify-end gap-1.5">
                  <Battery className="w-4 h-4 text-[#0878F9]" />
                  {selectedType.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Topology / Capacity</p>
                <p className="text-sm font-mono text-[#0878F9] font-bold">
                  {selectedType.configuration || `${selectedType.cellCount}S`} • {selectedType.nominalCapacity ? `${selectedType.nominalCapacity} Ah` : `${(selectedType.cellCount * (stats.avgAh || 100)).toFixed(0)} Ah`}
                </p>
              </div>
            </div>
          )}

          {/* Progress Pill */}
          <div className="flex flex-col items-end min-w-[180px]">
            <div className="flex items-center justify-between w-full text-xs font-bold mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[#526B91]">Slots Filled</span>
              <span className={`font-mono text-sm ${isCellCountComplete ? "text-[#166534]" : "text-[#0878F9]"}`}>
                {selectedCells.length} / {targetCellCount}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#F4F9FF] rounded-full overflow-hidden border border-[#D8E8FA] p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (selectedCells.length / targetCellCount) * 100)}%` }}
                className={`h-full rounded-full transition-all duration-300 ${
                  isCellCountComplete 
                    ? "bg-emerald-500 shadow-sm" 
                    : "bg-[#0878F9] shadow-sm"
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── LINKED WORK ORDER BANNER (IF SPECIFIED) ───────────────────────────── */}
      {workOrderDetails && (
        <div className="p-3.5 bg-[#EAF5FF] border border-[#0878F9]/30 rounded-xl text-[#0B2148] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0878F9]/10 text-[#0878F9] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B2148]">
                Production Order: <span className="font-mono text-[#0878F9] font-extrabold">{workOrderDetails.workOrderNumber}</span>
                <span className="text-[#526B91] font-normal ml-2">({workOrderDetails.productRef})</span>
              </p>
              <p className="text-[11px] text-[#526B91]">
                Target: {workOrderDetails.plannedQuantity} Packs • Completed: {workOrderDetails.completedQuantity || 0} Packs
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-white text-[#0878F9] border border-[#0878F9]/30 uppercase">
            Work Order Active
          </span>
        </div>
      )}

      {/* ── 3-COLUMN MAIN WORKSPACE ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        
        {/* ── LEFT COLUMN: Product Blueprint Overview & Hardware BOM Parts ──── */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Hardware BOM Components Checklist */}
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs space-y-4">
            
            {/* Header with Product Selector and Verify Action */}
            <div className="space-y-3 border-b border-[#D8E8FA] pb-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0878F9]" />
                  <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Hardware BOM Parts</h3>
                </div>
                
                {hasActiveBom && (
                  <button 
                    type="button"
                    onClick={verifyAllBomItems}
                    disabled={verifiedBomItems.length === (activeBom?.items?.length || 0)}
                    className="text-[10px] font-bold text-[#0878F9] hover:text-[#0667DB] disabled:opacity-40 px-2.5 py-1 rounded-lg bg-[#EAF5FF] border border-[#D8E8FA] transition-all cursor-pointer"
                  >
                    {verifiedBomItems.length === (activeBom?.items?.length || 0) ? "All Verified ✓" : "Verify All Parts"}
                  </button>
                )}
              </div>

              {/* Product Model Selector (if multiple available) */}
              {filteredPaxTypes && filteredPaxTypes.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#526B91]">
                    Selected Product:
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-1 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA]">
                    {filteredPaxTypes.map((type: any) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setSelectedTypeId(type.id);
                          setSelectedCells([]);
                          setVerifiedBomItems([]);
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedTypeId === type.id
                            ? "bg-[#0878F9] text-white shadow-xs"
                            : "text-[#526B91] hover:text-[#0B2148] hover:bg-white/60"
                        }`}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Product Specifications Chip */}
              {selectedType && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#F4F9FF] p-2.5 rounded-xl border border-[#D8E8FA]">
                  <div>
                    <span className="text-[9px] text-[#526B91] uppercase block font-sans">Topology</span>
                    <strong className="text-[#0B2148]">{selectedType.configuration || `${selectedType.cellCount}S1P`}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#526B91] uppercase block font-sans">Chemistry / Voltage</span>
                    <strong className="text-[#0B2148]">{selectedType.cellChemistry || "LFP"} • {selectedType.nominalVoltage || 48}V</strong>
                  </div>
                </div>
              )}
            </div>

            {/* BOM Status and Auto-Linked Banner */}
            {loadingBoms || loadingPaxTypes ? (
              <div className="p-6 flex flex-col items-center justify-center space-y-2 text-[#526B91]">
                <Loader2 className="w-5 h-5 text-[#0878F9] animate-spin" />
                <span className="text-xs">Loading active Bill of Materials...</span>
              </div>
            ) : isBomError ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span className="font-bold">Failed to load BOM components</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  An error occurred while retrieving the Bill of Materials for this product.
                </p>
                <button
                  type="button"
                  onClick={() => refetchBoms()}
                  className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-bold text-rose-700 hover:bg-rose-50 text-[11px] cursor-pointer"
                >
                  Retry Loading BOM
                </button>
              </div>
            ) : hasActiveBom ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-[#F4F9FF] p-2.5 rounded-xl border border-[#D8E8FA]">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-3.5 h-3.5 text-[#0878F9]" />
                    <span className="font-bold text-[#0B2148]">{activeBom.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#526B91]">
                    {verifiedBomItems.length} of {activeBom.items.length} Checked
                  </span>
                </div>

                <p className="text-[11px] text-[#526B91]">
                  Click each required hardware component to confirm physical installation before QC handover:
                </p>

                {/* BOM Items Checklist */}
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                  {activeBom.items.map((item: any, idx: number) => {
                    const itemId = item.id || item.materialId || `bom-item-${idx}`;
                    const isVerified = verifiedBomItems.includes(itemId);
                    const materialName = item.material?.name || item.name || `Component ${idx + 1}`;
                    const materialSku = item.material?.sku || item.sku || `BOM-SKU-${idx + 1}`;
                    const quantity = item.quantity || 1;

                    return (
                      <div
                        key={itemId}
                        onClick={() => toggleBomItem(itemId)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isVerified
                            ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs"
                            : "bg-[#F4F9FF] hover:bg-[#EAF5FF] border-[#D8E8FA] text-[#0B2148]"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-[#0B2148] flex items-center gap-2">
                            <span>{materialName}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white text-[#526B91] border border-[#D8E8FA]">
                              Qty: {quantity}
                            </span>
                          </p>
                          <p className="text-[9px] font-mono text-[#526B91]">{materialSku}</p>
                        </div>

                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                          isVerified ? "bg-emerald-600 text-white font-black" : "border border-[#D8E8FA] bg-white text-transparent"
                        }`}>
                          {isVerified ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <span className="text-[10px] text-[#526B91]">•</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Empty BOM Warning */
              <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  No Active BOM Configured
                </h4>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  No Bill of Materials is currently attached to <strong>{selectedType?.name || "this product"}</strong>.
                  An active BOM is required to verify hardware components and complete pack assembly.
                </p>
                <div className="pt-1 text-[10px] text-[#526B91]">
                  Configure and link a BOM in Master Admin Settings to enable assembly.
                </div>
              </div>
            )}

            {/* Live Pack Telemetry Delta (When Cells are Slotted) */}
            {selectedCells.length > 0 && (
              <div className="pt-3 border-t border-[#D8E8FA] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-[#0878F9]" />
                    Live Telemetry Delta
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    isAhDeltaValid && isIrDeltaValid ? "bg-emerald-50 text-[#166534] border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}>
                    {isAhDeltaValid && isIrDeltaValid ? "✓ Balanced & Safe" : "⚠ Delta Exceeded"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                    <span className="text-[9px] text-[#526B91] uppercase block font-sans">Capacity Spread (ΔAH)</span>
                    <span className={`text-sm font-bold ${isAhDeltaValid ? "text-[#166534]" : "text-rose-600"}`}>
                      {stats.ahSpread.toFixed(3)} AH
                    </span>
                    <span className="text-[8px] text-[#526B91] block mt-0.5 font-sans">Limit: ≤ {selectedType?.maxAhDifference || 0.05} AH</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA]">
                    <span className="text-[9px] text-[#526B91] uppercase block font-sans">Resistance Spread (ΔIR)</span>
                    <span className={`text-sm font-bold ${isIrDeltaValid ? "text-[#166534]" : "text-rose-600"}`}>
                      {stats.irSpread.toFixed(2)} mΩ
                    </span>
                    <span className="text-[8px] text-[#526B91] block mt-0.5 font-sans">Limit: ≤ {selectedType?.maxIrDifference || 3.0} mΩ</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER COLUMN: Cell Selection & Fast Barcode Scanner ───────────── */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          
          {/* Mode Switch & Barcode Scanner */}
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs space-y-4">
            
            {/* Mode Tabs */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center p-1 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA]">
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    mode === "manual"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Manual Pick & Scan
                </button>
                <button
                  type="button"
                  onClick={() => setMode("smart")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    mode === "smart"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148]"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Smart Cluster
                </button>
              </div>

              {/* 1-Click Auto Fill Button */}
              {mode === "manual" && (
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={isCellCountComplete || !availableCells || availableCells.length === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-40 disabled:pointer-events-none text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Fill Pack
                </button>
              )}
            </div>

            {/* Fast Barcode Scanner Input */}
            {mode === "manual" && (
              <form onSubmit={handleScan} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#526B91]">
                  <Scan className="w-4 h-4 text-[#0878F9]" />
                </div>
                <input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="SCAN CELL SERIAL BARCODE (e.g. CELL-18650-001)..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] focus:border-[#0878F9] focus:bg-white rounded-xl py-2.5 pl-10 pr-24 text-xs font-mono text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0878F9]/10 transition-all uppercase"
                />
                <button
                  type="submit"
                  disabled={!scanInput.trim()}
                  className="absolute inset-y-1 right-1 px-3.5 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Slot In
                </button>
              </form>
            )}
          </div>

          {/* Cell Inventory Browser */}
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs flex-1 flex flex-col space-y-3.5 min-h-[460px]">
            
            {mode === "smart" ? (
              <SmartGrouping
                paxTypeId={selectedTypeId}
                selectedType={selectedType}
                onSelectPack={(cells) => {
                  setSelectedCells(cells.map(c => ({
                    serial: c.serial,
                    grade: c.grade,
                    ah: (availableCells?.find((ac: any) => ac.serialNumber === c.serial)?.ahValue || 100.0),
                    ir: (availableCells?.find((ac: any) => ac.serialNumber === c.serial)?.irValue || 0.3)
                  })));
                  toast.success("AI-Balanced cell cluster slotted into pack!");
                }}
              />
            ) : (
              <>
                {/* Search & Grade Filter Pills */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#526B91]" />
                    <input
                      type="text"
                      value={cellSearch}
                      onChange={(e) => setCellSearch(e.target.value)}
                      placeholder="Search serial number..."
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-1.5 pl-9 pr-3 text-xs text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                    />
                  </div>

                  {/* Grade Filters */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedGradeFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        selectedGradeFilter === "ALL"
                          ? "bg-[#0878F9] text-white"
                          : "bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148]"
                      }`}
                    >
                      All ({availableCells?.length || 0})
                    </button>
                    {uniqueGrades.map((gr) => {
                      const count = availableCells?.filter((c: any) => c.grade === gr).length || 0;
                      return (
                        <button
                          key={gr}
                          type="button"
                          onClick={() => setSelectedGradeFilter(gr)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            selectedGradeFilter === gr
                              ? "bg-[#0878F9] text-white"
                              : "bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148]"
                          }`}
                        >
                          Grade {gr} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cells Grid */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar max-h-[520px]">
                  {loadingCells ? (
                    <div className="h-64 flex flex-col items-center justify-center text-[#526B91] space-y-2">
                      <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
                      <p className="text-xs">Loading qualified tested cells...</p>
                    </div>
                  ) : displayedCells.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F4F9FF] rounded-2xl border border-dashed border-[#D8E8FA] text-[#526B91] space-y-2">
                      <Battery className="w-10 h-10 text-[#526B91] mx-auto" />
                      <p className="text-xs font-bold text-[#0B2148]">No QC-approved cells found for this model</p>
                      <p className="text-[11px] max-w-xs text-[#526B91]">
                        Cells must complete testing at <strong>/test-engineer/testing</strong> and receive <strong>QC Approval (Gate 1)</strong> before they become available for PAX assembly.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {displayedCells.map((cell: any) => {
                        const isSlotted = selectedCells.some(c => c.serial === cell.serialNumber);
                        const slotIndex = selectedCells.findIndex(c => c.serial === cell.serialNumber);
                        
                        return (
                          <div
                            key={cell.serialNumber}
                            onClick={() => toggleCell(cell.serialNumber, cell.grade, cell.ahValue, cell.irValue)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                              isSlotted
                                ? "bg-[#EAF5FF] border-[#0878F9] shadow-xs"
                                : "bg-white border-[#D8E8FA] hover:border-[#0878F9]/50 hover:bg-[#F4F9FF] shadow-2xs"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className="font-mono text-xs font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors">
                                  {formatSerial(cell.serialNumber)}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <p className="text-[9px] font-mono text-[#526B91]">{cell.partNumber || "KYRA-CELL-001"}</p>
                                  <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">✓ QC Approved</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getGradeBadge(cell.grade)}`}>
                                  {cell.grade}
                                </span>
                                {isSlotted && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#0878F9] text-white">
                                    P{slotIndex + 1}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Measured Telemetry Chips */}
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                              <div className="bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA]">
                                <span className="text-[8px] font-sans font-bold text-[#526B91] uppercase block">Capacity</span>
                                <span className="text-[#0B2148] font-bold text-xs">{cell.ahValue.toFixed(2)} AH</span>
                              </div>
                              <div className="bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA]">
                                <span className="text-[8px] font-sans font-bold text-[#526B91] uppercase block">Resistance</span>
                                <span className="text-[#0878F9] font-bold text-xs">{cell.irValue.toFixed(2)} mΩ</span>
                              </div>
                            </div>

                            {/* Hover slot action hint */}
                            <div className="mt-2.5 pt-2 border-t border-[#D8E8FA]/60 flex items-center justify-between text-[10px]">
                              <span className="text-[#526B91]">
                                {isSlotted ? "Click to remove" : "Click to slot in"}
                              </span>
                              <span className={`font-bold ${isSlotted ? "text-rose-600" : "text-[#0878F9] group-hover:translate-x-0.5 transition-transform"}`}>
                                {isSlotted ? "✕ Remove" : "+ Slot In →"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Active Manifest & QC Handover ────────────────────── */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">
          
          <div className="p-5 rounded-2xl bg-white border border-[#D8E8FA] shadow-xs flex-1 flex flex-col space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Pack Manifest</h3>
              </div>
              <span className="text-xs font-mono font-bold text-[#0878F9]">
                {selectedCells.length} / {targetCellCount} Slots
              </span>
            </div>

            {/* Slotted Cells List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[200px]">
              <AnimatePresence mode="popLayout">
                {selectedCells.map((item, idx) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    key={item.serial}
                    className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between group hover:border-[#0878F9]/40 transition-all shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA]">
                          P{idx + 1}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#0B2148]">{formatSerial(item.serial)}</span>
                        <span className={`text-[9px] font-bold px-1 rounded border ${getGradeBadge(item.grade)}`}>
                          {item.grade}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-[#526B91]">
                        {item.ah.toFixed(2)} AH • {item.ir.toFixed(2)} mΩ
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCell(item.serial, item.grade, item.ah, item.ir)}
                      className="p-1 rounded-lg text-[#526B91] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove cell"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {selectedCells.length === 0 && (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-[#526B91] space-y-1.5">
                  <Scan className="w-8 h-8 text-[#526B91] mb-1" />
                  <p className="text-xs font-bold text-[#0B2148]">No Cells Slotted Yet</p>
                  <p className="text-[10px] text-[#526B91]">Scan or pick cells to bind to pack positions</p>
                </div>
              )}
            </div>

            {/* 4-Point Safety Gate Validation Summary */}
            <div className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#526B91] mb-1">
                4-Point QC Safety Gate
              </p>

              {/* 1. Placement */}
              <div className="flex items-center justify-between">
                <span className="text-[#526B91] text-[11px]">1. Cell Quantity ({selectedCells.length}/{targetCellCount})</span>
                {isCellCountComplete ? (
                  <span className="text-[#166534] font-bold flex items-center gap-1 text-[11px]">
                    <Check className="w-3 h-3 stroke-[3]" /> Ready
                  </span>
                ) : (
                  <span className="text-[#526B91] font-mono text-[11px]">Incomplete</span>
                )}
              </div>

              {/* 2. AH Spread */}
              <div className="flex items-center justify-between">
                <span className="text-[#526B91] text-[11px]">2. ΔAH Capacity Match</span>
                {isAhDeltaValid ? (
                  <span className="text-[#166534] font-bold flex items-center gap-1 text-[11px]">
                    <Check className="w-3 h-3 stroke-[3]" /> Passed
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold text-[11px]">Exceeded</span>
                )}
              </div>

              {/* 3. IR Spread */}
              <div className="flex items-center justify-between">
                <span className="text-[#526B91] text-[11px]">3. ΔIR Resistance Match</span>
                {isIrDeltaValid ? (
                  <span className="text-[#166534] font-bold flex items-center gap-1 text-[11px]">
                    <Check className="w-3 h-3 stroke-[3]" /> Passed
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold text-[11px]">Exceeded</span>
                )}
              </div>

              {/* 4. BOM */}
              <div className="flex items-center justify-between">
                <span className="text-[#526B91] text-[11px]">4. Hardware BOM Checked</span>
                {!hasActiveBom ? (
                  <span className="text-rose-600 font-bold text-[11px]">No Active BOM</span>
                ) : isBomComplete ? (
                  <span className="text-[#166534] font-bold flex items-center gap-1 text-[11px]">
                    <Check className="w-3 h-3 stroke-[3]" /> Verified
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold text-[11px]">Pending ({verifiedBomItems.length}/{activeBom?.items?.length || 0})</span>
                )}
              </div>
            </div>

            {/* Submission CTA */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                id="btn-handover-qc"
                disabled={!isAssemblyValid || createPaxMutation.isPending}
                onClick={() => createPaxMutation.mutate({ 
                  paxTypeId: selectedTypeId, 
                  cellSerials: selectedCells.map(c => c.serial),
                  workOrderId: workOrderId || undefined
                })}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {createPaxMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Submitting Pack to QC...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>Authorize & Handover to QC</span>
                  </>
                )}
              </button>

              {!isAssemblyValid && (
                <p className="text-[10px] text-center text-[#526B91]">
                  {!hasActiveBom
                    ? "Active Bill of Materials required to assemble"
                    : !isCellCountComplete
                    ? `Slot ${targetCellCount - selectedCells.length} more cell(s) to complete pack`
                    : !isBomComplete
                    ? "Verify all BOM hardware parts before QC submission"
                    : !isAhDeltaValid || !isIrDeltaValid
                    ? "Pack delta exceeds allowable tolerance"
                    : "Complete all 4 safety points to submit"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── GENERATED QR CODE & BARCODE PASSPORT MODAL ───────────────────────── */}
      <AnimatePresence>
        {createdPackData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#061B3A]/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-[#D8E8FA] rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-8 max-h-[92vh]"
            >
              {/* Modal Top Bar */}
              <div className="p-5 border-b border-[#D8E8FA] bg-[#F4F9FF] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-display font-bold text-[#0B2148]">
                        PAX Pack Created & QC Passport Generated
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#166534] text-[10px] font-mono font-bold uppercase">
                        Ready For QC
                      </span>
                    </div>
                    <p className="text-xs text-[#526B91] mt-0.5 font-mono">
                      Serial: <strong className="text-[#0878F9]">{createdPackData.paxSerial}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCreatedPackData(null)}
                  className="p-2 rounded-xl text-[#526B91] hover:text-[#0B2148] hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* View Selector Tabs */}
              <div className="px-6 pt-4 bg-white flex items-center justify-between border-b border-[#D8E8FA]/70 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-[#F4F9FF] rounded-xl border border-[#D8E8FA] text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveModalTab("all")}
                    className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeModalTab === "all"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>All-in-One Passport (All Details)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab("cells")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModalTab === "cells"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    Bound Cells ({createdPackData.cells.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab("bom")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModalTab === "bom"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    Hardware BOM ({createdPackData.bom?.items?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalTab("raw")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      activeModalTab === "raw"
                        ? "bg-[#0878F9] text-white shadow-2xs"
                        : "text-[#526B91] hover:text-[#0B2148]"
                    }`}
                  >
                    Raw QR JSON
                  </button>
                </div>

                <span className="text-[11px] text-[#526B91] font-mono">
                  {createdPackData.cells.length} Cells • {createdPackData.bom?.items?.length || 0} BOM Parts Verified
                </span>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* ── ALL-IN-ONE VIEW: Shows Barcode, QR Code, Cells, BOM, and Telemetry in one complete passport ── */}
                {activeModalTab === "all" && (
                  <div className="p-6 rounded-2xl bg-white border-2 border-[#0B2148] shadow-sm space-y-5 font-mono text-[#0B2148]">
                    
                    {/* Passport Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#0B2148] pb-3 gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-sm bg-[#FFC928]" />
                        <span className="font-display font-black text-base tracking-wider">KYRA ZAM 2.0</span>
                        <span className="text-[10px] bg-[#0B2148] text-white px-2 py-0.5 rounded font-bold font-sans">
                          ALL-IN-ONE BATTERY PACK PASSPORT
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-right font-sans text-[#526B91] flex items-center sm:flex-col gap-2 sm:gap-0">
                        <span>Assembled: <strong>{new Date(createdPackData.assembledAt).toLocaleString()}</strong></span>
                        <span>Operator: <strong>{createdPackData.operatorName || "Technician"}</strong></span>
                      </div>
                    </div>

                    {/* QR Code & Barcode Section */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 bg-[#F4F9FF] p-4 rounded-2xl border border-[#D8E8FA]">
                      {/* High-density QR Code */}
                      <div className="p-2 bg-white rounded-xl border border-[#D8E8FA] shrink-0 shadow-xs flex flex-col items-center">
                        <QRCodeSVG
                          value={qrPayloadString}
                          size={152}
                          level="M"
                          includeMargin={true}
                        />
                        <span className="text-[8px] font-mono text-[#526B91] mt-1 font-bold">SCAN COMPLETE PASSPORT</span>
                      </div>

                      {/* Barcode & Key Specs */}
                      <div className="space-y-3 flex-1 w-full">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-sans text-[#526B91] font-bold">Pack Serial Number</span>
                            <span className="text-[10px] font-sans font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              QC Ready
                            </span>
                          </div>
                          <div className="text-lg font-black tracking-wider text-[#0B2148] font-mono mt-0.5">
                            {createdPackData.paxSerial}
                          </div>

                          {/* Code-128 Barcode Stripe */}
                          <div className="h-9 w-full bg-slate-900 rounded mt-1.5 flex items-center justify-center p-1 px-3">
                            <div className="flex items-center justify-between w-full h-full">
                              {Array.from({ length: 42 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="bg-white h-full"
                                  style={{
                                    width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1.5 : 2.2)}px`,
                                    opacity: i % 7 === 0 ? 0 : 1
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
                          <div className="bg-white p-2 rounded-lg border border-[#D8E8FA]">
                            <span className="text-[8px] text-[#526B91] uppercase block font-bold">Model</span>
                            <strong className="text-[#0B2148] text-xs font-mono truncate block">{createdPackData.paxType?.name || "Pack"}</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-[#D8E8FA]">
                            <span className="text-[8px] text-[#526B91] uppercase block font-bold">Configuration</span>
                            <strong className="text-[#0878F9] text-xs font-mono">{createdPackData.paxType?.configuration || `${createdPackData.cells.length}S1P`}</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-[#D8E8FA]">
                            <span className="text-[8px] text-[#526B91] uppercase block font-bold">Avg Capacity</span>
                            <strong className="text-[#166534] text-xs font-mono">{createdPackData.stats.avgAh.toFixed(2)} AH</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-[#D8E8FA]">
                            <span className="text-[8px] text-[#526B91] uppercase block font-bold">Grade</span>
                            <strong className="text-[#0B2148] text-xs font-mono">{createdPackData.stats.grade || "A+"}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono bg-white p-3 rounded-xl border border-[#D8E8FA]">
                      <div>
                        <span className="text-[#526B91] text-[9px] uppercase font-sans block">Avg Resistance</span>
                        <strong>{createdPackData.stats.avgIr.toFixed(2)} mΩ</strong>
                      </div>
                      <div>
                        <span className="text-[#526B91] text-[9px] uppercase font-sans block">Capacity Spread (ΔAH)</span>
                        <strong className="text-[#166534]">{createdPackData.stats.ahSpread.toFixed(3)} AH (Safe)</strong>
                      </div>
                      <div>
                        <span className="text-[#526B91] text-[9px] uppercase font-sans block">Resistance Spread (ΔIR)</span>
                        <strong className="text-[#166534]">{createdPackData.stats.irSpread.toFixed(2)} mΩ (Safe)</strong>
                      </div>
                      <div>
                        <span className="text-[#526B91] text-[9px] uppercase font-sans block">Work Order Reference</span>
                        <strong className="text-[#0878F9] truncate block">{createdPackData.workOrderNumber || "Direct Production"}</strong>
                      </div>
                    </div>

                    {/* Section 1: ALL Bound Serialized Cells */}
                    <div className="space-y-2 pt-1 border-t border-dashed border-[#D8E8FA]">
                      <div className="flex items-center justify-between font-sans">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0B2148] flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5 text-[#0878F9]" />
                          <span>Bound Serialized Physical Cells ({createdPackData.cells.length} Units)</span>
                        </span>
                        <span className="text-[10px] text-[#526B91] font-mono">Matched Grade {createdPackData.stats.grade}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {createdPackData.cells.map((cell) => (
                          <div
                            key={cell.serial}
                            className="p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-[#0878F9]/10 text-[#0878F9] font-bold text-[10px]">
                                P{cell.position}
                              </span>
                              <strong className="text-[#0B2148]">{formatSerial(cell.serial)}</strong>
                            </div>
                            <div className="text-right text-[10px] text-[#526B91]">
                              <span>{cell.ah.toFixed(2)} AH</span> • <span>{cell.ir.toFixed(2)} mΩ</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 2: ALL Verified Hardware BOM Components */}
                    {createdPackData.bom?.items && createdPackData.bom.items.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-dashed border-[#D8E8FA]">
                        <div className="flex items-center justify-between font-sans">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#0B2148] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#0878F9]" />
                            <span>Verified Hardware BOM ({createdPackData.bom.name})</span>
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold">All Parts Installed ✓</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {createdPackData.bom.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-[#0B2148] font-sans">{item.name}</span>
                                <span className="text-[10px] font-mono text-[#526B91] block">{item.sku}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#166534] font-mono font-bold text-[11px]">
                                Qty: {item.quantity} ✓
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Compliance & Seal Footer */}
                    <div className="pt-2 border-t border-[#0B2148] flex flex-col sm:flex-row items-center justify-between text-[9px] font-sans text-[#526B91] gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold uppercase text-[#0B2148]">Kyra Zam Certified Battery Pack</span>
                        <span>• Compliance IEC 62133 / AIS-156</span>
                      </div>
                      <span className="font-mono">Tamper Evident Electronic Passport</span>
                    </div>
                  </div>
                )}

                {/* Tab 2: Cells List Only */}
                {activeModalTab === "cells" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#526B91]">
                        Complete serialized physical cells bound to this pack:
                      </p>
                      <span className="text-xs font-mono font-bold text-[#0878F9]">
                        {createdPackData.cells.length} Total Cells
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                      {createdPackData.cells.map((cell) => (
                        <div
                          key={cell.serial}
                          className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#0878F9]/10 text-[#0878F9] font-bold text-[11px]">
                              P{cell.position}
                            </span>
                            <strong className="text-[#0B2148]">{formatSerial(cell.serial)}</strong>
                          </div>
                          <div className="text-right text-[11px] text-[#526B91]">
                            <span>{cell.ah.toFixed(2)} AH</span> • <span>{cell.ir.toFixed(2)} mΩ</span>
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white border border-[#D8E8FA] text-[9px] font-bold text-[#0B2148]">
                              Grade {cell.grade}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: BOM Hardware Only */}
                {activeModalTab === "bom" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#526B91]">
                        Hardware Bill of Materials components confirmed for this pack:
                      </p>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {createdPackData.bom?.items?.length || 0} Components Verified
                      </span>
                    </div>
                    {createdPackData.bom?.items && createdPackData.bom.items.length > 0 ? (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                        {createdPackData.bom.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-[#0B2148] text-sm">{item.name}</span>
                              <span className="text-xs font-mono text-[#526B91] block">{item.sku}</span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-[#166534] font-mono font-bold text-xs">
                              Qty: {item.quantity} (Verified ✓)
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-[#F4F9FF] rounded-xl border border-dashed border-[#D8E8FA] text-center text-xs text-[#526B91]">
                        No BOM Hardware items recorded.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Raw JSON Payload */}
                {activeModalTab === "raw" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#526B91]">
                      <span>Full QR code payload data string encoded in barcode:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(qrPayloadString);
                          toast.success("QR Payload JSON copied to clipboard!");
                        }}
                        className="text-[#0878F9] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Raw JSON</span>
                      </button>
                    </div>
                    <pre className="p-4 rounded-2xl bg-[#061B3A] text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-[360px] custom-scrollbar border border-slate-700 leading-relaxed">
                      {qrPayloadString}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-5 border-t border-[#D8E8FA] bg-[#F4F9FF] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handlePrintLabel}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#0B2148] font-bold text-xs border border-[#D8E8FA] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-4 h-4 text-[#0878F9]" />
                    <span>Print All-in-One Label</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(qrPayloadString);
                      toast.success("QR Code & Barcode JSON copied to clipboard!");
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0878F9] font-bold text-xs border border-[#D8E8FA] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy JSON</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCreatedPackData(null)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assemble Next Pack</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
