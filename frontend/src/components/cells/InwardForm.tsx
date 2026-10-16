"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Plus, Battery, Info } from "lucide-react";

const inwardSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  batchNumber: z.string().optional(),
  voltage: z.number().min(0, "Voltage must be positive"),
  category: z.string().min(1, "Category is required"),
  cycles: z.number().int().min(0, "Cycles must be positive"),
});

type InwardFormData = z.infer<typeof inwardSchema>;

export default function InwardForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InwardFormData>({
    resolver: zodResolver(inwardSchema),
    defaultValues: {
      cycles: 0,
      voltage: 3.2,
      category: "LFP 3.2V",
    }
  });

  const onSubmit = async (data: InwardFormData) => {
    setLoading(true);
    try {
      await api.post("/cells/inward", data);
      toast.success(`Cell ${data.serialNumber} inwarded successfully`);
      reset();
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to inward cell");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center border border-accent/30 text-accent">
          <Battery className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-[#0B2148]">Manual Cell Inward</h2>
          <p className="text-sm text-[#526B91]">Register a new cell into the system manually.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#526B91] ml-1">Serial Number</label>
            <input
              {...register("serialNumber")}
              placeholder="e.g. CELL-12345"
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:border-accent/50 transition-all"
            />
            {errors.serialNumber && <p className="text-xs text-red-400 mt-1">{errors.serialNumber.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#526B91] ml-1">Batch Number</label>
            <input
              {...register("batchNumber")}
              placeholder="e.g. BATCH-2026-05"
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#526B91] ml-1">Voltage (V)</label>
            <input
              type="number"
              step="0.01"
              {...register("voltage", { valueAsNumber: true })}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:border-accent/50 transition-all"
            />
            {errors.voltage && <p className="text-xs text-red-400 mt-1">{errors.voltage.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#526B91] ml-1">Category / Type</label>
            <select
              {...register("category")}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] focus:outline-none focus:border-[#0878F9] transition-all"
            >
              <option value="LFP 3.2V" className="bg-white text-[#0B2148]">LFP 3.2V</option>
              <option value="NMC 3.7V" className="bg-white text-[#0B2148]">NMC 3.7V</option>
              <option value="LTO 2.4V" className="bg-white text-[#0B2148]">LTO 2.4V</option>
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-widest text-[#526B91] ml-1">Initial Cycles</label>
            <input
              type="number"
              {...register("cycles", { valueAsNumber: true })}
              className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-3 px-4 text-[#0B2148] placeholder:text-[#64748B] focus:outline-none focus:border-[#0878F9] transition-all"
            />
            {errors.cycles && <p className="text-xs text-red-500 mt-1">{errors.cycles.message}</p>}
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> <span>Add Cell to Inventory</span></>}
          </button>
        </div>
      </form>

      <div className="mt-8 flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-400/80 leading-relaxed">
          Newly inwarded cells are marked as <span className="font-bold text-blue-300">RAW</span>. They must undergo AH/IR testing before being assigned to a PAX pack.
        </p>
      </div>
    </div>
  );
}
