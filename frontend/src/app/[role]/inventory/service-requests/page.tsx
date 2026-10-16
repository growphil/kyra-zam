"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Loader2, 
  RefreshCcw,
  X,
  CheckCircle2,
  ClipboardList,
  Check,
  Ban,
  PackageCheck
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface MaterialRequest {
  id: string;
  serviceBatteryId: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    material: {
      name: string;
      unit: string;
    }
  }[];
  serviceBattery: {
    serviceId: string;
    customerName: string;
  };
}

export default function ServiceRequestsPage() {
  const { data: session } = useSession();
  
  const userRoles = (session?.user as any)?.roles || [];
  const isAdmin = userRoles.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));
  const isInventoryManager = userRoles.includes("INVENTORY_MANAGER");
  const canManageRequests = isAdmin || isInventoryManager;

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => { setMounted(true); }, []);

  // Fetch Material Requests
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["service-material-requests"],
    queryFn: async () => {
      const res = await api.get("/service/material-request");
      return res.data;
    },
    enabled: mounted,
  });

  // Mutations
  const updateRequestStatusMutation = useMutation({
    mutationFn: (data: { id: string, status: string }) => 
      api.patch(`/service/material-request/${data.id}`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-material-requests"] });
      toast.success("Request status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Operation failed")
  });

  if (!mounted) return null;

  const filteredRequests = (requests || []).filter((req: MaterialRequest) => {
    return req.serviceBattery.serviceId.toLowerCase().includes(search.toLowerCase()) || 
      req.serviceBattery.customerName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#0B2148] flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-accent" />
            Material Requests (Service)
          </h1>
          <p className="text-xs text-[#526B91] mt-1 uppercase tracking-widest font-bold">Approve & Issue Components</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="p-2.5 bg-[#F4F9FF] hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 border border-[#D8E8FA] rounded-xl text-[#526B91] hover:text-white transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Service ID or Customer..." 
            className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 pl-12 pr-4 text-sm focus:border-accent/30 focus:outline-none transition-all placeholder:text-slate-700" 
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-[#D8E8FA]">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Loading Requests...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F9FF] border-b border-[#D8E8FA]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Service ID</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Materials</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91]">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#526B91] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8F1FC]">
              {filteredRequests.map((req: MaterialRequest) => (
                <tr key={req.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148] group-hover:text-[#0B2148] transition-colors">{req.serviceBattery.serviceId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-[#0B2148]">{req.serviceBattery.customerName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {req.items.map(item => (
                        <span key={item.id} className="text-xs text-[#526B91]">
                          {item.material.name} x {item.quantity} {item.material.unit}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                      req.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      req.status === "APPROVED" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                      req.status === "ISSUED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {req.status === "PENDING" && canManageRequests && (
                        <>
                          <button 
                            onClick={() => updateRequestStatusMutation.mutate({ id: req.id, status: "APPROVED" })}
                            className="p-2 rounded-lg hover:bg-emerald-500/10 text-[#526B91] hover:text-emerald-400 transition-all"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => updateRequestStatusMutation.mutate({ id: req.id, status: "REJECTED" })}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-[#526B91] hover:text-red-400 transition-all"
                            title="Reject"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {req.status === "APPROVED" && canManageRequests && (
                        <button 
                          onClick={() => updateRequestStatusMutation.mutate({ id: req.id, status: "ISSUED" })}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          Issue Materials
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
