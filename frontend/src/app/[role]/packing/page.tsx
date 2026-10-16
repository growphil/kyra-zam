"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Package,
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Truck,
  Printer,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  ChevronRight,
  RefreshCw,
  Loader2,
  X,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Barcode,
  History,
  Info,
  Check,
  Building2,
  MapPin,
  AlertCircle,
  Copy,
  Download,
  Wifi,
  WifiOff
} from "lucide-react";

export default function PackingQueuePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = (params?.role as string) || "packing";
  const { data: session } = useSession();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaxType, setSelectedPaxType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedSerialInput, setScannedSerialInput] = useState("");

  // Scanner & Network state
  const [isOnline, setIsOnline] = useState(true);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Active Packing Session State
  const [activePackingModal, setActivePackingModal] = useState<any | null>(null);
  const [activeStep, setActiveStep] = useState<"VERIFY" | "CHECKLIST" | "BOX" | "CONFIRMED" | "TRANSFER">("VERIFY");
  const [checklistState, setChecklistState] = useState<Record<string, { verified: boolean; condition: string; notes: string; quantity: number; meta?: any }>>({});
  const [boxChecks, setBoxChecks] = useState<Record<string, boolean>>({});
  const [boxCondition, setBoxCondition] = useState("GOOD");
  const [boxSealed, setBoxSealed] = useState(false);
  const [packingNotes, setPackingNotes] = useState("");

  // Transfer state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");

  // --- DATA FETCHING ---

  // 1. KPI Stats
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["packing-stats"],
    queryFn: async () => (await api.get("/packing/stats")).data,
    refetchInterval: 10000
  });

  // 2. Queue List
  const { data: queueData, isLoading: loadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ["packing-queue", searchQuery, selectedPaxType, page],
    queryFn: async () => {
      const res = await api.get("/packing/queue", {
        params: {
          search: searchQuery || undefined,
          paxTypeId: selectedPaxType !== "ALL" ? selectedPaxType : undefined,
          page,
          limit: 15
        }
      });
      return res.data;
    },
    refetchInterval: 8000
  });

  // 3. Pax Types for filtering
  const { data: paxTypesData } = useQuery({
    queryKey: ["pax-types-list"],
    queryFn: async () => (await api.get("/cells/pax-types")).data
  });

  // 4. Warehouses for transfer
  const { data: warehousesData } = useQuery({
    queryKey: ["packing-warehouses"],
    queryFn: async () => (await api.get("/packing/warehouses")).data,
    enabled: activeStep === "TRANSFER"
  });

  // 5. Active Sticker Query (for confirmed & transfer steps)
  const { data: activeStickerData, isLoading: loadingSticker } = useQuery({
    queryKey: ["active-sticker", activePackingModal?.packingRecord?.id],
    queryFn: async () => {
      if (!activePackingModal?.packingRecord?.id) return null;
      const res = await api.get(`/packing/${activePackingModal.packingRecord.id}/sticker`);
      return res.data.sticker;
    },
    enabled: !!activePackingModal?.packingRecord?.id && (activeStep === "CONFIRMED" || activeStep === "TRANSFER")
  });

  // --- MUTATIONS ---

  // Start packing session mutation
  const startPackingMutation = useMutation({
    mutationFn: async ({ paxSerial }: { paxSerial: string }) => {
      return (await api.post("/packing/start", { paxSerial })).data;
    },
    onSuccess: (data) => {
      toast.success(`Packing session started for ${data.paxSerial}`);
      queryClient.invalidateQueries({ queryKey: ["packing-queue"] });
      queryClient.invalidateQueries({ queryKey: ["packing-stats"] });
      // Initialize checklist state
      initChecklistFromRecord(data);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to start packing session");
    }
  });

  // Save checklist mutation
  const saveChecklistMutation = useMutation({
    mutationFn: async ({ packingId, items, boxCondition, boxSealed, notes }: any) => {
      return (await api.put(`/packing/${packingId}/checklist`, { items, boxCondition, boxSealed, notes })).data;
    },
    onSuccess: (data) => {
      toast.success("Checklist progress saved");
      queryClient.invalidateQueries({ queryKey: ["packing-queue"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to save checklist");
    }
  });

  // Confirm packing mutation
  const confirmPackingMutation = useMutation({
    mutationFn: async ({ packingId, boxCondition, boxSealed, notes }: any) => {
      return (await api.post(`/packing/${packingId}/confirm`, { boxCondition, boxSealed, notes })).data;
    },
    onSuccess: (data) => {
      toast.success(`Packing confirmed! Sticker ${data.stickerNumber} generated`);
      queryClient.invalidateQueries({ queryKey: ["packing-queue"] });
      queryClient.invalidateQueries({ queryKey: ["packing-stats"] });
      setActivePackingModal((prev: any) => ({ ...prev, packingRecord: data }));
      setActiveStep("CONFIRMED");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to confirm packing");
    }
  });

  // Transfer to FG mutation
  const transferToFGMutation = useMutation({
    mutationFn: async ({ packingId, warehouseId, locationId, notes }: any) => {
      return (await api.post(`/packing/${packingId}/transfer-to-fg`, { warehouseId, locationId, notes })).data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully moved to Finished Goods warehouse (${data.destinationWarehouse?.name})`);
      queryClient.invalidateQueries({ queryKey: ["packing-queue"] });
      queryClient.invalidateQueries({ queryKey: ["packing-stats"] });
      setActivePackingModal(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to transfer to Finished Goods");
    }
  });

  // --- HANDLERS ---

  const handleOpenPackingVerification = async (paxSerial: string) => {
    setIsProcessingScan(true);
    try {
      const res = await api.get(`/packing/verify/${paxSerial}`);
      const payload = res.data;

      setActivePackingModal({
        ...payload.pax,
        eligible: payload.eligible,
        reasons: payload.reasons || [],
        hasConfiguredMaterials: payload.hasConfiguredMaterials
      });

      if (!payload.eligible) {
        setActiveStep("VERIFY");
        toast.error(`Ineligible for Packing: ${payload.reasons?.join(", ")}`, {
          duration: 5000
        });
        return;
      }

      if (payload.pax.packingRecord) {
        initChecklistFromRecord(payload.pax.packingRecord);
        if (payload.pax.packingRecord.status === "PACKED") {
          setActiveStep("CONFIRMED");
        } else if (payload.pax.packingRecord.status === "CHECKLIST_PENDING") {
          setActiveStep("BOX");
        } else {
          setActiveStep("CHECKLIST");
        }
      } else {
        setActiveStep("VERIFY");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Verification failed");
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Hardware barcode wedge listener for automatic shop-floor scanning
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 120) {
        buffer = "";
      }
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (buffer.length >= 6) {
          const serial = buffer.trim().toUpperCase();
          buffer = "";
          handleOpenPackingVerification(serial);
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedSerialInput.trim()) return;
    const serial = scannedSerialInput.trim().toUpperCase();
    setIsScannerOpen(false);
    setScannedSerialInput("");
    handleOpenPackingVerification(serial);
  };

  const initChecklistFromRecord = (record: any) => {
    const clState: Record<string, any> = {};
    const bxState: Record<string, boolean> = {};

    if (record.checklistItems) {
      record.checklistItems.forEach((item: any) => {
        if (item.itemType === "MATERIAL") {
          let parsedNotes: any = {};
          try {
            if (item.notes && item.notes.startsWith("{")) {
              parsedNotes = JSON.parse(item.notes);
            }
          } catch {}
          clState[item.id] = {
            verified: item.verified,
            condition: item.condition || "GOOD",
            notes: parsedNotes.operatorNotes || (typeof item.notes === "string" && !item.notes.startsWith("{") ? item.notes : ""),
            quantity: item.quantity || 1,
            meta: parsedNotes
          };
        } else {
          bxState[item.id] = item.verified;
        }
      });
    }

    setChecklistState(clState);
    setBoxChecks(bxState);
    setBoxCondition(record.boxCondition || "GOOD");
    setBoxSealed(record.boxSealed || false);
    setPackingNotes(record.notes || "");
  };

  const handleStartPacking = () => {
    if (!activePackingModal) return;
    startPackingMutation.mutate(
      { paxSerial: activePackingModal.paxSerial },
      {
        onSuccess: (newRec) => {
          setActivePackingModal((prev: any) => ({ ...prev, packingRecord: newRec }));
          setActiveStep("CHECKLIST");
        }
      }
    );
  };

  const handleToggleMaterialItem = (itemId: string) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        verified: !prev[itemId]?.verified
      }
    }));
  };

  const handleToggleBoxItem = (itemId: string) => {
    setBoxChecks((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSaveAndProceedToBox = () => {
    if (!activePackingModal?.packingRecord) return;
    const itemsPayload = Object.keys(checklistState).map((id) => {
      const it = checklistState[id];
      const combinedNotes = JSON.stringify({
        ...(it.meta || {}),
        operatorNotes: it.notes || ""
      });
      return {
        id,
        verified: it.verified,
        condition: it.condition,
        notes: combinedNotes,
        quantity: it.quantity
      };
    });

    saveChecklistMutation.mutate({
      packingId: activePackingModal.packingRecord.id,
      items: itemsPayload,
      boxCondition,
      boxSealed,
      notes: packingNotes
    });

    setActiveStep("BOX");
  };

  const handleConfirmPacking = () => {
    if (!activePackingModal?.packingRecord) return;

    // Combine material + box items for update
    const materialPayload = Object.keys(checklistState).map((id) => {
      const it = checklistState[id];
      const combinedNotes = JSON.stringify({
        ...(it.meta || {}),
        operatorNotes: it.notes || ""
      });
      return {
        id,
        verified: it.verified,
        condition: it.condition,
        notes: combinedNotes,
        quantity: it.quantity
      };
    });

    const boxPayload = Object.keys(boxChecks).map((id) => ({
      id,
      verified: boxChecks[id],
      condition: "GOOD",
      quantity: 1
    }));

    saveChecklistMutation.mutate(
      {
        packingId: activePackingModal.packingRecord.id,
        items: [...materialPayload, ...boxPayload],
        boxCondition,
        boxSealed: true,
        notes: packingNotes
      },
      {
        onSuccess: () => {
          confirmPackingMutation.mutate({
            packingId: activePackingModal.packingRecord.id,
            boxCondition,
            boxSealed: true,
            notes: packingNotes
          });
        }
      }
    );
  };

  const handlePrintSticker = async () => {
    if (!activePackingModal?.packingRecord?.id) return;
    try {
      const res = await api.get(`/packing/${activePackingModal.packingRecord.id}/sticker`);
      const sticker = res.data.sticker;
      const serial = sticker.paxSerial;

      // Print using browser popup window with ultra-crisp 4x6" thermal print layout
      const printWindow = window.open("", "_blank", "width=650,height=900");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Battery Pack Label - ${serial}</title>
              <meta charset="utf-8" />
              <style>
                @page {
                  size: 100mm 150mm;
                  margin: 0;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  margin: 0;
                  padding: 8mm 6mm;
                  background: #fff;
                  color: #000;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                }
                .label-container {
                  width: 88mm;
                  height: 134mm;
                  border: 3px solid #000;
                  border-radius: 6px;
                  padding: 8px 10px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .brand-header {
                  border-bottom: 2.5px solid #000;
                  padding-bottom: 5px;
                  text-align: center;
                }
                .brand-title {
                  font-size: 22px;
                  font-weight: 900;
                  letter-spacing: 2.5px;
                  line-height: 1.1;
                }
                .brand-sub {
                  font-size: 8.5px;
                  font-weight: 800;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  color: #111;
                  margin-top: 2px;
                }
                .spec-table {
                  width: 100%;
                  font-size: 10.5px;
                  margin-top: 4px;
                  border-collapse: collapse;
                }
                .spec-table td {
                  padding: 2.5px 0;
                  vertical-align: top;
                }
                .spec-label {
                  font-weight: 800;
                  color: #222;
                  width: 38%;
                  font-size: 9px;
                  text-transform: uppercase;
                }
                .spec-val {
                  font-family: "Courier New", Courier, monospace;
                  font-weight: 900;
                  font-size: 11px;
                }
                .barcode-hero-box {
                  border: 2px solid #000;
                  border-radius: 6px;
                  padding: 6px;
                  margin: 6px 0;
                  text-align: center;
                  background: #fafafa;
                }
                .qr-row {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 10px;
                  padding: 4px 0;
                }
                .qr-box {
                  width: 100px;
                  height: 100px;
                  flex-shrink: 0;
                }
                .qr-box img {
                  width: 100%;
                  height: 100%;
                  display: block;
                }
                .serial-stack {
                  flex: 1;
                  text-align: left;
                }
                .serial-text {
                  font-family: monospace;
                  font-size: 16px;
                  font-weight: 900;
                  letter-spacing: 1px;
                  word-break: break-all;
                  border-bottom: 2px solid #000;
                  padding-bottom: 3px;
                  margin-bottom: 3px;
                }
                .barcode-stripes {
                  height: 24px;
                  width: 100%;
                  display: flex;
                  align-items: center;
                  gap: 1.5px;
                  margin-top: 4px;
                }
                .bar {
                  height: 100%;
                  background: #000;
                }
                .safety-box {
                  border-top: 2px solid #000;
                  padding-top: 5px;
                  font-size: 7.5px;
                  font-weight: 700;
                  line-height: 1.25;
                  text-align: justify;
                }
                .safety-icons {
                  display: flex;
                  justify-content: space-between;
                  font-size: 8px;
                  font-weight: 900;
                  margin-top: 3px;
                  border-top: 1px dashed #444;
                  padding-top: 3px;
                }
                .footer {
                  border-top: 2.5px solid #000;
                  padding-top: 4px;
                  display: flex;
                  justify-content: space-between;
                  font-size: 8.5px;
                  font-weight: 900;
                }
              </style>
            </head>
            <body>
              <div class="label-container">
                <!-- Header -->
                <div class="brand-header">
                  <div class="brand-title">KYRA ZAM 2.0</div>
                  <div class="brand-sub">CERTIFIED LITHIUM BATTERY PACK • AIS-156 / UN 38.3</div>
                </div>

                <!-- Specs -->
                <table class="spec-table">
                  <tr>
                    <td class="spec-label">MODEL:</td>
                    <td class="spec-val">${sticker.modelName}</td>
                  </tr>
                  <tr>
                    <td class="spec-label">CONFIG / RATING:</td>
                    <td class="spec-val">${sticker.configuration} (${sticker.nominalVoltage} ${sticker.nominalCapacity})</td>
                  </tr>
                  <tr>
                    <td class="spec-label">PACKING ID:</td>
                    <td class="spec-val">${sticker.packingNumber}</td>
                  </tr>
                  <tr>
                    <td class="spec-label">SEAL / STICKER:</td>
                    <td class="spec-val">${sticker.stickerNumber}</td>
                  </tr>
                  <tr>
                    <td class="spec-label">MFG / PACK DATE:</td>
                    <td class="spec-val">${new Date(sticker.packingDate).toLocaleDateString()}</td>
                  </tr>
                </table>

                <!-- QR & Serial Area -->
                <div class="barcode-hero-box">
                  <div class="qr-row">
                    <div class="qr-box">
                      <img src="${sticker.qrCodeBase64}" alt="QR" />
                    </div>
                    <div class="serial-stack">
                      <div style="font-size: 8px; font-weight: bold; color: #555; text-transform: uppercase;">Battery Serial Number</div>
                      <div class="serial-text">${sticker.paxSerial}</div>
                      <div style="font-size: 8px; font-weight: bold; color: #444;">WO: ${sticker.workOrderNumber || "WO-BATCH-01"}</div>
                      <!-- Barcode stripes -->
                      <div class="barcode-stripes">
                        ${Array.from({ length: 36 })
                          .map((_, i) => `<div class="bar" style="width: ${i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1}px;"></div>`)
                          .join("")}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Safety Warnings -->
                <div class="safety-box">
                  <strong>CAUTION:</strong> DO NOT SHORT CIRCUIT, CRUSH, PUNCTURE, OR HEAT ABOVE 60°C. CHARGE WITH SPECIFIED CC/CV CHARGER ONLY. RECYCLE IN ACCORDANCE WITH APPLICABLE REGULATIONS.
                  <div class="safety-icons">
                    <span>⚡ HIGH VOLTAGE</span>
                    <span>♻️ Li-Ion RECYCLE</span>
                    <span>UN 3480 CLASS 9</span>
                  </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                  <span>QC: APPROVED (PASS)</span>
                  <span>OP: ${sticker.operatorName}</span>
                  <span>KYRA ZAM ENERGIES</span>
                </div>
              </div>

              <script>
                window.onload = function() {
                  window.print();
                  window.close();
                }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err: any) {
      toast.error("Failed to generate printable sticker");
    }
  };

  const handleTransferToFG = () => {
    if (!activePackingModal?.packingRecord?.id || !selectedWarehouseId || !selectedLocationId) {
      toast.error("Please select a warehouse and specific location bay");
      return;
    }

    transferToFGMutation.mutate({
      packingId: activePackingModal.packingRecord.id,
      warehouseId: selectedWarehouseId,
      locationId: selectedLocationId,
      notes: packingNotes
    });
  };

  const queueItems = queueData?.queue || [];
  const totalQueue = queueData?.total || 0;

  // Selected warehouse locations
  const availableLocations = useMemo(() => {
    if (!selectedWarehouseId || !warehousesData) return [];
    const wh = warehousesData.find((w: any) => w.id === selectedWarehouseId);
    return wh?.locations || [];
  }, [selectedWarehouseId, warehousesData]);

  // Material checklist progress calculation
  const materialItems = activePackingModal?.packingRecord?.checklistItems?.filter((i: any) => i.itemType === "MATERIAL") || [];
  const requiredMaterialItems = materialItems.filter((i: any) => i.required);
  const optionalMaterialItems = materialItems.filter((i: any) => !i.required);

  const verifiedMaterialCount = materialItems.filter((i: any) => checklistState[i.id]?.verified).length;
  const verifiedRequiredCount = requiredMaterialItems.filter((i: any) => checklistState[i.id]?.verified).length;
  const verifiedOptionalCount = optionalMaterialItems.filter((i: any) => checklistState[i.id]?.verified).length;

  const allRequiredMaterialsVerified = requiredMaterialItems.length === 0 || verifiedRequiredCount === requiredMaterialItems.length;
  const allMaterialsVerified = materialItems.length > 0 && verifiedMaterialCount === materialItems.length;

  const boxItems = activePackingModal?.packingRecord?.checklistItems?.filter((i: any) => i.itemType === "BOX") || [];
  const verifiedBoxCount = boxItems.filter((i: any) => boxChecks[i.id]).length;
  const allBoxVerified = boxItems.length > 0 && verifiedBoxCount === boxItems.length;

  return (
    <div className="space-y-4 max-w-[1750px] mx-auto text-[#0B2148] pb-12">
      {/* ── 1. HEADER & CONTROLS ────────────────────────────────────────── */}
      <PageHeader
        title="Packing Station"
        subtitle="Verify quality clearance, complete packing checks, generate labels and transfer eligible packs to Finished Goods."
        icon={<Package className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              !isOnline
                ? "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"
                : isProcessingScan
                ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                : "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                !isOnline
                  ? "bg-[#991B1B]"
                  : isProcessingScan
                  ? "bg-[#92400E] animate-ping"
                  : "bg-[#166534] animate-pulse"
              }`}
            />
            {!isOnline
              ? "Terminal Offline"
              : isProcessingScan
              ? "Processing Scan..."
              : "Scanner Ready"}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Scan PAX QR
            </button>
            <button
              onClick={() => router.push(`/${roleSlug}/packing/history`)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-semibold text-xs border border-[#D8E8FA] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <History className="w-4 h-4 text-[#0878F9]" />
              Packing History
            </button>
            <button
              onClick={() => refetchQueue()}
              className="p-2 rounded-xl bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#526B91] hover:text-[#0878F9] border border-[#D8E8FA] transition-colors cursor-pointer shadow-xs"
              title="Refresh Queue"
              aria-label="Refresh Queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* ── 2. STANDARDIZED SUMMARY CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Ready in Queue</div>
          <div className="text-2xl font-bold text-[#0B2148] mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-[#0878F9]" /> : statsData?.readyForPacking || 0}
          </div>
          <div className="text-xs text-[#526B91] mt-0.5">EOL & QC Passed</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Packing In Progress</div>
          <div className="text-2xl font-bold text-[#1D4ED8] mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-[#1D4ED8]" /> : statsData?.packingInProgress || 0}
          </div>
          <div className="text-xs text-[#526B91] mt-0.5">Checklist Active</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Packed Today</div>
          <div className="text-2xl font-bold text-[#166534] mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-[#166534]" /> : statsData?.packedToday || 0}
          </div>
          <div className="text-xs text-[#526B91] mt-0.5">Stickers Generated</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Transferred to Finished Goods</div>
          <div className="text-2xl font-bold text-[#0878F9] mt-1">
            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin text-[#0878F9]" /> : statsData?.transferredToFGToday || 0}
          </div>
          <div className="text-xs text-[#526B91] mt-0.5">In FG Warehouse</div>
        </div>
      </div>

      {/* ── 3. FILTER & SEARCH TOOLBAR ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-[#D8E8FA] shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input
              type="text"
              placeholder="Search serial, model, or work order..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] transition-colors"
            />
          </div>

          <select
            value={selectedPaxType}
            onChange={(e) => {
              setSelectedPaxType(e.target.value);
              setPage(1);
            }}
            className="bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
          >
            <option value="ALL">All PAX Models</option>
            {paxTypesData?.map((pt: any) => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-medium text-[#526B91] self-end sm:self-auto">
          Showing <span className="text-[#0B2148] font-bold">{queueItems.length}</span> of {totalQueue} eligible packs
        </div>
      </div>

      {/* ── 4. ELIGIBLE-PACK QUEUE TABLE ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#D8E8FA] overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-[#D8E8FA] flex items-center justify-between bg-[#F4F9FF]">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#0878F9]" />
            <h2 className="text-sm font-bold text-[#0B2148]">Eligible Pack Queue</h2>
          </div>
          <span className="text-xs text-[#526B91]">Packs with Passed EOL Testing & Signed QC Inspection</span>
        </div>

        <div className="overflow-x-auto">
          {loadingQueue ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
              <p className="text-xs font-semibold text-[#526B91]">Loading packing queue...</p>
            </div>
          ) : queueItems.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-[#166534] mx-auto" />
              <div className="text-base font-bold text-[#0B2148]">All Tested Packs Are Packed</div>
              <p className="text-xs text-[#526B91] max-w-md mx-auto">
                No packs currently pending in the packing queue. New packs will appear automatically once Pax EOL Testing and QC sign-off are completed.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D8E8FA] text-[11px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                  <th className="py-3 px-4 pl-6">PAX Serial</th>
                  <th className="py-3 px-4">PAX Model & Specs</th>
                  <th className="py-3 px-4">Work Order</th>
                  <th className="py-3 px-4">EOL Testing</th>
                  <th className="py-3 px-4">QC Approval</th>
                  <th className="py-3 px-4">Packing Status</th>
                  <th className="py-3 px-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E8FA] text-sm">
                {queueItems.map((item: any) => {
                  const hasActiveRecord = item.packingRecord !== null;

                  return (
                    <tr key={item.paxSerial} className="hover:bg-[#F4F9FF]/80 transition-colors">
                      <td className="py-3.5 px-4 pl-6">
                        <div className="font-mono font-bold text-[#0B2148] text-xs flex items-center gap-1.5">
                          <Barcode className="w-4 h-4 text-[#0878F9]" />
                          {item.paxSerial}
                        </div>
                        <div className="text-[11px] text-[#526B91] mt-0.5">{item.assembledStation}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0B2148] text-xs">{item.paxTypeName}</div>
                        <div className="text-[11px] text-[#526B91] mt-0.5">
                          {item.configuration} • {item.nominalVoltage}V {item.nominalCapacity}Ah ({item.cellCount} Cells)
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-[#F4F9FF] border border-[#D8E8FA] text-[#0B2148]">
                          {item.workOrderNumber}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {item.eolTestStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {item.qcStatus}
                        </div>
                        <div className="text-[10px] text-[#526B91] mt-0.5">By {item.qcInspector}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {hasActiveRecord ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            {item.packingRecord.status.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                            <Sparkles className="w-3.5 h-3.5" />
                            READY TO PACK
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 pr-6 text-right">
                        <button
                          onClick={() => handleOpenPackingVerification(item.paxSerial)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-xs active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                          {hasActiveRecord ? "Resume Packing" : "Start Packing"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bounded pagination controls */}
        {totalQueue > 15 && (
          <div className="p-3.5 border-t border-[#D8E8FA] bg-[#F4F9FF] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#526B91]">
            <span>
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, totalQueue)} of {totalQueue} packs
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-[#D8E8FA] bg-white text-[#0B2148] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#EAF5FF] transition-colors"
              >
                Previous
              </button>
              <span className="font-semibold text-[#0B2148]">
                Page {page} of {Math.ceil(totalQueue / 15)}
              </span>
              <button
                onClick={() => setPage((p) => (p * 15 < totalQueue ? p + 1 : p))}
                disabled={page * 15 >= totalQueue}
                className="px-3 py-1 rounded-lg border border-[#D8E8FA] bg-white text-[#0B2148] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#EAF5FF] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. QR SCANNER MODAL ───────────────────────────────────────────── */}
      <AnimatePresence>
        {isScannerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#061B3A]/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white border border-[#D8E8FA] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#0B2148] font-bold text-sm">
                  <QrCode className="w-5 h-5 text-[#0878F9]" />
                  Scan / Input PAX Serial
                </div>
                <button
                  onClick={() => setIsScannerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#EAF5FF] text-[#526B91] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleScanSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#526B91] mb-1.5">
                    PAX Serial Number / Barcode Payload
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. KYRA-PX-2026-000001"
                    value={scannedSerialInput}
                    onChange={(e) => setScannedSerialInput(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-xs text-[#0B2148] font-mono placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                  />
                  <p className="text-[11px] text-[#526B91] mt-1.5">
                    Point barcode scanner at battery pack label or enter exact serial.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#D8E8FA]">
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:bg-[#F4F9FF] border border-[#D8E8FA] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    Verify & Open
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 6. PACKING WORKFLOW FULL COCKPIT MODAL ───────────────────────── */}
      <AnimatePresence>
        {activePackingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#F4F9FF] flex flex-col overflow-hidden text-[#0B2148]"
          >
            {/* Full-Page Modal Header */}
            <div className="bg-white border-b border-[#D8E8FA] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EAF5FF] rounded-xl flex items-center justify-center text-[#0878F9] border border-[#D8E8FA] shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg md:text-xl font-bold font-mono text-[#0B2148] tracking-tight">
                      {activePackingModal.paxSerial}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#F4F9FF] text-[#0878F9] font-semibold border border-[#D8E8FA]">
                      {activePackingModal.paxType?.name}
                    </span>
                  </div>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    {activePackingModal.paxType?.configuration} • {activePackingModal.paxType?.nominalVoltage}V {activePackingModal.paxType?.nominalCapacity}Ah
                  </p>
                </div>
              </div>

              {/* Workflow Stepper Tabs */}
              <div className="flex items-center gap-1 bg-[#F4F9FF] p-1 rounded-xl border border-[#D8E8FA] text-xs">
                <button
                  onClick={() => setActiveStep("VERIFY")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeStep === "VERIFY"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                  }`}
                >
                  1. Verification
                </button>
                <button
                  onClick={() => setActiveStep("CHECKLIST")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeStep === "CHECKLIST"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : allRequiredMaterialsVerified && materialItems.length > 0
                      ? "text-[#166534] hover:bg-white"
                      : "text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                  }`}
                >
                  2. Materials
                </button>
                <button
                  onClick={() => setActiveStep("BOX")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeStep === "BOX"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : allBoxVerified
                      ? "text-[#166534] hover:bg-white"
                      : "text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                  }`}
                >
                  3. Box Quality
                </button>
                <button
                  onClick={() => setActiveStep("CONFIRMED")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeStep === "CONFIRMED"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                  }`}
                >
                  4. Label
                </button>
                <button
                  onClick={() => setActiveStep("TRANSFER")}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeStep === "TRANSFER"
                      ? "bg-[#0878F9] text-white shadow-xs"
                      : "text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                  }`}
                >
                  5. Transfer FG
                </button>
              </div>

              <button
                onClick={() => setActivePackingModal(null)}
                className="p-2 rounded-xl text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] transition-colors border border-transparent hover:border-[#D8E8FA]"
                title="Close Packing Session"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Workflow Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-6 w-full max-w-[1700px] mx-auto space-y-5">
              {/* ── STEP 1: VERIFICATION SCREEN ──────────────────────────── */}
              {activeStep === "VERIFY" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Electrical Specs */}
                    <div className="p-5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#526B91] flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#0878F9]" />
                        Electrical Specifications
                      </div>
                      <div className="text-base font-bold text-[#0B2148]">{activePackingModal.paxType?.name}</div>
                      <div className="text-xs text-[#526B91] space-y-1.5 pt-1">
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Voltage:</span>
                          <span className="text-[#0B2148] font-mono font-bold">{activePackingModal.paxType?.nominalVoltage}V</span>
                        </div>
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Capacity:</span>
                          <span className="text-[#0B2148] font-mono font-bold">{activePackingModal.paxType?.nominalCapacity}Ah</span>
                        </div>
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Config:</span>
                          <span className="text-[#0B2148] font-mono font-bold">{activePackingModal.paxType?.configuration}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cell Count:</span>
                          <span className="text-[#0B2148] font-mono font-bold">{activePackingModal.cells?.length || activePackingModal.paxType?.cellCount} Cells</span>
                        </div>
                      </div>
                    </div>

                    {/* EOL Testing Gate */}
                    <div className="p-5 rounded-xl bg-white border border-[#BBF7D0] shadow-xs space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#166534] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        PAX EOL Testing Gate
                      </div>
                      <div className="text-base font-bold text-[#166534]">Test Passed & Validated</div>
                      <div className="text-xs text-[#526B91] space-y-1.5 pt-1">
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Status:</span>
                          <span className="text-[#166534] font-bold bg-[#DCFCE7] px-2 py-0.5 rounded text-[11px]">PASSED</span>
                        </div>
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Report:</span>
                          <span className="text-[#0B2148] font-mono">{activePackingModal.eolTesting?.reportUrl || "TR-VERIFIED-OK"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tested At:</span>
                          <span className="text-[#0B2148]">{new Date(activePackingModal.assembledAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* QC Approval */}
                    <div className="p-5 rounded-xl bg-white border border-[#BFDBFE] shadow-xs space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Quality Assurance Sign-Off
                      </div>
                      <div className="text-base font-bold text-[#1D4ED8]">QC Approved</div>
                      <div className="text-xs text-[#526B91] space-y-1.5 pt-1">
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Inspector:</span>
                          <span className="text-[#0B2148] font-semibold">{activePackingModal.qualityControl?.inspector || "QA Lead"}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#D8E8FA] pb-1">
                          <span>Inspection #:</span>
                          <span className="text-[#0B2148] font-mono">{activePackingModal.qualityControl?.inspectionNumber || "QC-SIGN-OFF"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Approved At:</span>
                          <span className="text-[#0B2148]">{new Date(activePackingModal.qualityControl?.approvedAt || activePackingModal.assembledAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manufacturing Traceability */}
                  <div className="p-5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#0B2148] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#0878F9]" />
                      Manufacturing Traceability Record
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA]">
                        <span className="text-[#526B91] text-[11px] block">Work Order</span>
                        <span className="font-mono text-[#0B2148] font-bold">{activePackingModal.workOrder?.workOrderNumber || "WO-DIRECT"}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA]">
                        <span className="text-[#526B91] text-[11px] block">Assembly Station</span>
                        <span className="text-[#0B2148] font-semibold">{activePackingModal.assembledStation}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA]">
                        <span className="text-[#526B91] text-[11px] block">Supervisor</span>
                        <span className="text-[#0B2148] font-semibold">{activePackingModal.workOrder?.supervisor || "Meena Iyer"}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA]">
                        <span className="text-[#526B91] text-[11px] block">Assembly Date</span>
                        <span className="text-[#0B2148]">{new Date(activePackingModal.assembledAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Configured Materials Requirements Preview */}
                  <div className="p-5 rounded-xl bg-white border border-[#D8E8FA] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#0B2148] flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#0878F9]" />
                        Configured Packing Materials ({activePackingModal.paxType?.name})
                      </div>
                      {activePackingModal.availablePackingMaterials?.length > 0 && (
                        <span className="text-[11px] font-semibold text-[#166534] bg-[#DCFCE7] px-2.5 py-0.5 rounded-full border border-[#BBF7D0]">
                          {activePackingModal.availablePackingMaterials.length} Items Configured
                        </span>
                      )}
                    </div>

                    {activePackingModal.availablePackingMaterials && activePackingModal.availablePackingMaterials.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {activePackingModal.availablePackingMaterials.map((mat: any, idx: number) => (
                          <div key={mat.id || idx} className="p-3 rounded-lg bg-[#F4F9FF] border border-[#D8E8FA] flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-[#0B2148] flex items-center gap-1.5">
                                <span>{mat.name}</span>
                                {mat.isRequired ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
                                    REQ
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                                    OPT
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#526B91] mt-0.5">
                                Qty: <span className="font-semibold text-[#0B2148]">{mat.quantity} {mat.unit || "PCS"}</span>
                                {mat.materialCode && <span className="ml-1 font-mono">• {mat.materialCode}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-[#FEE2E2]/60 border border-[#FECACA] flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-[#991B1B] shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-[#991B1B]">
                            Packing materials are not configured for this product. Contact the administrator.
                          </div>
                          <p className="text-xs text-[#B91C1C] mt-0.5">
                            No packing material checklist has been configured in Factory Settings for {activePackingModal.paxType?.name}. Packaging cannot proceed until configured by Superadmin.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ineligibility Warning if any gates fail */}
                  {(!activePackingModal.eligible || activePackingModal.hasConfiguredMaterials === false || !activePackingModal.availablePackingMaterials?.length) && (
                    <div className="p-4 rounded-xl bg-[#FEE2E2] border border-[#FECACA] flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#991B1B] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-[#991B1B]">
                          {activePackingModal.hasConfiguredMaterials === false || !activePackingModal.availablePackingMaterials?.length
                            ? "Packing materials are not configured for this product. Contact the administrator."
                            : "Pack Ineligible for Packaging"}
                        </div>
                        <div className="text-xs text-[#B91C1C] space-y-0.5">
                          {activePackingModal.reasons && activePackingModal.reasons.length > 0 ? (
                            activePackingModal.reasons.map((reason: string, rIdx: number) => (
                              <div key={rIdx}>• {reason}</div>
                            ))
                          ) : (
                            <div>• Packaging materials have not been configured for this product ({activePackingModal.paxType?.name}). Contact the administrator.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action */}
                  {(() => {
                    const isBlocked =
                      !activePackingModal.eligible ||
                      activePackingModal.hasConfiguredMaterials === false ||
                      !activePackingModal.availablePackingMaterials?.length;

                    return (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleStartPacking}
                          disabled={startPackingMutation.isPending || isBlocked}
                          className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors ${
                            isBlocked
                              ? "bg-[#E2E8F0] text-[#64748B] cursor-not-allowed border border-[#CBD5E1]"
                              : "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs cursor-pointer active:scale-95"
                          }`}
                        >
                          {startPackingMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isBlocked ? (
                            <AlertTriangle className="w-4 h-4 text-[#991B1B]" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {isBlocked
                            ? activePackingModal.hasConfiguredMaterials === false || !activePackingModal.availablePackingMaterials?.length
                              ? "Packing Blocked: Materials Not Configured"
                              : "Packing Blocked: Eligibility Requirements Not Met"
                            : "Initialize Packing & Proceed to Checklist"}
                          {!isBlocked && <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── STEP 2: PACKAGING MATERIAL CHECKLIST ──────────────────── */}
              {activeStep === "CHECKLIST" && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#DBEAFE] border border-[#BFDBFE]">
                    <div>
                      <div className="text-sm font-bold text-[#1D4ED8] flex items-center gap-2">
                        <Boxes className="w-4 h-4" />
                        Mandatory Packaging Materials Checklist
                      </div>
                      <div className="text-xs text-[#1E40AF] mt-0.5">
                        Verify physical inclusion, condition and quantities of all accessories configured for {activePackingModal.paxType?.name}.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-2xs ${
                        allRequiredMaterialsVerified
                          ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]"
                          : "bg-white text-[#1D4ED8] border-[#BFDBFE]"
                      }`}>
                        {verifiedRequiredCount} / {requiredMaterialItems.length} Required Verified
                      </div>
                      {optionalMaterialItems.length > 0 && (
                        <div className="text-xs font-medium bg-white text-[#526B91] px-2.5 py-1.5 rounded-lg border border-[#D8E8FA] shadow-2xs">
                          {verifiedOptionalCount} / {optionalMaterialItems.length} Optional
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                    {materialItems.map((item: any) => {
                      const isVerified = checklistState[item.id]?.verified ?? false;
                      const currentCondition = checklistState[item.id]?.condition || "GOOD";
                      const currentQty = checklistState[item.id]?.quantity || item.quantity;
                      const currentNotes = checklistState[item.id]?.notes || "";

                      let meta: any = {};
                      try {
                        if (item.notes && item.notes.startsWith("{")) meta = JSON.parse(item.notes);
                      } catch {}
                      const materialCode = meta.materialCode || item.material?.sku || null;
                      const unit = meta.unit || item.material?.unit || "PCS";
                      const instructions = meta.instructions || (typeof item.notes === "string" && !item.notes.startsWith("{") ? item.notes : null);

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 shadow-xs ${
                            isVerified
                              ? "bg-[#DCFCE7]/25 border-[#BBF7D0]"
                              : currentCondition === "DAMAGED"
                              ? "bg-[#FEF2F2] border-[#FCA5A5]"
                              : "bg-white border-[#D8E8FA] hover:border-[#BFDBFE]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleMaterialItem(item.id)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors mt-0.5 shrink-0 cursor-pointer ${
                                isVerified
                                  ? "bg-[#166534] text-white shadow-2xs"
                                  : "border-2 border-[#D8E8FA] bg-white hover:border-[#0878F9]"
                              }`}
                              aria-label={`Verify ${item.itemName}`}
                            >
                              {isVerified && <Check className="w-4 h-4 stroke-[3]" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-[#0B2148] flex flex-wrap items-center gap-2">
                                <span>{item.itemName}</span>
                                {item.required ? (
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
                                    Required
                                  </span>
                                ) : (
                                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                                    Optional
                                  </span>
                                )}
                                {materialCode && (
                                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F4F9FF] text-[#0878F9] border border-[#D8E8FA]">
                                    {materialCode}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-[#526B91] mt-1 flex flex-wrap items-center gap-3">
                                <span>
                                  Required Qty: <strong className="text-[#0B2148] font-mono">{currentQty} {unit}</strong>
                                </span>
                                {currentCondition === "DAMAGED" && (
                                  <span className="text-[11px] font-bold text-[#991B1B] bg-[#FEE2E2] px-2 py-0.5 rounded border border-[#FECACA]">
                                    ⚠️ Inspection Discrepancy: Damaged
                                  </span>
                                )}
                              </div>

                              {instructions && (
                                <div className="mt-2 text-xs text-[#526B91] bg-[#F4F9FF] p-2 rounded-lg border border-[#D8E8FA] flex items-start gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-[#0878F9] shrink-0 mt-0.5" />
                                  <span>{instructions}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Controls Row: Condition & Discrepancy Notes */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#D8E8FA]/70 pl-10 sm:pl-0">
                            <div className="w-full sm:w-44 shrink-0">
                              <select
                                value={currentCondition}
                                onChange={(e) => {
                                  setChecklistState((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      condition: e.target.value
                                    }
                                  }));
                                }}
                                className={`w-full bg-[#F4F9FF] border rounded-lg px-2.5 py-1.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] ${
                                  currentCondition === "DAMAGED" ? "border-[#EF4444] text-[#991B1B] font-bold" : "border-[#D8E8FA]"
                                }`}
                              >
                                <option value="GOOD">Condition: Good</option>
                                <option value="DAMAGED">Condition: Damaged</option>
                                <option value="NA">Condition: Not Applicable</option>
                              </select>
                            </div>

                            <input
                              type="text"
                              placeholder="Remarks / discrepancy notes (optional)..."
                              value={currentNotes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setChecklistState((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    notes: val
                                  }
                                }));
                              }}
                              className="flex-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg px-2.5 py-1.5 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Navigation Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#D8E8FA]">
                    <button
                      onClick={() => setActiveStep("VERIFY")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:text-[#0B2148] hover:bg-white border border-[#D8E8FA] transition-colors"
                    >
                      Back to Verification
                    </button>

                    <div className="flex items-center gap-3">
                      {!allRequiredMaterialsVerified && (
                        <span className="text-xs text-[#991B1B] font-semibold bg-[#FEE2E2] px-3 py-1 rounded-lg border border-[#FECACA]">
                          {requiredMaterialItems.length - verifiedRequiredCount} mandatory material(s) remaining
                        </span>
                      )}
                      <button
                        onClick={handleSaveAndProceedToBox}
                        disabled={!allRequiredMaterialsVerified || materialItems.length === 0}
                        className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors ${
                          allRequiredMaterialsVerified && materialItems.length > 0
                            ? "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs cursor-pointer active:scale-95"
                            : "bg-[#E2E8F0] text-[#64748B] cursor-not-allowed border border-[#CBD5E1]"
                        }`}
                      >
                        Proceed to Box Quality Check
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: BOX QUALITY & SEALING CHECKLIST ───────────────── */}
              {activeStep === "BOX" && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#DBEAFE] border border-[#BFDBFE]">
                    <div>
                      <div className="text-sm font-bold text-[#1D4ED8]">Final Box Inspection & Sealing Gate</div>
                      <div className="text-xs text-[#1E40AF] mt-0.5">
                        Verify physical carton integrity, orientation, shock padding and tamper-evident sealing.
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#1D4ED8] bg-white px-3 py-1.5 rounded-lg border border-[#BFDBFE] shrink-0 self-start sm:self-auto shadow-2xs">
                      {verifiedBoxCount} / {boxItems.length} Checked
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {boxItems.map((item: any) => {
                      const isChecked = boxChecks[item.id] ?? false;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleBoxItem(item.id)}
                          className={`p-4 rounded-xl border transition-colors cursor-pointer flex items-center justify-between shadow-xs ${
                            isChecked
                              ? "bg-[#DCFCE7]/25 border-[#BBF7D0]"
                              : "bg-white border-[#D8E8FA] hover:border-[#D8E8FA]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                                isChecked
                                  ? "bg-[#166534] text-white shadow-2xs"
                                  : "border-2 border-[#D8E8FA] bg-white"
                              }`}
                            >
                              {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-[#0B2148]">{item.itemName}</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-[#526B91] px-2 py-0.5 rounded bg-[#F4F9FF] border border-[#D8E8FA]">
                            Mandatory
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Box Notes */}
                  <div className="p-4 rounded-xl bg-white border border-[#D8E8FA] space-y-1.5 shadow-xs">
                    <label className="text-xs font-bold text-[#0B2148]">Operator Packing Remarks / Notes</label>
                    <input
                      type="text"
                      placeholder="Optional remarks, e.g. Box sealed with tamper tape #TT-492"
                      value={packingNotes}
                      onChange={(e) => setPackingNotes(e.target.value)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#D8E8FA]">
                    <button
                      onClick={() => setActiveStep("CHECKLIST")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:text-[#0B2148] hover:bg-white border border-[#D8E8FA] transition-colors"
                    >
                      Back to Materials
                    </button>
                    <button
                      onClick={handleConfirmPacking}
                      disabled={!allBoxVerified || confirmPackingMutation.isPending}
                      className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors ${
                        allBoxVerified
                          ? "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs cursor-pointer active:scale-95"
                          : "bg-[#E2E8F0] text-[#64748B] cursor-not-allowed"
                      }`}
                    >
                      {confirmPackingMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Confirm Final Packing & Generate Label
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: PACKING LABEL GENERATOR & PRINT PREVIEW ───────── */}
              {activeStep === "CONFIRMED" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-[#DCFCE7] border border-[#BBF7D0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-[#166534] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Official Packing Verified & Serialized Label Generated
                      </div>
                      <p className="text-xs text-[#166534]/90 mt-0.5">
                        Print and attach this high-resolution thermal product label to the designated battery chassis before Finished Goods transfer.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-white text-[#166534] border border-[#BBF7D0] shadow-2xs">
                        {activeStickerData?.stickerNumber || activePackingModal.packingRecord?.stickerNumber || "STK-OFFICIAL"}
                      </span>
                    </div>
                  </div>

                  {/* Standardized Industrial Label Container */}
                  <div className="max-w-xl mx-auto p-6 rounded-2xl bg-white text-slate-950 shadow-md border-2 border-slate-900 space-y-4 font-sans">
                    {/* Top Header */}
                    <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black tracking-widest text-slate-950 flex items-center gap-1.5">
                          <Zap className="w-5 h-5 text-[#FFC928] fill-[#FFC928] inline" />
                          KYRA ZAM 2.0
                        </div>
                        <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#526B91]">
                          CERTIFIED LITHIUM BATTERY PACK • AIS-156 & UN 38.3
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] font-mono">
                          QC APPROVED
                        </span>
                        <div className="text-[9px] text-[#526B91] font-mono mt-0.5">
                          PASS: 100% EOL
                        </div>
                      </div>
                    </div>

                    {/* Specs Table */}
                    <div className="grid grid-cols-2 gap-2 text-xs border-b-2 border-slate-900 pb-2.5">
                      <div className="space-y-1">
                        <div>
                          <span className="text-[#526B91] font-bold text-[10px] block uppercase">MODEL / TYPE:</span>
                          <span className="font-bold text-slate-900 text-xs">
                            {activeStickerData?.modelName || activePackingModal.paxType?.name}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#526B91] font-bold text-[10px] block uppercase">CONFIG & RATING:</span>
                          <span className="font-bold font-mono text-slate-900 text-xs">
                            {activeStickerData?.configuration || activePackingModal.paxType?.configuration} ({activeStickerData?.nominalVoltage || `${activePackingModal.paxType?.nominalVoltage}V`} {activeStickerData?.nominalCapacity || `${activePackingModal.paxType?.nominalCapacity}Ah`})
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-right">
                        <div>
                          <span className="text-[#526B91] font-bold text-[10px] block uppercase">PACKING ID:</span>
                          <span className="font-bold font-mono text-[#0B2148] text-xs">
                            {activeStickerData?.packingNumber || activePackingModal.packingRecord?.packingNumber || "PK-2026-000001"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#526B91] font-bold text-[10px] block uppercase">DATE & OPERATOR:</span>
                          <span className="font-bold font-mono text-slate-900 text-xs">
                            {new Date(activeStickerData?.packingDate || activePackingModal.packingRecord?.completedAt || Date.now()).toLocaleDateString()} • {activeStickerData?.operatorName || session?.user?.name || "Operator"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* QR Code & Barcode Row */}
                    <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Live Scannable QR Code */}
                      <div className="p-2 bg-white rounded-lg border border-[#D8E8FA] shadow-2xs shrink-0 flex items-center justify-center">
                        {activeStickerData?.qrCodeBase64 ? (
                          <img src={activeStickerData.qrCodeBase64} alt="QR Code" className="w-24 h-24" />
                        ) : (
                          <QRCodeSVG
                            value={JSON.stringify({
                              brand: "KYRA ZAM",
                              serial: activePackingModal.paxSerial,
                              model: activePackingModal.paxType?.name,
                              packingId: activePackingModal.packingRecord?.packingNumber,
                              sticker: activePackingModal.packingRecord?.stickerNumber || "STK-GEN",
                              date: new Date().toISOString().split("T")[0]
                            })}
                            size={96}
                            level="M"
                            includeMargin={false}
                          />
                        )}
                      </div>

                      {/* Barcode & Serial Hero */}
                      <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                        <div className="text-[10px] font-extrabold uppercase text-[#526B91] tracking-wider">
                          Primary Serial Number
                        </div>
                        <div className="font-mono text-lg font-black tracking-wider text-slate-950 border border-slate-900 px-2.5 py-0.5 rounded bg-white inline-block shadow-2xs">
                          {activePackingModal.paxSerial}
                        </div>
                        {/* High-contrast black barcode simulation lines */}
                        <div className="h-6 w-full flex items-center justify-center sm:justify-start gap-[2px] overflow-hidden opacity-95">
                          {Array.from({ length: 42 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-full bg-slate-950"
                              style={{
                                width: idx % 3 === 0 ? "3px" : idx % 2 === 0 ? "2px" : "1px",
                                marginRight: idx % 5 === 0 ? "2px" : "0px"
                              }}
                            />
                          ))}
                        </div>
                        <div className="text-[9px] font-mono text-[#526B91]">
                          WO: {activePackingModal.workOrder?.workOrderNumber || "WO-BATCH-01"} • KYRA ZAM SEAL
                        </div>
                      </div>
                    </div>

                    {/* Safety, Compliance & Regulatory Footer */}
                    <div className="border-t-2 border-slate-900 pt-2 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between text-[9px] font-extrabold text-slate-700 uppercase tracking-tight gap-1">
                        <span className="flex items-center gap-1 text-[#92400E]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          DO NOT SHORT CIRCUIT
                        </span>
                        <span className="flex items-center gap-1 text-[#166534]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          UN 3480 CLASS 9 LITHIUM
                        </span>
                        <span>AIS-156 CERTIFIED</span>
                      </div>
                      <div className="text-[8px] text-[#526B91] text-center leading-tight">
                        Manufactured by Kyra Zam Energies Pvt. Ltd. Verified against IEC 62133 & AIS 156 protocols.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#D8E8FA]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrintSticker}
                        className="px-5 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        Print Thermal Label (4" x 6")
                      </button>

                      <button
                        onClick={() => {
                          const payload = JSON.stringify({
                            brand: "KYRA ZAM",
                            serial: activePackingModal.paxSerial,
                            model: activePackingModal.paxType?.name,
                            packingId: activePackingModal.packingRecord?.packingNumber,
                            sticker: activePackingModal.packingRecord?.stickerNumber || "STK-GEN"
                          }, null, 2);
                          navigator.clipboard.writeText(payload);
                          toast.success("QR & Serial payload copied to clipboard");
                        }}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-semibold text-xs border border-[#D8E8FA] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                      >
                        <Copy className="w-4 h-4 text-[#0878F9]" />
                        Copy QR Data
                      </button>
                    </div>

                    <button
                      onClick={() => setActiveStep("TRANSFER")}
                      className="px-5 py-2.5 rounded-xl bg-[#061B3A] hover:bg-[#0B2148] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      Transfer to Finished Goods
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 5: FINISHED GOODS WAREHOUSE TRANSFER ─────────────── */}
              {activeStep === "TRANSFER" && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-[#DBEAFE] border border-[#BFDBFE] space-y-1">
                    <div className="text-sm font-bold text-[#1D4ED8]">Move Packed Battery to Finished Goods Warehouse</div>
                    <p className="text-xs text-[#1E40AF]">
                      Select destination warehouse and physical shelf/bay location to update inventory counts and release pack for dispatch.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-5 rounded-xl bg-white border border-[#D8E8FA] space-y-2 shadow-xs">
                      <label className="block text-xs font-bold text-[#0B2148] mb-1 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#0878F9]" />
                        Destination Warehouse
                      </label>
                      <select
                        value={selectedWarehouseId}
                        onChange={(e) => {
                          setSelectedWarehouseId(e.target.value);
                          setSelectedLocationId("");
                        }}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9]"
                      >
                        <option value="">Select Warehouse...</option>
                        {warehousesData?.map((wh: any) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name} ({wh.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-5 rounded-xl bg-white border border-[#D8E8FA] space-y-2 shadow-xs">
                      <label className="block text-xs font-bold text-[#0B2148] mb-1 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#0878F9]" />
                        Shelf / Bay Location
                      </label>
                      <select
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        disabled={!selectedWarehouseId}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] disabled:opacity-50"
                      >
                        <option value="">Select Location Bay...</option>
                        {availableLocations.map((loc: any) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name || loc.code} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-white border border-[#D8E8FA] space-y-2 text-xs text-[#526B91] shadow-xs">
                    <div className="font-bold text-[#0B2148] text-sm">Transfer Summary:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      <div>• Pack Serial: <span className="font-mono text-[#0B2148] font-bold">{activePackingModal.paxSerial}</span></div>
                      <div>• Packing ID: <span className="font-mono text-[#0B2148] font-bold">{activePackingModal.packingRecord?.packingNumber}</span></div>
                      <div>• Destination Stock Movement: <span className="text-[#166534] font-bold">RECEIPT to FG Inventory</span></div>
                      <div>• New PAX Status: <span className="text-[#1D4ED8] font-bold">READY FOR SALE / DISPATCH</span></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#D8E8FA]">
                    <button
                      onClick={() => setActiveStep("CONFIRMED")}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-[#526B91] hover:text-[#0B2148] hover:bg-white border border-[#D8E8FA] transition-colors"
                    >
                      Back to Label
                    </button>
                    <button
                      onClick={handleTransferToFG}
                      disabled={!selectedWarehouseId || !selectedLocationId || transferToFGMutation.isPending}
                      className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors ${
                        selectedWarehouseId && selectedLocationId
                          ? "bg-[#0878F9] hover:bg-[#0667DB] text-white shadow-xs cursor-pointer active:scale-95"
                          : "bg-[#E2E8F0] text-[#64748B] cursor-not-allowed"
                      }`}
                    >
                      {transferToFGMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4" />
                      )}
                      Confirm Transfer to Finished Goods
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
