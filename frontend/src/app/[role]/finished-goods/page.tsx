"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Package, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight,
  ShieldCheck, 
  CheckCircle2, 
  QrCode, 
  Sparkles,
  Zap,
  Info,
  DollarSign,
  ShoppingCart,
  ScanLine,
  AlertTriangle,
  Building2,
  MapPin
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";

export default function FinishedGoodsPortalPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [scanSerial, setScanSerial] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  // Fetch Finished Goods from dedicated endpoint
  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ["sales-finished-goods-list", search, page],
    queryFn: async () => {
      const res = await api.get("/sales/finished-goods", {
        params: { search: search || undefined, page, limit: 12 }
      });
      return res.data;
    }
  });

  const packs = listData?.packs || [];
  const totalCount = listData?.total || 0;
  const totalPages = Math.ceil(totalCount / 12) || 1;

  // Real-time barcode / serial scan verification
  const handleVerifyScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanSerial.trim()) {
      toast.error("Please enter or scan a serial number / QR code");
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    try {
      const res = await api.get(`/sales/finished-goods/verify/${encodeURIComponent(scanSerial.trim())}`);
      setScanResult(res.data);
      if (res.data.eligible) {
        toast.success(`Pack ${res.data.pack.paxSerial} is eligible for sale!`);
      }
    } catch (err: any) {
      const data = err.response?.data;
      setScanResult({
        eligible: false,
        reason: data?.reason || "Battery pack is not eligible for sale in Finished Goods.",
        code: data?.code || "NOT_ELIGIBLE"
      });
      toast.error(data?.reason || "Pack is not eligible for sale");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      {/* Page Header */}
      <PageHeader
        title="Finished Goods Warehouse"
        description="QC-approved, packed & transferred battery packs ready for immediate commercial sale"
        icon={<Package className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Sales", href: `/${roleSlug}/sales` },
          { label: "Finished Goods" }
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/${roleSlug}/sales/new`)}
              className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              New Sale Workflow
            </button>
          </div>
        }
      />

      {/* Top Scanner & Quick Verification Strip */}
      <div className="bg-white rounded-2xl border border-[#D8E8FA] p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] flex-shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0B2148]">Barcode & Serial Scanner</h3>
              <p className="text-[11px] text-[#526B91]">
                Scan QR sticker or type serial to verify Finished Goods eligibility before selling
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyScan} className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <QrCode className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Scan or enter Serial / Sticker (e.g. PAX-2026-0004)..."
                value={scanSerial}
                onChange={(e) => setScanSerial(e.target.value)}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2 text-xs font-mono font-bold text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-[#0878F9] transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isScanning || !scanSerial.trim()}
              className="px-4 py-2 bg-[#061B3A] hover:bg-[#0B2148] text-white text-xs font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer flex-shrink-0"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-[#0878F9]" />}
              Verify
            </button>
          </form>
        </div>

        {/* Scan Verification Result Feedback */}
        {scanResult && (
          <div className="mt-3 pt-3 border-t border-[#E8F1FC]">
            {scanResult.eligible ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-900">
                      Eligible for Sale: <span className="font-mono">{scanResult.pack.paxSerial}</span> — {scanResult.pack.model}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Configured Price: ₹{scanResult.pack.configuredSellingPrice?.toLocaleString("en-IN")} • Location: {scanResult.pack.packing?.warehouseCode || "WH-FG"} ({scanResult.pack.packing?.locationCode || "FG-STG01"})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/${roleSlug}/sales/new?serial=${scanResult.pack.paxSerial}`)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer self-start md:self-auto"
                >
                  Sell This Battery
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-900">Cannot Sell This Battery</p>
                  <p className="text-[11px] text-rose-700">{scanResult.reason}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search and Filter Strip */}
      <div className="bg-white rounded-2xl border border-[#D8E8FA] p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Finished Goods (Serial, Model, Sticker)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-[#0878F9] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-[#526B91]">
          <span className="font-semibold text-[#0B2148]">{totalCount}</span> Available Ready Packs in Warehouse
        </div>
      </div>

      {/* Main Inventory Cards Grid */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#526B91]">
          <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
          <p className="text-xs font-semibold">Loading Finished Goods buffer...</p>
        </div>
      ) : packs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((p: any) => (
            <div
              key={p.paxSerial}
              className="bg-white rounded-2xl border border-[#D8E8FA] hover:border-[#0878F9]/50 transition-all p-5 shadow-xs flex flex-col justify-between group"
            >
              <div>
                {/* Header badge & status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="font-mono text-sm font-bold text-[#0B2148] tracking-tight block">
                      {p.paxSerial}
                    </span>
                    <span className="text-xs font-semibold text-[#526B91] mt-0.5 block">
                      {p.model}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    READY FOR SALE
                  </span>
                </div>

                {/* Warehouse Location Info */}
                <div className="p-2.5 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl flex items-center justify-between text-xs text-[#526B91] mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0878F9]" />
                    <span className="text-[11px] font-medium text-[#0B2148]">
                      {p.packing?.warehouseName || "Finished Goods Warehouse"}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-white border border-[#D8E8FA] rounded text-[#061B3A]">
                    {p.packing?.locationCode || "FG-STG01"}
                  </span>
                </div>

                {/* Specifications Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="p-2 bg-white rounded-lg border border-[#E8F1FC]">
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Voltage / Cap</p>
                    <p className="font-mono font-bold text-[#0B2148] mt-0.5">
                      {p.specifications?.nominalVoltage}V • {p.specifications?.nominalCapacity}Ah
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-[#E8F1FC]">
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Config / Chem</p>
                    <p className="font-mono font-bold text-[#0B2148] mt-0.5">
                      {p.specifications?.configuration} • {p.specifications?.cellChemistry}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-[#E8F1FC]">
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Avg Capacity</p>
                    <p className="font-mono font-bold text-[#0B2148] mt-0.5">
                      {p.specifications?.avgAh} Ah
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-[#E8F1FC]">
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-semibold">Sticker Barcode</p>
                    <p className="font-mono font-bold text-[#0B2148] mt-0.5 truncate">
                      {p.packing?.stickerNumber || "STK-VERIFIED"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price & Action footer */}
              <div className="pt-3 border-t border-[#E8F1FC] flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Selling Price</p>
                  <p className="font-mono text-base font-bold text-[#0878F9]">
                    ₹{p.configuredSellingPrice ? Number(p.configuredSellingPrice).toLocaleString("en-IN") : "0.00"}
                  </p>
                </div>

                <button
                  onClick={() => router.push(`/${roleSlug}/sales/new?serial=${p.paxSerial}`)}
                  className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer group-hover:scale-102"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Sell Pack
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#D8E8FA] p-16 text-center text-[#526B91]">
          <Package className="w-12 h-12 mx-auto mb-3 text-[#526B91]/40" />
          <h4 className="text-sm font-bold text-[#0B2148]">No Finished Battery Packs Found</h4>
          <p className="text-xs text-[#526B91] mt-1 max-w-md mx-auto">
            Only fully assembled, QC-passed, packed and officially transferred battery packs in the Finished Goods warehouse appear here.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalCount > 12 && (
        <div className="bg-white rounded-2xl border border-[#D8E8FA] p-4 flex items-center justify-between text-xs text-[#526B91]">
          <p>
            Showing Page <span className="font-bold text-[#0B2148]">{page}</span> of <span className="font-bold text-[#0B2148]">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 border border-[#D8E8FA] rounded-lg hover:bg-[#F4F9FF] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-[#0B2148]" />
            </button>
            <span className="font-mono font-bold text-[#0B2148]">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 bg-[#0878F9] text-white rounded-lg hover:bg-[#0667DB] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
