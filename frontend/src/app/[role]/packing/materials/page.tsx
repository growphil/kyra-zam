"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Layers,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";

export default function PackingMaterialsConfigPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const roleSlug = (params?.role as string) || "packing";

  const [selectedPaxTypeId, setSelectedPaxTypeId] = useState<string>("");
  const [materialList, setMaterialList] = useState<
    Array<{ name: string; quantity: number; isRequired: boolean; notes: string }>
  >([]);

  // 1. Fetch Pax Types
  const { data: paxTypesData, isLoading: loadingPaxTypes } = useQuery({
    queryKey: ["pax-types-list"],
    queryFn: async () => {
      const res = await api.get("/cells/pax-types");
      if (res.data && res.data.length > 0 && !selectedPaxTypeId) {
        setSelectedPaxTypeId(res.data[0].id);
      }
      return res.data;
    }
  });

  // 2. Fetch Config for selected Pax Type
  const { data: configsData, isLoading: loadingConfigs } = useQuery({
    queryKey: ["packing-material-configs", selectedPaxTypeId],
    queryFn: async () => {
      if (!selectedPaxTypeId) return [];
      const res = await api.get(`/packing/materials/config?paxTypeId=${selectedPaxTypeId}`);
      const data = res.data || [];
      setMaterialList(
        data.map((d: any) => ({
          name: d.name,
          quantity: d.quantity || 1,
          isRequired: d.isRequired ?? true,
          notes: d.notes || ""
        }))
      );
      return data;
    },
    enabled: !!selectedPaxTypeId
  });

  // 3. Save Config Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post("/packing/materials/config", {
          paxTypeId: selectedPaxTypeId,
          materials: materialList
        })
      ).data;
    },
    onSuccess: () => {
      toast.success("Packing materials configuration saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["packing-material-configs", selectedPaxTypeId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to save configuration");
    }
  });

  const handleAddItem = () => {
    setMaterialList((prev) => [
      ...prev,
      { name: "New Packaging Component", quantity: 1, isRequired: true, notes: "" }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setMaterialList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setMaterialList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto text-[#0B2148] pb-16">
      <PageHeader
        title="Packing Material Configurator"
        subtitle="Define required accessories, cables, manuals, chargers and protective foam sets per battery model."
        icon={<Layers className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={
          <button
            onClick={() => router.push(`/${roleSlug}/packing`)}
            className="flex items-center gap-1.5 text-xs text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Station
          </button>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddItem}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/30 text-[#0B2148] font-semibold text-xs border border-[#D8E8FA] flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#0878F9]" />
              Add Component
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Configuration
            </button>
          </div>
        }
      />

      {/* Model Selector */}
      <div className="p-4 rounded-xl bg-white border border-[#D8E8FA] shadow-xs space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#526B91] flex items-center gap-2">
          <Package className="w-4 h-4 text-[#0878F9]" />
          Select Target Battery Pack Model (PaxType)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {paxTypesData?.map((pt: any) => {
            const isSelected = selectedPaxTypeId === pt.id;
            return (
              <button
                key={pt.id}
                type="button"
                onClick={() => setSelectedPaxTypeId(pt.id)}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#EAF5FF] border-[#0878F9] text-[#0878F9] shadow-xs"
                    : "bg-[#F4F9FF] border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-white"
                }`}
              >
                <div className="font-bold text-xs">{pt.name}</div>
                <div className="text-[11px] text-[#526B91] mt-0.5">
                  {pt.configuration} • {pt.nominalVoltage}V {pt.nominalCapacity}Ah
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials List */}
      <div className="rounded-xl border border-[#D8E8FA] p-5 space-y-4 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D8E8FA] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#0B2148]">Configured Packaging Items</h2>
            <p className="text-xs text-[#526B91]">
              The packing checklist dynamically verifies these items during pack processing.
            </p>
          </div>
          <span className="text-xs text-[#526B91] bg-[#F4F9FF] px-2.5 py-1 rounded-lg border border-[#D8E8FA]">
            {materialList.length} items configured
          </span>
        </div>

        {loadingConfigs ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#0878F9] animate-spin mx-auto" />
          </div>
        ) : materialList.length === 0 ? (
          <div className="p-12 text-center text-[#526B91] text-xs space-y-2">
            <Package className="w-8 h-8 mx-auto text-[#526B91]" />
            <div>No custom packing materials configured for this model yet.</div>
            <button
              onClick={handleAddItem}
              className="px-3.5 py-1.5 rounded-lg bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Component
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {materialList.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#D8E8FA] flex flex-col md:flex-row md:items-center gap-3 justify-between"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(idx, "name", e.target.value)}
                      placeholder="e.g. Fast Battery Charger"
                      className="flex-1 bg-white border border-[#D8E8FA] rounded-lg px-3 py-1.5 text-xs text-[#0B2148] font-semibold focus:outline-none focus:border-[#0878F9]"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#526B91]">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItem(idx, "quantity", parseInt(e.target.value, 10) || 1)
                        }
                        className="w-14 bg-white border border-[#D8E8FA] rounded-lg px-2 py-1.5 text-xs text-center text-[#0B2148] font-bold focus:outline-none focus:border-[#0878F9]"
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => handleUpdateItem(idx, "notes", e.target.value)}
                    placeholder="Instructions / specs for operator, e.g. 54.6V 5A fast charger with XT60 connector"
                    className="w-full bg-white border border-[#D8E8FA] rounded-lg px-3 py-1 text-xs text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:border-[#0878F9]"
                  />
                </div>

                <div className="flex items-center gap-4 justify-between md:justify-end pt-2 md:pt-0">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isRequired}
                      onChange={(e) => handleUpdateItem(idx, "isRequired", e.target.checked)}
                      className="rounded accent-[#0878F9] w-4 h-4 cursor-pointer"
                    />
                    <span className={item.isRequired ? "text-[#0B2148]" : "text-[#526B91]"}>
                      Mandatory
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 rounded-lg text-[#526B91] hover:text-[#991B1B] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                    title="Remove Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
