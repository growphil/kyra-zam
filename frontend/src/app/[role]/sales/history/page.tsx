"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ClipboardList, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  CheckCircle2, 
  FileText,
  Truck,
  DollarSign,
  Package,
  ArrowUpRight
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function SalesHistoryPortalPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Fetch sales history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["sales-history-list", search, page],
    queryFn: async () => {
      const res = await api.get("/sales/history", {
        params: { search: search || undefined, page, limit: 15 }
      });
      return res.data;
    }
  });

  const sales = historyData?.sales || [];
  const totalCount = historyData?.total || 0;
  const totalPages = Math.ceil(totalCount / 15) || 1;

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      {/* Page Header */}
      <PageHeader
        title="Sales History"
        description="Comprehensive audit ledger of Finished Goods sales, payment verifications & warranty activations"
        icon={<ClipboardList className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Sales", href: `/${roleSlug}/sales` },
          { label: "Sales History" }
        ]}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search serial, customer, model..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-[#0878F9] transition-all"
            />
          </div>
        }
      />

      {/* Main Table Surface */}
      <div className="bg-white rounded-2xl border border-[#D8E8FA] overflow-hidden shadow-xs flex flex-col">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-[#526B91]">
              <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
              <p className="text-xs font-semibold">Loading sales history...</p>
            </div>
          ) : sales.length > 0 ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">Battery Serial</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Customer / Channel</th>
                  <th className="px-4 py-3">Sales Order</th>
                  <th className="px-4 py-3">Dispatch Order</th>
                  <th className="px-4 py-3">Warranty Code</th>
                  <th className="px-4 py-3">Sold At</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {sales.map((s: any) => (
                  <tr key={s.saleId} className="hover:bg-[#F4F9FF] transition-colors">
                    {/* Battery Serial */}
                    <td className="px-4 py-3 font-mono font-bold text-[#0B2148]">
                      {s.paxSerial}
                    </td>

                    {/* Model */}
                    <td className="px-4 py-3 font-semibold text-[#526B91]">
                      {s.paxTypeName}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#0B2148] block">
                        {s.customerName}
                      </span>
                      {s.vendorName && (
                        <span className="text-[10px] text-[#526B91] block">
                          Vendor: {s.vendorName}
                        </span>
                      )}
                    </td>

                    {/* Sales Order */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#0B2148]">
                        {s.salesOrderNumber || "-"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 ml-1.5 inline-block">
                        {s.paymentStatus || "PAID"}
                      </span>
                    </td>

                    {/* Dispatch Order */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#526B91]">
                        {s.dispatchNumber || "-"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 ml-1.5 inline-block">
                        {s.dispatchStatus || "DELIVERED"}
                      </span>
                    </td>

                    {/* Warranty Code */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#0878F9]">
                        {s.warrantyNumber || "-"}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 ml-1.5 inline-block">
                        ACTIVE
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 font-mono text-xs text-[#526B91]">
                      {new Date(s.soldAt || s.createdAt).toLocaleDateString()}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#0B2148]">
                      ₹{Number(s.amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-[#526B91]">
              <Package className="w-10 h-10 mb-3 text-[#526B91]/40" />
              <p className="text-sm font-semibold text-[#0B2148]">No Sales Transactions Found</p>
              <p className="text-xs text-[#526B91] mt-0.5">
                Completed Finished Goods direct sales will appear in this ledger.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCount > 15 && (
          <div className="p-4 border-t border-[#D8E8FA] flex items-center justify-between text-xs text-[#526B91]">
            <p>
              Showing Page <span className="font-bold text-[#0B2148]">{page}</span> of <span className="font-bold text-[#0B2148]">{totalPages}</span> ({totalCount} Sales Recorded)
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 border border-[#D8E8FA] rounded-lg text-[#0B2148] hover:bg-[#F4F9FF] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-bold text-[#0B2148]">{page} / {totalPages}</span>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 bg-[#0878F9] hover:bg-[#0667DB] rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
