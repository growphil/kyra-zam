"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShieldCheck, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Calendar,
  Package,
  User,
  ArrowUpRight
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function WarrantyRecordsPortalPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Fetch warranties registry
  const { data: warranties = [], isLoading } = useQuery({
    queryKey: ["seller-warranties-list"],
    queryFn: async () => {
      const res = await api.get("/crm/warranty/warranties");
      return res.data || [];
    }
  });

  const filtered = warranties.filter((w: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      w.warrantyNumber?.toLowerCase().includes(q) ||
      w.paxSerial?.toLowerCase().includes(q) ||
      w.customer?.name?.toLowerCase().includes(q)
    );
  });

  const pageSize = 15;
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-8">
      {/* Page Header */}
      <PageHeader
        title="Warranty Records"
        description="Active warranty certificates, policy coverage timelines and customer battery registrations"
        icon={<ShieldCheck className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Sales", href: `/${roleSlug}/sales` },
          { label: "Warranty Records" }
        ]}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search warranty code, serial, customer..."
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
              <p className="text-xs font-semibold">Loading warranty certificates...</p>
            </div>
          ) : paginated.length > 0 ? (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="px-4 py-3">Warranty Code</th>
                  <th className="px-4 py-3">Battery Pack Serial</th>
                  <th className="px-4 py-3">Registered Customer</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Coverage Start</th>
                  <th className="px-4 py-3">Coverage Expiry</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                {paginated.map((w: any) => (
                  <tr key={w.id || w.warrantyNumber} className="hover:bg-[#F4F9FF] transition-colors">
                    {/* Warranty Code */}
                    <td className="px-4 py-3 font-mono font-bold text-[#0878F9]">
                      {w.warrantyNumber}
                    </td>

                    {/* Serial */}
                    <td className="px-4 py-3 font-mono font-bold text-[#0B2148]">
                      {w.paxSerial}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3 font-semibold text-[#0B2148]">
                      {w.customer?.name || "Direct Customer"}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 font-mono text-xs text-[#526B91]">
                      {w.warrantyDurationMonths || 12} Months
                    </td>

                    {/* Start Date */}
                    <td className="px-4 py-3 font-mono text-xs text-[#526B91]">
                      {w.warrantyStartDate ? new Date(w.warrantyStartDate).toLocaleDateString() : "-"}
                    </td>

                    {/* End Date */}
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0B2148]">
                      {w.warrantyEndDate ? new Date(w.warrantyEndDate).toLocaleDateString() : "-"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {w.status || "ACTIVE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-[#526B91]">
              <ShieldCheck className="w-10 h-10 mb-3 text-[#526B91]/40" />
              <p className="text-sm font-semibold text-[#0B2148]">No Warranty Records Found</p>
              <p className="text-xs text-[#526B91] mt-0.5">
                Warranties activated on Finished Goods sales handover will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > pageSize && (
          <div className="p-4 border-t border-[#D8E8FA] flex items-center justify-between text-xs text-[#526B91]">
            <p>
              Showing Page <span className="font-bold text-[#0B2148]">{page}</span> of <span className="font-bold text-[#0B2148]">{totalPages}</span> ({filtered.length} Total Warranties)
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
