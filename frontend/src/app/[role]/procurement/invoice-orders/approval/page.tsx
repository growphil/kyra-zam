"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  Building2,
  Calendar,
  Loader2,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AdminApprovalQueuePage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = (params.role as string) || "admin";

  useEffect(() => {
    if (roleSlug === "inventory-manager") {
      router.replace(`/${roleSlug}/procurement/purchase-orders`);
    }
  }, [roleSlug, router]);

  if (roleSlug === "inventory-manager") {
    return null;
  }

  const { data: queueData, isLoading } = useQuery({
    queryKey: ["procurement-io-pending-approval"],
    queryFn: async () => {
      const res = await api.get("/crm/procurement/invoice-orders/pending-approval");
      return res.data?.items || [];
    },
  });

  return (
    <div className="space-y-5 max-w-[1500px] mx-auto pb-12">
      <PageHeader
        title="Admin Invoice Order Approval Queue"
        description="Final authorization queue: Review physical verification counts, financial terms, and approve inward goods for usable stock posting"
        icon={<CheckCircle2 className="w-5 h-5 text-purple-600" />}
        breadcrumbs={[
          { label: "Procurement", href: `/${roleSlug}/procurement/purchase-orders` },
          { label: "Invoice Orders", href: `/${roleSlug}/procurement/invoice-orders` },
          { label: "Approval Queue" },
        ]}
      />

      <div className="rounded-2xl border border-[#D8E8FA] bg-white overflow-hidden p-5 shadow-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin" />
            <span className="text-xs text-[#526B91]">Loading approval queue...</span>
          </div>
        ) : !queueData || queueData.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="text-sm font-semibold text-[#0B2148]">No Pending Approvals</div>
            <p className="text-xs text-[#526B91] max-w-sm mx-auto">
              All physically verified invoice orders have been authorized or reviewed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueData.map((io: any) => (
              <div
                key={io.id}
                className="p-4 rounded-xl border border-[#D8E8FA] hover:border-purple-400 bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-4 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#0878F9]">{io.ioNumber}</span>
                    <span className="text-xs font-semibold text-slate-800">PO: {io.purchaseOrder?.poNumber}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      AWAITING AUTHORIZATION
                    </span>
                  </div>
                  <div className="text-xs text-[#526B91] flex items-center gap-3">
                    <span>Vendor: <strong className="text-[#0B2148]">{io.vendor?.name}</strong></span>
                    <span>Total: <strong className="font-mono text-[#0B2148]">{io.purchaseOrder?.currency} {Number(io.purchaseOrder?.grandTotal).toLocaleString()}</strong></span>
                    <span>Verified By: <strong>{io.inventoryVerifiedBy?.name || "Pending Verification"}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/${roleSlug}/procurement/invoice-orders/${io.id}`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  <span>Review & Authorize</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

